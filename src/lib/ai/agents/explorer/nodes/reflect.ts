// src/lib/ai/agents/explorer/nodes/reflect.ts

import type { ExplorationState } from '../types';
import { EXPLORER_CONSTANTS } from '../constants';

/**
 * Reflect Node
 *
 * Self-correction and confidence adjustment after tool execution.
 * Analyzes whether the last action led to progress.
 */
export async function reflectNode(state: ExplorationState): Promise<Partial<ExplorationState>> {
  const { currentDecision, reactTrace, discoveries, errors, iteration } = state;

  if (!currentDecision) return {};

  const lastStep = reactTrace[reactTrace.length - 1];
  if (!lastStep) return {};

  // Generate reflection
  const reflection = generateReflection({
    lastDecision: currentDecision,
    lastObservation: lastStep.observation,
    discoveries,
    errors,
    iteration,
  });

  // Adjust confidence based on reflection
  const adjustedConfidence = adjustConfidence(currentDecision.confidence, reflection);

  // Update trace with reflection
  const updatedTrace = reactTrace.map((step, i) =>
    i === reactTrace.length - 1
      ? { ...step, reflection }
      : step
  );

  return {
    reactTrace: updatedTrace,
    reflectionNotes: reflection,
    currentDecision: { ...currentDecision, confidence: adjustedConfidence },
  };
}

interface ReflectionParams {
  lastDecision: ExplorationState['currentDecision'];
  lastObservation?: string;
  discoveries: ExplorationState['discoveries'];
  errors: ExplorationState['errors'];
  iteration: number;
}

function generateReflection(params: ReflectionParams): string {
  const { lastDecision, lastObservation, discoveries, errors, iteration } = params;

  const parts: string[] = [];

  // Check for new discoveries
  const newDiscoveries = discoveries.filter(
    (d) => d.timestamp && Date.now() - new Date(d.timestamp).getTime() < 60000
  );

  if (newDiscoveries.length > 0) {
    parts.push(`Found ${newDiscoveries.length} new discovery(ies).`);
  }

  // Check for errors
  const recentErrors = errors.filter((e) => e.iteration === iteration);
  if (recentErrors.length > 0) {
    parts.push(`Error occurred: ${recentErrors[0].error}`);
  }

  // Check confidence
  if (lastDecision && lastDecision.confidence < EXPLORER_CONSTANTS.MEDIUM_CONFIDENCE) {
    parts.push('Low confidence - consider alternative approach.');
  }

  // Check observation content
  if (lastObservation?.includes('API endpoint')) {
    parts.push('Good: Found API endpoint.');
  } else if (lastObservation?.includes('Error')) {
    parts.push('Action failed - may need to retry or try different approach.');
  }

  return parts.length > 0 ? parts.join(' ') : 'No significant changes noted.';
}

function adjustConfidence(originalConfidence: number, reflection: string): number {
  let adjusted = originalConfidence;

  // Increase confidence if we found something
  if (reflection.includes('Found') && reflection.includes('discovery')) {
    adjusted = Math.min(100, adjusted + 10);
  }

  // Decrease if errors
  if (reflection.includes('Error')) {
    adjusted = Math.max(0, adjusted - EXPLORER_CONSTANTS.CONFIDENCE_PENALTY_ERROR);
  }

  // Decrease if low confidence warning
  if (reflection.includes('Low confidence')) {
    adjusted = Math.max(0, adjusted - EXPLORER_CONSTANTS.CONFIDENCE_PENALTY_LOW);
  }

  return adjusted;
}