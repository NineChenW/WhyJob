# Explorer Agent - Exploration Loop Spec

## Overview

The exploration loop implements the **ReAct pattern** using LangGraph's StateGraph. It orchestrates the AI decision-making, Chrome Extension tool execution, result observation, and self-reflection through a deterministic, checkpointable loop with a maximum iteration guard.

**Iteration 3 Scope**: Full ReAct loop with LangGraph, proper state management, iteration guard, and reflection.

## Graph Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         LangGraph StateGraph                                │
│                                                                              │
│  START ──────┐                                                               │
│              │                                                               │
│              ▼                                                               │
│  ┌───────────────────────────────────────────────────────────────────────┐  │
│  │                      llm_decision Node                                │  │
│  │  ┌────────────────────────────────────────────────────────────────┐  │  │
│  │  │  Prompt Chain:                                                   │  │  │
│  │  │  System Prompt (role, rules)                                      │  │  │
│  │  │  + Context Prompt (state)                                        │  │  │
│  │  │  + ReAct Prompt (reasoning pattern)                              │  │  │
│  │  │  + Groq LLM (structured output)                                  │  │  │
│  │  └────────────────────────────────────────────────────────────────┘  │  │
│  │                                                                       │  │
│  │  Output: currentDecision, reactTrace entries                        │  │
│  └───────────────────────────────────────────────────────────────────────┘  │
│              │                                                               │
│              ▼                                                               │
│  ┌───────────────────────────────────────────────────────────────────────┐  │
│  │                   check_termination Node                              │  │
│  │                                                                       │  │
│  │  Checks:                                                              │  │
│  │  1. Is decision terminal? (GENERATE_CONFIG / FAIL)                   │  │
│  │  2. Max iterations reached?                                           │  │
│  │  3. Too many errors?                                                  │  │
│  │                                                                       │  │
│  │  Routing:                                                             │  │
│  │  - execute_tool → continue loop                                       │  │
│  │  - generate_config → END (success)                                   │  │
│  │  - fail / max_iterations → END (terminal)                            │  │
│  └───────────────────────────────────────────────────────────────────────┘  │
│              │                                                               │
│              ▼                                                               │
│  ┌───────────────────────────────────────────────────────────────────────┐  │
│  │                       execute_tool Node                                │  │
│  │                                                                       │  │
│  │  Chrome Extension Tool invocation:                                    │  │
│  │  - Build command from currentDecision                                │  │
│  │  - Send to extension via server relay                                 │  │
│  │  - Wait for result with timeout                                      │  │
│  │                                                                       │  │
│  │  Output: toolCalls[], errors[]                                        │  │
│  └───────────────────────────────────────────────────────────────────────┘  │
│              │                                                               │
│              ▼                                                               │
│  ┌───────────────────────────────────────────────────────────────────────┐  │
│  │                      observe_result Node                               │  │
│  │                                                                       │  │
│  │  Parse tool output:                                                   │  │
│  │  - Extract discoveries (API endpoints, job data, etc.)               │  │
│  │  - Capture network calls                                              │  │
│  │  - Record page visits                                                 │  │
│  │  - Update currentUrl, monitoringId                                    │  │
│  │                                                                       │  │
│  │  Output: discoveries[], networkCalls[], pagesVisited[]               │  │
│  └───────────────────────────────────────────────────────────────────────┘  │
│              │                                                               │
│              ▼                                                               │
│  ┌───────────────────────────────────────────────────────────────────────┐  │
│  │                        reflect Node                                    │  │
│  │                                                                       │  │
│  │  Self-correction:                                                     │  │
│  │  - Analyze if action was successful                                  │  │
│  │  - Adjust confidence based on observation                            │  │
│  │  - Generate reflection notes                                         │  │
│  │                                                                       │  │
│  │  Output: reactTrace updated, reflectionNotes                         │  │
│  └───────────────────────────────────────────────────────────────────────┘  │
│              │                                                               │
│              │   ┌──────────────────────────────────────────────┐          │
│              │   │         Iteration < Max?                      │          │
│              └───┼─────────      YES ───────────────────────────┼──────────┘
│                  │                    │                           │
│                  │                    NO                          │
│                  │                    ▼                           │
│                  │            ┌────────────────┐                   │
│                  └───────────▶│  generate_config│◀────────────────┘
│                               └────────────────┘                    │
│                                       │                             │
│                                       ▼                             │
│                                  ┌────────┐                        │
│                                  │  END   │                        │
│                                  └────────┘                        │
└─────────────────────────────────────────────────────────────────────────────┘
```

## State Channels

```typescript
// src/lib/ai/agents/explorer/graph.ts

