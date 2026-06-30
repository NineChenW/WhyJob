/**
 * Explorer Test Queue API
 *
 * POST /api/explorer/test/queue → Add command to queue (for testing)
 * GET /api/explorer/test/queue → Get queue stats
 */

import { NextRequest, NextResponse } from 'next/server';
import {
  getQueueStats,
  addPendingCommand,
} from '@/lib/http/explorer-queue';
import type { CommandType } from '@/lib/http/explorer-types';

export const dynamic = 'force-dynamic';

export async function GET() {
  const stats = getQueueStats();
  return NextResponse.json({
    success: true,
    stats,
    timestamp: new Date().toISOString(),
  });
}

interface AddCommandPayload {
  taskId: string;
  type: CommandType;
  params?: Record<string, unknown>;
}

export async function POST(request: NextRequest) {
  const timestamp = new Date().toISOString();

  try {
    const body: AddCommandPayload = await request.json();
    const { taskId, type, params } = body;

    if (!taskId || !type) {
      return NextResponse.json(
        { error: 'taskId and type are required' },
        { status: 400 }
      );
    }

    // Add command to the task's queue
    const requestId = addPendingCommand(taskId, { type, params });

    return NextResponse.json({
      success: true,
      requestId,
      message: 'Command added to queue',
    });
  } catch (error) {
    console.error(`[${timestamp}] [TestQueue] Error:`, error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}