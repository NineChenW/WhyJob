// src/lib/ai/agents/test-agent/graph.ts

/**
 * Test Agent - LangGraph Integration
 *
 * This module implements a basic LangGraph agent with a single LLM node.
 * It demonstrates object-oriented patterns and NVIDIA AI provider usage.
 *
 * Reference: https://docs.langchain.com/oss/javascript/langgraph/quickstart
 */

import { Annotation } from '@langchain/langgraph';
import type { TestAgentState } from './types';

/**
 * State annotation for Test Agent
 */
const TestAgentStateAnnotation = Annotation.Root({
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
 * Get the state annotation (for external use)
 */
export function getTestAgentAnnotation() {
  return TestAgentStateAnnotation;
}

/**
 * Initialize test agent state
 */
export function initializeTestAgentState(input: {
  taskId: string;
  messages?: Array<{ role: 'user' | 'assistant' | 'system'; content: string }>;
}): TestAgentState {
  return {
    taskId: input.taskId,
    messages: input.messages ?? [],
    llmCallCount: 0,
    lastResponse: undefined,
    error: undefined,
  };
}

/**
 * Create the Test Agent StateGraph
 *
 * Note: Returns the graph builder, not a compiled graph.
 * Call .compile() on the result to get an executable graph.
 *
 * Example usage:
 * ```
 * const graph = createTestAgentGraph();
 * const compiled = graph.compile();
 * const result = await compiled.invoke(initialState);
 * ```
 */
export function createTestAgentGraph() {
  // Lazy import to avoid circular dependency issues
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { StateGraph, END, START } = require('@langchain/langgraph');

  const graph = new StateGraph({
    stateSchema: TestAgentStateAnnotation,
  });

  // Import node lazily to avoid circular dependencies
  const { llmNode } = require('./nodes');

  // Add LLM node
  graph.addNode('llm', llmNode);

  // Define edges: START -> llm -> END
  graph.addEdge(START, 'llm');
  graph.addEdge('llm', END);

  return graph;
}

/**
 * Compile the Test Agent Graph
 */
export function compileTestAgentGraph() {
  const graph = createTestAgentGraph();
  return graph.compile();
}

/**
 * Run the Test Agent
 *
 * Convenience function that creates, compiles, and runs the graph.
 */
export async function runTestAgent(
  state: TestAgentState
): Promise<TestAgentState> {
  const compiled = compileTestAgentGraph();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const result = await compiled.invoke(state as any);

  return result as TestAgentState;
}

/**
 * Test Agent class (object-oriented interface)
 *
 * Provides a clean object-oriented interface to the test agent.
 *
 * Usage:
 * ```
 * const agent = new TestAgent();
 * const result = await agent.run({
 *   taskId: 'test-1',
 *   messages: [{ role: 'user', content: 'Hello!' }],
 * });
 * ```
 */
export class TestAgent {
  /**
   * Run the test agent with the given state
   */
  async run(state: TestAgentState): Promise<TestAgentState> {
    return runTestAgent(state);
  }

  /**
   * Create a new test agent graph
   */
  createGraph() {
    return createTestAgentGraph();
  }

  /**
   * Compile the graph
   */
  compile() {
    return compileTestAgentGraph();
  }
}