import { StateGraph, END, START } from '@langgraph/langgraph';
import type { ExplorationState } from './types';

/**
 * State channel configuration
 * Defines how each state field is updated
 */
export function createExplorerGraph() {
  const graph = new StateGraph<ExplorationState>({
    // Immutable fields - set once at start
    immutable: ['taskId', 'companyId', 'company', 'contentTypes', 'maxIterations', 'startTime'],

    // Incremental fields - append/reduce
    paths: {
      // Iteration: increment on each loop
      iteration: (a, b) => (b !== undefined ? b : a) + 1,

      // History fields: append new items
      pagesVisited: (a, b) => (b && b.length > 0 ? [...a, ...b] : a),
      discoveries: (a, b) => (b && b.length > 0 ? [...a, ...b] : a),
      networkCalls: (a, b) => (b && b.length > 0 ? [...a, ...b] : a),
      toolCalls: (a, b) => (b && b.length > 0 ? [...a, ...b] : a),
      errors: (a, b) => (b && b.length > 0 ? [...a, ...b] : a),
      reactTrace: (a, b) => (b ? [...a, b] : a),
    },

    // Overwrite fields - latest value wins
    state: {
      currentUrl: (a, b) => b ?? a,
      pendingMonitoringId: (a, b) => b ?? a,
      currentDecision: (a, b) => b ?? a,
      reflectionNotes: (a, b) => b ?? a,
      shouldContinue: (a, b) => b ?? a,
      terminationReason: (a, b) => b ?? a,
      finalResult: (a, b) => b ?? a,
    },
  });

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
    (state) => state.terminationReason ?? 'execute_tool',
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
```

## Node Implementations

### 1. LLM Decision Node

```typescript
// src/lib/ai/agents/explorer/nodes/llm-decision.ts

import { buildPromptChain } from '../prompts';
import { groqChatCompletion, getGroqModel } from '../../client';
import { GROQ_DECISION_SCHEMA, groqDecisionSchema } from '../prompts/schemas';
import type { ExplorationState } from '../types';

const DECISION_TEMPERATURE = 0.3;
const DECISION_MAX_TOKENS = 1024;

/**
 * LLM Decision Node
 *
 * Builds prompt chain from current state and calls Groq
 * to get the next ReAct action decision.
 */
async function llmDecisionNode(state: ExplorationState): Promise<Partial<ExplorationState>> {
  // Build prompt chain: System + Context + ReAct
  const { systemPrompt, userPrompt } = buildPromptChain(state);

  // Add reflection hint if we have prior steps
  const reflectionHint = state.reactTrace.length > 0
    ? '\n\n[Reflection] Consider if previous actions led to progress. Adjust strategy if needed.'
    : '';

  try {
    const completion = await groqChatCompletion({
      model: getGroqModel(),
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt + reflectionHint },
      ],
      temperature: DECISION_TEMPERATURE,
      max_tokens: DECISION_MAX_TOKENS,
      response_format: { type: 'json_schema', json_schema: GROQ_DECISION_SCHEMA },
    });

    const rawResponse = completion.choices[0]?.message?.content;
    if (!rawResponse) throw new Error('Empty Groq response');

    const decision = groqDecisionSchema.parse(JSON.parse(rawResponse));

    // Add to ReAct trace
    const reactStep: ExplorationState['reactTrace'][0] = {
      stepNumber: state.reactTrace.length + 1,
      thought: decision.reasoning,
      action: decision.action,
      actionInput: decision.target,
      timestamp: new Date(),
    };

    return {
      currentDecision: {
        action: decision.action,
        target: decision.target,
        reasoning: decision.reasoning,
        confidence: decision.confidence,
      },
      reactTrace: [...state.reactTrace, reactStep],
      shouldContinue: true,
    };

  } catch (error) {
    console.error('[llm_decision] Error:', error);
    return getFallbackDecision(state);
  }
}

