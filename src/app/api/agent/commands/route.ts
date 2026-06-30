/**
 * Explorer Agent Commands API
 *
 * GET /api/agent/commands?taskId=xxx
 *
 * Returns commands for the extension to execute via polling.
 *
 * Flow:
 * 1. Extension polls Commands GET → returns pending commands
 * 2. Extension executes command → POSTs /results
 * 3. Results API processes result (idempotency via queue)
 */

import { NextRequest, NextResponse } from 'next/server';
import {
  popNextPendingCommand,
  hasMorePendingCommands,
} from '@/lib/http/explorer-queue';
import type {
  PollResponse,
  Command,
  NavigateParams,
  ExtractDomParams,
  ExecuteJsParams,
  GetNetworkLogParams,
  StopNetworkMonitoringParams,
} from '@/lib/http/explorer-types';

export const dynamic = 'force-dynamic';

/**
 * Get task status based on command queue
 */
function getTaskStatus(taskId: string): 'exploring' | 'complete' | 'failed' {
  return hasMorePendingCommands(taskId) ? 'exploring' : 'complete';
}

export async function GET(request: NextRequest) {
  const timestamp = new Date().toISOString();
  const searchParams = request.nextUrl.searchParams;
  const taskId = searchParams.get('taskId');

  console.log(`[${timestamp}] [Commands] Poll request - taskId: ${taskId}`);

  if (!taskId) {
    console.log(`[${timestamp}] [Commands] Missing taskId`);
    // Return empty response - no task specified
    const response: PollResponse = {
      commands: [],
      serverUrl: `${request.nextUrl.origin}/api/agent`,
      taskStatus: undefined,
      taskId: undefined,
    };
    return NextResponse.json(response);
  }

  try {
    // Get next pending command
    const command = popNextPendingCommand(taskId);

    if (!command) {
      console.log(`[${timestamp}] [Commands] No pending commands for task: ${taskId}`);
      const response: PollResponse = {
        commands: [],
        serverUrl: `${request.nextUrl.origin}/api/agent`,
        taskStatus: getTaskStatus(taskId),
        taskId,
      };
      return NextResponse.json(response);
    }

    // Build command object
    const cmd: Command = {
      type: command.type,
      requestId: command.requestId,
      params: command.params as NavigateParams | ExtractDomParams | ExecuteJsParams | GetNetworkLogParams | StopNetworkMonitoringParams | undefined,
    };

    console.log(`[${timestamp}] [Commands] Returning command:`, {
      requestId: command.requestId,
      type: command.type,
    });

    const response2: PollResponse = {
      commands: [cmd],
      serverUrl: `${request.nextUrl.origin}/api/agent`,
      taskStatus: getTaskStatus(taskId),
      taskId,
    };

    return NextResponse.json(response2);
  } catch (error) {
    console.error(`[${timestamp}] [Commands] Error:`, error);
    return NextResponse.json(
      { error: 'Failed to get command', details: error instanceof Error ? error.message : 'Unknown' },
      { status: 500 }
    );
  }
}