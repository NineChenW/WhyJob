// src/lib/ai/providers/types.ts

/**
 * AI Model Configuration Types
 */

import type { ChatCompletionMessageParam } from 'openai/resources/chat/completions';

// ============================================
// Provider Types
// ============================================

export type AIProviderType = 'groq' | 'anthropic' | 'openai' | 'nvidia';

export type ResponseFormat =
  | { type: 'json_object' | 'text' }
  | { type: 'json_schema'; json_schema: { name: string; schema: Record<string, unknown> } };

// ============================================
// Provider Interface
// ============================================

export interface AIProvider {
  /** Provider name (e.g., 'groq', 'anthropic', 'openai') */
  readonly name: AIProviderType;

  /** Check if this provider is properly configured */
  isConfigured(): boolean;

  /**
   * Create a chat completion
   */
  createCompletion(params: AICompletionParams): Promise<AICompletionResult>;
}

export interface AICompletionParams {
  model?: string;
  messages: ChatCompletionMessageParam[];
  temperature?: number;
  max_tokens?: number;
  response_format?: ResponseFormat;
}

export interface AICompletionResult {
  content: string;
  model: string;
  usage?: {
    promptTokens?: number;
    completionTokens?: number;
    totalTokens?: number;
  };
  finishReason?: string;
}

// ============================================
// Model Configuration
// ============================================

export interface ModelConfig {
  /** Provider type */
  provider: AIProviderType;
  /** Model ID (e.g., 'llama-3.3-70b-versatile') */
  modelId: string;
  /** Display name */
  name: string;
  /** Default temperature */
  temperature: number;
  /** Max tokens */
  maxTokens: number;
  /** Whether JSON schema response is supported */
  supportsJsonSchema: boolean;
  /** Context window size (approximate) */
  contextWindow?: number;
  /** Supported response formats */
  supportedFormats: Array<'json_object' | 'json_schema' | 'text'>;
}

export interface ProviderConfig {
  /** Provider type */
  type: AIProviderType;
  /** Display name */
  name: string;
  /** Base URL for API */
  baseUrl: string;
  /** Environment variable for API key */
  apiKeyEnvVar: string;
  /** Whether this provider is enabled */
  enabled: boolean;
  /** Default model */
  defaultModel: string;
  /** Available models */
  models: ModelConfig[];
}