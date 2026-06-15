/**
 * Explorer Agent Commands API
 *
 * GET /api/agent/commands?extensionId=xxx&taskId=yyy
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import type { Prisma } from '@prisma/client';
import {
  getTaskWithCompany,
  type Discovery,
} from '@/lib/db/explorer';
import {
  decideNextAction,
  decisionToCommand,
  generateConfig,
  testApiEndpoint,
  type TaskState,
} from '@/lib/ai/agents/explorer-act';

const AGENT_EXTENSION_ID = 'shared';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const timestamp = new Date().toISOString();
  const searchParams = request.nextUrl.searchParams;
  const extensionId = searchParams.get('extensionId');
  const taskId = searchParams.get('taskId');

  console.log(`[${timestamp}] [Commands] Received request - extensionId: ${extensionId}, taskId: ${taskId}`);

  if (!extensionId) {
    console.log(`[${timestamp}] [Commands] Missing extensionId`);
    return NextResponse.json(
      { error: 'extensionId required' },
      { status: 400 }
    );
  }

  if (!taskId) {
    console.log(`[${timestamp}] [Commands] Missing taskId`);
    return NextResponse.json({
      commands: [],
      serverUrl: '',
      message: 'taskId required',
    });
  }

  try {
    console.log(`[${timestamp}] [Commands] Loading task: ${taskId}`);
    const task = await getTaskWithCompany(taskId);

    if (!task) {
      console.log(`[${timestamp}] [Commands] Task not found: ${taskId}`);
      return NextResponse.json({
        commands: [],
        serverUrl: '',
        error: 'Task not found',
      });
    }

    console.log(`[${timestamp}] [Commands] Task loaded - iterations: ${task.iterations}, status: ${task.status}`);
    console.log(`[${timestamp}] [Commands] Task state:`, {
      id: task.id,
      company: task.company?.name ?? 'Unknown',
      contentTypes: task.contentTypes,
      pagesVisited: task.pagesVisited,
      discoveries: (task.discoveries as unknown as Discovery[]) || [],
      currentAction: task.currentAction,
      currentTarget: task.currentTarget,
    });

    // Build task state for decision making
    const state: TaskState = {
      id: task.id,
      companyId: task.companyId,
      company: {
        name: task.company?.name ?? 'Unknown',
        website: task.company?.website ?? undefined,
        industry: task.company?.industry ?? undefined,
      },
      contentTypes: task.contentTypes as string[],
      iterations: task.iterations,
      pagesVisited: task.pagesVisited,
      discoveries: (task.discoveries as unknown as Discovery[]) || [],
      currentAction: task.currentAction,
      currentTarget: task.currentTarget,
    };

    // THINK: Decide next action
    console.log(`[${timestamp}] [Commands] Calling decideNextAction()...`);
    const decision = decideNextAction(state);
    console.log(`[${timestamp}] [Commands] Decision made:`, decision);

    // Check for terminal states
    if (decision.action === 'GENERATE_CONFIG') {
      console.log(`[${timestamp}] [Commands] Decision: GENERATE_CONFIG - generating config`);
      const result = generateConfig(state);

      if (result.success && result.config) {
        await prisma.fetchTask.update({
          where: { id: taskId },
          data: {
            status: 'complete',
            config: result.config as object,
            confidence: result.config.confidence,
            completedAt: new Date(),
            currentAction: null,
            currentTarget: null,
          },
        });

        console.log(`[${timestamp}] [Commands] Task ${taskId} completed with confidence ${result.config.confidence}%`);

        return NextResponse.json({
          commands: [],
          serverUrl: '',
          taskStatus: 'complete',
          config: result.config,
        });
      } else {
        await prisma.fetchTask.update({
          where: { id: taskId },
          data: {
            status: 'failed',
            reason: result.reason ?? 'Failed to generate config',
            completedAt: new Date(),
            currentAction: null,
            currentTarget: null,
          },
        });

        console.log(`[${timestamp}] [Commands] Task ${taskId} failed: ${result.reason}`);

        return NextResponse.json({
          commands: [],
          serverUrl: '',
          taskStatus: 'failed',
          reason: result.reason,
        });
      }
    }

    if (decision.action === 'FAIL') {
      console.log(`[${timestamp}] [Commands] Decision: FAIL - ${decision.reason}`);
      await prisma.fetchTask.update({
        where: { id: taskId },
        data: {
          status: 'failed',
          reason: decision.reason,
          completedAt: new Date(),
          currentAction: null,
          currentTarget: null,
        },
      });

      return NextResponse.json({
        commands: [],
        serverUrl: '',
        taskStatus: 'failed',
        reason: decision.reason,
      });
    }

    // TEST_API is executed server-side (no extension needed)
    if (decision.action === 'TEST_API') {
      console.log(`[${timestamp}] [Commands] Decision: TEST_API - ${decision.targetUrl}`);

      // Test the API endpoint
      const testResult = await testApiEndpoint(decision.targetUrl!);

      // Analyze the result and create discovery
      const discovery = {
        type: testResult.success
          ? 'api_endpoint' as const
          : testResult.statusCode === 401 || testResult.statusCode === 403
          ? 'requires_auth' as const
          : 'no_content' as const,
        url: decision.targetUrl,
        data: testResult.responseData,
        requiresAuth: testResult.statusCode === 401 || testResult.statusCode === 403,
        reason: testResult.error,
      };

      // Update task with discovery and increment iteration
      const pagesVisited = [...task.pagesVisited];
      if (decision.targetUrl && !pagesVisited.includes(decision.targetUrl)) {
        pagesVisited.push(decision.targetUrl);
      }

      const discoveries = [
        ...((task.discoveries as unknown as Discovery[]) || []),
        discovery,
      ];

      await prisma.fetchTask.update({
        where: { id: taskId },
        data: {
          iterations: task.iterations + 1,
          pagesVisited,
          discoveries: discoveries as unknown as Prisma.InputJsonValue,
          currentAction: null,
          currentTarget: null,
        },
      });

      console.log(`[${timestamp}] [Commands] TEST_API result:`, discovery);

      // Return empty commands - extension will poll again for next step
      return NextResponse.json({
        commands: [],
        serverUrl: '',
        taskStatus: 'exploring',
        iteration: task.iterations + 1,
        discovery: { type: discovery.type },
      });
    }

    // Store current action state (so we know what's being executed)
    console.log(`[${timestamp}] [Commands] Storing currentAction: ${decision.action}, currentTarget: ${decision.targetUrl}`);
    await prisma.fetchTask.update({
      where: { id: taskId },
      data: {
        currentAction: decision.action,
        currentTarget: decision.targetUrl ?? null,
      },
    });

    // Generate command for extension
    const requestId = `${taskId}-${Date.now()}`;
    const command = decisionToCommand(decision, requestId);

    console.log(`[${timestamp}] [Commands] Sending command to extension:`, command);

    return NextResponse.json({
      commands: [command],
      serverUrl: '',
      taskStatus: 'exploring',
      iteration: task.iterations,
    });
  } catch (error) {
    console.error(`[${timestamp}] [Commands] Error getting command:`, error);
    return NextResponse.json(
      { error: 'Failed to get command', details: error instanceof Error ? error.message : 'Unknown' },
      { status: 500 }
    );
  }
}