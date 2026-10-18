// rag/01-explore-embeddings.ts

/**
 * RAG Pipeline Phase 1 — Explore Embeddings
 *
 * Embed 5 short strings with the NVIDIA embedding model, print vector
 * details, and compute a 5x5 cosine-similarity matrix with a hand-written
 * helper (no external library).
 *
 * Run: npx tsx --env-file=.env rag/01-explore-embeddings.ts
 *
 * Model note: phases 2-3 must reuse EMBEDDING_MODEL verbatim —
 * never mix embedding models between ingestion and query.
 */

import OpenAI from 'openai';

/** The one embedding model for the whole RAG pipeline (phases 1-3). */
const EMBEDDING_MODEL = 'nvidia/nemotron-3-embed-1b';
/** NVIDIA retrieval models need the input role; query/passage share one vector space per role. */
const EMBEDDING_INPUT_TYPE = 'query';
const NVIDIA_BASE_URL = 'https://integrate.api.nvidia.com/v1';
const FIRST_N_VALUES = 8;

const SAMPLE_TEXTS = [
  'payment reconciliation',
  'how to reconcile payments',
  'LangGraph state graph',
  'Douyin ad placement',
  'recipe for dumplings',
];

/**
 * Hand-written cosine similarity: dot(a, b) / (|a| * |b|).
 * ~10 lines, no external library.
 */
function cosineSimilarity(a: number[], b: number[]): number {
  let dot = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  const denominator = Math.sqrt(normA) * Math.sqrt(normB);
  return denominator === 0 ? 0 : dot / denominator;
}

function createClient(): OpenAI {
  const apiKey = process.env.NVIDIA_API_KEY;
  if (!apiKey) {
    throw new Error('NVIDIA_API_KEY not configured (run with --env-file=.env)');
  }
  return new OpenAI({ apiKey, baseURL: NVIDIA_BASE_URL });
}

async function embedTexts(client: OpenAI, texts: string[]): Promise<number[][]> {
  // input_type is an NVIDIA extension to the OpenAI embeddings API, absent from SDK types
  const params = {
    model: EMBEDDING_MODEL,
    input: texts,
    input_type: EMBEDDING_INPUT_TYPE,
  } as OpenAI.EmbeddingCreateParams;
  const response = await client.embeddings.create(params);
  return response.data
    .sort((a, b) => a.index - b.index)
    .map((item) => item.embedding);
}

/** Print model name, per-text vector length, and first 8 values. */
function printVectorSummary(texts: string[], vectors: number[][]): void {
  console.log(`Model: ${EMBEDDING_MODEL}\n`);
  texts.forEach((text, i) => {
    const preview = vectors[i].slice(0, FIRST_N_VALUES).map((v) => v.toFixed(4));
    console.log(`[${i}] "${text}"`);
    console.log(`    length: ${vectors[i].length}, first ${FIRST_N_VALUES}: [${preview.join(', ')}]`);
  });
  console.log();
}

/** Print the 5x5 cosine-similarity matrix with row/column labels. */
function printSimilarityMatrix(texts: string[], vectors: number[][]): void {
  const matrix = vectors.map((a) => vectors.map((b) => cosineSimilarity(a, b)));

  const header = ''.padEnd(28) + texts.map((_, i) => `[${i}]`.padStart(8)).join('');
  console.log('Cosine similarity matrix:');
  console.log(header);
  texts.forEach((text, i) => {
    const row = matrix[i].map((v) => v.toFixed(4).padStart(8)).join('');
    console.log(`[${i}] ${text.padEnd(24)} ${row}`);
  });
}

async function main(): Promise<void> {
  const client = createClient();
  const vectors = await embedTexts(client, SAMPLE_TEXTS);
  printVectorSummary(SAMPLE_TEXTS, vectors);
  printSimilarityMatrix(SAMPLE_TEXTS, vectors);
}

main().catch((error) => {
  console.error('Failed:', error);
  process.exit(1);
});
