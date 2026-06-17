// src/lib/ai/agents/explorer/nodes/generate-config.ts

import { buildFetchConfig } from '../fetchconfig-generator';
import type { ExplorationState } from '../types';

/**
 * Generate Config Node
 *
 * Creates FetchConfig from accumulated discoveries.
 * This is the terminal node on successful completion.
 */
export async function generateConfigNode(state: ExplorationState): Promise<Partial<ExplorationState>> {
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
      config: config ?? undefined,
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
  const hasApi = discoveries.some((d) => d.type === 'api_endpoint');
  const boost = hasApi ? 15 : 0;

  // Reduce for errors
  const errorCount = discoveries.filter((d) => d.type === 'no_content' || !d.confidence).length;
  const penalty = errorCount * 5;

  return Math.max(0, Math.min(100, avgConfidence + boost - penalty));
}