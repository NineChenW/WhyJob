// src/lib/ai/agents/explorer/graph.ts

/**
 * Explorer Agent - LangGraph Integration
 *
 * This module implements the ReAct pattern using LangGraph's StateGraph.
 * Uses domain-organized state structure matching ExplorationState interface.
 */

import { Annotation } from '@langchain/langgraph';
import type {
  ExplorationState,
  ContentType,
  LLMDecision,
  TaskInfo,
  IterationControl,
  ExplorationMemory,
  IterationHistory,
  AgentContext,
  ExplorationResultData,
} from './types';
import { EXPLORER_CONSTANTS } from './constants';
import { getCheckpointer, createThreadConfig } from './checkpointer';

export { EXPLORER_CONSTANTS };

/**
 * State annotation using LangGraph's Annotation API
 * Uses nested structure matching ExplorationState interface
 */
const ExplorationAnnotation = Annotation.Root({
  // Identity group
  task: Annotation<TaskInfo>(),

  // Loop control group
  iteration: Annotation<IterationControl>(),

  // Collective memory group
  memory: Annotation<ExplorationMemory>(),

  // Iteration history group (one snapshot per iteration)
  history: Annotation<IterationHistory>(),

  // Current context group
  context: Annotation<AgentContext>(),

  // Final result
  result: Annotation<ExplorationResultData | undefined>(),

  // Metadata
  startTime: Annotation<Date>(),
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
  const maxIterations = input.maxIterations ?? EXPLORER_CONSTANTS.DEFAULT_MAX_ITERATIONS;

  return {
    task: {
      taskId: input.taskId,
      companyId: input.companyId,
      company: input.company,
      contentTypes: input.contentTypes,
    },
    iteration: {
      iteration: 0,
      maxIterations,
      shouldContinue: true,
    },
    memory: {
      pagesVisited: [],
      discoveries: [],
      errors: [],
    },
    history: {
      snapshots: [],
      waitingForExtensionResult: undefined,
    },
    context: {
      currentUrl: undefined,
      pendingMonitoringId: undefined,
    },
    result: undefined,
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
 * 2. Compiling it with .compile({ checkpointer })
 * 3. Running with .invoke() or .stream()
 *
 * Example usage:
 * ```
 * const checkpointer = await getCheckpointer();
 * const graph = createExplorerGraph();
 * const compiled = graph.compile({ checkpointer });
 * const result = await compiled.invoke(initialState, {
 *   configurable: { tool: chromeExtensionTool, thread_id: taskId }
 * });
 * ```
 */
export function createExplorerGraph() {
  // Lazy import to avoid circular dependency issues
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { StateGraph, END, START } = require('@langchain/langgraph');

  const graph = new StateGraph({
    stateSchema: ExplorationAnnotation,
  });

  // Import nodes lazily to avoid circular dependencies
  const {
    llmDecisionNode,
    checkTerminationNode,
    executeToolNode,
    waitForExtensionNode,
    observeResultNode,
    reflectNode,
    generateConfigNode,
    testConfigNode,
  } = require('./nodes');

  // Add nodes
  graph.addNode('llm_decision', llmDecisionNode);
  graph.addNode('check_termination', checkTerminationNode);
  graph.addNode('execute_tool', executeToolNode);
  graph.addNode('wait_for_extension', waitForExtensionNode);
  graph.addNode('observe_result', observeResultNode);
  graph.addNode('reflect', reflectNode);
  graph.addNode('generate_config', generateConfigNode);
  graph.addNode('test_config', testConfigNode);

  // Define edges
  graph.addEdge(START, 'llm_decision');
  graph.addEdge('llm_decision', 'check_termination');

  // Conditional routing based on termination check
  graph.addConditionalEdges(
    'check_termination',
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (state: any) => state.iteration?.terminationReason ?? 'execute_tool',
    {
      execute_tool: 'execute_tool',
      generate_config: 'generate_config',
      fail: END,
      max_iterations: 'generate_config',
    }
  );

  // wait_for_extension suspends via interrupt - graph pauses until resumed
  graph.addEdge('execute_tool', 'wait_for_extension');
  graph.addEdge('wait_for_extension', 'observe_result');
  graph.addEdge('observe_result', 'reflect');
  graph.addEdge('reflect', 'llm_decision');

  // Config generation: generate_config → test_config → END
  graph.addEdge('generate_config', 'test_config');
  graph.addEdge('test_config', END);

  return graph;
}

/**
 * Compile the Explorer Graph with checkpointer and interrupt configuration.
 * Uses interruptAfter to ensure graph suspends at the right point.
 */
export async function compileExplorerGraph(checkpointer: any) {
  const graph = createExplorerGraph();

  return graph.compile({
    checkpointer,
    // Use interruptAfter to suspend after wait_for_extension completes pending call
    // This ensures the graph pauses at a predictable point for resume
    interruptAfter: ['wait_for_extension'],
  });
}

/**
 * Run the explorer graph
 *
 * This is a convenience function that creates, compiles, and runs the graph.
 * For more control, use createExplorerGraph() directly.
 *
 * With PostgresSaver checkpointer:
 * - State is persisted after every node completes
 * - If thread_id has a previous checkpoint, LangGraph loads it automatically
 * - Use interrupt() in nodes to pause and resume cleanly
 */
export async function runExplorerGraph(
  state: ExplorationState,
  serverUrl: string
): Promise<ExplorationState> {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { ChromeExtensionTool } = require('./tools/chrome-extension');

  const checkpointer = await getCheckpointer();
  const graph = createExplorerGraph();
  const compiled = graph.compile({ checkpointer });

  const tool = new ChromeExtensionTool(serverUrl, state.task.taskId);
  const config = createThreadConfig(state.task.taskId);

  // No getResumeContext() needed - checkpointer persists state automatically
  // If this task was previously interrupted, LangGraph loads that checkpoint
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const result = await compiled.invoke(state as any, {
    ...config,
    configurable: {
      ...config.configurable,
      tool,
    },
  });

  return result as ExplorationState;
}