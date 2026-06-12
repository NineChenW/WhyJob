// API route for individual explorer task
// GET /api/explorer/tasks/[id] - Get task status and result

import { NextRequest, NextResponse } from 'next/server';
import { getFetchTaskById } from '@/lib/db/explorer';

interface Params {
  params: Promise<{ id: string }>;
}

// Get task status and result
// GET /api/explorer/tasks/[id]
export async function GET(request: NextRequest, { params }: Params) {
  try {
    const { id } = await params;

    if (!id) {
      return NextResponse.json(
        { error: 'Task ID required' },
        { status: 400 }
      );
    }

    const task = await getFetchTaskById(id);

    if (!task) {
      return NextResponse.json(
        { error: 'Task not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      id: task.id,
      status: task.status,
      config: task.config,
      reason: task.reason,
      iterations: task.iterations,
      confidence: task.confidence,
    });
  } catch (error) {
    console.error('[API] Failed to get task:', error);
    return NextResponse.json(
      { error: 'Failed to get task' },
      { status: 500 }
    );
  }
}