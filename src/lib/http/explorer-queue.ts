// src/lib/http/explorer-queue.ts

/**
 * Explorer Queue Utility
 *
 * Provides idempotency guarantees:
 * - Same command can only be fetched once (dequeue semantics)
 * - Same result can only be posted once (idempotency)
 *
 * Uses in-memory Map for simplicity. In production, consider Redis
 * for multi-instance deployments.
 */

import type { CommandType } from '@/lib/http/explorer-types';

/**
 * Command queue entry - tracks dequeued commands
 */
interface CommandEntry {
  requestId: string;
  taskId: string;
  dequeuedAt: Date;
}

/**
 * Pending command stored for polling
 */
interface PendingCommand {
  type: CommandType;
  requestId: string;
  params?: Record<string, unknown>;
}

/**
 * Result entry - tracks processed results
 */
interface ResultEntry {
  requestId: string;
  taskId: string;
  processedAt: Date;
}

/**
 * In-memory stores (in production, use Redis)
 */
const commandDequeueMap = new Map<string, CommandEntry>();
const resultProcessedMap = new Map<string, ResultEntry>();

/**
 * Pending commands store (taskId -> list of commands)
 */
const pendingCommandsByTask = new Map<string, PendingCommand[]>();

// ============================================
// Pending Command Queue (for polling)
// ============================================

/**
 * Add a command to a task's pending command queue
 */
export function addPendingCommand(
  taskId: string,
  command: Omit<PendingCommand, 'requestId'>
): string {
  const requestId = `${taskId}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

  const commands = pendingCommandsByTask.get(taskId) || [];
  commands.push({ ...command, requestId });
  pendingCommandsByTask.set(taskId, commands);

  return requestId;
}

/**
 * Get and remove the next pending command for a task (dequeue semantics)
 */
export function popNextPendingCommand(taskId: string): PendingCommand | null {
  const commands = pendingCommandsByTask.get(taskId) || [];
  if (commands.length === 0) {
    return null;
  }

  // Find first command that hasn't been dequeued yet
  for (let i = 0; i < commands.length; i++) {
    const cmd = commands[i];
    if (!commandDequeueMap.has(cmd.requestId)) {
      // Mark as dequeued
      markCommandDequeued(cmd.requestId, taskId);
      // Remove from store
      commands.splice(i, 1);
      pendingCommandsByTask.set(taskId, commands);
      return cmd;
    }
  }

  return null;
}

/**
 * Get pending command count for a task
 */
export function getPendingCommandCount(taskId: string): number {
  const commands = pendingCommandsByTask.get(taskId) || [];
  return commands.filter(cmd => !commandDequeueMap.has(cmd.requestId)).length;
}

/**
 * Check if task has more pending commands
 */
export function hasMorePendingCommands(taskId: string): boolean {
  return getPendingCommandCount(taskId) > 0;
}

// ============================================
// Command Queue (Dequeue Semantics)
// ============================================

/**
 * Mark a command as dequeued (fetched by extension)
 * Returns true if this is the first time the command was dequeued
 */
export function markCommandDequeued(requestId: string, taskId: string): boolean {
  if (commandDequeueMap.has(requestId)) {
    return false; // Already dequeued
  }

  commandDequeueMap.set(requestId, {
    requestId,
    taskId,
    dequeuedAt: new Date(),
  });

  return true;
}

/**
 * Check if a command has already been dequeued
 */
export function isCommandDequeued(requestId: string): boolean {
  return commandDequeueMap.has(requestId);
}

/**
 * Get dequeue info for a command
 */
export function getCommandDequeueInfo(requestId: string): CommandEntry | undefined {
  return commandDequeueMap.get(requestId);
}

/**
 * Release a command back to the queue (e.g., if extension disconnects)
 * The command can be fetched again
 */
export function releaseCommand(requestId: string): boolean {
  return commandDequeueMap.delete(requestId);
}

/**
 * Get all pending commands for a task
 */
export function getDequeuedCommandsForTask(taskId: string): CommandEntry[] {
  const entries: CommandEntry[] = [];
  for (const entry of commandDequeueMap.values()) {
    if (entry.taskId === taskId) {
      entries.push(entry);
    }
  }
  return entries;
}

// ============================================
// Result Queue (Idempotency)
// ============================================

/**
 * Check if a result has already been processed
 * Returns true if this result was already posted
 */
export function isResultProcessed(requestId: string): boolean {
  return resultProcessedMap.has(requestId);
}

/**
 * Mark a result as processed
 * Returns true if this is the first time the result was processed
 */
export function markResultProcessed(requestId: string, taskId: string): boolean {
  if (resultProcessedMap.has(requestId)) {
    return false; // Already processed
  }

  resultProcessedMap.set(requestId, {
    requestId,
    taskId,
    processedAt: new Date(),
  });

  return true;
}

/**
 * Get processing info for a result
 */
export function getResultProcessingInfo(requestId: string): ResultEntry | undefined {
  return resultProcessedMap.get(requestId);
}

// ============================================
// Queue Stats (for debugging/monitoring)
// ============================================

export function getQueueStats(): {
  dequeuedCommands: number;
  processedResults: number;
  commandsByTask: Record<string, number>;
} {
  const commandsByTask: Record<string, number> = {};

  for (const entry of commandDequeueMap.values()) {
    commandsByTask[entry.taskId] = (commandsByTask[entry.taskId] || 0) + 1;
  }

  return {
    dequeuedCommands: commandDequeueMap.size,
    processedResults: resultProcessedMap.size,
    commandsByTask,
  };
}

// ============================================
// Relay Integration Helpers
// ============================================

/**
 * Generate a unique request ID for commands
 */
export function generateRequestId(taskId: string, iteration: number): string {
  return `${taskId}-${iteration}-${Date.now()}`;
}

/**
 * Extract taskId from requestId
 * Format: "taskId-iteration-timestamp"
 */
export function extractTaskIdFromRequestId(requestId: string): string {
  const parts = requestId.split('-');
  // Remove last 2 segments (iteration, timestamp)
  return parts.slice(0, -2).join('-');
}

/**
 * Extract iteration from requestId
 */
export function extractIterationFromRequestId(requestId: string): number {
  const parts = requestId.split('-');
  if (parts.length >= 2) {
    return parseInt(parts[parts.length - 2], 10);
  }
  return 0;
}

// ============================================
// Cleanup (runs periodically)
// ============================================

/**
 * Clean up old entries (older than 1 hour)
 * Called periodically to prevent memory leaks
 */
function cleanupOldEntries(): void {
  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);

  for (const [key, entry] of commandDequeueMap.entries()) {
    if (entry.dequeuedAt < oneHourAgo) {
      commandDequeueMap.delete(key);
    }
  }

  for (const [key, entry] of resultProcessedMap.entries()) {
    if (entry.processedAt < oneHourAgo) {
      resultProcessedMap.delete(key);
    }
  }
}

// Run cleanup every 5 minutes
if (typeof setInterval !== 'undefined') {
  setInterval(cleanupOldEntries, 5 * 60 * 1000);
}