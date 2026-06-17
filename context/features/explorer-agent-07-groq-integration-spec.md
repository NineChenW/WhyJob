# Explorer Agent - Groq Integration Spec

## Overview

Groq provides fast, low-latency AI inference for the ReAct decision loop. This spec covers how Groq is integrated into the **prompt chain** and how it supports structured output for deterministic decisions.

**Iteration 3 Scope**: Groq integration with LangGraph prompt chain, structured JSON output, and fallback behavior.

## Integration with LangGraph Prompt Chain

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         LLM Decision Node                                    │
│                                                                              │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                     PROMPT CHAIN                                      │   │
│  │                                                                      │   │
│  │  ┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐  │   │
│  │  │   System Prompt │ +  │  Context Prompt  │ +  │  ReAct Prompt   │  │   │
│  │  │   (from Groq)   │    │   (from State)   │    │  (from config)  │  │   │
│  │  └─────────────────┘    └─────────────────┘    └─────────────────┘  │   │
│  │                                                                      │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                       │                                     │
│                                       ▼                                     │
│   ┌─────────────────────────────────────────────────────────────────────┐   │
│   │                    groqChatCompletion()                              │   │
│   │                                                                      │   │
│   │  model: llama-3.3-70b-versatile                                       │   │
│   │  temperature: 0.3                                                    │   │
│   │  max_tokens: 1024                                                    │   │
│   │  response_format: json_schema (GROQ_DECISION_SCHEMA)                │   │
│   │                                                                      │   │
│   └─────────────────────────────────────────────────────────────────────┘   │
│                                       │                                     │
│                                       ▼                                     │
│   ┌─────────────────────────────────────────────────────────────────────┐   │
│   │                    JSON.parse(response)                              │   │
│   │                                                                      │   │
│   │  {                                                                  │   │
│   │    "action": "NAVIGATE",                                             │   │
│   │    "target": { "url": "..." },                                       │   │
│   │    "reasoning": "...",                                               │   │
│   │    "confidence": 85                                                   │   │
│   │  }                                                                   │   │
│   │                                                                      │   │
│   └─────────────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────────────┘
```

## Requirements

### 1. Groq Client Setup

```typescript
// src/lib/ai/client.ts

import OpenAI from 'openai';

let groqInstance: OpenAI | null = null;

export function getGroqClient(): OpenAI {
  if (!groqInstance) {
    const apiKey = process.env.GROQ_API_KEY;
    if (!apiKey) {
      throw new Error('GROQ_API_KEY not configured');
    }
    groqInstance = new OpenAI({
      apiKey,
      baseURL: 'https://api.groq.com/openai/v1',
    });
  }
  return groqInstance;
}

export async function groqChatCompletion(params: {
  model?: string;
  messages: OpenAI.Chat.ChatCompletionMessage[];
  temperature?: number;
  max_tokens?: number;
  response_format?: { type: 'json_object' } | { type: 'json_schema'; json_schema: { name: string; schema: unknown } };
}): Promise<OpenAI.Chat.ChatCompletion> {
  const client = getGroqClient();
  return client.chat.completions.create({
    model: params.model ?? 'llama-3.3-70b-versatile',
    messages: params.messages,
    temperature: params.temperature ?? 0.3,
    max_tokens: params.max_tokens ?? 1024,
    response_format: params.response_format,
  });
}

// Configuration constants
export const EXPLORER_MODEL = 'llama-3.3-70b-versatile';
export const DECISION_TEMPERATURE = 0.3;
export const DECISION_MAX_TOKENS = 1024;
```

### 2. Environment Setup

```bash
# .env.local, .env
GROQ_API_KEY=gsk_your_groq_api_key
```

### 3. Groq Decision Schema

```typescript
// src/lib/ai/agents/explorer/prompts/schemas.ts

import { z } from 'zod';

/**
 * Schema for Groq structured output
 * This is passed to groqChatCompletion as response_format
 */
export const GROQ_DECISION_SCHEMA = {
  name: 'exploration_decision',
  schema: {
    type: 'object',
    properties: {
      action: {
        type: 'string',
        enum: [
          'NAVIGATE',
          'GET_SNAPSHOT',
          'EXTRACT_DOM',
          'EXECUTE_JS',
          'START_NETWORK_MONITORING',
          'GET_NETWORK_LOG',
          'STOP_NETWORK_MONITORING',
          'ANALYZE_DATA',
          'GENERATE_CONFIG',
          'FAIL',
          'REFLECT',
        ],
        description: 'The action to take next',
      },
      target: {
        type: 'object',
        properties: {
          url: { type: 'string', description: 'URL for NAVIGATE action' },
          selectors: {
            type: 'object',
            additionalProperties: { type: 'string' },
            description: 'CSS selectors for EXTRACT_DOM action',
          },
          script: { type: 'string', description: 'JavaScript code for EXECUTE_JS action' },
          args: {
            type: 'object',
            additionalProperties: { type: 'unknown' },
            description: 'Arguments for the JavaScript script',
          },
          monitoringId: { type: 'string', description: 'Monitoring session ID for network actions' },
          filter: {
            type: 'object',
            properties: {
              urlPattern: { type: 'string' },
              methods: { type: 'array', items: { type: 'string' } },
              statusRange: { type: 'string', enum: ['2xx', '3xx', '4xx', '5xx'] },
            },
          },
        },
      },
      reasoning: {
        type: 'string',
        description: 'Why this action was chosen, considering current state and goals',
      },
      confidence: {
        type: 'number',
        minimum: 0,
        maximum: 100,
        description: 'Confidence that this action will lead to useful data (0-100)',
      },
    },
    required: ['action', 'reasoning', 'confidence'],
  },
};

