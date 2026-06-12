/**
 * HTTP Polling Relay
 *
 * Manages command/result queues for the Explorer Agent ↔ Chrome Extension
 * communication via HTTP polling.
 *
 * Note: This uses in-memory storage for Iteration 1.
 * Production would use Redis or similar for cross-instance sharing.
 */

import { Command, CommandResult } from '@/schemas/explorer';

// In-memory stores for testing
const commandQueue = new Map<string, Command[]>();
const resultStore = new Map<string, CommandResult[]>();

// ============================================
// Command Queue (Server → Extension)
// ============================================

/**
 * Add a command for an extension to execute
 */
export function addCommand(extensionId: string, command: Command): void {
  const existing = commandQueue.get(extensionId) || [];
  existing.push(command);
  commandQueue.set(extensionId, existing);
}

/**
 * Add multiple commands for an extension
 */
export function addCommands(extensionId: string, commands: Command[]): void {
  const existing = commandQueue.get(extensionId) || [];
  existing.push(...commands);
  commandQueue.set(extensionId, existing);
}

/**
 * Get and consume all pending commands for an extension
 * Commands are removed after being fetched (fire-and-forget)
 */
export function getCommands(extensionId: string): Command[] {
  const commands = commandQueue.get(extensionId) || [];
  commandQueue.delete(extensionId);
  return commands;
}

/**
 * Peek at commands without consuming them
 */
export function peekCommands(extensionId: string): Command[] {
  return commandQueue.get(extensionId) || [];
}

// ============================================
// Result Store (Extension → Server)
// ============================================

/**
 * Add a result from command execution
 */
export function addResult(extensionId: string, result: CommandResult): void {
  const existing = resultStore.get(extensionId) || [];
  existing.push(result);
  resultStore.set(extensionId, existing);
}

/**
 * Add multiple results from command executions
 */
export function addResults(extensionId: string, results: CommandResult[]): void {
  const existing = resultStore.get(extensionId) || [];
  existing.push(...results);
  resultStore.set(extensionId, existing);
}

/**
 * Get and consume all results for an agent
 * Results are removed after being fetched
 */
export function getResults(extensionId: string): CommandResult[] {
  const results = resultStore.get(extensionId) || [];
  resultStore.delete(extensionId);
  return results;
}

/**
 * Peek at results without consuming them
 */
export function peekResults(extensionId: string): CommandResult[] {
  return resultStore.get(extensionId) || [];
}

// ============================================
// Utility Functions
// ============================================

/**
 * Clear all commands for an extension
 */
export function clearCommands(extensionId: string): void {
  commandQueue.delete(extensionId);
}

/**
 * Clear all results for an extension
 */
export function clearResults(extensionId: string): void {
  resultStore.delete(extensionId);
}

/**
 * Clear all queues (for testing)
 */
export function clearAll(): void {
  commandQueue.clear();
  resultStore.clear();
}

/**
 * Get queue statistics (for debugging/monitoring)
 */
export function getQueueStats(): {
  commandQueueSize: number;
  resultStoreSize: number;
  extensionIds: string[];
} {
  const extensionIds = new Set([
    ...commandQueue.keys(),
    ...resultStore.keys(),
  ]);
  return {
    commandQueueSize: Array.from(commandQueue.values()).reduce(
      (acc, cmds) => acc + cmds.length,
      0
    ),
    resultStoreSize: Array.from(resultStore.values()).reduce(
      (acc, results) => acc + results.length,
      0
    ),
    extensionIds: Array.from(extensionIds),
  };
}