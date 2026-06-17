// src/lib/ai/providers/groq.ts

/**
 * Groq AI Provider Implementation
 *
 * Uses OpenAI SDK with Groq's API endpoint
 */

import OpenAI from 'openai';
import type { AIProvider, AICompletionParams, AICompletionResult } from './types';

let groqInstance: OpenAI | null = null;

/**
 * Get or create the Groq client singleton
 */
function getGroqClient(): OpenAI {
  if (!groqInstance) {
    const apiKey = process.env.GROQ_API_KEY;
    if (!apiKey) {
      throw new Error('GROQ_API_KEY not configured');
    }
    groqInstance = new OpenAI({
      apiKey,
      baseURL: 'https://api.groq.com/openai/v1',
    });
  }
  return groqInstance;
}

/**
 * Groq AI Provider
 */
export class GroqProvider implements AIProvider {
  readonly name = 'groq' as const;

  /**
   * Check if Groq is properly configured
   */
  isConfigured(): boolean {
    return !!process.env.GROQ_API_KEY;
  }

  /**
   * Create a chat completion using Groq
   */
  async createCompletion(params: AICompletionParams): Promise<AICompletionResult> {
    const client = getGroqClient();
    const model = params.model ?? 'llama-3.3-70b-versatile';

    let completion;
    try {
      completion = await client.chat.completions.create({
        model,
        messages: params.messages,
        temperature: params.temperature ?? 0.3,
        max_tokens: params.max_tokens ?? 1024,
        response_format: params.response_format as OpenAI.Chat.ChatCompletionCreateParamsNonStreaming['response_format'],
      });
    } catch (error) {
      console.error('Groq API error:', error);
      throw error;
    }

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
  }
}

// Singleton instance
let groqProviderInstance: GroqProvider | null = null;

/**
 * Get the Groq provider singleton
 */
export function getGroqProvider(): GroqProvider {
  if (!groqProviderInstance) {
    groqProviderInstance = new GroqProvider();
  }
  return groqProviderInstance;
}