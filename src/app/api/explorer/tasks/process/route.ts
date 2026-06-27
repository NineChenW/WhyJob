/**
 * Process Explorer Agent Task
 *
 * POST /api/explorer/tasks/process
 *
 * Simple status checker - resume happens via Results API calling Command({ resume }).
 *
 * With PostgresSaver checkpointer:
 * - Actual resume happens via Results API
 * - This endpoint just checks completion status
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  const timestamp = new Date().toISOString();

  try {
    // Check for exploring tasks that might need status check
    const exploringTask = await prisma.fetchTask.findFirst({
      where: { status: 'exploring' },
      orderBy: { createdAt: 'asc' },
    });

    if (!exploringTask) {
      const pendingTask = await prisma.fetchTask.findFirst({
        where: { status: 'pending' },
        orderBy: { createdAt: 'asc' },
      });

      if (pendingTask) {
        return NextResponse.json({
          processed: false,
          reason: 'no_exploring_tasks',
          message: 'Use /pickup to start a pending task',
        });
      }

      return NextResponse.json({
        processed: false,
        reason: 'no_tasks',
        message: 'No tasks to process',
      });
    }

    console.log(`[${timestamp}] [Process] Checking task: ${exploringTask.id}`);

    if (exploringTask.status === 'complete') {
      return NextResponse.json({
        processed: true,
        success: true,
        taskId: exploringTask.id,
        config: exploringTask.config,
        confidence: exploringTask.confidence,
      });
    }

    if (exploringTask.status === 'failed') {
      return NextResponse.json({
        processed: true,
        success: false,
        taskId: exploringTask.id,
        reason: exploringTask.reason,
      });
    }

    // Task is still exploring - extension should be polling /commands
    return NextResponse.json({
      processed: true,
      taskId: exploringTask.id,
      waitingForExtension: true,
      message: 'Task waiting for extension. Poll commands API.',
    });
  } catch (error) {
    console.error(`[${timestamp}] [Process] Error processing task:`, error);
    return NextResponse.json(
      { error: 'Failed to process task', details: error instanceof Error ? error.message : 'Unknown' },
      { status: 500 }
    );
  }
}