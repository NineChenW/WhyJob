// rag/lib/embeddings.test.ts

import { describe, expect, it, vi } from 'vitest';
import type OpenAI from 'openai';
import { embedTexts, EMBEDDING_MODEL, EMBED_DIM } from './embeddings';

/** Embeddings-client stub: returns fixed-size vectors with optionally scrambled indices. */
function embeddingClientWith(dim: number, indices?: number[]): OpenAI {
  return {
    embeddings: {
      create: vi.fn(async (params: { input: string[] }) => ({
        data: params.input.map((_, i) => ({
          object: 'embedding',
          index: indices ? indices[i] : i,
          embedding: new Array(dim).fill(0.1),
        })),
      })),
    },
  } as unknown as OpenAI;
}

describe('embedTexts', () => {
  it('returns empty array for empty input without calling the API', async () => {
    const client = embeddingClientWith(EMBED_DIM);
    const result = await embedTexts(client, []);
    expect(result).toEqual([]);
    expect(client.embeddings.create).not.toHaveBeenCalled();
  });

  it('sends the pipeline model and input_type: query', async () => {
    const client = embeddingClientWith(EMBED_DIM);
    await embedTexts(client, ['hello']);
    expect(client.embeddings.create).toHaveBeenCalledWith(
      expect.objectContaining({
        model: EMBEDDING_MODEL,
        input: ['hello'],
        input_type: 'query',
      })
    );
  });

  it('sorts response vectors by index regardless of API ordering', async () => {
    // API returned vectors out of order: text "a" -> index 1, text "b" -> index 0
    const client = {
      embeddings: {
        create: vi.fn(async (params: { input: string[] }) => ({
          data: params.input.map((_, i) => ({
            object: 'embedding',
            index: i === 0 ? 1 : 0,
            embedding: [i === 0 ? 2 : 1],
          })),
        })),
      },
    } as unknown as OpenAI;
    const result = await embedTexts(client, ['a', 'b'], 1);
    expect(result).toEqual([[1], [2]]);
  });

  it('throws on dimension mismatch', async () => {
    const client = embeddingClientWith(1536);
    await expect(embedTexts(client, ['hello'])).rejects.toThrow(/Embedding dimension mismatch: got 1536, expected 2048/);
  });

  it('honors a custom expected dimension', async () => {
    const client = embeddingClientWith(3);
    const result = await embedTexts(client, ['hello'], 3);
    expect(result[0]).toHaveLength(3);
  });
});
