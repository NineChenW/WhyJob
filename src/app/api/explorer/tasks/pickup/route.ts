/**
 * Pickup exploration task
 *
 * POST /api/explorer/tasks/pickup
 *
 * Called by the extension when it comes online to claim a task.
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

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

    console.log(`[${timestamp}] [Pickup] Found pending task: ${pendingTask.id}, updating to 'exploring'...`);

    // Update task to exploring status
    const updatedTask = await prisma.fetchTask.update({
      where: { id: pendingTask.id },
      data: {
        status: 'exploring',
      },
    });

    console.log(`[${timestamp}] [Pickup] Task ${updatedTask.id} is now 'exploring'`);

    return NextResponse.json({
      pickedUp: true,
      alreadyProcessing: false,
      task: {
        id: updatedTask.id,
        companyId: updatedTask.companyId,
        contentTypes: updatedTask.contentTypes,
        status: updatedTask.status,
      },
      message: 'Task picked up. Poll commands API with taskId for next steps.',
    });
  } catch (error) {
    console.error(`[${timestamp}] [Pickup] Failed to pickup task:`, error);
    return NextResponse.json(
      { error: 'Failed to pickup task' },
      { status: 500 }
    );
  }
}