# WhyJob RAG Pipeline

A minimal-but-complete RAG pipeline over my own career knowledge base: markdown corpus → chunks → embeddings → pgvector retrieval → cited LLM answers with refusal behavior, plus a hand-written eval harness that measures recall and drove the retrieval tuning. Project-tier, standalone scripts — no UI, no server.

## Architecture

```
CreateResume corpus (119 .md files: context/ docs/ ckb/)
    │
    ▼
02-ingest.ts ──► heading sections + RecursiveCharacterTextSplitter (chunkSize 400, overlap 0)
    │
    ▼
lib/embeddings.ts ──► NVIDIA nemotron-3-embed-1b (input_type='query', 2048 dims)
    │
    ▼
Neon PostgreSQL: rag_chunks (vector(2048) + HNSW index on embedding::halfvec(2048))
    │
    ▼
lib/retrieval.ts ──► top-5 by cosine distance (halfvec casts both sides → index used)
    │
    ▼
lib/ask.ts ──► three-layer prompt (instructions + refuse rule ABOVE context) → chat model
    │         (nemotron-3-ultra-550b-a55b, JSON mode, retry once)
    ▼
cited answer + refusals ("Not in the knowledge base.")
```

| File | Purpose |
| --- | --- |
| `01-explore-embeddings.ts` | Phase 1: feel embeddings — 5×5 cosine-similarity matrix, hand-written helper |
| `02-ingest.ts` | Phase 2: corpus → chunks → embeddings → `rag_chunks` (env-tunable chunkSize/overlap) |
| `03-ask.ts` | Phase 3: question → top-5 retrieval → cited answer |
| `04-eval-set.json` | Phase 4: 10 hand-written pairs (7 answerable, 3 should-refuse) |
| `04-evaluate.ts` | Phase 4: recall@5 eval + refusal checks (optional topK argv override) |
| `lib/` | Shared pure logic: `embeddings.ts`, `retrieval.ts`, `ask.ts`, `eval.ts` (unit-tested) |

## Reproduce from a Fresh Clone

1. **Env vars** (`.env` in repo root): `NVIDIA_API_KEY` (embeddings + chat), `DATABASE_URL` (Neon Postgres with pgvector).
2. **Corpus**: phase 2 reads a CreateResume-layout markdown corpus (`context/`, `docs/`, `ckb/` subdirs). Default root is hardcoded; pass yours as argv: `npx tsx --env-file=.env rag/02-ingest.ts /path/to/corpus-root`. Any markdown corpus works — adjust the eval set to your own files.
3. **End-to-end:**

```bash
# 1. Ingest (chunks + embeds + inserts; re-runnable, truncates first)
npx tsx --env-file=.env rag/02-ingest.ts

# 2. Ask a question (retrieval + cited answer)
npx tsx --env-file=.env rag/03-ask.ts "When the WeChat Pay API field-set change broke supplier onboarding at ClouDr, what was the two-track response?"

# 3. Eval (recall@5 + refusals; optional topK override, e.g. `rag/04-evaluate.ts 3`)
npx tsx --env-file=.env rag/04-evaluate.ts

# Unit tests
npm run test:run
```

## Eval Results — Tuning Before/After

10 hand-written questions (7 answerable, 3 should-refuse on absent topics). Tuning changed one variable at a time, re-running the full eval after each change.

| Run | chunkSize | overlap | top-K | recall@5 | refusals |
| --- | --------- | ------- | ----- | -------- | -------- |
| baseline | 800 | 100 | 5 | 6/7 | 3/3 |
| tune 1 | 800 | 100 | 8 | 7/7 | 3/3 |
| tune 2 | 400 | 100 | 5 | 7/7 | 3/3 |
| tune 3 | 400 | 100 | 3 | 7/7 | 3/3 |
| tune 4 | 1200 | 100 | 5 | 6/7 | 3/3 |
| **winner** | **400** | **0** | **5** | **7/7** | **3/3** |