function getFallbackDecision(state: ExplorationState) {
  const { iteration, pagesVisited, discoveries, company } = state;

  let action: string;
  let target: unknown;
  let reasoning: string;
  let confidence: number;

  if (iteration === 0 && pagesVisited.length === 0) {
    action = 'NAVIGATE';
    target = { url: company.website || `https://www.${company.name.toLowerCase().replace(/\s+/g, '')}.com` };
    reasoning = 'Fallback: Navigate to company website';
    confidence = 70;
  } else if (pagesVisited.length > 0 && discoveries.length === 0) {
    action = 'GET_SNAPSHOT';
    target = undefined;
    reasoning = 'Fallback: Capture page content';
    confidence = 80;
  } else if (discoveries.length > 0) {
    action = 'GENERATE_CONFIG';
    target = undefined;
    reasoning = 'Fallback: Generate config with current discoveries';
    confidence = 50;
  } else {
    action = 'FAIL';
    target = undefined;
    reasoning = 'Fallback: Cannot progress, failing';
    confidence = 0;
  }

  return {
    currentDecision: { action, target, reasoning, confidence },
    reactTrace: [
      ...state.reactTrace,
      {
        stepNumber: state.reactTrace.length + 1,
        thought: reasoning,
        action,
        actionInput: target,
        reflection: 'Fallback due to LLM error',
        timestamp: new Date(),
      },
    ],
    shouldContinue: action !== 'FAIL',
  };
}
```

### 2. Check Termination Node

```typescript
// src/lib/ai/agents/explorer/nodes/check-termination.ts

import type { ExplorationState } from '../types';

/**
 * Check Termination Node
 *
 * Evaluates whether the exploration loop should continue or terminate.
 * Checks for:
 * 1. Terminal LLM decisions (GENERATE_CONFIG, FAIL)
 * 2. Max iterations reached
 * 3. Excessive errors (no progress)
 */
async function checkTerminationNode(state: ExplorationState): Promise<Partial<ExplorationState>> {
  const { iteration, maxIterations, currentDecision, errors, discoveries } = state;

  // Check 1: Terminal LLM decision
  if (currentDecision?.action === 'GENERATE_CONFIG') {
    return {
      shouldContinue: false,
      terminationReason: 'generate_config',
    };
  }

  if (currentDecision?.action === 'FAIL') {
    return {
      shouldContinue: false,
      terminationReason: 'fail',
    };
  }

  // Check 2: Max iterations reached
  if (iteration >= maxIterations) {
    return {
      shouldContinue: false,
      terminationReason: 'max_iterations',
      reflectionNotes: `Reached max iterations (${maxIterations}). ${discoveries.length} discoveries found.`,
    };
  }

  // Check 3: Too many consecutive errors
  const recentErrors = errors.filter(e => e.iteration >= iteration - 2);
  if (recentErrors.length >= 3 && iteration >= 2) {
    return {
      shouldContinue: false,
      terminationReason: 'fail',
      reflectionNotes: 'Too many consecutive errors, no progress made.',
    };
  }

  // Continue loop
  return {
    shouldContinue: true,
  };
}
```

### 3. Execute Tool Node

```typescript
// src/lib/ai/agents/explorer/nodes/execute-tool.ts

import type { ExplorationState, LLMSDecision } from '../types';
import type { ChromeExtensionTool } from '../tools/chrome-extension';

/**
 * Execute Tool Node
 *
 * Invokes the Chrome Extension tool with parameters from currentDecision.
 * Handles the command/response protocol with the extension.
 */
async function executeToolNode(
  state: ExplorationState,
  context: { tool: ChromeExtensionTool }
): Promise<Partial<ExplorationState>> {
  const { currentDecision } = state;
  if (!currentDecision) {
    throw new Error('No current decision - cannot execute tool');
  }

  // Skip tool execution for terminal actions
  if (currentDecision.action === 'GENERATE_CONFIG' || currentDecision.action === 'FAIL') {
    return {};
  }

  // Build tool input from decision
  const toolInput = buildToolInput(currentDecision);
  const startTime = Date.now();

  let output: unknown;
  let error: string | undefined;

  try {
    output = await context.tool.invoke({
      action: currentDecision.action,
      params: toolInput,
    });
  } catch (e) {
    error = String(e);
  }

  const toolCall: ExplorationState['toolCalls'][0] = {
    tool: currentDecision.action,
    input: toolInput,
    output,
    error,
    timestamp: new Date(),
    duration: Date.now() - startTime,
  };

  return {
    toolCalls: [toolCall],
    errors: error
      ? [...state.errors, { iteration: state.iteration, tool: currentDecision.action, error, timestamp: new Date() }]
      : state.errors,
  };
}

function buildToolInput(decision: LLMSDecision): Record<string, unknown> {
  const { action, target } = decision;

  switch (action) {
    case 'NAVIGATE':
      return { url: target?.url };
    case 'GET_SNAPSHOT':
      return {};
    case 'EXTRACT_DOM':
      return { selectors: target?.selectors };
    case 'EXECUTE_JS':
      return { script: target?.script, args: target?.args ?? {} };
    case 'START_NETWORK_MONITORING':
      return {};
    case 'GET_NETWORK_LOG':
      return { monitoringId: target?.monitoringId, filter: target?.filter };
    case 'STOP_NETWORK_MONITORING':
      return { monitoringId: target?.monitoringId };
    default:
      return {};
  }
}
```

### 4. Observe Result Node

```typescript
// src/lib/ai/agents/explorer/nodes/observe-result.ts

