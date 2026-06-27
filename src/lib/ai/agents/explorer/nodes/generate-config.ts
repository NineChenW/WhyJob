// src/lib/ai/agents/explorer/nodes/generate-config.ts

/**
 * Generate Config Node
 *
 * Creates FetchConfig from accumulated discoveries.
 * This is the terminal node on successful completion.
 */

import { ExplorationStateWrapper } from '../domain';
import { createNode } from '../node-wrapper';
import { TERMINATION_REASON } from '../constants';
import { buildFetchConfig } from '../fetchconfig-generator';

/**
 * Generate Config Node
 *
 * Builds FetchConfig from accumulated discoveries and sets the final result.
 */
export const generateConfigNode = createNode(async (wrapper: ExplorationStateWrapper) => {
  const config = buildFetchConfig(wrapper.raw);
  const success = !!config;

  const status = !success
    ? 'failed'
    : wrapper.iteration.terminationReason === TERMINATION_REASON.MAX_ITERATIONS
      ? 'max_iterations'
      : 'complete';

  wrapper.setResult({
    success,
    taskId: wrapper.task.taskId,
    status,
    config: config ?? undefined,
    confidence: config?.confidence ?? wrapper.memory.calculateConfidence(),
    reason: !success
      ? 'No valid discoveries found to generate config'
      : wrapper.iteration.terminationReason === TERMINATION_REASON.MAX_ITERATIONS
        ? `Max iterations (${wrapper.iteration.maxIterations}) reached`
        : undefined,
  });

  wrapper.terminate(TERMINATION_REASON.GENERATE_CONFIG);

  return wrapper;
});