// src/lib/ai/agents/explorer/nodes/check-termination.ts

/**
 * Check Termination Node
 *
 * Evaluates whether the exploration loop should continue or terminate.
 * Checks for:
 * 1. Terminal LLM decisions (GENERATE_CONFIG, FAIL)
 * 2. Max iterations reached
 * 3. Excessive errors (no progress)
 */

import { ExplorationStateWrapper } from '../domain';
import { createNode } from '../node-wrapper';
import { TERMINATION_REASON } from '../constants';

/**
 * Check Termination Node
 *
 * Evaluates termination conditions and terminates if met.
 */
export const checkTerminationNode = createNode(async (wrapper: ExplorationStateWrapper) => {
  // Check 1: Terminal LLM decision
  if (wrapper.isTerminalAction()) {
    wrapper.terminate(TERMINATION_REASON.GENERATE_CONFIG);
    return wrapper;
  }

  // Check 2: Max iterations reached
  if (wrapper.iteration.isMaxReached) {
    wrapper.terminate(TERMINATION_REASON.MAX_ITERATIONS);
    return wrapper;
  }

  // Check 3: Too many consecutive errors
  const currentIteration = wrapper.iteration.iteration;
  const recentErrors = wrapper.memory.getRecentErrors(EXCESSIVE_ERROR_COUNT);
  const errorsInRecentIterations = recentErrors.filter((e) => e.iteration >= currentIteration - 2);

  if (errorsInRecentIterations.length >= EXCESSIVE_ERROR_COUNT && currentIteration >= 2) {
    wrapper.terminate(TERMINATION_REASON.FAIL);
    return wrapper;
  }

  // Continue loop - do nothing
  return wrapper;
});

const EXCESSIVE_ERROR_COUNT = 3;