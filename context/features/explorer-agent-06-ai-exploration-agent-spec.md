# Explorer Agent - AI Exploration Agent Spec (Iteration 3)

## Overview

AI Exploration Agent uses **LangGraph.js** for scalable, production-grade agent orchestration following the **ReAct pattern** (Reasoning + Acting + Observing). The Chrome Extension is integrated as a first-class **Tool**, and the architecture follows professional AI Agent patterns with clear extensibility points.

**Iteration 3 Scope**: Full LangGraph ReAct implementation with proper prompt chaining, Chrome Extension Tool, Memory system, and pluggable Tool/Skill/RAG/MCP interfaces.

## ReAct Pattern Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         ReAct Exploration Loop                               │
│                                                                              │
│   ┌─────────────────────────────────────────────────────────────────────┐   │
│   │                        PROMPT CHAIN                                 │   │
│   │                                                                      │   │
│   │  ┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐  │   │
│   │  │   System Prompt │ +  │  User/Context   │ +  │  ReAct Trace    │  │   │
│   │  │   (Static)       │    │  Prompt (State) │    │  (Reasoning)   │  │   │
│   │  └─────────────────┘    └─────────────────┘    └─────────────────┘  │   │
│   │                                                                      │   │
│   └─────────────────────────────────────────────────────────────────────┘   │
│                                       │                                     │
│                                       ▼                                     │
│   ┌─────────────────────────────────────────────────────────────────────┐   │
│   │                        LLM Node (Groq)                               │   │
│   │                                                                      │   │
│   │  1. THINK: Analyze state, reason about best action                  │   │
│   │  2. DECIDE: Select action or reflection                             │   │
│   │  3. OUTPUT: Structured decision with reasoning                      │   │
│   │                                                                      │   │
│   └─────────────────────────────────────────────────────────────────────┘   │
│                                       │                                     │
│                                       ▼                                     │
│   ┌─────────────────────────────────────────────────────────────────────┐   │
│   │                    Conditional Routing                              │   │
│   │                                                                      │   │
│   │  ┌───────────────┐  ┌────────────────┐  ┌──────────────────────┐   │   │
│   │  │ Tool Call?    │  │ Generate Config│  │ Fail / Reflection    │   │   │
│   │  │   ↓          │  │    (END)        │  │    (END)              │   │   │
│   │  └───────────────┘  └────────────────┘  └──────────────────────┘   │   │
│   │                                                                      │   │
│   └─────────────────────────────────────────────────────────────────────┘   │
│                                       │                                     │
│                                       ▼                                     │
│   ┌─────────────────────────────────────────────────────────────────────┐   │
│   │                        TOOL NODE                                     │   │
│   │              Chrome Extension Tool Invocation                        │   │
│   └─────────────────────────────────────────────────────────────────────┘   │
│                                       │                                     │
│                                       ▼                                     │
│   ┌─────────────────────────────────────────────────────────────────────┐   │
│   │                     OBSERVATION NODE                                 │   │
│   │              Parse result, extract discoveries                       │   │
│   └─────────────────────────────────────────────────────────────────────┘   │
│                                       │                                     │
│                                       ▼                                     │
│   ┌─────────────────────────────────────────────────────────────────────┐   │
│   │                     REFLECTION NODE                                  │   │
│   │              Self-correction check, shouldContinue decision          │   │
│   └─────────────────────────────────────────────────────────────────────┘   │
│                                       │                                     │
│   ┌───────────────────────────────────┼───────────────────────────────┐   │
│   │                                   │                               │   │
│   │                            ┌──────┴──────┐                        │   │
│   │                            │ Continue?   │                        │   │
│   │                            └──────┬──────┘                        │   │
│   │                                   │                               │   │
│   │                            loop back to PROMPT CHAIN               │   │
│   │                                                                      │   │
└───┼───────────────────────────────────┼───────────────────────────────────┘
    │                                   │
    └─────────────── Max Iterations ─────┘
```

## LangGraph State Definition

```typescript
// src/lib/ai/agents/explorer/types.ts

export type ContentType = 'company_culture' | 'job_listing' | 'company_wechat';

export interface ExplorationState {
  // Task Context
  taskId: string;
  companyId: string;
  company: {
    id: string;
    name: string;
    website?: string;
    industry?: string;
  };
  contentTypes: ContentType[];

  // Iteration Control
  iteration: number;
  maxIterations: number;

  // Memory & History
  pagesVisited: PageVisit[];
  discoveries: Discovery[];
  networkCalls: NetworkCall[];
  toolCalls: ToolCall[];
  errors: ExplorationError[];

  // ReAct Trace (the reasoning chain)
  reactTrace: ReActStep[];

  // Agent State
  currentUrl?: string;
  pendingMonitoringId?: string;