import { parseToolResult } from '../result-parser';
import type { ExplorationState } from '../types';

/**
 * Observe Result Node
 *
 * Parses tool output and extracts:
 * - Discoveries (API endpoints, job data, etc.)
 * - Network calls
 * - Page visits
 * - Updated state (currentUrl, monitoringId)
 */
async function observeResultNode(state: ExplorationState): Promise<Partial<ExplorationState>> {
  const { currentDecision, toolCalls } = state;

  if (!currentDecision || toolCalls.length === 0) {
    return {};
  }

  const lastCall = toolCalls[toolCalls.length - 1];
  const parsed = parseToolResult(currentDecision.action, lastCall.output, lastCall.error);

  // Update ReAct trace with observation
  const updatedTrace = state.reactTrace.map((step, i) =>
    i === state.reactTrace.length - 1
      ? { ...step, observation: parsed.observation }
      : step
  );

  return {
    reactTrace: updatedTrace,
    pagesVisited: parsed.pageVisit ? [parsed.pageVisit] : [],
    discoveries: parsed.discoveries,
    networkCalls: parsed.networkCalls,
    currentUrl: parsed.currentUrl ?? state.currentUrl,
    pendingMonitoringId: parsed.monitoringId ?? state.pendingMonitoringId,
  };
}
```

### 5. Reflect Node

```typescript
// src/lib/ai/agents/explorer/nodes/reflect.ts

import type { ExplorationState } from '../types';

/**
 * Reflect Node
 *
 * Self-correction and confidence adjustment after tool execution.
 * Analyzes whether the last action led to progress.
 */
async function reflectNode(state: ExplorationState): Promise<Partial<ExplorationState>> {
  const { currentDecision, reactTrace, discoveries, errors, iteration } = state;

  if (!currentDecision) return {};

  const lastStep = reactTrace[reactTrace.length - 1];
  if (!lastStep) return {};

  // Generate reflection
  const reflection = generateReflection({
    lastDecision: currentDecision,
    lastObservation: lastStep.observation,
    discoveries,
    errors,
    iteration,
  });

  // Adjust confidence based on reflection
  const adjustedConfidence = adjustConfidence(currentDecision.confidence, reflection);

  // Update trace with reflection
  const updatedTrace = reactTrace.map((step, i) =>
    i === reactTrace.length - 1
      ? { ...step, reflection }
      : step
  );

  return {
    reactTrace: updatedTrace,
    reflectionNotes: reflection,
    currentDecision: { ...currentDecision, confidence: adjustedConfidence },
  };
}

function generateReflection(params: {
  lastDecision: ExplorationState['currentDecision'];
  lastObservation?: string;
  discoveries: ExplorationState['discoveries'];
  errors: ExplorationState['errors'];
  iteration: number;
}): string {
  const { lastDecision, lastObservation, discoveries, errors, iteration } = params;

  const parts: string[] = [];

  // Check for new discoveries
  const newDiscoveries = discoveries.filter(d => d.timestamp &&
    Date.now() - new Date(d.timestamp).getTime() < 60000); // Last minute

  if (newDiscoveries.length > 0) {
    parts.push(`Found ${newDiscoveries.length} new discovery(ies).`);
  }

  // Check for errors
  const recentErrors = errors.filter(e => e.iteration === iteration);
  if (recentErrors.length > 0) {
    parts.push(`Error occurred: ${recentErrors[0].error}`);
  }

  // Check confidence
  if (lastDecision && lastDecision.confidence < 50) {
    parts.push('Low confidence - consider alternative approach.');
  }

  // Check observation content
  if (lastObservation?.includes('API endpoint')) {
    parts.push('Good: Found API endpoint.');
  } else if (lastObservation?.includes('Error')) {
    parts.push('Action failed - may need to retry or try different approach.');
  }

  return parts.length > 0 ? parts.join(' ') : 'No significant changes noted.';
}

function adjustConfidence(
  originalConfidence: number,
  reflection: string
): number {
  let adjusted = originalConfidence;

  // Increase confidence if we found something
  if (reflection.includes('Found') && reflection.includes('discovery')) {
    adjusted = Math.min(100, adjusted + 10);
  }

  // Decrease if errors
  if (reflection.includes('Error')) {
    adjusted = Math.max(0, adjusted - 15);
  }

  // Decrease if low confidence warning
  if (reflection.includes('Low confidence')) {
    adjusted = Math.max(0, adjusted - 10);
  }

  return adjusted;
}
```

### 6. Generate Config Node

```typescript
// src/lib/ai/agents/explorer/nodes/generate-config.ts

