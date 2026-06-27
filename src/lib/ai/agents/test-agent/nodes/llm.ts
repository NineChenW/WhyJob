// src/lib/ai/agents/test-agent/nodes/llm.ts

/**
 * LLM Node for Test Agent
 *
 * A simple node that calls the LLM with the current messages
 * and returns the response.
 */

import { AIMessage } from '@langchain/core/messages';
import { explorerComplete } from '@/lib/ai/client';
import type { TestAgentState } from '../types';

/**
 * LLM Node
 *
 * Takes the current state messages, sends them to the LLM via NVIDIA AI,
 * and returns the response.
 */
export async function llmNode(state: TestAgentState): Promise<Partial<TestAgentState>> {
  const { messages } = state;

  // Check if there are messages to process
  if (messages.length === 0) {
    return {
      lastResponse: 'No messages to process',
      error: undefined,
    };
  }

  try {
    // Format messages for the AI client
    const formattedMessages = messages.map((msg) => ({
      role: msg.role as 'user' | 'assistant' | 'system',
      content: msg.content,
    }));

    // Call the LLM via NVIDIA AI
    const result = await explorerComplete({
      messages: formattedMessages as any,
      temperature: 0.7,
      max_tokens: 1024,
    });

    const responseContent = result.content || 'No response content';

    return {
      lastResponse: responseContent,
      llmCallCount: 1,
      error: undefined,
    };
  } catch (err) {
    console.error('[test-agent] LLM node error:', err);
    return {
      lastResponse: undefined,
      error: err instanceof Error ? err.message : 'Unknown error',
    };
  }
}

/**
 * Alternative LLM node using LangChain's Messages format
 *
 * This version uses LangChain's message classes for better
 * interoperability with other LangChain components.
 */
export async function llmNodeWithMessages(state: TestAgentState): Promise<Partial<TestAgentState>> {
  const { messages } = state;

  if (messages.length === 0) {
    return {
      lastResponse: 'No messages to process',
      error: undefined,
    };
  }

  try {
    // Convert to LangChain message format
    const lcMessages = messages.map((msg) => {
      if (msg.role === 'user') {
        return { role: 'user' as const, content: msg.content };
      } else if (msg.role === 'assistant') {
        return new AIMessage({ content: msg.content });
      }
      return { role: 'system' as const, content: msg.content };
    });

    // Call the LLM via NVIDIA AI
    const result = await explorerComplete({
      messages: lcMessages as any,
      temperature: 0.7,
      max_tokens: 1024,
    });

    const responseContent = result.content || 'No response content';

    return {
      lastResponse: responseContent,
      llmCallCount: 1,
      error: undefined,
    };
  } catch (err) {
    console.error('[test-agent] LLM node error:', err);
    return {
      lastResponse: undefined,
      error: err instanceof Error ? err.message : 'Unknown error',
    };
  }
}