  // Decision from LLM
  currentDecision?: LLMSDecision;
  reflectionNotes?: string;

  // Termination
  shouldContinue: boolean;
  terminationReason?: string;
  finalResult?: ExplorationResult;

  // Metadata
  startTime: Date;
}

export interface ReActStep {
  stepNumber: number;
  thought: string;      // Reasoning about current state
  action: string;      // Action decided
  actionInput?: unknown; // Input to the action
  observation?: string; // Result of action (filled after tool execution)
  reflection?: string;  // Self-correction notes
}

export interface LLMSDecision {
  action: ExplorationAction;
  target?: {
    url?: string;
    selectors?: Record<string, string>;
    script?: string;
    args?: Record<string, unknown>;
    monitoringId?: string;
    filter?: NetworkFilter;
  };
  reasoning: string;      // Why this action was chosen
  confidence: number;     // 0-100
  reflectionPrompt?: string; // Optional prompt for reflection node
}

export type ExplorationAction =
  | 'NAVIGATE'
  | 'GET_SNAPSHOT'
  | 'EXTRACT_DOM'
  | 'EXECUTE_JS'
  | 'START_NETWORK_MONITORING'
  | 'GET_NETWORK_LOG'
  | 'STOP_NETWORK_MONITORING'
  | 'ANALYZE_DATA'
  | 'GENERATE_CONFIG'
  | 'FAIL'
  | 'REFLECT';

export interface NetworkFilter {
  urlPattern?: string;
  methods?: string[];
  statusRange?: '2xx' | '3xx' | '4xx' | '5xx';
}
```

## Prompt Chain Architecture

### 1. System Prompt (Static)

```typescript
// src/lib/ai/agents/explorer/prompts/system-prompt.ts

/**
 * System prompt - Agent role, capabilities, and rules
 * This is the STATIC part of the prompt chain
 */
export const SYSTEM_PROMPT = `You are an expert Web Exploration AI Agent. Your mission is to discover company data (job listings, company culture, WeChat accounts) by exploring company websites through a Chrome browser extension.

## Your Capabilities

You have access to the following browser automation tools:

| Tool | Description | When to Use |
|------|-------------|-------------|
| NAVIGATE(url) | Navigate browser to URL | Always start with this |
| GET_SNAPSHOT() | Capture page HTML, text, network calls | After navigation, after JS execution |
| EXTRACT_DOM(selectors) | Extract specific DOM elements | When you know specific selectors |
| EXECUTE_JS(script, args?) | Run JavaScript in page | For dynamic content, "Load More" buttons |
| START_NETWORK_MONITORING() | Begin capturing network requests | Before scrolling/interacting |
| GET_NETWORK_LOG(monitoringId?) | Retrieve captured network calls | After interactions complete |
| STOP_NETWORK_MONITORING(monitoringId) | Stop capturing network requests | After finding API endpoints |

## Decision Rules

1. **First Action**: Always NAVIGATE to company website or careers page
2. **After Navigation**: Always GET_SNAPSHOT to see page content
3. **Dynamic Content**: Use EXECUTE_JS to click "Load More" or scroll
4. **API Discovery**: Use network monitoring to find JSON APIs
5. **Data Found**: If you found structured API data, GENERATE_CONFIG immediately
6. **No Progress**: If no useful data after 3 iterations, consider FAIL
7. **Max Iterations**: Stop after 5 iterations even if incomplete

## Output Format

You must respond with a JSON object containing:
{
  "action": "ACTION_NAME",
  "target": { /* action-specific parameters */ },
  "reasoning": "Why you chose this action",
  "confidence": 0-100
}

## Important Guidelines

- Prioritize finding JSON APIs over web scraping (APIs are more reliable)
- Look for /api/, /jobs, /positions, /careers in URLs
- If a page requires login/auth, note it and move on
- Always capture the full URL including query parameters from network calls
- Confidence below 50 should trigger consideration of alternative approaches`;
```

### 2. User/Context Prompt (Dynamic State)

```typescript
// src/lib/ai/agents/explorer/prompts/context-prompt.ts

import type { ExplorationState, PageVisit, Discovery, NetworkCall, ExplorationError } from '../types';

interface ContextPromptInput {
  state: ExplorationState;
}

