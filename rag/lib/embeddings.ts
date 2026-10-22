// rag/lib/embeddings.ts

/**
 * Shared embedding helpers for the RAG pipeline scripts.
 *
 * Extracted from phase 1/2 so phase 3 (and later phases) reuse the exact
 * same client + model config — never mix embedding models between
 * ingestion and query.
 */

import OpenAI from 'openai';

/** The one embedding model for the whole RAG pipeline (phases 1-3). */
export const EMBEDDING_MODEL = 'nvidia/nemotron-3-embed-1b';
/** NVIDIA retrieval models need the input role; query/passage share one vector space per role. */
export const EMBEDDING_INPUT_TYPE = 'query';
export const NVIDIA_BASE_URL = 'https://integrate.api.nvidia.com/v1';
/** nemotron-3-embed-1b returns 2048-dim vectors (measured in phase 1). */
export const EMBED_DIM = 2048;

/** Create the OpenAI-compatible client pointed at the NVIDIA endpoint. */
export function createEmbeddingClient(): OpenAI {
  const apiKey = process.env.NVIDIA_API_KEY;
  if (!apiKey) {
    throw new Error('NVIDIA_API_KEY not configured (run with --env-file=.env)');
  }
  return new OpenAI({ apiKey, baseURL: NVIDIA_BASE_URL });
}

/** Embed texts with the pipeline model, guarding the expected dimension. */
export async function embedTexts(
  client: OpenAI,
  texts: string[],
  expectedDim: number = EMBED_DIM
): Promise<number[][]> {
  if (texts.length === 0) return [];
  // input_type is an NVIDIA extension to the OpenAI embeddings API, absent from SDK types
  const params = {
    model: EMBEDDING_MODEL,
    input: texts,
    input_type: EMBEDDING_INPUT_TYPE,
  } as OpenAI.EmbeddingCreateParams;
  const response = await client.embeddings.create(params);
  const vectors = response.data
    .sort((a, b) => a.index - b.index)
    .map((item) => item.embedding);
  if (vectors[0].length !== expectedDim) {
    throw new Error(
      `Embedding dimension mismatch: got ${vectors[0].length}, expected ${expectedDim} (${EMBEDDING_MODEL})`
    );
  }
  return vectors;
}