/**
 * Zod schema for parsing response (validation layer)
 */
export const groqDecisionSchema = z.object({
  action: z.enum([
    'NAVIGATE',
    'GET_SNAPSHOT',
    'EXTRACT_DOM',
    'EXECUTE_JS',
    'START_NETWORK_MONITORING',
    'GET_NETWORK_LOG',
    'STOP_NETWORK_MONITORING',
    'ANALYZE_DATA',
    'GENERATE_CONFIG',
    'FAIL',
    'REFLECT',
  ]),
  target: z.object({
    url: z.string().optional(),
    selectors: z.record(z.string()).optional(),
    script: z.string().optional(),
    args: z.record(z.unknown()).optional(),
    monitoringId: z.string().optional(),
    filter: z.object({
      urlPattern: z.string().optional(),
      methods: z.array(z.string()).optional(),
      statusRange: z.enum(['2xx', '3xx', '4xx', '5xx']).optional(),
    }).optional(),
  }).optional(),
  reasoning: z.string(),
  confidence: z.number().min(0).max(100),
});

export type GroqDecision = z.infer<typeof groqDecisionSchema>;
```

### 4. Prompt Integration

```typescript
// src/lib/ai/agents/explorer/prompts/index.ts (excerpt)

import { SYSTEM_PROMPT } from './system-prompt';
import { buildContextPrompt } from './context-prompt';
import { REACT_REASONING_PROMPT } from './react-prompt';
import { GROQ_DECISION_SCHEMA } from './schemas';
import type { ExplorationState } from '../types';

export function buildPromptChain(state: ExplorationState) {
  // System prompt is static
  const systemPrompt = SYSTEM_PROMPT;

  // Context prompt is dynamic based on state
  const contextPrompt = buildContextPrompt({ state });

  // ReAct reasoning prompt
  const reactPrompt = REACT_REASONING_PROMPT;

  // Build full user prompt
  const userPrompt = `${contextPrompt}\n\n${reactPrompt}`;

  return {
    systemPrompt,
    userPrompt,
    fullPrompt: `${systemPrompt}\n\n${userPrompt}`,
  };
}

export function getGroqConfig() {
  return {
    model: 'llama-3.3-70b-versatile',
    temperature: 0.3,
    max_tokens: 1024,
    response_format: { type: 'json_schema', json_schema: GROQ_DECISION_SCHEMA },
  };
}
```

### 5. LLM Node Implementation

```typescript
// src/lib/ai/agents/explorer/nodes/llm-decision.ts

import { groqChatCompletion, EXPLORER_MODEL, DECISION_TEMPERATURE, DECISION_MAX_TOKENS } from '../../client';
import { buildPromptChain, getGroqConfig } from '../prompts';
import { GROQ_DECISION_SCHEMA, groqDecisionSchema } from '../prompts/schemas';
import type { ExplorationState, LLMSDecision } from '../types';

/**
 * LLM Decision Node
 *
 * This is the core decision-making node in the ReAct loop.
 * It builds a prompt chain from current state and calls Groq
 * to get the next action decision.
 */
