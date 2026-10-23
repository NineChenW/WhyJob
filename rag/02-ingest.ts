// rag/02-ingest.ts

/**
 * RAG Pipeline Phase 2 — Ingest Corpus
 *
 * Read the CreateResume markdown corpus, split it into chunks, embed every
 * chunk, and insert into the `rag_chunks` pgvector table on Neon.
 *
 * Run: npx tsx --env-file=.env rag/02-ingest.ts [corpusRoot]
 *
 * Model note: reuses EMBEDDING_MODEL + EMBEDDING_INPUT_TYPE from phase 1
 * verbatim — never mix embedding models between ingestion and query.
 * Dimension note: nemotron-3-embed-1b returns 2048-dim vectors (measured),
 * so the column is vector(2048), not the plan's original vector(1536).
 */

import { readdir, readFile } from 'node:fs/promises';
import { join, relative } from 'node:path';
import OpenAI from 'openai';
import { RecursiveCharacterTextSplitter } from '@langchain/textsplitters';
import { neon, type NeonQueryFunction } from '@neondatabase/serverless';

const EMBEDDING_MODEL = 'nvidia/nemotron-3-embed-1b';
const EMBEDDING_INPUT_TYPE = 'query';
const NVIDIA_BASE_URL = 'https://integrate.api.nvidia.com/v1';
const EMBED_DIM = 2048;

const DEFAULT_CORPUS_ROOT = '/Users/luckyjay_hu/ai_workdir/CreateResume';
const CORPUS_DIRS = ['context', 'docs', 'ckb'] as const;
// Phase-4 tuning: override via env (CHUNK_SIZE=400 ...) so each tuning run
// re-ingests without editing the script. Defaults are the phase-2 baseline.
const CHUNK_SIZE = Number(process.env.CHUNK_SIZE ?? 800);
const CHUNK_OVERLAP = Number(process.env.CHUNK_OVERLAP ?? 100);
const EMBED_BATCH_SIZE = 64;
const INSERT_BATCH_SIZE = 50;

type NeonSql = NeonQueryFunction<false, false>;

interface ChunkRow {
  content: string;
  source: string;
  heading: string;
}

/** Type of a corpus document, derived from which top-level directory it lives in. */
function corpusTypeFor(relPath: string): string {
  const topDir = relPath.split('/')[0];
  return CORPUS_DIRS.find((dir) => dir === topDir) ?? 'other';
}

/** Resolve the corpus root from argv[2], falling back to the default path. */
function resolveCorpusRoot(): string {
  return process.argv[2] ?? DEFAULT_CORPUS_ROOT;
}

/** Recursively collect .md file paths under `dir`. */
async function collectMarkdownFiles(dir: string): Promise<string[]> {
  const entries = await readdir(dir, { withFileTypes: true });
  const files = entries
    .filter((entry) => entry.isFile() && entry.name.endsWith('.md'))
    .map((entry) => join(dir, entry.name));
  const subDirs = entries.filter((entry) => entry.isDirectory()).map((entry) => join(dir, entry.name));
  const nested = await Promise.all(subDirs.map((sub) => collectMarkdownFiles(sub)));
  return files.concat(...nested);
}

/** Walk every corpus directory and return absolute .md paths. */
async function collectCorpusFiles(root: string): Promise<string[]> {
  const perDir = await Promise.all(
    CORPUS_DIRS.map((dir) => collectMarkdownFiles(join(root, dir)).catch(() => []))
  );
  return perDir.flat().sort();
}

/**
 * Split a markdown document into { text, heading } sections, where each
 * section starts at a heading line and carries the nearest preceding heading.
 */
