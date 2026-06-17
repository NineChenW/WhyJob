// src/lib/ai/agents/explorer/nodes/llm-decision.ts

/**
 * LLM Decision Node
 *
 * Builds prompt chain from current state and calls the AI provider
 * to get the next ReAct action decision.
 */

import type { ChatCompletionMessageParam } from 'openai/resources/index';
import { explorerComplete } from '@/lib/ai/client';
import { DECISION_JSON_SCHEMA, buildPromptChain } from '../prompts';
import type { ExplorationState, ReActStep } from '../types';

/**
 * LLM Decision Node
 *
 * Builds prompt chain from current state and calls the configured AI provider
 * to get the next ReAct action decision.
 */
export async function llmDecisionNode(state: ExplorationState): Promise<Partial<ExplorationState>> {
  // Build prompt chain: System + Context + ReAct
  const { systemPrompt, userPrompt } = buildPromptChain({
    state,
    includeReflection: state.reactTrace.length > 0,
  });

  // Add reflection hint if we have prior steps
  const reflectionHint = state.reactTrace.length > 0
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

    const decision = JSON.parse(rawResponse);

    // Add to ReAct trace
    const reactStep: ReActStep = {
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

/**
 * Fallback decision when AI is unavailable
 * Uses rule-based logic instead of AI
 */
function getFallbackDecision(state: ExplorationState): Partial<ExplorationState> {
  const { iteration, pagesVisited, discoveries, company } = state;

  let action: ExplorationState['currentDecision'] = {
    action: 'FAIL',
    reasoning: 'Fallback: Cannot make progress, failing exploration',
    confidence: 0,
  };

  if (iteration === 0 && pagesVisited.length === 0) {
    const url = company.website ||
      `https://www.${company.name.toLowerCase().replace(/\s+/g, '')}.com`;

    action = {
      action: 'NAVIGATE',
      target: { url },
      reasoning: 'Fallback: Navigate to company website',
      confidence: 70,
    };
  } else if (pagesVisited.length > 0 && discoveries.length === 0) {
    action = {
      action: 'GET_SNAPSHOT',
      reasoning: 'Fallback: Capture page content after navigation',
      confidence: 80,
    };
  } else if (discoveries.length > 0) {
    action = {
      action: 'GENERATE_CONFIG',
      reasoning: 'Fallback: We have discoveries, attempt to generate config',
      confidence: 50,
    };
  }

  return {
    currentDecision: action,
    reactTrace: [
      ...state.reactTrace,
      {
        stepNumber: state.reactTrace.length + 1,
        thought: action.reasoning,
        action: action.action,
        actionInput: action.target,
        reflection: 'Fallback decision due to LLM error',
        timestamp: new Date(),
      },
    ],
    shouldContinue: action.action !== 'FAIL',
  };
}