export async function llmDecisionNode(state: ExplorationState): Promise<Partial<ExplorationState>> {
  // Build the prompt chain: System + Context + ReAct
  const { systemPrompt, userPrompt } = buildPromptChain(state);

  // Determine if we should include reflection prompt (after first iteration)
  const includeReflection = state.reactTrace.length > 0;
  const reflectionNote = includeReflection
    ? '\n\nConsider whether previous actions were successful. Adjust confidence accordingly.'
    : '';

  const fullUserPrompt = userPrompt + reflectionNote;

  try {
    // Call Groq with structured output
    const completion = await groqChatCompletion({
      model: EXPLORER_MODEL,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: fullUserPrompt },
      ],
      temperature: DECISION_TEMPERATURE,
      max_tokens: DECISION_MAX_TOKENS,
      response_format: { type: 'json_schema', json_schema: GROQ_DECISION_SCHEMA },
    });

    const rawResponse = completion.choices[0]?.message?.content;

    if (!rawResponse) {
      throw new Error('No response from Groq');
    }

    // Parse and validate response
    const parsed = JSON.parse(rawResponse);
    const decision = groqDecisionSchema.parse(parsed);

    // Create ReAct step for trace
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
    // Log error and use fallback decision
    console.error('[LLM Decision Node] Error:', error);

    // Fallback to safe decision
    const fallbackDecision = getFallbackDecision(state);

    return {
      currentDecision: fallbackDecision,
      reactTrace: [
        ...state.reactTrace,
        {
          stepNumber: state.reactTrace.length + 1,
          thought: `Error getting LLM decision: ${error}. Using fallback.`,
          action: fallbackDecision.action,
          actionInput: fallbackDecision.target,
          reflection: 'Fallback decision due to LLM error',
          timestamp: new Date(),
        },
      ],
      shouldContinue: true,
    };
  }
}

/**
 * Fallback decision when Groq is unavailable
 * Uses rule-based logic instead of AI
 */
function getFallbackDecision(state: ExplorationState): LLMSDecision {
  const { iteration, pagesVisited, discoveries, company } = state;

  // First iteration: Navigate to company website
  if (iteration === 0 && pagesVisited.length === 0) {
    const url = company.website ||
      `https://www.${company.name.toLowerCase().replace(/\s+/g, '')}.com`;

    return {
      action: 'NAVIGATE',
      target: { url },
      reasoning: 'Fallback: Navigate to company website',
      confidence: 70,
    };
  }

  // After navigation: Get snapshot
  if (pagesVisited.length > 0 && discoveries.length === 0) {
    return {
      action: 'GET_SNAPSHOT',
      reasoning: 'Fallback: Capture page content after navigation',
      confidence: 80,
    };
  }

  // If we have discoveries: try to generate config
  if (discoveries.length > 0) {
    return {
      action: 'GENERATE_CONFIG',
      reasoning: 'Fallback: We have discoveries, attempt to generate config',
      confidence: 50,
    };
  }

  // Give up
  return {
    action: 'FAIL',
    reasoning: 'Fallback: Cannot make progress, failing exploration',
    confidence: 0,
  };
}
```

### 6. API Key and Configuration

```typescript
// src/lib/ai/client.ts

export function isGroqConfigured(): boolean {
  return !!process.env.GROQ_API_KEY;
}

export function getGroqModel(): string {
  // Allow override for testing or different models
  return process.env.GROQ_EXPLORER_MODEL || EXPLORER_MODEL;
}
```

### 7. Error Handling and Retries

```typescript
// src/lib/ai/agents/explorer/nodes/llm-decision.ts

const MAX_RETRIES = 2;
const RETRY_DELAY_MS = 1000;

async function callGroqWithRetry(
  messages: OpenAI.Chat.ChatCompletionMessage[],
  retryCount = 0
): Promise<string> {
  try {
    const completion = await groqChatCompletion({
      model: getGroqModel(),
      messages,
      temperature: DECISION_TEMPERATURE,
      max_tokens: DECISION_MAX_TOKENS,
      response_format: { type: 'json_schema', json_schema: GROQ_DECISION_SCHEMA },
    });

    const content = completion.choices[0]?.message?.content;
    if (!content) {
      throw new Error('Empty response from Groq');
    }

    return content;

  } catch (error) {
    if (retryCount < MAX_RETRIES) {
      console.warn(`[Groq] Retry ${retryCount + 1}/${MAX_RETRIES} after error:`, error);
      await new Promise(resolve => setTimeout(resolve, RETRY_DELAY_MS * (retryCount + 1)));
      return callGroqWithRetry(messages, retryCount + 1);
    }
    throw error;
  }
}
```

## Decision Confidence Guidelines

| Confidence | Interpretation | Action |
|------------|----------------|--------|
| 90-100 | Very confident, clear data source found | Generate config immediately |
| 70-89 | Confident, good progress | Continue exploring |
| 50-69 | Moderate, might need different approach | Consider alternative strategies |
| 30-49 | Low confidence, struggling | Try fallback or different method |
| 0-29 | Very low, likely to fail | Consider FAIL after 1-2 more tries |

## Reference

- `@docs/ai-assist-fetch-info-plan.md` - Full system design
- `@context/features/explorer-agent-06-ai-exploration-agent-spec.md` - Main exploration spec
- Groq API: https://console.groq.com/docs/api
- ReAct Pattern: [Synapse paper](https://arxiv.org/abs/2210.03629)

## Notes

- Groq provides fast inference (< 2 seconds typical)
- Structured JSON output ensures deterministic parsing
- Zod validation as a second layer after JSON schema
- Fallback decisions ensure graceful degradation
- Temperature 0.3 balances creativity and determinism