function splitIntoHeadingSections(content: string): { text: string; heading: string }[] {
  const lines = content.split('\n');
  const sections: { text: string[]; heading: string }[] = [];
  let currentHeading = '';
  let currentLines: string[] = [];

  lines.forEach((line) => {
    if (/^#{1,6} /.test(line)) {
      sections.push({ text: currentLines, heading: currentHeading });
      currentHeading = line.replace(/^#+ /, '').trim();
      currentLines = [];
    }
    currentLines.push(line);
  });
  sections.push({ text: currentLines, heading: currentHeading });

  return sections
    .map((section) => ({ text: section.text.join('\n').trim(), heading: section.heading }))
    .filter((section) => section.text.length > 0);
}

/** Create the splitter with the phase-2 defaults (tuning happens in phase 4). */
function createSplitter(): RecursiveCharacterTextSplitter {
  return new RecursiveCharacterTextSplitter({ chunkSize: CHUNK_SIZE, chunkOverlap: CHUNK_OVERLAP });
}

/** Chunk one file: split into heading sections, then split each section. */
async function chunkFile(
  filePath: string,
  root: string,
  splitter: RecursiveCharacterTextSplitter
): Promise<ChunkRow[]> {
  const content = await readFile(filePath, 'utf8');
  const source = relative(root, filePath);
  const type = corpusTypeFor(source);
  const sections = splitIntoHeadingSections(content);
  const chunksPerSection = await Promise.all(sections.map((s) => splitter.splitText(s.text)));
  return sections.flatMap((section, i) =>
    chunksPerSection[i].map((chunk) => ({ content: chunk, source, heading: section.heading || type }))
  );
}

function createClient(): OpenAI {
  const apiKey = process.env.NVIDIA_API_KEY;
  if (!apiKey) {
    throw new Error('NVIDIA_API_KEY not configured (run with --env-file=.env)');
  }
  return new OpenAI({ apiKey, baseURL: NVIDIA_BASE_URL });
}

async function embedBatch(client: OpenAI, texts: string[]): Promise<number[][]> {
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

/** Embed all chunk contents in batches, guarding the model dimension. */
async function embedChunks(client: OpenAI, contents: string[]): Promise<number[][]> {
  const allVectors: number[][] = [];
  for (let start = 0; start < contents.length; start += EMBED_BATCH_SIZE) {
    const batch = contents.slice(start, start + EMBED_BATCH_SIZE);
    const vectors = await embedBatch(client, batch);
    if (vectors[0].length !== EMBED_DIM) {
      throw new Error(
        `Embedding dimension mismatch: got ${vectors[0].length}, expected ${EMBED_DIM} (${EMBEDDING_MODEL})`
      );
    }
    allVectors.push(...vectors);
    console.log(`  embedded ${Math.min(start + EMBED_BATCH_SIZE, contents.length)}/${contents.length}`);
  }
  return allVectors;
}

/** Create the rag_chunks table + HNSW index (idempotent). */
async function ensureSchema(sql: NeonSql): Promise<void> {
  await sql`CREATE EXTENSION IF NOT EXISTS vector`;
  await sql`
    CREATE TABLE IF NOT EXISTS rag_chunks (
      id bigserial PRIMARY KEY,
      content text NOT NULL,
      embedding vector(2048),
      source text NOT NULL,
      heading text NOT NULL
    )
  `;
  // HNSW on `vector` caps at 2000 dims; 2048 requires half-precision indexing
  // (halfvec allows 4000). Phase 3 queries must cast the same way for the
  // index to be used: ORDER BY embedding::halfvec(2048) <=> $query::halfvec(2048)
  await sql`
    CREATE INDEX IF NOT EXISTS rag_chunks_embedding_hnsw
    ON rag_chunks USING hnsw ((embedding::halfvec(2048)) halfvec_cosine_ops)
  `;
}

/** Format an embedding vector as the pgvector text literal: [1.0,2.0,...]. */
function toVectorLiteral(embedding: number[]): string {
  return `[${embedding.join(',')}]`;
}

/** Insert one batch of chunk rows inside a transaction. */
async function insertBatch(
  sql: NeonSql,
  rows: (ChunkRow & { embedding: string })[]
): Promise<void> {
  for (const row of rows) {
    await sql`
      INSERT INTO rag_chunks (content, embedding, source, heading)
      VALUES (${row.content}, ${row.embedding}::vector, ${row.source}, ${row.heading})
    `;
  }
}

/** Insert all chunks in batches of INSERT_BATCH_SIZE. */
async function insertChunks(
  sql: NeonSql,
  rows: (ChunkRow & { embedding: string })[]
): Promise<void> {
  for (let start = 0; start < rows.length; start += INSERT_BATCH_SIZE) {
    const batch = rows.slice(start, start + INSERT_BATCH_SIZE);
    await insertBatch(sql, batch);
    console.log(`  inserted ${Math.min(start + INSERT_BATCH_SIZE, rows.length)}/${rows.length}`);
  }
}

/** Clear previous phase-2 rows so the ingest is re-runnable. */
async function resetTable(sql: NeonSql): Promise<void> {
  await sql`TRUNCATE rag_chunks`;
}

async function main(): Promise<void> {
  const root = resolveCorpusRoot();
  const files = await collectCorpusFiles(root);
  console.log(`Corpus root: ${root}`);
  console.log(`Files: ${files.length} (${CORPUS_DIRS.join(', ')})`);

  const splitter = createSplitter();
  const fileChunks = await Promise.all(files.map((file) => chunkFile(file, root, splitter)));
  const chunks = fileChunks.flat();
  console.log(`Chunks: ${chunks.length}`);

  const client = createClient();
  const vectors = await embedChunks(client, chunks.map((chunk) => chunk.content));

  const sql = neon(process.env.DATABASE_URL!);
  await ensureSchema(sql);
  await resetTable(sql);
  await insertChunks(
    sql,
    chunks.map((chunk, i) => ({ ...chunk, embedding: toVectorLiteral(vectors[i]) }))
  );

  console.log(`Model: ${EMBEDDING_MODEL}, input_type: ${EMBEDDING_INPUT_TYPE}, dim: ${EMBED_DIM}`);
  console.log(`Chunking: size ${CHUNK_SIZE}, overlap ${CHUNK_OVERLAP}`);
  console.log(`Done: ${files.length} files -> ${chunks.length} chunks`);
}

main().catch((error) => {
  console.error('Failed:', error);
  process.exit(1);
});
