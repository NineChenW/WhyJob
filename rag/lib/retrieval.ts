// rag/lib/retrieval.ts

/**
 * Shared retrieval logic for the RAG pipeline (phases 3-4).
 *
 * Extracted verbatim from rag/03-ask.ts so the phase-4 eval measures the
 * exact same retrieval path the ask script uses — no deeper refactor
 * (phase 5 does cleanup).
 *
 * Index note: HNSW on `vector` caps at 2000 dims, so the index is on
 * `embedding::halfvec(2048)` — the query must cast the same way or the
 * index is ignored.
 */

import type { NeonQueryFunction } from '@neondatabase/serverless';
import OpenAI from 'openai';
import { embedTexts } from './embeddings';
import type { RetrievedChunk } from './ask';

export const DEFAULT_TOP_K = 5;

export type NeonSql = NeonQueryFunction<false, false>;

/**
 * Retrieve the top-K chunks by cosine distance. The `::halfvec(2048)` casts
 * mirror the HNSW expression index from phase 2 — without them the index is
 * ignored (vector-index dims cap at 2000; halfvec allows 4000).
 */
export async function retrieveTopK(
  sql: NeonSql,
  client: OpenAI,
  question: string,
  topK: number = DEFAULT_TOP_K
): Promise<RetrievedChunk[]> {
  const [queryVector] = await embedTexts(client, [question]);
  const queryLiteral = `[${queryVector.join(',')}]`;
  const rows = await sql`
    SELECT content, source, heading,
           1 - (embedding::halfvec(2048) <=> ${queryLiteral}::halfvec(2048)) AS similarity
    FROM rag_chunks
    ORDER BY embedding::halfvec(2048) <=> ${queryLiteral}::halfvec(2048)
    LIMIT ${topK}
  `;
  return rows.map((row) => ({
    content: row.content as string,
    source: row.source as string,
    heading: row.heading as string,
    similarity: Number(row.similarity),
  }));
}

/** Guard: retrieval only makes sense when phase 2 has populated the table. */
export async function assertChunksExist(sql: NeonSql): Promise<void> {
  const [row] = await sql`SELECT count(*)::int AS count FROM rag_chunks`;
  if (Number(row.count) === 0) {
    console.error('rag_chunks is empty — run phase 2 first: npx tsx --env-file=.env rag/02-ingest.ts');
    process.exit(1);
  }
}
