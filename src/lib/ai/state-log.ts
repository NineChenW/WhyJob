/**
 * Generic Agent State Log Library
 *
 * Provides incremental state persistence with async/resume support.
 * Any agent node can log its state, and the Results API can detect
 * hanging entries (status=0) to trigger resumption.
 */

import { prisma } from '@/lib/prisma';
import type { AgentStateLog } from '@prisma/client';

/**
 * Input for creating a state log entry
 */
export interface StateLogInput {
  taskId: string;
  agent: string;
  node: string;
  state: unknown;
  note?: StateLogNote;
  nextNode?: string | null;
  status?: 0 | 1; // 1=Done, 0=Hang up waiting for async
}

/**
 * Note structure for additional context
 */
export interface StateLogNote {
  // Common fields
  iteration?: number;
  error?: string;
  duration?: number; // ms

  // LLM decision fields
  decision?: {
    action: string;
    target?: unknown;
    reasoning: string;
    confidence: number;
  };
  reasoning?: string;

  // Tool execution fields
  toolCall?: {
    tool: string;
    input: unknown;
    output?: unknown;
    error?: string;
  };

  // Async tool fields
  asyncTool?: {
    toolName: string;
    requestId: string;
    commandQueued: boolean;
    waitingForResult: boolean;
  };

  // Discovery fields
  discoveriesAdded?: number;
  pagesVisitedCount?: number;
  networkCallsCount?: number;

  // Config test fields
  configTest?: {
    success: boolean;
    statusCode?: number;
    itemCount?: number;
    responseTime?: number;
    error?: string;
  };

  // Termination fields
  terminationReason?: string;
  shouldContinue?: boolean;

  // Metadata
  metadata?: Record<string, unknown>;
}

/**
 * Create a new state log entry
 */
export async function createStateLog(input: StateLogInput): Promise<string> {
  const log = await prisma.agentStateLog.create({
    data: {
      taskId: input.taskId,
      agent: input.agent,
      node: input.node,
      state: input.state as object,
      note: input.note ? (input.note as object) : undefined,
      nextNode: input.nextNode ?? null,
      status: input.status ?? 1,
    },
  });
  return log.id;
}

/**
 * Update state log (for async resume)
 */
export async function updateStateLog(
  id: string,
  updates: Partial<{
    state: unknown;
    note: StateLogNote;
    nextNode: string | null;
    status: 0 | 1;
  }>
): Promise<void> {
  await prisma.agentStateLog.update({
    where: { id },
    data: {
      ...updates,
      note: updates.note ? (updates.note as object) : undefined,
      state: updates.state ? (updates.state as object) : undefined,
    },
  });
}

/**
 * Get latest log entry for a task
 */
export async function getLatestStateLog(taskId: string): Promise<AgentStateLog | null> {
  return prisma.agentStateLog.findFirst({
    where: { taskId },
    orderBy: { createdAt: 'desc' },
  });
}

/**
 * Get hanging log entries for a task (status = 0)
 */
export async function getHangingLogs(taskId: string): Promise<AgentStateLog[]> {
  return prisma.agentStateLog.findMany({
    where: { taskId, status: 0 },
    orderBy: { createdAt: 'desc' },
  });
}

/**
 * Resume from hanging state
 *
 * Returns the latest hanging log entry and its state, or null if none.
 */
export async function getResumeContext(
  taskId: string
): Promise<{ log: AgentStateLog; state: unknown } | null> {
  const log = await prisma.agentStateLog.findFirst({
    where: { taskId, status: 0 },
    orderBy: { createdAt: 'desc' },
  });

  if (!log) return null;

  return {
    log,
    state: log.state as unknown,
  };
}

/**
 * Clear state logs for a task
 *
 * Returns the number of deleted entries.
 */
export async function clearStateLogs(taskId: string): Promise<number> {
  const result = await prisma.agentStateLog.deleteMany({
    where: { taskId },
  });
  return result.count;
}