export function buildContextPrompt(input: ContextPromptInput): string {
  const { state } = input;
  const {
    company,
    contentTypes,
    iteration,
    maxIterations,
    pagesVisited,
    discoveries,
    networkCalls,
    errors,
    reactTrace,
    currentUrl,
  } = state;

  // Format pages visited
  const pagesText = formatPagesVisited(pagesVisited);

  // Format discoveries
  const discoveriesText = formatDiscoveries(discoveries);

  // Format network calls (show most relevant)
  const networkText = formatNetworkCalls(networkCalls);

  // Format errors
  const errorsText = formatErrors(errors);

  // Format ReAct trace
  const traceText = formatReActTrace(reactTrace);

  return `## Current Exploration Task

**Company**: ${company.name} ${company.industry ? `(${company.industry})` : ''}
**Website**: ${company.website || 'Unknown - discover from search'}
**Target Content**: ${contentTypes.join(', ')}
**Current URL**: ${currentUrl || 'None yet'}

## Iteration Progress

- **Iteration**: ${iteration + 1} of ${maxIterations}
- **Pages Visited**: ${pagesVisited.length}
${pagesText}

- **Discoveries**: ${discoveries.length}
${discoveriesText}

- **Network Calls Captured**: ${networkCalls.length}
${networkText}

- **Errors**: ${errors.length}
${errorsText}

## ReAct Reasoning Trace

${traceText}

## Your Task

Based on the current state above, decide your next action. Follow the ReAct pattern:
- **Thought**: Analyze what you've found and what you need
- **Action**: Choose the best tool to make progress
- **Confidence**: Rate your confidence in this action (0-100)

Remember: Prioritize finding JSON APIs over web scraping. Look for /api/, /jobs endpoints.`;
}

function formatPagesVisited(pages: PageVisit[]): string {
  if (pages.length === 0) return '  (No pages visited yet)';

  return pages
    .slice(-5) // Last 5 pages
    .map(p => `  - ${p.url} "${p.title}"`)
    .join('\n');
}

function formatDiscoveries(discoveries: Discovery[]): string {
  if (discoveries.length === 0) return '  (No discoveries yet)';

  return discoveries
    .slice(-5)
    .map(d => {
      const summary = summarizeDiscovery(d);
      return `  - [${d.type}] ${d.url || 'unknown'} (conf: ${d.confidence}%) - ${summary}`;
    })
    .join('\n');
}

function summarizeDiscovery(d: Discovery): string {
  switch (d.type) {
    case 'api_endpoint':
      return 'API endpoint found';
    case 'webpage':
      return d.data ? `Extracted ${Object.keys(d.data).length} elements` : 'Web page';
    case 'job_data':
      return 'Job listings detected';
    case 'culture_data':
      return 'Culture content found';
    case 'requires_auth':
      return d.reason || 'Authentication required';
    default:
      return d.reason || d.type;
  }
}

function formatNetworkCalls(calls: NetworkCall[]): string {
  if (calls.length === 0) return '  (No network calls captured)';

  // Show API calls with /api/ or /jobs in URL
  const apiCalls = calls
    .filter(c => c.url.includes('/api/') || c.url.includes('/jobs') || c.url.includes('/positions'))
    .slice(-5);

  if (apiCalls.length === 0) {
    return '  (No API-like calls found)';
  }

  return apiCalls
    .map(c => `  - ${c.method} ${c.url} (${c.status})`)
    .join('\n');
}

function formatErrors(errors: ExplorationError[]): string {
  if (errors.length === 0) return '  (No errors)';

  return errors
    .slice(-3)
    .map(e => `  - [${e.tool}] ${e.error}`)
    .join('\n');
}

function formatReActTrace(trace: ExplorationState['reactTrace']): string {
  if (trace.length === 0) return '  (Fresh start - no reasoning yet)';

  return trace
    .slice(-3)
    .map(step => {
      let text = `Step ${step.stepNumber}: ${step.thought}`;
      text += `\n  Action: ${step.action}`;
      if (step.observation) {
        text += `\n  Observation: ${step.observation}`;
      }
      if (step.reflection) {
        text += `\n  Reflection: ${step.reflection}`;
      }
      return text;
    })
    .join('\n\n');
}
```

### 3. ReAct Reasoning Prompt (Chain of Thought)

```typescript
// src/lib/ai/agents/explorer/prompts/react-prompt.ts

/**
 * ReAct reasoning prompt template
 * This is appended to the user prompt to guide the LLM through the ReAct pattern
 */
export const REACT_REASONING_PROMPT = `

## ReAct Reasoning Pattern

Follow this pattern for each decision:

**Thought**: Analyze the current situation. What have we discovered? What information do we still need? What patterns have we seen?

**Action**: Based on your analysis, what is the next best action? Consider:
- If no pages visited yet → NAVIGATE to company website
- If just navigated → GET_SNAPSHOT to capture content
- If page has interactive elements → EXECUTE_JS to load more
- If we see API patterns in network → GET_NETWORK_LOG to find endpoints
- If we found a good data source → GENERATE_CONFIG
- If we're stuck with no progress → FAIL

**Confidence**: Rate your confidence (0-100) that this action will lead to useful data.

Important Decision Heuristics:
- Jobs in URL path (e.g., /api/jobs, /careers/jobs) = high confidence
- JSON responses from XHR = high confidence
- Job listing keywords in HTML = medium confidence
- Authentication required = lower confidence
- Too many errors without progress = consider FAIL

Your response must be a valid JSON object:
{
  "action": "ACTION_NAME",
  "target": { /* relevant parameters */ },
  "reasoning": "Your thought process",
  "confidence": 0-100
}`;
```

### 4. Full Prompt Chain Builder

```typescript
// src/lib/ai/agents/explorer/prompts/index.ts

