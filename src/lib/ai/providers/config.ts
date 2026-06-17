// src/lib/ai/providers/config.ts

/**
 * AI Provider Configuration
 *
 * Central configuration for all supported AI providers and models.
 * Edit this file to add new providers or modify model settings.
 */

import type { ProviderConfig, ModelConfig, AIProviderType } from './types';

// ============================================
// Model Configurations
// ============================================

const GROQ_MODELS: ModelConfig[] = [
  {
    provider: 'groq',
    modelId: 'llama-3.3-70b-versatile',
    name: 'Llama 3.3 70B Versatile',
    temperature: 0.3,
    maxTokens: 1024,
    supportsJsonSchema: true,
    contextWindow: 128000,
    supportedFormats: ['json_object', 'json_schema', 'text'],
  },
  {
    provider: 'groq',
    modelId: 'llama-3.1-70b-versatile',
    name: 'Llama 3.1 70B Versatile',
    temperature: 0.3,
    maxTokens: 1024,
    supportsJsonSchema: true,
    contextWindow: 128000,
    supportedFormats: ['json_object', 'json_schema', 'text'],
  },
  {
    provider: 'groq',
    modelId: 'mixtral-8x7b-32768',
    name: 'Mixtral 8x7B',
    temperature: 0.3,
    maxTokens: 1024,
    supportsJsonSchema: true,
    contextWindow: 32768,
    supportedFormats: ['json_object', 'json_schema', 'text'],
  },
  {
    provider: 'groq',
    modelId: 'llama-3.2-3b-preview',
    name: 'Llama 3.2 3B Preview',
    temperature: 0.3,
    maxTokens: 1024,
    supportsJsonSchema: true,
    contextWindow: 128000,
    supportedFormats: ['json_object', 'json_schema', 'text'],
  },
];

const ANTHROPIC_MODELS: ModelConfig[] = [
  {
    provider: 'anthropic',
    modelId: 'claude-sonnet-4-20250514',
    name: 'Claude Sonnet 4',
    temperature: 0.3,
    maxTokens: 4096,
    supportsJsonSchema: false,
    contextWindow: 200000,
    supportedFormats: ['text'],
  },
  {
    provider: 'anthropic',
    modelId: 'claude-opus-4-5-20251120',
    name: 'Claude Opus 4',
    temperature: 0.3,
    maxTokens: 4096,
    supportsJsonSchema: false,
    contextWindow: 200000,
    supportedFormats: ['text'],
  },
  {
    provider: 'anthropic',
    modelId: 'claude-3-5-sonnet-20241022',
    name: 'Claude 3.5 Sonnet',
    temperature: 0.3,
    maxTokens: 4096,
    supportsJsonSchema: false,
    contextWindow: 200000,
    supportedFormats: ['text'],
  },
  {
    provider: 'anthropic',
    modelId: 'claude-3-5-haiku-20241022',
    name: 'Claude 3.5 Haiku',
    temperature: 0.3,
    maxTokens: 4096,
    supportsJsonSchema: false,
    contextWindow: 200000,
    supportedFormats: ['text'],
  },
];

const OPENAI_MODELS: ModelConfig[] = [
  {
    provider: 'openai',
    modelId: 'gpt-4o',
    name: 'GPT-4o',
    temperature: 0.3,
    maxTokens: 4096,
    supportsJsonSchema: true,
    contextWindow: 128000,
    supportedFormats: ['json_object', 'json_schema', 'text'],
  },
  {
    provider: 'openai',
    modelId: 'gpt-4o-mini',
    name: 'GPT-4o Mini',
    temperature: 0.3,
    maxTokens: 4096,
    supportsJsonSchema: true,
    contextWindow: 128000,
    supportedFormats: ['json_object', 'json_schema', 'text'],
  },
  {
    provider: 'openai',
    modelId: 'gpt-4-turbo',
    name: 'GPT-4 Turbo',
    temperature: 0.3,
    maxTokens: 4096,
    supportsJsonSchema: true,
    contextWindow: 128000,
    supportedFormats: ['json_object', 'json_schema', 'text'],
  },
  {
    provider: 'openai',
    modelId: 'o1-preview',
    name: 'o1 Preview',
    temperature: 1.0,
    maxTokens: 4096,
    supportsJsonSchema: false,
    contextWindow: 128000,
    supportedFormats: ['text'],
  },
];

