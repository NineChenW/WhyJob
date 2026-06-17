// src/lib/ai/agents/explorer/prompts/index.ts

import { SYSTEM_PROMPT } from './system-prompt';
import { buildContextPrompt } from './context-prompt';
import { REACT_REASONING_PROMPT } from './react-prompt';
import { DECISION_JSON_SCHEMA } from './schemas';
import type { ExplorationState } from '../types';

export { SYSTEM_PROMPT } from './system-prompt';
export { buildContextPrompt } from './context-prompt';
export { REACT_REASONING_PROMPT } from './react-prompt';
export { DECISION_JSON_SCHEMA, groqDecisionSchema, JSON_MODE_PROMPT_INSTRUCTION } from './schemas';
export type { ExplorerDecision, ExplorerAction } from './schemas';

/**
 * Prompt chain input
 */
export interface PromptChainInput {
  state: ExplorationState;
  includeReflection?: boolean;
}

/**
 * Build complete prompt chain
 */
export function buildPromptChain(input: PromptChainInput): {
  systemPrompt: string;
  userPrompt: string;
  fullPrompt: string;
} {
  const { state, includeReflection = false } = input;

  // System prompt is static
  const systemPrompt = SYSTEM_PROMPT;

  // Context prompt is dynamic based on state
  const contextPrompt = buildContextPrompt({ state });

  // ReAct reasoning prompt
  const reactPrompt = REACT_REASONING_PROMPT;

  // Reflection prompt for after tool execution
  const reflectionPrompt = includeReflection ? REFLECTION_PROMPT : '';

  // Build full user prompt
  const userPrompt = `${contextPrompt}

${reactPrompt}

${reflectionPrompt}`.trim();

  return {
    systemPrompt,
    userPrompt,
    fullPrompt: `${systemPrompt}\n\n${userPrompt}`,
  };
}

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