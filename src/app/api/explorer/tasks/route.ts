// API route for explorer tasks
// POST /api/explorer/tasks - Create new exploration task
// GET /api/explorer/tasks - List tasks (optional)

import { NextRequest, NextResponse } from 'next/server';
import { createFetchTask, getFetchTasksByStatus } from '@/lib/db/explorer';
import { fetchTaskCreateSchema } from '@/schemas/explorer';
import type { TaskStatus } from '@/schemas/explorer';

// Create new exploration task
// POST /api/explorer/tasks
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const parsed = fetchTaskCreateSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid request body', details: parsed.error.issues },
        { status: 400 }
      );
    }

    const { companyId, contentTypes } = parsed.data;

    const task = await createFetchTask({
      companyId,
      contentTypes,
    });

    return NextResponse.json({
      taskId: task.id,
      status: task.status as TaskStatus,
    });
  } catch (error) {
    console.error('[API] Failed to create task:', error);
    return NextResponse.json(
      { error: 'Failed to create task' },
      { status: 500 }
    );
  }
}

// List tasks by status
// GET /api/explorer/tasks?status=pending
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const status = searchParams.get('status') as TaskStatus | null;

    if (!status) {
      return NextResponse.json(
        { error: 'status query parameter required' },
        { status: 400 }
      );
    }

    const tasks = await getFetchTasksByStatus(status);

    return NextResponse.json({ tasks });
  } catch (error) {
    console.error('[API] Failed to list tasks:', error);
    return NextResponse.json(
      { error: 'Failed to list tasks' },
      { status: 500 }
    );
  }
}