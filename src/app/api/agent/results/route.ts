/**
 * Explorer Agent Results API
 *
 * POST /api/agent/results → Extension posts result, triggers graph resume
 *
 * Resume flow (PostgresSaver checkpointer):
 * 1. Extension POSTs result → Results API calls graph.invoke(Command({ resume }))
 * 2. LangGraph loads checkpoint by thread_id, interrupt() returns resume value
 * 3. execute_tool node completes pending call, graph continues
 */

import { NextRequest, NextResponse } from 'next/server';
import { Command } from '@langchain/langgraph';
import { completeFetchTask, failFetchTask } from '@/lib/db/explorer';
import { getCheckpointer, createThreadConfig } from '@/lib/ai/agents/explorer/checkpointer';
import { createExplorerGraph } from '@/lib/ai/agents/explorer/graph';

interface ResultPayload {
  extensionId: string;
  results: Array<{
    requestId: string;
    success: boolean;
    data?: unknown;
    error?: string;
  }>;
}

export const dynamic = 'force-dynamic';

/**
 * GET /api/agent/results
 * Not used in checkpointer flow - kept for potential debugging.
 */
export async function GET(request: NextRequest) {
  const taskId = request.nextUrl.searchParams.get('taskId');
  return NextResponse.json({
    message: 'Use POST to resume graph',
    taskId,
    timestamp: new Date().toISOString(),
  });
}

/**
 * POST /api/agent/results
 * Receives tool execution results from Chrome Extension.
 * Resumes the LangGraph with Command({ resume }) to continue the ReAct loop.
 */
export async function POST(request: NextRequest) {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] [Results] Received results request`);

  try {
    const body: ResultPayload = await request.json();
    const { results, extensionId } = body;

    console.log(`[${timestamp}] [Results] extensionId: ${extensionId}, results count: ${results?.length}`);

    if (!results || !Array.isArray(results) || results.length === 0) {
      console.log(`[${timestamp}] [Results] No results to process`);
      return NextResponse.json({ error: 'results required' }, { status: 400 });
    }

    // Process each result
    for (const result of results) {
      console.log(`[${timestamp}] [Results] Processing result:`, {
        requestId: result.requestId,
        success: result.success,
        error: result.error,
      });

      // Extract taskId from requestId (format: "taskId-iteration-timestamp")
      const requestIdParts = result.requestId.split('-');
      if (requestIdParts.length < 2) {
        console.log(`[${timestamp}] [Results] Invalid requestId format: ${result.requestId}`);
        continue;
      }

      const taskId = requestIdParts.slice(0, -2).join('-'); // Remove last 2 segments (iteration, timestamp)
      console.log(`[${timestamp}] [Results] Extracted taskId: ${taskId}`);

      // Resume the graph with the result
      await resumeGraph(taskId, result);
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error(`[${timestamp}] [Results] Error processing results:`, error);
    return NextResponse.json(
      { error: 'Failed to process results', details: error instanceof Error ? error.message : 'Unknown' },
      { status: 500 }
    );
  }
}

/**
 * Resume the LangGraph with the extension result.
 * Uses Command({ resume }) to provide the result to the interrupted graph.
 */
async function resumeGraph(taskId: string, result: {
  requestId: string;
  success: boolean;
  data?: unknown;
  error?: string;
}): Promise<void> {
  const timestamp = new Date().toISOString();

  try {
    console.log('[Results] result:', JSON.stringify(result, null, 2));
    // Get checkpointer and compile graph
    const checkpointer = await getCheckpointer();
    const graph = createExplorerGraph();
    const compiled = graph.compile({ checkpointer });
    const config = createThreadConfig(taskId);

    console.log(`[${timestamp}] [Results] Resuming graph for task ${taskId}`);

    const state = await compiled.getState(config);
    console.log('[Results] Current state checkpoint:', JSON.stringify(state, null, 2));
    console.log('[Results] Has pending calls:', state.values.toolCalls);

    // Resume with Command({ resume })
    // LangGraph loads checkpoint by thread_id, then interrupt() returns this value
    const resumedState = await compiled.invoke(
      new Command({
        resume: {
          success: result.success,
          data: result.data,
          error: result.error,
        },
      }),
      config
    );

    console.log(`[${timestamp}] [Results] Graph resumed for task ${taskId}:`, {
      terminationReason: resumedState.terminationReason,
      finalResult: !!resumedState.finalResult,
      discoveriesCount: resumedState.discoveries?.length,
    });

    // Handle terminal states
    if (resumedState.terminationReason === 'generate_config' && resumedState.finalResult) {
      await completeFetchTask(
        taskId,
        resumedState.finalResult.config as unknown as object,
        resumedState.finalResult.confidence
      );
      console.log(`[${timestamp}] [Results] Task ${taskId} completed with confidence ${resumedState.finalResult.confidence}%`);
    } else if (resumedState.terminationReason === 'fail' || resumedState.terminationReason === 'max_iterations') {
      await failFetchTask(taskId, resumedState.finalResult?.reason ?? `Terminated: ${resumedState.terminationReason}`);
      console.log(`[${timestamp}] [Results] Task ${taskId} failed: ${resumedState.terminationReason}`);
    }
  } catch (error) {
    // Graph might not have an interrupt (already completed or no checkpoint)
    console.log(`[${timestamp}] [Results] Graph resume error (may be normal if no checkpoint):`, error);
  }
}