// src/lib/ai/agents/explorer/nodes/reflect.ts

/**
 * Reflect Node
 *
 * Self-correction and confidence adjustment after tool execution.
 * Analyzes whether the last action led to progress.
 */

import { ExplorationStateWrapper } from '../domain';
import { createNode } from '../node-wrapper';
import { EXPLORER_CONSTANTS } from '../constants';
import type { IterationSnapshot } from '../types';

/**
 * Reflect Node
 *
 * Generates self-reflection after tool execution, analyzing whether
 * the last action led to progress. Sets reflection on the last snapshot.
 */
export const reflectNode = createNode(async (wrapper: ExplorationStateWrapper) => {
  const lastSnapshot = wrapper.history.lastSnapshot;

  if (!lastSnapshot) {
    return wrapper;
  }

  // Generate reflection based on current state
  const reflection = generateReflection(wrapper, lastSnapshot);

  // Set reflection on the last snapshot
  wrapper.setReflection(reflection);

  return wrapper;
});

/**
 * Generate reflection text based on exploration state
 */
function generateReflection(wrapper: ExplorationStateWrapper, lastSnapshot: IterationSnapshot | undefined): string {
  const parts: string[] = [];

  // Check for new discoveries in last minute
  const newDiscoveries = wrapper.memory.discoveries.filter(
    (d) => d.timestamp && Date.now() - new Date(d.timestamp).getTime() < 60000
  );

  if (newDiscoveries.length > 0) {
    parts.push(`Found ${newDiscoveries.length} new discovery(ies).`);
  }

  // Check for errors in current iteration
  const currentIteration = wrapper.iteration.iteration;
  const recentErrors = wrapper.memory.getErrorsForIteration(currentIteration);
  if (recentErrors.length > 0) {
    parts.push(`Error occurred: ${recentErrors[0].error}`);
  }

  // Check decision confidence
  const lastDecision = wrapper.lastDecision;
  if (lastDecision && lastDecision.confidence < EXPLORER_CONSTANTS.MEDIUM_CONFIDENCE) {
    parts.push('Low confidence - consider alternative approach.');
  }

  // Check observation content
  const observation = lastSnapshot?.observation;
  if (observation?.includes('API endpoint')) {
    parts.push('Good: Found API endpoint.');
  } else if (observation?.includes('Error')) {
    parts.push('Action failed - may need to retry or try different approach.');
  }

  return parts.length > 0 ? parts.join(' ') : 'No significant changes noted.';
}