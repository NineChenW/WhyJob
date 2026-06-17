// src/lib/ai/client.ts

/**
 * AI Client Layer - Simplified Interface
 *
 * Provides easy-to-use AI client functions. All configuration is encapsulated
 * within this module - callers don't need to know about provider setup.
 *
 * Usage:
 *   import { getExplorerAgentAIClient } from '@/lib/ai/client';
 *
 *   const client = getExplorerAgentAIClient();
 *   const result = await client.complete({ messages: [...] });
 */

// Re-export the main AIClient for flexible usage
export { AIClient, createCompletion, getProvider, getDefaultProvider, getBestAvailableProvider, isAnyProviderConfigured } from './providers';
export type { AIProvider, AIProviderType, AICompletionParams, AICompletionResult, ResponseFormat, ModelConfig, ProviderConfig } from './providers';
export { EXPLORER_MODEL_CONFIG, DEFAULT_PROVIDER, DEFAULT_MODELS, getAvailableProviders, getProviderConfig, getModelConfig, PROVIDER_CONFIGS } from './providers/config';

import type { AICompletionParams, AICompletionResult } from './providers';
import { AIClient, createCompletion, EXPLORER_MODEL_CONFIG, DEFAULT_PROVIDER } from './providers';
import type { AIProviderType } from './providers';

// ============================================
// Explorer Agent AI Client
// ============================================

/**
 * Get the AI client optimized for the Explorer Agent.
 *
 * Uses NVIDIA as the primary provider with Llama 3.1 Nemotron 70B.
 * Falls back to Groq if NVIDIA is not configured.
 *
 * Usage:
 *   const client = getExplorerAgentAIClient();
 *   const result = await client.complete({ messages: [...] });
 */
export function getExplorerAgentAIClient(): AIClient {
  const client = new AIClient(EXPLORER_MODEL_CONFIG.provider);
  return client;
}

/**
 * Create a completion using the Explorer Agent's optimized config.
 * Convenience function for simple one-off calls.
 *
 * Usage:
 *   const result = await explorerComplete({ messages: [...] });
 */
export async function explorerComplete(params: AICompletionParams): Promise<AICompletionResult> {
  return createCompletion(
    {
      model: EXPLORER_MODEL_CONFIG.model,
      temperature: EXPLORER_MODEL_CONFIG.temperature,
      max_tokens: EXPLORER_MODEL_CONFIG.maxTokens,
      ...params,
    },
    EXPLORER_MODEL_CONFIG.provider
  );
}

// ============================================
// Generic AI Client Factory
// ============================================

/**
 * Get an AI client for a specific provider.
 * The caller doesn't need to know about API keys or configuration.
 *
 * Usage:
 *   const client = getAIClient('groq');
 *   const result = await client.complete({ messages: [...] });
 */
export function getAIClient(provider?: AIProviderType): AIClient {
  return new AIClient(provider ?? DEFAULT_PROVIDER);
}

/**
 * Create a completion with the default provider.
 * Convenience function for simple one-off calls.
 *
 * Usage:
 *   const result = await complete({ messages: [...] });
 */
export async function complete(params: AICompletionParams): Promise<AICompletionResult> {
  return createCompletion(params);
}

// ============================================
// Provider Check Utilities
// ============================================

/**
 * Check if the Explorer Agent AI is properly configured
 */
export function isExplorerAgentAIConfigured(): boolean {
  const client = getExplorerAgentAIClient();
  return client.isConfigured();
}

/**
 * Get the current Explorer Agent provider name
 */
export function getExplorerAgentProviderName(): string {
  const client = getExplorerAgentAIClient();
  return client.getProviderType();
}