const NVIDIA_MODELS: ModelConfig[] = [
  {
    provider: 'nvidia',
    modelId: 'meta/llama-3.3-70b-instruct',
    name: 'Llama 3.3 70B',
    temperature: 0.3,
    maxTokens: 1024,
    supportsJsonSchema: true,
    contextWindow: 128000,
    supportedFormats: ['json_object', 'json_schema', 'text'],
  },
  {
    provider: 'nvidia',
    modelId: 'mistralai/mistral-nemo-12b-instruct',
    name: 'Mistral Nemo 12B',
    temperature: 0.3,
    maxTokens: 1024,
    supportsJsonSchema: true,
    contextWindow: 128000,
    supportedFormats: ['json_object', 'json_schema', 'text'],
  },
];

// ============================================
// Provider Configurations
// ============================================

export const PROVIDER_CONFIGS: Record<AIProviderType, ProviderConfig> = {
  groq: {
    type: 'groq',
    name: 'Groq',
    baseUrl: 'https://api.groq.com/openai/v1',
    apiKeyEnvVar: 'GROQ_API_KEY',
    enabled: true,
    defaultModel: 'llama-3.3-70b-versatile',
    models: GROQ_MODELS,
  },
  anthropic: {
    type: 'anthropic',
    name: 'Anthropic',
    baseUrl: 'https://api.anthropic.com/v1',
    apiKeyEnvVar: 'ANTHROPIC_API_KEY',
    enabled: !!process.env.ANTHROPIC_API_KEY,
    defaultModel: 'claude-sonnet-4-20250514',
    models: ANTHROPIC_MODELS,
  },
  openai: {
    type: 'openai',
    name: 'OpenAI',
    baseUrl: 'https://api.openai.com/v1',
    apiKeyEnvVar: 'OPENAI_API_KEY',
    enabled: !!process.env.OPENAI_API_KEY,
    defaultModel: 'gpt-4o',
    models: OPENAI_MODELS,
  },
  nvidia: {
    type: 'nvidia',
    name: 'NVIDIA NIM',
    baseUrl: 'https://integrate.api.nvidia.com/v1',
    apiKeyEnvVar: 'NVIDIA_API_KEY',
    enabled: !!process.env.NVIDIA_API_KEY,
    defaultModel: 'meta/llama-3.3-70b-instruct',
    models: NVIDIA_MODELS,
  },
};

// ============================================
// Default Configuration
// ============================================

/**
 * Default provider to use when not specified
 */
export const DEFAULT_PROVIDER: AIProviderType = 'nvidia';

/**
 * Default model for each provider
 */
export const DEFAULT_MODELS: Record<AIProviderType, string> = {
  groq: 'llama-3.3-70b-versatile',
  anthropic: 'claude-sonnet-4-20250514',
  openai: 'gpt-4o',
  nvidia: 'meta/llama-3.3-70b-instruct',
};

/**
 * Explorer agent specific configuration
 */
export const EXPLORER_MODEL_CONFIG = {
  provider: 'nvidia' as AIProviderType,
  model: 'meta/llama-3.3-70b-instruct',
  temperature: 0.3,
  maxTokens: 1024,
};

/**
 * Get all available providers
 */
export function getAvailableProviders(): ProviderConfig[] {
  return Object.values(PROVIDER_CONFIGS).filter(p => p.enabled);
}

/**
 * Get provider config by type
 */
export function getProviderConfig(type: AIProviderType): ProviderConfig | undefined {
  return PROVIDER_CONFIGS[type];
}

/**
 * Get model config by provider and model ID
 */
export function getModelConfig(provider: AIProviderType, modelId: string): ModelConfig | undefined {
  const providerConfig = PROVIDER_CONFIGS[provider];
  return providerConfig?.models.find(m => m.modelId === modelId);
}