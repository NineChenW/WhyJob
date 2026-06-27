// src/lib/ai/agents/explorer/node-wrapper.ts

/**
 * Node Wrapper - State Access Firewall
 *
 * This module provides a wrapper pattern that ensures ALL node logic
 * accesses state ONLY through the domain wrapper. This creates a clean
 * separation between LangGraph's raw state format and the domain model.
 *
 * Flow:
 *   Raw State (LangGraph) → [Wrapper Factory] → Node receives Wrapper → [Logic] → Return Wrapper → [toPartial] → LangGraph
 */

import type { ExplorationState } from './types';
import { ExplorationStateWrapper } from './domain';

/**
 * Node handler signature - works with wrapper, returns wrapper
 *
 * Nodes receive a mutable wrapper they can modify directly.
 * The wrapper mutates in place and returns itself for chaining.
 */
export type NodeHandler = (
  wrapper: ExplorationStateWrapper
) => Promise<ExplorationStateWrapper> | ExplorationStateWrapper;

/**
 * Create a node function with wrapper enforcement
 *
 * Wraps the handler to:
 * 1. Convert raw ExplorationState → ExplorationStateWrapper (before)
 * 2. Execute handler with wrapper only (no raw state access)
 * 3. Convert result wrapper to Partial<ExplorationState> for LangGraph (after)
 *
 * @example
 * ```typescript
 * export const llmDecisionNode = createNode(async (wrapper) => {
 *   if (wrapper.isFirstIteration()) {
 *     return wrapper.navigateTo('https://example.com', 'Home');
 *   }
 *   return wrapper.advanceIteration();
 * });
 * ```
 */
export function createNode(handler: NodeHandler) {
  return async (state: ExplorationState): Promise<Partial<ExplorationState>> => {
    const wrapper = new ExplorationStateWrapper(state);
    const resultWrapper = await handler(wrapper);
    return resultWrapper.toPartial();
  };
}

/**
 * Node interceptors for pre/post processing
 */
export interface NodeInterceptors {
  /** Called before handler, can inspect wrapper state */
  onEnter?: (wrapper: ExplorationStateWrapper) => void;
  /** Called after handler, can inspect wrapper state and result */
  onExit?: (
    wrapper: ExplorationStateWrapper,
    result: ExplorationStateWrapper
  ) => void;
  /** Called on error, receives the error */
  onError?: (error: Error, wrapper: ExplorationStateWrapper) => void;
}

/**
 * Create a node with interceptor support
 *
 * Useful for logging, debugging, metrics, validation, etc.
 */
export function createNodeWithInterceptors(
  handler: NodeHandler,
  interceptors?: NodeInterceptors
) {
  return async (state: ExplorationState): Promise<Partial<ExplorationState>> => {
    const wrapper = new ExplorationStateWrapper(state);

    try {
      // Pre-processing
      interceptors?.onEnter?.(wrapper);

      // Main handler
      const resultWrapper = await handler(wrapper);

      // Post-processing
      interceptors?.onExit?.(wrapper, resultWrapper);

      return resultWrapper.toPartial();
    } catch (error) {
      interceptors?.onError?.(error as Error, wrapper);
      throw error;
    }
  };
}

/**
 * Pre-built interceptors for common use cases
 */
export const interceptors = {
  /**
   * Logging interceptor for debugging
   */
  logging: (nodeName: string): NodeInterceptors => ({
    onEnter: (wrapper) => {
      console.log(
        `[${nodeName}] Enter - iteration: ${wrapper.iteration.iteration}, snapshots: ${wrapper.history.snapshotCount}`
      );
    },
    onExit: (wrapper, result) => {
      console.log(
        `[${nodeName}] Exit - iteration: ${result.iteration.iteration}, shouldContinue: ${result.iteration.shouldContinue}`
      );
    },
  }),

  /**
   * Validation interceptor to ensure state integrity
   */
  validation: (): NodeInterceptors => ({
    onExit: (wrapper) => {
      // Ensure iteration never goes negative
      if (wrapper.iteration.iteration < 0) {
        throw new Error('Iteration cannot be negative');
      }
      // Ensure snapshots are in order
      const snapshots = wrapper.history.snapshots;
      for (let i = 0; i < snapshots.length; i++) {
        if (snapshots[i].stepNumber !== i + 1) {
          throw new Error(`Snapshot step numbers out of order at index ${i}`);
        }
      }
    },
  }),
};