import { buildFetchConfig } from '../fetchconfig-generator';
import type { ExplorationState } from '../types';

/**
 * Generate Config Node
 *
 * Creates FetchConfig from accumulated discoveries.
 * This is the terminal node on successful completion.
 */
async function generateConfigNode(state: ExplorationState): Promise<Partial<ExplorationState>> {
  const config = buildFetchConfig(state);

  const success = !!config;
  const status = !success
    ? 'failed'
    : state.terminationReason === 'max_iterations'
      ? 'max_iterations'
      : 'complete';

  return {
    finalResult: {
      success,
      taskId: state.taskId,
      status,
      config,
      iterations: state.iteration,
      discoveries: state.discoveries,
      confidence: config?.confidence ?? calculateOverallConfidence(state.discoveries),
      reason: !success
        ? 'No valid discoveries found to generate config'
        : state.terminationReason === 'max_iterations'
          ? `Max iterations (${state.maxIterations}) reached`
          : undefined,
    },
    shouldContinue: false,
  };
}

function calculateOverallConfidence(discoveries: ExplorationState['discoveries']): number {
  if (discoveries.length === 0) return 0;

  const avgConfidence = discoveries.reduce((sum, d) => sum + d.confidence, 0) / discoveries.length;

  // Boost for API endpoints
  const hasApi = discoveries.some(d => d.type === 'api_endpoint');
  const boost = hasApi ? 15 : 0;

  // Reduce for errors
  const errorCount = discoveries.filter(d => d.type === 'no_content' || !d.confidence).length;
  const penalty = errorCount * 5;

  return Math.max(0, Math.min(100, avgConfidence + boost - penalty));
}
```

## Iteration Guard

```typescript
// src/lib/ai/agents/explorer/graph.ts

const DEFAULT_MAX_ITERATIONS = 5;

/**
 * The iteration guard is implemented in check_termination node.
 * It checks:
 *
 * 1. iteration >= maxIterations → terminate with 'max_iterations'
 * 2. currentDecision.action in ['GENERATE_CONFIG', 'FAIL'] → terminate
 * 3. consecutive errors >= 3 after iteration >= 2 → terminate with 'fail'
 *
 * The loop structure is:
 *
 * for (let iteration = 0; iteration < maxIterations; iteration++) {
 *   // Each iteration goes through: llm_decision → check_termination →
 *   // execute_tool → observe_result → reflect → (back to llm_decision)
 * }
 */

// Progress logging
function logIteration(state: ExplorationState): void {
  console.log(`[Explorer] Iteration ${state.iteration + 1}/${state.maxIterations}`);
  console.log(`[Explorer] Pages: ${state.pagesVisited.length}, Discoveries: ${state.discoveries.length}`);
  console.log(`[Explorer] Errors: ${state.errors.length}`);
  console.log(`[Explorer] Last action: ${state.reactTrace[state.reactTrace.length - 1]?.action}`);
}
```

## Constants

```typescript
// src/lib/ai/agents/explorer/constants.ts

export const EXPLORER_CONSTANTS = {
  // Iteration control
  DEFAULT_MAX_ITERATIONS: 5,
  MIN_ITERATIONS_BEFORE_FAIL: 2,
  MAX_CONSECUTIVE_ERRORS: 3,

  // Timing
  ACTION_TIMEOUT_MS: 30000,
  LLM_TIMEOUT_MS: 10000,
  POLL_INTERVAL_MS: 500,

  // Confidence thresholds
  HIGH_CONFIDENCE: 70,
  MEDIUM_CONFIDENCE: 50,
  LOW_CONFIDENCE: 30,

  // Action confidence adjustments
  CONFIDENCE_BOOST_API: 15,
  CONFIDENCE_PENALTY_ERROR: 15,
  CONFIDENCE_PENALTY_LOW: 10,
};
```

## Reference

- `@docs/ai-assist-fetch-info-plan.md` - Full system design
- `@context/features/explorer-agent-06-ai-exploration-agent-spec.md` - Main exploration spec
- `@context/features/explorer-agent-07-groq-integration-spec.md` - Groq integration
- LangGraph.js StateGraph: https://langchain-ai.github.io/langgraphjs/

## Notes

- **Deterministic**: Same state always produces same decisions
- **Checkpointable**: LangGraph saves state between node invocations
- **ReAct Trace**: Full reasoning history for debugging
- **Self-correcting**: Reflection node adjusts confidence
- **Graceful Degradation**: Fallback decisions when AI unavailable