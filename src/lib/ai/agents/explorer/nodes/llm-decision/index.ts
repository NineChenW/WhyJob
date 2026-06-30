// src/lib/ai/agents/explorer/nodes/llm-decision.ts

/**
 * LLM Decision Node
 *
 * Builds prompt chain from current state and calls the AI provider
 * to get the next ReAct action decision.
 *
 * Uses the createNode wrapper to ensure all state access goes through
 * the domain wrapper.
 */

import { explorerComplete } from '@/lib/ai/client';
import { createNode } from '../../node-wrapper';
import { EXPLORATION_ACTION, EXPLORER_CONSTANTS } from '../../constants';
import { SYSTEM_PROMPT, buildContextPrompt, REACT_REASONING_PROMPT } from './prompts';
import { DECISION_JSON_SCHEMA } from './prompts/schemas';
import type { ChatCompletionMessageParam } from 'openai/resources/index';
import type { ExplorationState, LLMDecision } from '../../types';

type ExplorationAction = typeof EXPLORATION_ACTION[keyof typeof EXPLORATION_ACTION];

// ============================================================
// Reflection Prompt (only used by buildPromptChain)
// ============================================================

/**
 * Reflection prompt for post-action analysis
 */
const REFLECTION_PROMPT = `

## Post-Action Reflection

After receiving the tool result, consider:
1. Did we get what we expected? Why or why not?
2. Should we try a different approach?
3. Is there anything in the result that warrants further investigation?
4. Should we continue or are we done?

If the result shows significant new information, update your confidence. If we got errors or unexpected results, consider alternatives.`;

// ============================================================
// Prompt Chain Builder
// ============================================================

/**
 * Build complete prompt chain
 */
function buildPromptChain(input: { state: ExplorationState; includeReflection?: boolean }): {
  systemPrompt: string;
  userPrompt: string;
} {
  const { state, includeReflection = false } = input;

  const systemPrompt = SYSTEM_PROMPT;
  const contextPrompt = buildContextPrompt({ state });
  const reactPrompt = REACT_REASONING_PROMPT;
  const reflectionPrompt = includeReflection ? REFLECTION_PROMPT : '';

  const userPrompt = `${contextPrompt}

${reactPrompt}

${reflectionPrompt}`.trim();

  return { systemPrompt, userPrompt };
}

// ============================================================
// LLM Execution Helpers
// ============================================================

/**
 * Build messages for LLM
 */
function buildMessages(systemPrompt: string, userPrompt: string): ChatCompletionMessageParam[] {
  const reflectionHint = '\n\n[Reflection] Consider if previous actions led to progress. Adjust strategy if needed.';
  return [
    { role: 'system', content: systemPrompt },
    { role: 'user', content: userPrompt + reflectionHint },
  ];
}

/**
 * Parse LLM response
 */
function parseLlmResponse(content: string | null): LLMDecision {
  if (!content) {
    throw new Error('Empty AI response');
  }
  return JSON.parse(content) as LLMDecision;
}

/**
 * Fallback decision when AI is unavailable
 */
function getFallbackDecision(): LLMDecision {
  return {
    action: EXPLORATION_ACTION.GENERATE_CONFIG,
    reasoning: 'Fallback: AI unavailable, attempt config generation',
    confidence: EXPLORER_CONSTANTS.LOW_CONFIDENCE,
  };
}

/**
 * Call LLM with retry on failure
 */
async function callLlmWithRetry(systemPrompt: string, userPrompt: string): Promise<LLMDecision> {
  const messages = buildMessages(systemPrompt, userPrompt);

  try {
    const result = await explorerComplete({
      messages,
      response_format: { type: 'json_schema', json_schema: DECISION_JSON_SCHEMA },
    });
    return parseLlmResponse(result.content);
  } catch (error) {
    console.error('[llm_decision] Error:', error);
    return getFallbackDecision();
  }
}

// ============================================================
// Exported Helper (used by route.ts)
// ============================================================

/**
 * Call LLM to get a decision from exploration state.
 * This is a standalone helper that doesn't require the full graph infrastructure.
 */
export async function callLlmForDecision(state: ExplorationState): Promise<LLMDecision> {
  const includeReflection = state.iteration.iteration > 0;

  const { systemPrompt, userPrompt } = buildPromptChain({
    state,
    includeReflection,
  });

  return callLlmWithRetry(systemPrompt, userPrompt);
}

// ============================================================
// LLM Decision Node (for LangGraph)
// ============================================================

/**
 * LLM Decision Node
 *
 * Builds prompt chain from current state and calls the configured AI provider
 * to get the next ReAct action decision.
 */
export const llmDecisionNode = createNode(async (wrapper) => {
  const { systemPrompt, userPrompt } = buildPromptChain({
    state: wrapper.raw,
    includeReflection: !wrapper.isFirstIteration(),
  });

  const decision = await callLlmWithRetry(systemPrompt, userPrompt);
  wrapper.recordDecision(decision);

  return wrapper;
});