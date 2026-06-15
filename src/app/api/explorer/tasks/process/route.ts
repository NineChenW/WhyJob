/**
 * Run Explorer Agent
 *
 * POST /api/explorer/tasks/process
 *
 * This endpoint is called when the extension picks up a task.
 * It runs the explorer agent which communicates with the extension
 * via the HTTP polling relay (POST commands, GET results).
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { explore, HttpExtension } from '@/lib/ai/agents/explorer-agent';
import { completeFetchTask, failFetchTask } from '@/lib/db/explorer';
import type { ExplorationTask } from '@/lib/ai/agents/explorer-agent';
import type { Prisma } from '@prisma/client';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    // 1. Pick up the task (same logic as pickup route)
    const existingExploringTask = await prisma.fetchTask.findFirst({
      where: { status: 'exploring' },
      orderBy: { createdAt: 'asc' },
    });

    if (existingExploringTask) {
      return NextResponse.json({
        processed: false,
        reason: 'already_processing',
        taskId: existingExploringTask.id,
      });
    }

    const pendingTask = await prisma.fetchTask.findFirst({
      where: { status: 'pending' },
      orderBy: { createdAt: 'asc' },
    });

    if (!pendingTask) {
      return NextResponse.json({
        processed: false,
        reason: 'no_pending_tasks',
      });
    }

    // 2. Mark task as exploring
    const task = await prisma.fetchTask.update({
      where: { id: pendingTask.id },
      data: { status: 'exploring' },
    });

    // 3. Fetch company info for the exploration task
    const company = await prisma.company.findUnique({
      where: { id: task.companyId },
    });

    console.log(`[Agent] Starting exploration for task: ${task.id}`);

    // 4. Build exploration task for agent
    const explorationTask: ExplorationTask = {
      companyId: task.companyId,
      company: {
        name: company?.name ?? 'Unknown',
        website: company?.website ?? undefined,
        industry: company?.industry ?? undefined,
      },
      contentTypes: task.contentTypes as string[],
    };

    // 5. Create HTTP extension for polling relay
    // The relay is at the same server, so we use the request to build the base URL
    const url = new URL(request.url);
    const serverUrl = `${url.protocol}//${url.host}/api/agent`;
    const extension = new HttpExtension(serverUrl);

    // 6. Run the exploration
    try {
      await extension.connect();
      const result = await explore(explorationTask, extension);

      // 6. Handle result
      if (result.success && result.config) {
        await completeFetchTask(task.id, result.config as unknown as Prisma.InputJsonValue, result.config.confidence);
        console.log(`[Agent] Task ${task.id} completed successfully with confidence ${result.config.confidence}%`);

        return NextResponse.json({
          processed: true,
          taskId: task.id,
          success: true,
          config: result.config,
        });
      } else {
        await failFetchTask(task.id, result.reason ?? 'Unknown error');
        console.log(`[Agent] Task ${task.id} failed: ${result.reason}`);

        return NextResponse.json({
          processed: true,
          taskId: task.id,
          success: false,
          reason: result.reason,
        });
      }
    } finally {
      extension.disconnect();
    }
  } catch (error) {
    console.error('[Agent] Error processing task:', error);
    return NextResponse.json(
      { error: 'Failed to process task', details: error instanceof Error ? error.message : 'Unknown' },
      { status: 500 }
    );
  }
}