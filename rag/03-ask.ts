// rag/03-ask.ts

/**
 * RAG Pipeline Phase 3 — Retrieval Loop (Ask)
 *
 * Embed a user question, retrieve the top-5 most similar chunks from
 * `rag_chunks` via pgvector cosine distance, and have the LLM answer
 * strictly from that context with citations.
 *
 * Run: npx tsx --env-file=.env rag/03-ask.ts "question"
 *
 * Model note: reuses EMBEDDING_MODEL + EMBEDDING_INPUT_TYPE from phases 1-2
 * verbatim — never mix embedding models between ingestion and query.
 * Index note: HNSW on `vector` caps at 2000 dims, so the index is on
 * `embedding::halfvec(2048)` — the query must cast the same way or the
 * index is ignored.
 * 
 * 
 
rag/03-ask.ts (new)
The Phase 3 entry script: takes a question from argv, guards against an empty rag_chunks table, embeds the question, retrieves top-5 chunks via pgvector cosine distance, builds the three-layer prompt, gets a cited JSON answer from the chat model, and prints results. All pure logic now lives in rag/lib/ask.ts; the script keeps only I/O glue (retrieveTopK SQL, assertChunksExist, printing, main()).

rag/lib/ask.ts (new)
Pure helpers extracted from the script so they can be unit-tested without triggering main() at import time: buildPrompt (instructions-with-refuse-rule → context → question), parseStructuredAnswer (extracts {...} from model output, Zod-validates {answer, citations} with indices capped at [1..5]), and generateAnswer (chat call with JSON mode, retries once on validation failure, then fails clearly). Exports RetrievedChunk type shared by script and tests.

rag/lib/embeddings.ts (new)
Shared embedding helpers extracted per the goal ("only if it avoids duplication"): EMBEDDING_MODEL / EMBEDDING_INPUT_TYPE='query' / EMBED_DIM=2048 constants, createEmbeddingClient, and embedTexts (sorts by index, guards dimension). Phases 1-3 now share the exact same embedding config — never mix models between ingestion and query.

 * 
 question (argv)
   │
   ▼
03-ask.ts ──► assertChunksExist (guard: phase 2 ran)
   │
   ├──► lib/embeddings.ts: embed question (nemotron-3-embed-1b, input_type='query', 2048 dims)
   │
   ├──► Neon SQL: top-5 by embedding::halfvec(2048) <=> query::halfvec(2048)
   │         (same cast as 02-ingest.ts → HNSW index used; 1 - distance = similarity)
   │
   ├──► lib/ask.ts: buildPrompt (refuse rule ABOVE context)
   │
   └──► lib/ask.ts: generateAnswer (nemotron-3-super-120b-a12b, JSON mode,
             retry once) → print answer + citations resolved to source :: heading
 * 
 */

import { neon, type NeonQueryFunction } from '@neondatabase/serverless';
import OpenAI from 'openai';
import {
  createEmbeddingClient,
  embedTexts,
} from './lib/embeddings';
import {
  buildPrompt,
  generateAnswer,
  type RetrievedChunk,
} from './lib/ask';

// meta/llama-3.3-70b-instruct (the project's old NVIDIA default) was retired by
// NVIDIA (410 Gone); nemotron-3-super-120b-a12b is the current chat model that
// supports JSON mode on the same endpoint, and pairs with the nemotron embedder.
const CHAT_MODEL = 'nvidia/nemotron-3-super-120b-a12b';

type NeonSql = NeonQueryFunction<false, false>;

/** Exit with usage when no question was provided on argv. */
function resolveQuestion(): string {
  const question = process.argv[2]?.trim();
  if (!question) {
    console.log('Usage: npx tsx --env-file=.env rag/03-ask.ts "question"');
    process.exit(1);
  }
  return question;
}

/**
 * Retrieve the top-K chunks by cosine distance. The `::halfvec(2048)` casts
 * mirror the HNSW expression index from phase 2 — without them the index is
 * ignored (vector-index dims cap at 2000; halfvec allows 4000).
 */
async function retrieveTopK(sql: NeonSql, client: OpenAI, question: string): Promise<RetrievedChunk[]> {
  const [queryVector] = await embedTexts(client, [question]);
  const queryLiteral = `[${queryVector.join(',')}]`;
  const rows = await sql`
    SELECT content, source, heading,
           1 - (embedding::halfvec(2048) <=> ${queryLiteral}::halfvec(2048)) AS similarity
    FROM rag_chunks
    ORDER BY embedding::halfvec(2048) <=> ${queryLiteral}::halfvec(2048)
    LIMIT 5
  `;
  return rows.map((row) => ({
    content: row.content as string,
    source: row.source as string,
    heading: row.heading as string,
    similarity: Number(row.similarity),
  }));
}

/** Guard: retrieval only makes sense when phase 2 has populated the table. */
async function assertChunksExist(sql: NeonSql): Promise<void> {
  const [row] = await sql`SELECT count(*)::int AS count FROM rag_chunks`;
  if (Number(row.count) === 0) {
    console.error('rag_chunks is empty — run phase 2 first: npx tsx --env-file=.env rag/02-ingest.ts');
    process.exit(1);
  }
}

/** Print each retrieved chunk: rank, source, heading, similarity. */
function logRetrievedChunks(chunks: RetrievedChunk[]): void {
  console.log(`\nRetrieved top-${chunks.length} chunks:`);
  chunks.forEach((chunk, i) => {
    console.log(`  [${i + 1}] ${chunk.source} :: ${chunk.heading} (similarity ${chunk.similarity.toFixed(4)})`);
  });
}

function createChatClient(): OpenAI {
  const apiKey = process.env.NVIDIA_API_KEY;
  if (!apiKey) {
    throw new Error('NVIDIA_API_KEY not configured (run with --env-file=.env)');
  }
  return new OpenAI({ apiKey, baseURL: 'https://integrate.api.nvidia.com/v1' });
}

/** Print the question, the cited answer, and citations resolved to source :: heading. */
function printResult(question: string, answer: string, citations: number[], chunks: RetrievedChunk[]): void {
  console.log(`\nQuestion: ${question}\n`);
  console.log(`Answer: ${answer}\n`);
  console.log('Citations:');
  citations.forEach((index) => {
    const chunk = chunks[index - 1];
    if (!chunk) return;
    console.log(`  [${index}] ${chunk.source} :: ${chunk.heading}`);
  });
}

async function main(): Promise<void> {
  const question = resolveQuestion();

  const sql = neon(process.env.DATABASE_URL!);
  await assertChunksExist(sql);

  const client = createEmbeddingClient();
  const chunks = await retrieveTopK(sql, client, question);
  if (chunks.length === 0) {
    console.error('Query returned 0 rows — likely re-run phase 2 to ingest the corpus.');
    process.exit(1);
  }
  logRetrievedChunks(chunks);

  const prompt = buildPrompt(question, chunks);
  const chatClient = createChatClient();
  const { answer, citations } = await generateAnswer(chatClient, prompt, CHAT_MODEL);
  printResult(question, answer, citations, chunks);
}

main().catch((error) => {
  console.error('Failed:', error);
  process.exit(1);
});
