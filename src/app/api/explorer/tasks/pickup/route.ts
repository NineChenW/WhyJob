/**
 * Pickup exploration task
 *
 * POST /api/explorer/tasks/pickup
 *
 * Called by the extension when it comes online to claim a task.
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { runExplorerGraph, initializeExplorationState } from '@/lib/ai/agents/explorer/graph';
import { ExplorationStateWrapper } from '@/lib/ai/agents/explorer/domain';

export const dynamic = 'force-dynamic';

export async function POST(_request: NextRequest) {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] [Pickup] Starting pickup request...`);

  try {
    // First check if there's already a task being explored
    console.log(`[${timestamp}] [Pickup] Checking for existing exploring tasks...`);
    const existingExploringTask = await prisma.fetchTask.findFirst({
      where: { status: 'exploring' },
      orderBy: { createdAt: 'asc' },
    });

    if (existingExploringTask) {
      console.log(`[${timestamp}] [Pickup] Found existing task in 'exploring' state: ${existingExploringTask.id}`);
      return NextResponse.json({
        pickedUp: false,
        alreadyProcessing: true,
        task: {
          id: existingExploringTask.id,
          companyId: existingExploringTask.companyId,
          contentTypes: existingExploringTask.contentTypes,
          status: existingExploringTask.status,
        },
        message: 'Task already being processed',
      });
    }

    // No task in progress - pick up the oldest pending task
    console.log(`[${timestamp}] [Pickup] No task in progress, looking for pending tasks...`);
    const pendingTask = await prisma.fetchTask.findFirst({
      where: { status: 'pending' },
      orderBy: { createdAt: 'asc' },
    });

    if (!pendingTask) {
      console.log(`[${timestamp}] [Pickup] No pending tasks found`);
      return NextResponse.json({
        pickedUp: false,
        alreadyProcessing: false,
        task: null,
        message: 'No pending tasks',
      });
    }

    // Fetch company info for the exploration
    const company = await prisma.company.findUnique({
      where: { id: pendingTask.companyId },
    });

    console.log(`[${timestamp}] [Pickup] Found pending task: ${pendingTask.id}, updating to 'exploring'...`);

    // Update task to exploring status
    const updatedTask = await prisma.fetchTask.update({
      where: { id: pendingTask.id },
      data: {
        status: 'exploring',
      },
    });

    console.log(`[${timestamp}] [Pickup] Task ${updatedTask.id} is now 'exploring'`);

    // Start the LangGraph explorer agent (fire-and-forget)
    // The graph will return when it needs extension results (waitingForExtensionResult)
    // or reaches a terminal state (generate_config, fail, max_iterations)
    const serverUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000';
    const state = initializeExplorationState({
      taskId: updatedTask.id,
      companyId: updatedTask.companyId,
      company: {
        id: company?.id ?? updatedTask.companyId,
        name: company?.name ?? 'Unknown',
        website: company?.website ?? undefined,
        industry: company?.industry ?? undefined,
      },
      contentTypes: (updatedTask.contentTypes as string[]) as any[],
      maxIterations: 5,
    });

    console.log(`[${timestamp}] [Pickup] Starting runExplorerGraph for task ${updatedTask.id}...`);

    // Run the graph (async - don't block the response)
    // If the graph needs extension results, it will return with waitingForExtensionResult=true
    // The extension will poll Commands GET to get the queued command, then POST results
    runExplorerGraph(state, serverUrl)
      .then((result) => {
        const wrapper = new ExplorationStateWrapper(result);
        console.log(`[${timestamp}] [Pickup] runExplorerGraph completed for task ${updatedTask.id}:`, {
          shouldContinue: wrapper.iteration.shouldContinue,
          terminationReason: wrapper.iteration.terminationReason,
          discoveriesCount: wrapper.memory.discoveryCount,
          finalResult: wrapper.result ? 'present' : 'none',
        });
      })
      .catch((error) => {
        console.error(`[${timestamp}] [Pickup] runExplorerGraph error for task ${updatedTask.id}:`, error);
        // Mark task as failed
        prisma.fetchTask.update({
          where: { id: updatedTask.id },
          data: {
            status: 'failed',
            reason: error instanceof Error ? error.message : 'Graph execution failed',
            completedAt: new Date(),
          },
        }).catch(console.error);
      });

    return NextResponse.json({
      pickedUp: true,
      alreadyProcessing: false,
      task: {
        id: updatedTask.id,
        companyId: updatedTask.companyId,
        contentTypes: updatedTask.contentTypes,
        status: updatedTask.status,
      },
      message: 'Exploration started. Poll commands API with taskId for next steps.',
    });
  } catch (error) {
    console.error(`[${timestamp}] [Pickup] Failed to pickup task:`, error);
    return NextResponse.json(
      { error: 'Failed to pickup task' },
      { status: 500 }
    );
  }
}