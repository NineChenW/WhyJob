// src/lib/ai/agents/explorer/checkpointer.ts

/**
 * PostgresSaver checkpointer for Explorer Agent LangGraph state.
 *
 * Provides:
 * - Singleton PostgresSaver instance (auto-setup on first use)
 * - createThreadConfig() helper for consistent thread_id per task
 */

import { PostgresSaver } from '@langchain/langgraph-checkpoint-postgres';

let _saver: PostgresSaver | null = null;

/**
 * Get or create the singleton PostgresSaver checkpointer.
 * Creates checkpoint tables on first run via .setup().
 */
export async function getCheckpointer(): Promise<PostgresSaver> {
  if (_saver) return _saver;

  const dbUrl = process.env.DATABASE_URL;
  if (!dbUrl) throw new Error('DATABASE_URL not set');

  _saver = PostgresSaver.fromConnString(dbUrl);
  await _saver.setup();
  return _saver;
}

/**
 * Create a thread config for a given taskId.
 * Uses taskId as thread_id so all invocations of the same task
 * share the same checkpointed state.
 */
export function createThreadConfig(taskId: string) {
  return {
    configurable: {
      thread_id: taskId,
    },
  };
}