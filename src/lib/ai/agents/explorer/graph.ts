// src/lib/ai/agents/explorer/graph.ts

/**
 * Explorer Agent - LangGraph Integration
 *
 * This module implements the ReAct pattern using LangGraph's StateGraph.
 * Due to API changes in @langchain/langgraph, the implementation uses
 * the Annotation API for state definition.
 */

import { Annotation } from '@langchain/langgraph';
import type { ExplorationState, ContentType, LLMSDecision, ReActStep, PageVisit, Discovery, NetworkCall, ToolCall, ExplorationError, ExplorationResult } from './types';
import { EXPLORER_CONSTANTS } from './constants';

export { EXPLORER_CONSTANTS };

/**
 * State annotation using LangGraph's Annotation API
 */
const ExplorationAnnotation = Annotation.Root({
  // Immutable fields - set once at start, never change
  taskId: Annotation<string>(),
  companyId: Annotation<string>(),
  company: Annotation<ExplorationState['company']>(),
  contentTypes: Annotation<ContentType[]>(),
  maxIterations: Annotation<number>(),
  startTime: Annotation<Date>(),

  // Incremental fields - append new items
  iteration: Annotation<number>(),
  pagesVisited: Annotation<PageVisit[]>(),
  discoveries: Annotation<Discovery[]>(),
  networkCalls: Annotation<NetworkCall[]>(),
  toolCalls: Annotation<ToolCall[]>(),
  errors: Annotation<ExplorationError[]>(),
  reactTrace: Annotation<ReActStep[]>(),

  // Overwrite fields - latest value wins
  currentUrl: Annotation<string | undefined>(),
  pendingMonitoringId: Annotation<string | undefined>(),
  currentDecision: Annotation<LLMSDecision | undefined>(),
  reflectionNotes: Annotation<string | undefined>(),
  shouldContinue: Annotation<boolean>(),
  terminationReason: Annotation<'generate_config' | 'fail' | 'max_iterations' | undefined>(),
  finalResult: Annotation<ExplorationResult | undefined>(),
});

/**
 * Get the state annotation (for external use)
 */
export function getExplorationAnnotation() {
  return ExplorationAnnotation;
}

/**
 * Initialize exploration state
 */
export function initializeExplorationState(input: {
  taskId: string;
  companyId: string;
  company: {
    id: string;
    name: string;
    website?: string;
    industry?: string;
  };
  contentTypes: ContentType[];
  maxIterations?: number;
}): ExplorationState {
  return {
    taskId: input.taskId,
    companyId: input.companyId,
    company: input.company,
    contentTypes: input.contentTypes,
    iteration: 0,
    maxIterations: input.maxIterations ?? EXPLORER_CONSTANTS.DEFAULT_MAX_ITERATIONS,
    pagesVisited: [],
    discoveries: [],
    networkCalls: [],
    toolCalls: [],
    errors: [],
    reactTrace: [],
    shouldContinue: true,
    startTime: new Date(),
  };
}

/**
 * Create the Explorer Agent StateGraph
 *
 * Note: This returns the graph builder, not a compiled graph.
 * Call .compile() on the result to get an executable graph.
 *
 * The actual execution requires:
 * 1. Creating the graph with this function
 * 2. Compiling it with .compile()
 * 3. Running with .invoke() or .stream()
 *
 * Example usage:
 * ```
 * const graph = createExplorerGraph();
 * const compiled = graph.compile();
 * const result = await compiled.invoke(initialState, {
 *   configurable: { tool: chromeExtensionTool }
 * });
 * ```
 */
export function createExplorerGraph() {
  // Lazy import to avoid circular dependency issues
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { StateGraph, END, START } = require('@langchain/langgraph');

  const graph = new StateGraph({
    annotation: ExplorationAnnotation,
  });

  // Import nodes lazily to avoid circular dependencies
  const {
    llmDecisionNode,
    checkTerminationNode,
    executeToolNode,
    observeResultNode,
    reflectNode,
    generateConfigNode,
  } = require('./nodes');

  // Add nodes
  graph.addNode('llm_decision', llmDecisionNode);
  graph.addNode('check_termination', checkTerminationNode);
  graph.addNode('execute_tool', executeToolNode);
  graph.addNode('observe_result', observeResultNode);
  graph.addNode('reflect', reflectNode);
  graph.addNode('generate_config', generateConfigNode);

  // Define edges
  graph.addEdge(START, 'llm_decision');
  graph.addEdge('llm_decision', 'check_termination');

  // Conditional routing based on termination check
  graph.addConditionalEdges(
    'check_termination',
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (state: any) => state.terminationReason ?? 'execute_tool',
    {
      execute_tool: 'execute_tool',
      generate_config: 'generate_config',
      fail: END,
      max_iterations: 'generate_config',
    }
  );

  // After tool execution, observe, reflect, then loop
  graph.addEdge('execute_tool', 'observe_result');
  graph.addEdge('observe_result', 'reflect');
  graph.addEdge('reflect', 'llm_decision');

  // Config generation ends the graph
  graph.addEdge('generate_config', END);

  return graph;
}

/**
 * Run the explorer graph
 *
 * This is a convenience function that creates, compiles, and runs the graph.
 * For more control, use createExplorerGraph() directly.
 */
export async function runExplorerGraph(
  state: ExplorationState,
  serverUrl: string
): Promise<ExplorationState> {
  const { ChromeExtensionTool } = require('./tools/chrome-extension');

  const graph = createExplorerGraph();
  const compiled = graph.compile();

  const tool = new ChromeExtensionTool(serverUrl, state.taskId);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const result = await compiled.invoke(state as any, {
    configurable: { tool },
  });

  return result as ExplorationState;
}