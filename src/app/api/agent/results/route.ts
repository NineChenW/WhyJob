/**
 * Explorer Agent Results API
 *
 * GET /api/agent/results?taskId=xxx&requestId=yyy  → Poll for result
 * POST /api/agent/results                          → Extension posts result
 *
 * The GET handler allows ChromeExtensionTool to poll for results.
 * The POST handler receives results from the Chrome Extension and
 * triggers async resume for hanging tasks.
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import type { Discovery } from '@/lib/db/explorer';
import { analyzeActionResult, type ActionResult } from '@/lib/ai/agents/explorer-act';
import { getLatestStateLog, updateStateLog, type StateLogNote } from '@/lib/ai/state-log';

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
 * GET /api/agent/results?taskId=xxx&requestId=yyy
 * ChromeExtensionTool polls for result by requestId.
 * Returns the stored result from the state log.
 */
export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const taskId = searchParams.get('taskId');
  const requestId = searchParams.get('requestId');

  if (!taskId) {
    return NextResponse.json({ error: 'taskId required' }, { status: 400 });
  }

  if (!requestId) {
    return NextResponse.json({ error: 'requestId required' }, { status: 400 });
  }

  // Find the state log entry for this requestId
  const log = await getLatestStateLog(taskId);

  if (!log) {
    // No log entry yet - return empty to trigger polling
    return NextResponse.json({});
  }

  // Check if the log has result data for this requestId
  const note = log.note as StateLogNote | null;
  if (note?.toolCall?.output !== undefined || note?.toolCall?.error !== undefined) {
    // Extract requestId from the tool call to match
    const noteRequestId = note.asyncTool?.requestId;
    if (noteRequestId === requestId) {
      return NextResponse.json({
        result: {
          success: !note.toolCall?.error,
          data: note.toolCall?.output,
          error: note.toolCall?.error,
          requestId,
        },
      });
    }
  }

  // Also check if status=1 (completed) but we haven't matched requestId yet
  // This handles the case where multiple results come in
  if (log.status === 1 && note?.asyncTool?.waitingForResult === false) {
    return NextResponse.json({
      result: {
        success: !note.toolCall?.error,
        data: note.toolCall?.output,
        error: note.toolCall?.error,
        requestId: note.asyncTool?.requestId,
      },
    });
  }

  // No result yet - return empty to continue polling
  return NextResponse.json({});
}

/**
 * POST /api/agent/results
 * Receives tool execution results from Chrome Extension.
 * Updates state log and triggers resume for hanging tasks.
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

      // Find hanging log entry for this task
      const hangingLog = await getLatestStateLog(taskId);

      if (hangingLog && hangingLog.status === 0) {
        // Update the hanging log with the result and set status=1 (Done)
        const existingNote = (hangingLog.note as StateLogNote) || {};
        // Preserve required tool and input from existing toolCall, add output/error
        const existingToolCall = existingNote.toolCall as { tool: string; input: unknown; output?: unknown; error?: string } | undefined;
        const existingAsyncTool = existingNote.asyncTool as { toolName: string; requestId: string; commandQueued: boolean; waitingForResult: boolean } | undefined;
        const updatedNote: StateLogNote = {
          ...existingNote,
          toolCall: {
            tool: existingToolCall?.tool ?? 'unknown',
            input: existingToolCall?.input ?? {},
            output: result.data,
            error: result.error,
          },
          asyncTool: {
            toolName: existingAsyncTool?.toolName ?? 'chrome_extension',
            requestId: existingAsyncTool?.requestId ?? result.requestId,
            commandQueued: existingAsyncTool?.commandQueued ?? true,
            waitingForResult: false,
          },
        };

        await updateStateLog(hangingLog.id, {
          status: 1,
          nextNode: 'observe_result',
          note: updatedNote,
        });

        console.log(`[${timestamp}] [Results] Updated hanging log ${hangingLog.id} with result, status=1`);

        // Trigger resume: update FetchTask status to 'exploring'
        // This signals the server action to re-invoke the graph
        await prisma.fetchTask.updateMany({
          where: { id: taskId, status: { in: ['pending', 'exploring'] } },
          data: { status: 'exploring' },
        });

        console.log(`[${timestamp}] [Results] Triggered resume for task ${taskId}`);
      }

      // Also process via existing FetchTask logic (for backward compatibility)
      const task = await prisma.fetchTask.findUnique({
        where: { id: taskId },
      });

      if (!task) {
        console.error(`[${timestamp}] [Results] Task not found: ${taskId}`);
        continue;
      }

      console.log(`[${timestamp}] [Results] Task found:`, {
        id: task.id,
        status: task.status,
        currentAction: task.currentAction,
        currentTarget: task.currentTarget,
        iterations: task.iterations,
      });

      // Fetch company info separately
      const company = await prisma.company.findUnique({
        where: { id: task.companyId },
      });

      // Build state for analysis
      const state = {
        id: task.id,
        companyId: task.companyId,
        company: {
          name: company?.name ?? 'Unknown',
          website: company?.website ?? undefined,
          industry: company?.industry ?? undefined,
        },
        contentTypes: task.contentTypes as string[],
        iterations: task.iterations,
        pagesVisited: task.pagesVisited as string[],
        discoveries: (task.discoveries as unknown as Discovery[]) || [],
        currentAction: task.currentAction,
        currentTarget: task.currentTarget,
      };

      // Analyze the result
      const actionResult: ActionResult = {
        success: result.success,
        url: (result.data as { url?: string })?.url,
        title: (result.data as { title?: string })?.title,
        error: result.error,
        data: result.data,
      };

      console.log(`[${timestamp}] [Results] Action result:`, actionResult);

      const decision: {
        action: 'NAVIGATE' | 'EXTRACT_DOM' | 'TEST_API' | 'GENERATE_CONFIG' | 'FAIL';
        targetUrl?: string;
        selectors?: Record<string, string>;
      } = {
        action: (state.currentAction as 'NAVIGATE' | 'EXTRACT_DOM' | 'TEST_API') ?? 'NAVIGATE',
        targetUrl: state.currentTarget ?? undefined,
        selectors: undefined,
      };

      console.log(`[${timestamp}] [Results] Decision context:`, decision);

      const discovery = analyzeActionResult(decision.action, actionResult, decision);

      console.log(`[${timestamp}] [Results] Discovery:`, discovery);

      // Prepare updates
      const pagesVisited = [...task.pagesVisited];
      if (discovery?.url && !pagesVisited.includes(discovery.url)) {
        pagesVisited.push(discovery.url);
      }

      const discoveries = [...((task.discoveries as unknown as Discovery[]) || [])];
      if (discovery) {
        discoveries.push(discovery);
      }

      console.log(`[${timestamp}] [Results] Updating task with:`, {
        newIterations: task.iterations + 1,
        pagesVisited,
        discoveriesCount: discoveries.length,
      });

      // Update task state (only if not already updated by resume trigger)
      await prisma.fetchTask.update({
        where: { id: taskId },
        data: {
          iterations: task.iterations + 1,
          pagesVisited,
          discoveries: discoveries as object,
          currentAction: null, // Clear current action - ready for next
          currentTarget: null,
        },
      });

      console.log(`[${timestamp}] [Results] Task ${taskId} updated successfully`);
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