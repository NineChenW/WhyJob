// src/lib/ai/agents/test-agent/types.ts

/**
 * Test Agent State Types
 *
 * Defines the state schema for the Test Agent's LangGraph.
 */

import { Annotation } from '@langchain/langgraph';

/**
 * Test Agent State
 *
 * Simple state for testing LLM node functionality.
 */
export interface TestAgentState {
  // Input
  taskId: string;

  // Messages for the LLM
  messages: Array<{
    role: 'user' | 'assistant' | 'system';
    content: string;
  }>;

  // LLM call count
  llmCallCount: number;

  // Final LLM response
  lastResponse?: string;

  // Error if any
  error?: string;
}

/**
 * LangGraph state annotation using Annotation API
 */
const TestAgentAnnotation = Annotation.Root({
  taskId: Annotation<string>(),
  messages: Annotation<Array<{
    role: 'user' | 'assistant' | 'system';
    content: string;
  }>>({
    reducer: (current, update) => [...current, ...update],
    default: () => [],
  }),
  llmCallCount: Annotation<number>({
    reducer: (current, update) => current + update,
    default: () => 0,
  }),
  lastResponse: Annotation<string | undefined>({
    reducer: (_current, update) => update,
    default: () => undefined,
  }),
  error: Annotation<string | undefined>({
    reducer: (_current, update) => update,
    default: () => undefined,
  }),
});

/**
 * Get the state annotation
 */
export function getTestAgentAnnotation() {
  return TestAgentAnnotation;
}

/**
 * State type derived from annotation (for type-safe nodes)
 */
export type TestAgentStateType = typeof TestAgentAnnotation;