// src/lib/ai/providers/nvidia.ts

/**
 * Nvidia NIM AI Provider Implementation
 *
 * Uses OpenAI SDK with NVIDIA's NIM endpoints
 * Free tier available at https://build.nvidia.com
 */

import OpenAI from 'openai';
import type { AIProvider, AICompletionParams, AICompletionResult } from './types';

let nvidiaInstance: OpenAI | null = null;

/**
 * Get or create the Nvidia NIM client singleton
 */
function getNvidiaClient(): OpenAI {
  if (!nvidiaInstance) {
    const apiKey = process.env.NVIDIA_API_KEY;
    if (!apiKey) {
      throw new Error('NVIDIA_API_KEY not configured');
    }
    nvidiaInstance = new OpenAI({
      apiKey,
      baseURL: 'https://integrate.api.nvidia.com/v1',
    });
  }
  return nvidiaInstance;
}

/**
 * Nvidia NIM AI Provider
 */
export class NvidiaProvider implements AIProvider {
  readonly name = 'nvidia' as const;

  /**
   * Check if Nvidia NIM is properly configured
   */
  isConfigured(): boolean {
    return !!process.env.NVIDIA_API_KEY;
  }

  /**
   * Create a chat completion using Nvidia NIM
   */
  async createCompletion(params: AICompletionParams): Promise<AICompletionResult> {
    const client = getNvidiaClient();
    // Default to Llama 3.3 70B Instruct for free tier
    const model = params.model ?? 'meta/llama-3.3-70b-instruct';

    try {
      const completion = await client.chat.completions.create({
        model,
        messages: params.messages,
        temperature: params.temperature ?? 0.3,
        max_tokens: params.max_tokens ?? 1024,
        response_format: params.response_format as OpenAI.Chat.ChatCompletionCreateParamsNonStreaming['response_format'],
      });

      const message = completion.choices[0]?.message;
      return {
        content: message?.content ?? '',
        model: completion.model,
        usage: completion.usage ? {
          promptTokens: completion.usage.prompt_tokens,
          completionTokens: completion.usage.completion_tokens,
          totalTokens: completion.usage.total_tokens,
        } : undefined,
        finishReason: completion.choices[0]?.finish_reason,
      };
    } catch (error) {
      console.error('Nvidia NIM error:', error);
      throw error;
    }
  }
}

// Singleton instance
let nvidiaProviderInstance: NvidiaProvider | null = null;

/**
 * Get the Nvidia provider singleton
 */
export function getNvidiaProvider(): NvidiaProvider {
  if (!nvidiaProviderInstance) {
    nvidiaProviderInstance = new NvidiaProvider();
  }
  return nvidiaProviderInstance;
}