// rag/04-evaluate.ts

/**
 * RAG Pipeline Phase 4 — Measure and Tune (Eval)
 *
 * Run the hand-written eval set (rag/04-eval-set.json) against the Phase 3
 * retrieval path: 7 answerable questions measure recall@5 (retrieval only,
 * no LLM), 3 should-refuse questions run the full Phase 3 ask path and must
 * answer with the exact refuse phrasing.
 *
 * Run:    npx tsx --env-file=.env rag/04-evaluate.ts
 * Tuning: after each single-variable change (chunkSize via re-ingest,
 *         topK via this script's second argv), re-run and record the row:
 *
 *   | Run | chunkSize | overlap | top-K | recall@5 | refusals |
 *
 * Retrieval note: uses lib/retrieval.ts extracted from 03-ask.ts so the eval
 * measures the exact ask-path retrieval (nemotron-3-embed-1b, input_type
 * 'query', dim 2048, ::halfvec(2048) casts both sides → HNSW index used).
 * 
 * 
 
How It All Connects
 
04-eval-set.json ──► 04-evaluate.ts ──► lib/eval.ts (parse, match rule, refusal check, summary)
                            │
                            ├──► lib/retrieval.ts (embed query → pgvector halfvec top-K)  ◄── shared with 03-ask.ts
                            └──► lib/ask.ts (buildPrompt + generateAnswer, refusals only)
02-ingest.ts (env-tunable chunkSize/overlap) ──► rag_chunks ◄── queried by retrieval.ts

The eval reuses Phase 3's retrieval and answer generation rather than duplicating them, so any number it produces describes the real ask path. Tuning changes one variable per run — chunkSize via env-override re-ingest, top-K via argv — and the results table gets a new row per run.

Results so far (baseline → now):

Run	chunkSize	overlap	top-K	recall	refusals
baseline	800	100	5	6/7	3/3
tune 2	800	100	8	7/7	3/3
tune 3	400	100	5	7/7	3/3
tune 4	400	100	3	7/7	3/3
tune 5	1200	100	5	6/7	3/3
Two measurable wins recorded: top-K 5→8, and chunkSize 800→400 — both fix Q6 (the cross-file Fingo employment question). Why 400 wins: smaller chunks keep the employment record's own text distinctive (higher similarity to its query — 0.63 vs 0.53 at 800) instead of being diluted by neighboring project content; 1200 does the opposite and regresses. A no-overlap run at 400 is re-ingesting now; then I'll pick the winner, do the final confirmation run, and record final numbers.
 */

import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { neon } from '@neondatabase/serverless';
import OpenAI from 'openai';
import { createEmbeddingClient } from './lib/embeddings';
import { buildPrompt, generateAnswer } from './lib/ask';
import { assertChunksExist, retrieveTopK, type NeonSql } from './lib/retrieval';
import {
  evaluateAnswerable,
  evaluateRefusal,
  parseEvalSet,
  summarizeResults,
  type EvalQuestion,
  type EvalResult,
} from './lib/eval';

// Same chat model as phase 3. As-built: nemotron-3-super-120b-a12b stopped
// resolving for this NVIDIA account (404, function not provisioned) —
// nemotron-3-ultra-550b-a55b is the current model that works with JSON mode
// and honors the refuse rule verbatim.
const CHAT_MODEL = 'nvidia/nemotron-3-ultra-550b-a55b';
const EVAL_SET_PATH = join(import.meta.dirname, '04-eval-set.json');

/** Resolve the top-K override from argv[2] (1-20), defaulting to 5. */
function resolveTopK(): number {
  const raw = process.argv[2];
  if (!raw) return 5;
  const topK = Number(raw);
  if (!Number.isInteger(topK) || topK < 1 || topK > 20) {
    console.log('Usage: npx tsx --env-file=.env rag/04-evaluate.ts [topK 1-20]');
    process.exit(1);
  }
  return topK;
}

/** Load and validate the eval set from disk. */
async function loadEvalSet(): Promise<ReturnType<typeof parseEvalSet>> {
  const raw = await readFile(EVAL_SET_PATH, 'utf8');
  return parseEvalSet(raw);
}

function createChatClient(): OpenAI {
  const apiKey = process.env.NVIDIA_API_KEY;
  if (!apiKey) {
    throw new Error('NVIDIA_API_KEY not configured (run with --env-file=.env)');
  }
  return new OpenAI({ apiKey, baseURL: 'https://integrate.api.nvidia.com/v1' });
}

/** Run the retrieval-only half of the eval for one answerable question. */
async function evalAnswerable(
  sql: NeonSql,
  embedClient: OpenAI,
  question: EvalQuestion,
  topK: number
): Promise<EvalResult> {
  const chunks = await retrieveTopK(sql, embedClient, question.question, topK);
  const result = evaluateAnswerable(
    question.question,
    chunks.map((chunk) => chunk.source),
    chunks.map((chunk) => chunk.similarity),
    question.expectedSource!
  );
  const status = result.hit ? 'HIT' : 'MISS';
  console.log(`  [${status}] best similarity ${result.bestSimilarity.toFixed(4)} (expect: ${question.expectedSource})`);
  return result;
}

/** Run the full phase-3 ask path for one should-refuse question. */
async function evalRefusal(
  sql: NeonSql,
  embedClient: OpenAI,
  chatClient: OpenAI,
  question: EvalQuestion,
  topK: number
): Promise<EvalResult> {
  const chunks = await retrieveTopK(sql, embedClient, question.question, topK);
  const prompt = buildPrompt(question.question, chunks);
  const { answer } = await generateAnswer(chatClient, prompt, CHAT_MODEL);
  const result = evaluateRefusal(question.question, answer);
  const status = result.passed ? 'PASS' : 'FAIL';
  console.log(`  [${status}] answer: "${answer.slice(0, 80)}"`);
  return result;
}

/** Print the per-run results table row so tuning runs can be copied into notes. */
function printTuningRow(run: number, topK: number, summary: ReturnType<typeof summarizeResults>): void {
  console.log('\nResults table row (fill chunkSize/overlap from the current ingest):');
  console.log(`  | run ${run} | (chunkSize) | (overlap) | ${topK} | ${summary.hits}/${summary.answerable} | ${summary.refusalsPassed}/${summary.refusals} |`);
}

async function main(): Promise<void> {
  const topK = resolveTopK();
  const evalSet = await loadEvalSet();
  console.log(`Eval set: ${evalSet.questions.length} questions, top-K ${topK}`);

  const sql = neon(process.env.DATABASE_URL!);
  await assertChunksExist(sql);

  const embedClient = createEmbeddingClient();
  const chatClient = createChatClient();

  const results: EvalResult[] = [];
  for (const [i, question] of evalSet.questions.entries()) {
    console.log(`\n[${i + 1}/${evalSet.questions.length}] ${question.question}`);
    if (question.shouldRefuse) {
      results.push(await evalRefusal(sql, embedClient, chatClient, question, topK));
    } else {
      results.push(await evalAnswerable(sql, embedClient, question, topK));
    }
  }

  const summary = summarizeResults(results);
  console.log(`\n=== ${summary.recallLine} (top-K ${topK}) ===`);
  printTuningRow(1, topK, summary);
}

main().catch((error) => {
  console.error('Failed:', error);
  process.exit(1);
});