import { SYSTEM_PROMPT } from './system-prompt';
import { buildContextPrompt } from './context-prompt';
import { REACT_REASONING_PROMPT } from './react-prompt';
import type { ExplorationState } from '../types';

export interface PromptChainInput {
  state: ExplorationState;
  includeReflection?: boolean;
}

export function buildPromptChain(input: PromptChainInput): {
  systemPrompt: string;
  userPrompt: string;
  fullPrompt: string;
} {
  const { state, includeReflection = false } = input;

  // System prompt is static
  const systemPrompt = SYSTEM_PROMPT;

  // User prompt is dynamic based on state
  const contextPrompt = buildContextPrompt({ state });

  // ReAct reasoning prompt
  const reactPrompt = REACT_REASONING_PROMPT;

  // Optional reflection prompt for after tool execution
  const reflectionPrompt = includeReflection ? REFLECTION_PROMPT : '';

  // Build full user prompt
  const userPrompt = `${contextPrompt}

${reactPrompt}

${reflectionPrompt}`;

  return {
    systemPrompt,
    userPrompt,
    fullPrompt: `${systemPrompt}\n\n${userPrompt}`,
  };
}

/**
 * Reflection prompt for self-correction after tool execution
 */
const REFLECTION_PROMPT = `

## Post-Action Reflection

After receiving the tool result, consider:
1. Did we get what we expected? Why or why not?
2. Should we try a different approach?
3. Is there anything in the result that warrants further investigation?
4. Should we continue or are we done?

If the result shows significant new information, update your confidence. If we got errors or unexpected results, consider alternatives.`;
```

## LangGraph Implementation

### Graph Definition

```typescript
// src/lib/ai/agents/explorer/graph.ts

import { StateGraph, END, START, Command } from '@langgraph/langgraph';
import type { ExplorationState, ExplorationAction, LLMSDecision } from './types';
import { ChromeExtensionTool } from './tools/chrome-extension';

const MAX_ITERATIONS = 5;

