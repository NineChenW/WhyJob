/**
 * Explorer Agent Commands API
 *
 * GET /api/agent/commands?extensionId=xxx&taskId=yyy
 *
 * Returns pending command from LangGraph checkpointed state (via PostgresSaver).
 * The extension polls this to get the next command to execute.
 *
 * Flow:
 * 1. runExplorerGraph() hits interrupt() → graph pauses, state checkpointed
 * 2. Extension polls Commands GET → reads pending tool from graph state
 * 3. Extension executes command → POSTs /results
 * 4. Results API resumes graph with Command({ resume })
 */

import { NextRequest, NextResponse } from 'next/server';
import { getCheckpointer, createThreadConfig } from '@/lib/ai/agents/explorer/checkpointer';
import { createExplorerGraph } from '@/lib/ai/agents/explorer/graph';
import { prisma } from '@/lib/prisma';

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
    // Read pending tool from graph state (checkpointed in Postgres via PostgresSaver)
    const checkpointer = await getCheckpointer();
    const graph = createExplorerGraph();
    const compiled = graph.compile({ checkpointer });
    const config = createThreadConfig(taskId);

    const state = await compiled.getState(config);

    // Find pending tool call from checkpointed state
    const toolCalls = state.values.toolCalls as Array<{
      type: string;
      input: Record<string, unknown>;
      requestId?: string;
      status?: string;
    }> | undefined;

    const lastCall = toolCalls?.[toolCalls.length - 1];

    if (lastCall?.status === 'pending') {
      console.log(`[${timestamp}] [Commands] Returning pending command: ${lastCall.type}`);

      return NextResponse.json({
        commands: [{
          type: lastCall.type as 'NAVIGATE' | 'GET_SNAPSHOT' | 'EXTRACT_DOM' | 'EXECUTE_JS' | 'START_NETWORK_MONITORING' | 'GET_NETWORK_LOG' | 'STOP_NETWORK_MONITORING',
          requestId: lastCall.requestId,
          params: lastCall.input,
        }],
        taskStatus: 'exploring',
        iteration: state.values.iteration,
      });
    }

    // No pending tool - check if task is complete or still running
    const task = await prisma.fetchTask.findUnique({
      where: { id: taskId },
    });

    // Graph has more steps to run but no pending tool means it's either:
    // - Still running (no interrupt yet)
    // - Completed (state.next is empty)
    if (!state.next || state.next.length === 0) {
      console.log(`[${timestamp}] [Commands] Graph completed for task ${taskId}`);
      return NextResponse.json({
        commands: [],
        taskStatus: task?.status ?? 'complete',
        message: 'Graph completed',
      });
    }

    // Still running but no command queued yet
    console.log(`[${timestamp}] [Commands] No pending command yet - graph still running`);
    return NextResponse.json({
      commands: [],
      taskStatus: task?.status ?? 'exploring',
      iteration: state.values.iteration,
      message: 'No command queued yet - poll again',
    });
  } catch (error) {
    console.error(`[${timestamp}] [Commands] Error getting command:`, error);
    return NextResponse.json(
      { error: 'Failed to get command', details: error instanceof Error ? error.message : 'Unknown' },
      { status: 500 }
    );
  }
}