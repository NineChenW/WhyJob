// rag/lib/ask.test.ts

import { describe, expect, it, vi } from 'vitest';
import type OpenAI from 'openai';
import { buildPrompt, generateAnswer, parseStructuredAnswer, type RetrievedChunk } from './ask';

const CHUNKS: RetrievedChunk[] = [
  {
    content: 'DevStash rate-limits requests to 60 per minute per IP.',
    source: 'context/docs/devstash.md',
    heading: 'Rate Limiting',
    similarity: 0.8123,
  },
  {
    content: 'Zuul gateways route traffic to backend services.',
    source: 'context/docs/ckb/zuul.md',
    heading: 'Gateway Routing',
    similarity: 0.7456,
  },
];

/** Minimal chat-completions stub shaped like the OpenAI client surface used by generateAnswer. */
function chatClientWith(responses: string[]): OpenAI {
  let call = 0;
  return {
    chat: {
      completions: {
        create: vi.fn(async () => {
          const content = responses[Math.min(call, responses.length - 1)];
          call += 1;
          return { choices: [{ message: { content } }] };
        }),
      },
    },
  } as unknown as OpenAI;
}

describe('buildPrompt', () => {
  it('orders layers: refuse-rule instructions, then context, then question', () => {
    const prompt = buildPrompt('What is the rate limit?', CHUNKS);
    const instructionsEnd = prompt.indexOf('Do not use outside knowledge.');
    const contextStart = prompt.indexOf('Context:');
    const questionStart = prompt.indexOf('Question: What is the rate limit?');
    expect(instructionsEnd).toBeGreaterThan(-1);
    expect(instructionsEnd).toBeLessThan(contextStart);
    expect(contextStart).toBeLessThan(questionStart);
  });

  it('refuse rule sits above the context chunks', () => {
    const prompt = buildPrompt('q', CHUNKS);
    const refuseAt = prompt.indexOf("Not in the knowledge base.");
    const firstChunkAt = prompt.indexOf('[1] context/docs/devstash.md :: Rate Limiting');
    expect(refuseAt).toBeGreaterThan(-1);
    expect(refuseAt).toBeLessThan(firstChunkAt);
  });

  it('labels each chunk [n] source :: heading and keeps the question verbatim', () => {
    const prompt = buildPrompt('How do  Zuul  gateways route?', CHUNKS);
    expect(prompt).toContain('[1] context/docs/devstash.md :: Rate Limiting\nDevStash rate-limits requests to 60 per minute per IP.');
    expect(prompt).toContain('[2] context/docs/ckb/zuul.md :: Gateway Routing\nZuul gateways route traffic to backend services.');
    expect(prompt).toContain('Question: How do  Zuul  gateways route?');
  });

  it('produces no chunk labels for empty context (the [1] in instructions is just the citation example)', () => {
    const prompt = buildPrompt('q', []);
    expect(prompt).not.toMatch(/\[1\] \S+ :: /);
    expect(prompt).toContain('Context:');
  });
});

describe('parseStructuredAnswer', () => {
  it('parses a clean JSON object', () => {
    expect(parseStructuredAnswer('{"answer":"60 rpm","citations":[1]}')).toEqual({
      answer: '60 rpm',
      citations: [1],
    });
  });

  it('extracts JSON embedded in surrounding prose', () => {
    const raw = 'Here is the answer:\n{"answer":"60 rpm","citations":[1,2]}\nHope that helps.';
    expect(parseStructuredAnswer(raw)).toEqual({ answer: '60 rpm', citations: [1, 2] });
  });

  it('accepts an empty citations array', () => {
    expect(parseStructuredAnswer('{"answer":"refused","citations":[]}')).toEqual({
      answer: 'refused',
      citations: [],
    });
  });

  it('throws when no JSON object is present', () => {
    expect(() => parseStructuredAnswer('plain text, no braces')).toThrow('No JSON object found');
  });

  it('throws on citation indices out of the [1..5] range', () => {
    expect(() => parseStructuredAnswer('{"answer":"x","citations":[6]}')).toThrow();
    expect(() => parseStructuredAnswer('{"answer":"x","citations":[0]}')).toThrow();
  });

  it('throws on non-integer or non-numeric citations', () => {
    expect(() => parseStructuredAnswer('{"answer":"x","citations":[1.5]}')).toThrow();
    expect(() => parseStructuredAnswer('{"answer":"x","citations":["1"]}')).toThrow();
  });

  it('throws when answer is missing', () => {
    expect(() => parseStructuredAnswer('{"citations":[1]}')).toThrow();
  });
});

describe('generateAnswer', () => {
  const CHAT_MODEL = 'nvidia/nemotron-3-super-120b-a12b';
  const VALID = '{"answer":"60 rpm","citations":[1]}';

  it('returns the parsed answer on first valid attempt', async () => {
    const client = chatClientWith([VALID]);
    const result = await generateAnswer(client, 'prompt', CHAT_MODEL);
    expect(result).toEqual({ answer: '60 rpm', citations: [1] });
    expect(client.chat.completions.create).toHaveBeenCalledTimes(1);
  });

  it('retries once after an invalid first attempt and then succeeds', async () => {
    const client = chatClientWith(['no json at all', VALID]);
    const result = await generateAnswer(client, 'prompt', CHAT_MODEL);
    expect(result).toEqual({ answer: '60 rpm', citations: [1] });
    expect(client.chat.completions.create).toHaveBeenCalledTimes(2);
  });

  it('throws clearly after exhausting attempts on repeated invalid output', async () => {
    const client = chatClientWith(['still no json']);
    await expect(generateAnswer(client, 'prompt', CHAT_MODEL)).rejects.toThrow(
      /Failed to get a valid structured answer after 2 attempts/
    );
    expect(client.chat.completions.create).toHaveBeenCalledTimes(2);
  });

  it('passes the chat model and JSON response format to the API', async () => {
    const client = chatClientWith([VALID]);
    await generateAnswer(client, 'prompt', CHAT_MODEL);
    expect(client.chat.completions.create).toHaveBeenCalledWith(
      expect.objectContaining({
        model: CHAT_MODEL,
        response_format: { type: 'json_object' },
      })
    );
  });

  it('treats empty model content as a failed attempt', async () => {
    const client = chatClientWith(['', VALID]);
    const result = await generateAnswer(client, 'prompt', CHAT_MODEL);
    expect(result).toEqual({ answer: '60 rpm', citations: [1] });
    expect(client.chat.completions.create).toHaveBeenCalledTimes(2);
  });
});