**Why 400/0 won:** smaller chunks keep the cross-file question's target (the Fingo employment record) distinctive — its similarity to the query rises from 0.53 (chunkSize 800) to 0.63 (400) — instead of being diluted by neighboring project content. 1200 does the opposite and regresses. Overlap 0 matched 400/100 quality with fewer chunks (5233 vs 5404), so it wins on ingest cost.

**The interview sentence:** this eval loop is the TDD-fixture habit applied to retrieval — hand-written fixtures (the eval set), a red/green signal (recall misses), and one-variable-at-a-time refactoring (tuning).

## Full Example (Winner Config)

Question: *"When the WeChat Pay API field-set change broke supplier onboarding at ClouDr, what was the two-track response?"*

Retrieved top-5:

```
[1] ckb/achievements/wechat-pay-two-track-remediation.md :: Outcome (similarity 0.8031)
[2] ckb/stories/wechat-pay-api-field-change.md :: Situation (similarity 0.7105)
[3] ckb/content/backend-engineer.md :: payment-incident — WeChat Pay field-change incident, ... (0.6975)
[4] ckb/employment/cloudr-senior-java.md :: Related stories (similarity 0.6898)
[5] ckb/projects/cloudr-pay-center.md :: Notable incident (similarity 0.6595)
```

Answer:

> The team ran a two-track remediation: a code adoption fix that shipped within two weeks, and a manual workaround (manual merchant submission) that onboarded over 10 merchants during that window, keeping supplier onboarding flowing.

Citations: `[1] ckb/achievements/wechat-pay-two-track-remediation.md`, `[4] ckb/employment/cloudr-senior-java.md`

**Refusal example** — *"What is the company's 2027 revenue plan?"* → answer is exactly `Not in the knowledge base.` (the prompt's refuse rule sits above the context; absent-topic questions never hallucinate).

## As-Built Corrections

Details that differ from the original plan (worth knowing before reusing this):

- **Vector dimension is 2048, not 1536** — measured at phase 1, `nemotron-3-embed-1b` returns 2048-dim vectors.
- **HNSW index uses a halfvec expression.** pgvector caps `vector`-type index dims at 2000; 2048 requires indexing `embedding::halfvec(2048)`. Queries must mirror the same cast in `ORDER BY` or the index is silently ignored.
- **`input_type: 'query'` on both sides.** NVIDIA retrieval models require the input role; ingest and query use the same value, keeping both in one vector space. Phase 1 measured meaningful contrast only with it (related pair 0.87, cross-topic ~0.1).
- **Never mix embedding models** between ingestion and query — the constants live once in `lib/embeddings.ts` and every phase reuses them.
- **Chat model history:** the plan's `meta/llama-3.3-70b-instruct` was retired by NVIDIA (410 Gone) → `nemotron-3-super-120b-a12b` → it later stopped resolving for this account (404 function-not-provisioned, still listed in `/models`) → current: `nemotron-3-ultra-550b-a55b` (JSON mode, honors the refuse rule verbatim, reasoning model needing larger `max_tokens`).
- **Chunking is two-stage:** markdown heading sections first (preserves `heading` metadata), then `RecursiveCharacterTextSplitter` within each section.

## Scope Honesty

- **Personal project extension**, not a product feature: the corpus is my own career knowledge base (CreateResume repo), the scripts run locally, and there is no production traffic.
- **Not enterprise RAG**: no access isolation / tenancy, no incremental sync, no hybrid search, no reranker, no streaming. The eval set is 10 hand-written questions, not a benchmark suite.
- What it does demonstrate end-to-end: chunking trade-offs, pgvector + HNSW with a real dimension constraint, grounded generation with citations, refusal behavior, and a measured recall before/after tuning.

## Tests

`rag/lib/*.test.ts` — 36 tests cover prompt building, structured-answer parsing (Zod, citations capped 1–5), embedding client + dimension guard, eval-set validation (Zod cross-field rules), the source-match rule, refusal checking, and summarization. Run with `npm run test:run`. The scripts themselves are I/O glue and stay out of unit-test scope per project standards.
