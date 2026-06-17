// src/lib/ai/providers/index.ts

/**
 * AI Provider Factory
 *
 * Provides a unified interface to access different AI providers.
 */

import type { AIProvider, AIProviderType, AICompletionParams, AICompletionResult } from './types';
import { GroqProvider, getGroqProvider } from './groq';
import { NvidiaProvider, getNvidiaProvider } from './nvidia';
import { DEFAULT_PROVIDER, getAvailableProviders } from './config';

// Re-export types and configs
export * from './types';
export * from './config';

// Provider instances cache
const providerCache: Partial<Record<AIProviderType, AIProvider>> = {};

/**
 * Get a provider instance by type
 */
export function getProvider(type: AIProviderType): AIProvider {
  if (providerCache[type]) {
    return providerCache[type]!;
  }

  switch (type) {
    case 'groq':
      const groqProvider = getGroqProvider();
      providerCache[type] = groqProvider;
      return groqProvider;

    case 'nvidia':
      const nvidiaProvider = getNvidiaProvider();
      providerCache[type] = nvidiaProvider;
      return nvidiaProvider;

    default:
      // Fallback to Groq for unknown types
      const defaultProvider = getGroqProvider();
      providerCache[type] = defaultProvider;
      return defaultProvider;
  }
}

/**
 * Get the default provider
 */
export function getDefaultProvider(): AIProvider {
  return getProvider(DEFAULT_PROVIDER);
}

/**
 * Clear provider cache (useful for testing)
 */
export function clearProviderCache(): void {
  Object.keys(providerCache).forEach(key => {
    delete providerCache[key as AIProviderType];
  });
}

/**
 * AI Client class for convenient access to AI completions
 */
export class AIClient {
  private provider: AIProvider;

  constructor(providerType?: AIProviderType) {
    this.provider = getProvider(providerType ?? DEFAULT_PROVIDER);
  }

  /**
   * Set the provider type
   */
  setProvider(type: AIProviderType): void {
    this.provider = getProvider(type);
  }

  /**
   * Get current provider type
   */
  getProviderType(): AIProviderType {
    return this.provider.name;
  }

  /**
   * Check if current provider is configured
   */
  isConfigured(): boolean {
    return this.provider.isConfigured();
  }

  /**
   * Create a completion
   */
  async complete(params: AICompletionParams): Promise<AICompletionResult> {
    return this.provider.createCompletion(params);
  }

  /**
   * Create a simple text completion
   */
  async completeText(
    systemPrompt: string,
    userMessage: string,
    options?: Partial<AICompletionParams>
  ): Promise<AICompletionResult> {
    return this.provider.createCompletion({
      model: options?.model,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userMessage },
      ],
      temperature: options?.temperature ?? 0.3,
      max_tokens: options?.max_tokens ?? 1024,
    });
  }
}

// ============================================
// Convenience Functions
// ============================================

/**
 * Create a completion using the default provider
 */
export async function createCompletion(
  params: AICompletionParams,
  providerType?: AIProviderType
): Promise<AICompletionResult> {
  const provider = getProvider(providerType ?? DEFAULT_PROVIDER);
  return provider.createCompletion(params);
}

/**
 * Check if any provider is configured
 */
export function isAnyProviderConfigured(): boolean {
  return getAvailableProviders().length > 0;
}

/**
 * Get the best available provider (for fallback scenarios)
 */
export function getBestAvailableProvider(): AIProvider | null {
  const available = getAvailableProviders();
  if (available.length === 0) return null;
  return getProvider(available[0].type);
}