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

import type { ChatCompletionMessageParam } from 'openai/resources/index';
import { explorerComplete } from '@/lib/ai/client';
import { DECISION_JSON_SCHEMA, buildPromptChain } from '../prompts';
import { ExplorationStateWrapper } from '../domain';
import { createNode } from '../node-wrapper';
import { EXPLORATION_ACTION, EXPLORER_CONSTANTS } from '../constants';
import type { LLMDecision } from '../types';

type ExplorationAction = typeof EXPLORATION_ACTION[keyof typeof EXPLORATION_ACTION];

/**
 * LLM Decision Node
 *
 * Builds prompt chain from current state and calls the configured AI provider
 * to get the next ReAct action decision.
 *
 * Resume handling: if waiting for extension result or a pending tool call exists,
 * skip LLM call and let wait_for_extension complete it.
 */
export const llmDecisionNode = createNode(async (wrapper) => {
  // Resume handling: if waiting for extension result OR a pending tool call exists,
  // skip LLM and let wait_for_extension complete the pending call
  if (wrapper.isWaitingForExtension() || wrapper.hasPendingToolCall()) {
    wrapper.recordDecision({
      action: EXPLORATION_ACTION.REFLECT,
      reasoning: 'Waiting for extension result to complete - checking for pending call',
      confidence: EXPLORER_CONSTANTS.MEDIUM_CONFIDENCE,
    });
    return wrapper;
  }

  // Build prompt chain: System + Context + ReAct
  const includeReflection = !wrapper.isFirstIteration();
  const { systemPrompt, userPrompt } = buildPromptChain({
    state: wrapper.raw,
    includeReflection,
  });

  // Add reflection hint if we have prior steps
  const reflectionHint = includeReflection
    ? '\n\n[Reflection] Consider if previous actions led to progress. Adjust strategy if needed.'
    : '';

  try {
    const messages: ChatCompletionMessageParam[] = [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt + reflectionHint },
    ];

    const result = await explorerComplete({
      messages,
      response_format: { type: 'json_schema', json_schema: DECISION_JSON_SCHEMA },
    });

    const rawResponse = result.content;
    if (!rawResponse) throw new Error('Empty AI response');

    const decision = JSON.parse(rawResponse) as LLMDecision;

    // Record the decision
    wrapper.recordDecision(decision);

    return wrapper;
  } catch (error) {
    console.error('[llm_decision] Error:', error);
    return getFallbackDecision(wrapper);
  }
});

/**
 * Fallback decision when AI is unavailable
 * Uses rule-based logic instead of AI
 */
function getFallbackDecision(wrapper: ExplorationStateWrapper): ExplorationStateWrapper {
  const task = wrapper.task;
  const iteration = wrapper.iteration.iteration;
  const hasPages = wrapper.memory.pagesVisited.length > 0;
  const hasDiscoveries = wrapper.hasDiscoveries();

  let action: ExplorationAction = EXPLORATION_ACTION.FAIL;
  let reasoning = 'Fallback: Cannot make progress, failing exploration';

  if (iteration === 0 && !hasPages) {
    // First iteration with no pages - navigate to company website
    const url = task.companyWebsite ||
      `https://www.${task.companyName.toLowerCase().replace(/\s+/g, '')}.com`;

    action = EXPLORATION_ACTION.NAVIGATE;
    reasoning = 'Fallback: Navigate to company website';
    wrapper.navigateTo(url, task.companyName);
  } else if (hasPages && !hasDiscoveries) {
    action = EXPLORATION_ACTION.GET_SNAPSHOT;
    reasoning = 'Fallback: Capture page content after navigation';
  } else if (hasDiscoveries) {
    action = EXPLORATION_ACTION.GENERATE_CONFIG;
    reasoning = 'Fallback: We have discoveries, attempt to generate config';
  }

  wrapper.recordDecision({
    action,
    reasoning,
    confidence: action === EXPLORATION_ACTION.NAVIGATE
      ? EXPLORER_CONSTANTS.LOW_CONFIDENCE
      : action === EXPLORATION_ACTION.GET_SNAPSHOT
        ? EXPLORER_CONSTANTS.MEDIUM_CONFIDENCE
        : EXPLORER_CONSTANTS.LOW_CONFIDENCE,
  });

  if (action === EXPLORATION_ACTION.FAIL) {
    wrapper.terminate('fail');
  }

  return wrapper;
}