export function createExplorerGraph() {
  const graph = new StateGraph<ExplorationState>({
    // State channels with reducer functions
    channels: {
      // Immutable fields
      taskId: null,
      companyId: null,
      company: null,
      contentTypes: null,
      maxIterations: null,
      startTime: null,

      // Incremental fields (append)
      iteration: (a, b) => (b !== undefined ? b : a) + 1,
      pagesVisited: (a, b) => (b ? [...a, ...b] : a),
      discoveries: (a, b) => (b ? [...a, ...b] : a),
      networkCalls: (a, b) => (b ? [...a, ...b] : a),
      toolCalls: (a, b) => (b ? [...a, ...b] : a),
      errors: (a, b) => (b ? [...a, ...b] : a),
      reactTrace: (a, b) => (b ? [...a, b] : a),

      // Overwrite fields
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
  graph.addNode('execute_tool', executeToolNode);
  graph.addNode('observe_result', observeResultNode);
  graph.addNode('reflect', reflectNode);
  graph.addNode('check_termination', checkTerminationNode);
  graph.addNode('generate_config', generateConfigNode);

  // Define edges
  graph.addEdge(START, 'llm_decision');

  // LLM decides next action
  graph.addEdge('llm_decision', 'check_termination');

  // Conditional routing after termination check
  graph.addConditionalEdges(
    'check_termination',
    (state) => {
      if (state.terminationReason) {
        return state.terminationReason; // 'generate_config' | 'fail' | 'max_iterations'
      }
      return 'execute_tool';
    },
    {
      execute_tool: 'execute_tool',
      generate_config: 'generate_config',
      fail: END,
      max_iterations: 'generate_config',
    }
  );

  // After tool execution, observe and reflect
  graph.addEdge('execute_tool', 'observe_result');
  graph.addEdge('observe_result', 'reflect');

  // After reflection, loop back to LLM
  graph.addEdge('reflect', 'llm_decision');

  // Config generation ends the graph
  graph.addEdge('generate_config', END);

  return graph;
}
```

### Node Implementations

```typescript
// src/lib/ai/agents/explorer/nodes.ts

import { groqChatCompletion, EXPLORER_MODEL } from '../../client';
import { buildPromptChain } from './prompts';
import { ChromeExtensionTool } from './tools/chrome-extension';
import { parseToolResult, buildReActStep } from './result-parser';
import { buildFetchConfig } from './fetchconfig-generator';
import type { ExplorationState, LLMSDecision, ReActStep } from './types';

const DECISION_TEMPERATURE = 0.3;
const DECISION_MAX_TOKENS = 1024;

const GROQ_DECISION_SCHEMA = {
  name: 'exploration_decision',
  schema: {
    type: 'object',
    properties: {
      action: {
        type: 'string',
        enum: [
          'NAVIGATE', 'GET_SNAPSHOT', 'EXTRACT_DOM', 'EXECUTE_JS',
          'START_NETWORK_MONITORING', 'GET_NETWORK_LOG', 'STOP_NETWORK_MONITORING',
          'ANALYZE_DATA', 'GENERATE_CONFIG', 'FAIL', 'REFLECT'
        ],
      },
      target: {
        type: 'object',
        properties: {
          url: { type: 'string' },
          selectors: { type: 'object', additionalProperties: { type: 'string' } },
          script: { type: 'string' },
          args: { type: 'object' },
          monitoringId: { type: 'string' },
          filter: { type: 'object' },
        },
      },
      reasoning: { type: 'string' },
      confidence: { type: 'number', minimum: 0, maximum: 100 },
    },
    required: ['action', 'reasoning', 'confidence'],
  },
};

/**
 * LLM Decision Node
 * Implements the PROMPT CHAIN: System + Context + ReAct
 */
async function llmDecisionNode(state: ExplorationState): Promise<Partial<ExplorationState>> {
  // Build prompt chain
  const { systemPrompt, userPrompt } = buildPromptChain({
    state,
    includeReflection: state.reactTrace.length > 0, // Include reflection after first iteration
  });

  // Call Groq with structured output
  const completion = await groqChatCompletion({
    model: EXPLORER_MODEL,
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt },
    ],
    temperature: DECISION_TEMPERATURE,
    max_tokens: DECISION_MAX_TOKENS,
    response_format: { type: 'json_schema', json_schema: GROQ_DECISION_SCHEMA },
  });

  const rawResponse = completion.choices[0]?.message?.content;
  if (!rawResponse) {
    throw new Error('No response from Groq');
  }

  const decision: LLMSDecision = JSON.parse(rawResponse);

  // Add to ReAct trace
  const reactStep = buildReActStep({
    stepNumber: state.reactTrace.length + 1,
    thought: decision.reasoning,
    action: decision.action,
    actionInput: decision.target,
  });

  return {
    currentDecision: decision,
    reactTrace: [...state.reactTrace, reactStep],
    shouldContinue: true,
  };
}

/**
 * Tool Execution Node
 * Invokes Chrome Extension tool
 */
async function executeToolNode(state: ExplorationState): Promise<Partial<ExplorationState>> {
  const { currentDecision } = state;
  if (!currentDecision) {
    throw new Error('No decision made yet');
  }

  // Handle terminal actions without tool execution
  if (currentDecision.action === 'GENERATE_CONFIG' || currentDecision.action === 'FAIL') {
    return {};
  }

  // Build tool input
  const toolInput = buildToolInput(currentDecision);

  // Execute tool via extension
  // Note: In actual implementation, this would use the compiled graph's tool
  // For now, we assume the tool is injected or accessed via context
  const tool = state['_tool'] as ChromeExtensionTool | undefined;
  if (!tool) {
    throw new Error('Chrome Extension tool not available');
  }

  const startTime = Date.now();
  let output: unknown;
  let error: string | undefined;

  try {
    output = await tool.invoke({
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
    errors: error ? [...state.errors, { iteration: state.iteration, tool: currentDecision.action, error, timestamp: new Date() }] : state.errors,
  };
}

/**
 * Observe Result Node
 * Parses tool output and extracts discoveries
 */
async function observeResultNode(state: ExplorationState): Promise<Partial<ExplorationState>> {
  const { currentDecision, toolCalls } = state;
  if (!currentDecision) return {};

  const lastCall = toolCalls[toolCalls.length - 1];
  if (!lastCall) return {};

  // Parse the tool result
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

/**
 * Reflect Node
 * Self-correction and confidence adjustment
 */
async function reflectNode(state: ExplorationState): Promise<Partial<ExplorationState>> {
  const { currentDecision, reactTrace, discoveries, errors } = state;
  if (!currentDecision) return {};

  const lastStep = reactTrace[reactTrace.length - 1];
  if (!lastStep) return {};

  // Generate reflection notes
  const reflection = generateReflection({
    lastDecision: currentDecision,
    lastObservation: lastStep.observation,
    discoveries,
    errors,
    iteration: state.iteration,
  });

  // Update confidence based on reflection
  const adjustedConfidence = adjustConfidence(currentDecision.confidence, reflection);

  // Update the decision confidence in trace
  const updatedTrace = state.reactTrace.map((step, i) =>
    i === state.reactTrace.length - 1
      ? { ...step, reflection }
      : step
  );

  return {
    reactTrace: updatedTrace,
    reflectionNotes: reflection,
    currentDecision: { ...currentDecision, confidence: adjustedConfidence },
  };
}

/**
 * Check Termination Node
 * Determines if the loop should continue or end
 */
async function checkTerminationNode(state: ExplorationState): Promise<Partial<ExplorationState>> {
  const { iteration, maxIterations, currentDecision, discoveries } = state;

  // Max iterations check
  if (iteration >= maxIterations) {
    return {
      shouldContinue: false,
      terminationReason: 'max_iterations',
    };
  }

  // Terminal decision by LLM
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

  // No progress after multiple iterations
  const errorCount = state.errors.filter(e => e.iteration >= iteration - 2).length;
  if (errorCount >= 3 && iteration >= 2) {
    return {
      shouldContinue: false,
      terminationReason: 'fail',
    };
  }

  return {
    shouldContinue: true,
  };
}

/**
 * Generate Config Node
 * Creates FetchConfig from discoveries
 */
async function generateConfigNode(state: ExplorationState): Promise<Partial<ExplorationState>> {
  const config = buildFetchConfig(state);

  return {
    finalResult: {
      success: !!config,
      taskId: state.taskId,
      status: config ? 'complete' : state.terminationReason === 'fail' ? 'failed' : 'max_iterations',
      config,
      iterations: state.iteration,
      discoveries: state.discoveries,
      confidence: config?.confidence ?? calculateOverallConfidence(state.discoveries),
      reason: state.terminationReason === 'fail' ? 'Exploration failed' : state.terminationReason === 'max_iterations' ? 'Max iterations reached' : undefined,
    },
    shouldContinue: false,
  };
}
```

### Helper Functions

```typescript
// src/lib/ai/agents/explorer/result-parser.ts

import type { ExplorationState, Discovery, NetworkCall, PageVisit } from './types';

interface ToolParseResult {
  observation: string;
  pageVisit?: PageVisit;
  discoveries: Discovery[];
  networkCalls: NetworkCall[];
  currentUrl?: string;
  monitoringId?: string;
}

export function parseToolResult(
  action: string,
  output: unknown,
  error?: string
): ToolParseResult {
  if (error) {
    return { observation: `Error: ${error}`, discoveries: [], networkCalls: [] };
  }

  const result = output as Record<string, unknown>;

  switch (action) {
    case 'NAVIGATE':
      return parseNavigateResult(result);
    case 'GET_SNAPSHOT':
      return parseSnapshotResult(result);
    case 'EXTRACT_DOM':
      return parseExtractResult(result);
    case 'EXECUTE_JS':
      return parseJsResult(result);
    case 'GET_NETWORK_LOG':
      return parseNetworkLogResult(result);
    case 'START_NETWORK_MONITORING':
      return {
        observation: result.success ? 'Network monitoring started' : 'Failed to start monitoring',
        discoveries: [],
        networkCalls: [],
        monitoringId: result.monitoringId as string,
      };
    case 'STOP_NETWORK_MONITORING':
      return {
        observation: `Network monitoring stopped. Captured ${result.totalCallsCaptured || 0} calls`,
        discoveries: [],
        networkCalls: [],
      };
    default:
      return { observation: `Unknown action: ${action}`, discoveries: [], networkCalls: [] };
  }
}

function parseNavigateResult(result: Record<string, unknown>): ToolParseResult {
  return {
    observation: `Navigated to ${result.url}, title: ${result.title || 'Unknown'}`,
    pageVisit: result.url ? {
      url: result.url as string,
      title: (result.title as string) || 'Untitled',
      timestamp: new Date(),
    } : undefined,
    currentUrl: result.url as string,
    discoveries: [],
    networkCalls: [],
  };
}

function parseSnapshotResult(result: Record<string, unknown>): ToolParseResult {
  const observation = `Snapshot captured: ${(result.visibleText as string)?.length || 0} chars of text`;
  const pageVisit: PageVisit | undefined = result.url ? {
    url: result.url as string,
    title: (result.title as string) || 'Untitled',
    timestamp: new Date(),
  } : undefined;

  // Detect job data
  const discoveries: Discovery[] = [];
  const html = result.html as string;
  const visibleText = result.visibleText as string;

  if (containsJobContent(html, visibleText)) {
    discoveries.push({
      id: `discovery-${Date.now()}`,
      type: 'job_data',
      url: result.url as string,
      data: { text: visibleText.slice(0, 3000) },
      confidence: 70,
      timestamp: new Date(),
    });
  }

  // Capture network calls from snapshot
  const networkCalls = (result.networkCalls as NetworkCall[]) || [];

  return {
    observation,
    pageVisit,
    discoveries,
    networkCalls,
    currentUrl: result.url as string,
  };
}

function parseExtractResult(result: Record<string, unknown>): ToolParseResult {
  const elements = result.elements as Record<string, unknown[]>;
  const count = elements ? Object.values(elements).flat().length : 0;

  const discoveries: Discovery[] = [];
  if (elements && count > 0) {
    discoveries.push({
      id: `discovery-${Date.now()}`,
      type: 'webpage',
      url: result.url as string,
      data: elements,
      confidence: 75,
      timestamp: new Date(),
    });
  }

  return {
    observation: `Extracted ${count} elements`,
    discoveries,
    networkCalls: [],
  };
}

function parseJsResult(result: Record<string, unknown>): ToolParseResult {
  return {
    observation: result.success
      ? `JS executed successfully${result.output ? `: ${result.output}` : ''}`
      : `JS execution failed: ${result.error || 'Unknown error'}`,
    discoveries: [],
    networkCalls: [],
  };
}

function parseNetworkLogResult(result: Record<string, unknown>): ToolParseResult {
  const calls = (result.calls as NetworkCall[]) || [];
  const discoveries: Discovery[] = [];

  // Find API endpoints
  for (const call of calls) {
    if (isApiEndpoint(call.url) && call.status >= 200 && call.status < 400) {
      discoveries.push({
        id: `discovery-${Date.now()}-${Math.random()}`,
        type: 'api_endpoint',
        url: call.url,
        data: call,
        confidence: 85,
        timestamp: new Date(),
      });
    }
  }

  return {
    observation: `Captured ${calls.length} network calls, found ${discoveries.length} API endpoints`,
    discoveries,
    networkCalls: calls,
  };
}

function containsJobContent(html: string, text: string): boolean {
  const patterns = [/job/i, /career/i, /position/i, /hiring/i, /open role/i];
  return patterns.some(p => p.test(html) || p.test(text));
}

function isApiEndpoint(url: string): boolean {
  try {
    const parsed = new URL(url);
    return (
      parsed.pathname.includes('/api/') ||
      parsed.pathname.includes('/jobs') ||
      parsed.pathname.includes('/positions') ||
      parsed.searchParams.has('q') ||
      parsed.searchParams.has('query')
    );
  } catch {
    return false;
  }
}

export function buildReActStep(input: {
  stepNumber: number;
  thought: string;
  action: string;
  actionInput?: unknown;
}): ExplorationState['reactTrace'][0] {
  return {
    stepNumber: input.stepNumber,
    thought: input.thought,
    action: input.action,
    actionInput: input.actionInput,
    timestamp: new Date(),
  };
}
```

## Chrome Extension Tool (LangGraph Tool Interface)

```typescript
// src/lib/ai/agents/explorer/tools/chrome-extension.ts

import type { Tool } from '@langgraph/core/tools';

interface ToolInput {
  action: string;
  params?: Record<string, unknown>;
}

interface ToolOutput {
  success: boolean;
  url?: string;
  title?: string;
  html?: string;
  visibleText?: string;
  elements?: Record<string, unknown[]>;
  output?: string;
  error?: string;
  calls?: unknown[];
  monitoringId?: string;
  totalCallsCaptured?: number;
  duration?: number;
  timestamp: string;
}

/**
 * Chrome Extension Tool for LangGraph
 * Implements the standard Tool interface
 */
export class ChromeExtensionTool implements Tool<ToolInput, ToolOutput> {
  name = 'chrome_extension';
  description = 'Control Chrome browser for web exploration. Navigate to pages, capture content, extract DOM, execute JavaScript, monitor network requests.';
  argsSchema = {
    type: 'object',
    properties: {
      action: {
        type: 'string',
        enum: [
          'NAVIGATE', 'GET_SNAPSHOT', 'EXTRACT_DOM', 'EXECUTE_JS',
          'START_NETWORK_MONITORING', 'GET_NETWORK_LOG', 'STOP_NETWORK_MONITORING'
        ],
      },
      params: { type: 'object' },
    },
    required: ['action'],
  };

  private serverUrl: string;
  private taskId: string;
  private requestCounter = 0;

  constructor(serverUrl: string, taskId: string) {
    this.serverUrl = serverUrl;
    this.taskId = taskId;
  }

  async invoke(input: ToolInput): Promise<ToolOutput> {
    const { action, params = {} } = input;
    this.requestCounter++;

    const requestId = `req-${this.requestCounter}-${Date.now()}`;
    const command = this.buildCommand(action, params, requestId);

    // Send command to server relay
    await this.sendCommand(command);

    // Wait for result
    const result = await this.waitForResult(requestId, 30000);

    return result as ToolOutput;
  }

  private buildCommand(action: string, params: Record<string, unknown>, requestId: string) {
    const base = { type: action, requestId };

    switch (action) {
      case 'NAVIGATE':
        return { ...base, params: { url: params.url } };
      case 'GET_SNAPSHOT':
        return base;
      case 'EXTRACT_DOM':
        return { ...base, params: { selectors: params.selectors } };
      case 'EXECUTE_JS':
        return { ...base, params: { script: params.script, args: params.args ?? {} } };
      case 'START_NETWORK_MONITORING':
        return base;
      case 'GET_NETWORK_LOG':
        return { ...base, params: { monitoringId: params.monitoringId, filter: params.filter } };
      case 'STOP_NETWORK_MONITORING':
        return { ...base, params: { monitoringId: params.monitoringId } };
      default:
        throw new Error(`Unknown action: ${action}`);
    }
  }

  private async sendCommand(command: unknown): Promise<void> {
    const response = await fetch(`${this.serverUrl}/api/agent/commands`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ taskId: this.taskId, commands: [command] }),
    });

    if (!response.ok) {
      throw new Error(`Failed to send command: ${response.statusText}`);
    }
  }

  private async waitForResult(requestId: string, timeoutMs: number): Promise<ToolOutput> {
    const startTime = Date.now();

    while (Date.now() - startTime < timeoutMs) {
      const response = await fetch(
        `${this.serverUrl}/api/agent/results?taskId=${this.taskId}&requestId=${requestId}`
      );

      if (response.ok) {
        const data = await response.json();
        if (data.result) {
          return data.result;
        }
      }

      await new Promise(resolve => setTimeout(resolve, 500));
    }

    throw new Error(`Timeout waiting for result: ${requestId}`);
  }
}
```

## Extensibility Points

### 1. Memory System

```typescript
// src/lib/ai/agents/explorer/memory.ts

import type { StateSnapshot } from '@langgraph/langgraph-prebuilt';
import type { ExplorationState, Discovery } from './types';

export interface IExplorationMemory {
  checkpoint(state: ExplorationState): Promise<StateSnapshot>;
  restore(checkpointId: string): Promise<ExplorationState>;
  addDiscovery(companyId: string, discovery: Discovery): Promise<void>;
  retrieveSimilar(companyId: string, query: string): Promise<Discovery[]>;
  clear(taskId: string): Promise<void>;
}
```

### 2. Skills System

```typescript
// src/lib/ai/agents/explorer/skills.ts

import type { ExplorationState } from './types';

export interface ISkill {
  name: string;
  description: string;
  canHandle(state: ExplorationState): boolean;
  execute(state: ExplorationState, input: unknown): Promise<Partial<ExplorationState>>;
}

export class SkillRegistry {
  private skills = new Map<string, ISkill>();
  register(skill: ISkill) { this.skills.set(skill.name, skill); }
  getApplicable(state: ExplorationState): ISkill[] {
    return Array.from(this.skills.values()).filter(s => s.canHandle(state));
  }
}
```

### 3. RAG Integration

```typescript
// src/lib/ai/agents/explorer/rag.ts

export interface IRAGRetriever {
  index(companyId: string, content: string, metadata?: Record<string, unknown>): Promise<void>;
  query(query: string, companyId?: string, limit?: number): Promise<RAGResult[]>;
  delete(companyId: string): Promise<void>;
}
```

### 4. MCP Integration

```typescript
// src/lib/ai/agents/explorer/mcp.ts

export interface MCPServer {
  name: string;
  url: string;
  tools: MCPTool[];
}

export interface IMCPClient {
  connect(server: MCPServer): Promise<void>;
  listTools(): MCPTool[];
  callTool(serverName: string, toolName: string, input: Record<string, unknown>): Promise<unknown>;
}
```

## Reference

- `@docs/ai-assist-fetch-info-plan.md` - Full system design
- `@context/features/explorer-agent-01-chrome-extension-spec.md` - Chrome Extension commands
- ReAct Pattern: [Synapse paper](https://arxiv.org/abs/2210.03629)
- LangGraph.js: https://langchain-ai.github.io/langgraphjs/

## Notes

- **Prompt Chain**: System + Context + ReAct reasoning, not a single call
- **ReAct Trace**: Every step recorded with Thought/Action/Observation/Reflection
- **Reflection Node**: Self-correction capability after each tool execution
- **Deterministic**: Same state always produces same decisions
- **Checkpointing**: State saved between iterations via LangGraph