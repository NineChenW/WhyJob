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
export async function checkTerminationNode(
  state: ExplorationState
): Promise<Partial<ExplorationState>> {
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
  const recentErrors = errors.filter((e) => e.iteration >= iteration - 2);
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