# RAG Pipeline 02 - Ingest Corpus Spec

## Overview

Phase 2 of the RAG Pipeline execution plan (`docs/rag-pipeline-execution-plan.md`). Turn the corpus of `.md` documents into retrievable units: read markdown files, split them into chunks with LangChain's `RecursiveCharacterTextSplitter`, embed every chunk, and insert into pgvector on Neon.

**Pipeline context**: Builds directly on Phase 1 (`rag/01-explore-embeddings.ts`). Phases 3-4 (retrieval loop, eval/tuning) consume the `rag_chunks` table created here.

## Requirements

### Script

- New `rag/02-ingest.ts` (standalone script, runnable via `tsx`; no UI)

### Corpus Ingestion

- Corpus root: `/Users/luckyjay_hu/ai_workdir/CreateResume` (passed in as configurable base path)
- Read all `.md` files matching: `context/**/*.md`, `docs/**/*.md`, `ckb/**/*.md`
- Current corpus size: 118 markdown files across the three directories (verified)

### Chunking

- Split each file with LangChain's `RecursiveCharacterTextSplitter`
- Starting parameters: `chunkSize: 800, chunkOverlap: 100` (tuning happens in Phase 4; do not tune now)
- Metadata per chunk:
  - `source`: relative file path
  - `heading`: nearest markdown heading
  - `type`: `context` | `docs` | `ckb` (derived from which directory the file came from)

### Storage (Neon + pgvector)

- Table `rag_chunks`:
  - `id bigserial primary key`
  - `content text`
  - `embedding vector(2048)` (as-built: the plan's `vector(1536)` assumed a different model — measured nemotron dimension is 2048)
  - `source text`
  - `heading text`
- Requires `CREATE EXTENSION IF NOT EXISTS vector;` on the connected Neon branch
- HNSW index (as-built): `USING hnsw ((embedding::halfvec(2048)) halfvec_cosine_ops)` — pgvector caps HNSW on `vector` at 2000 dims, so 2048 requires the documented half-precision expression index. Phase 3 queries must mirror the cast (`embedding::halfvec(2048) <=> $q::halfvec(2048)`) for the index to be used
- Insert loop batched at ~50 rows per transaction (cost guard: do not over-engineer batching)
- Neon driver note: template interpolations are bind parameters, so DDL must hardcode the dimension literal (`vector(2048)`, not an interpolated constant)

### Embedding Provider

- Same model as Phase 1: NVIDIA `nemotron-3-embed-1b` via the existing OpenAI-compatible endpoint — **never mix embedding models**
- Reuse the `input_type` convention established in Phase 1 (log model + `input_type` in output)
- Embedding dimension must match the `vector(1536)` column; if the model returns a different dimension, surface a clear error instead of inserting bad rows

### Logging

- Log file counts and chunk counts: `files → chunks`
- Log the embedding model name and `input_type` used

## Checkpoint (must pass before Phase 3)

- [x] Chunks inserted (as-built: 119 files → 2964 chunks — well above the plan's ~100-400 estimate, which assumed "dozens of files"; more chunks is fine for recall)
- [x] Spot-checked 3 rows: `content` matches its `source` path and `heading` is the nearest markdown heading
- [x] Answered: *why 800/100 and not 8000/0?* — retrieval returns whole chunks; too big dilutes context in the prompt, too small loses surrounding meaning, overlap prevents cutting a sentence mid-thought across a boundary

## Out of Scope

- No retrieval loop or LLM answering (Phase 3)
- No eval set or tuning of `chunkSize`/top-K/overlap (Phase 4)
- No `ask.ts` integration, no UI
- No cleanup/refactor of Phase 1 script (Phase 5)

## References

- Plan: `docs/rag-pipeline-execution-plan.md` (Section 4, Phase 2)
- Phase 1 script: `rag/01-explore-embeddings.ts` (embedding client + `input_type` findings to reuse)
- LangChain.js `RecursiveCharacterTextSplitter`: https://js.langchain.com/docs/tutorials/rag/
- Troubleshooting:
  - `type "vector" does not exist` → extension not enabled on this Neon branch; re-run `CREATE EXTENSION vector;` on the *connected* branch
  - All similarities ~0.5 with no contrast → embedding call silently returned empty strings; log vector length + first values
