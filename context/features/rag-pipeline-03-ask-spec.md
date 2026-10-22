# RAG Pipeline 03 - Retrieval Loop (Ask) Spec

## Overview

Phase 3 of the RAG Pipeline execution plan (`docs/rag-pipeline-execution-plan.md`, Section 5). Close the loop: embed a user question, retrieve the top-5 most similar chunks from `rag_chunks` via pgvector cosine distance, and have the LLM answer strictly from that context with citations. This is the core RAG skill the plan builds toward.

**Pipeline context**: Builds on Phase 2 (`rag/02-ingest.ts`), which populated `rag_chunks` (119 files → 2964 chunks, `vector(2048)`, halfvec HNSW index). Phase 4 (eval/tuning) will reuse this script's retrieval + answer logic, so keep retrieval queryable in isolation.

## Requirements

### Script

- New `rag/03-ask.ts` (standalone script, runnable via `npx tsx --env-file=.env rag/03-ask.ts "question"`; no UI)
- Question comes from argv; if missing, print usage and exit
- Keep the retrieval step (embed → SQL top-K) separable from the answer step so Phase 4 can call just retrieval for eval

### Query Embedding

- Same model as ingestion: NVIDIA `nemotron-3-embed-1b`, `input_type: 'query'`, dim 2048 — **never mix embedding models** between ingestion and query
- Reuse the embedding client pattern from `rag/02-ingest.ts` (`EMBEDDING_MODEL`, `EMBEDDING_INPUT_TYPE`, `NVIDIA_BASE_URL`, dimension guard). Extract shared embedding helpers into `rag/lib/embeddings.ts` if it avoids duplication — otherwise keep them in-file (Phase 5 does the final cleanup; do not over-refactor now)

### Retrieval (pgvector on Neon)

- Top-5 by cosine distance (`<=>`), mirroring Phase 2's as-built halfvec cast so the HNSW index is actually used:

  ```sql
  SELECT content, source, heading,
         1 - (embedding::halfvec(2048) <=> $query::halfvec(2048)) AS similarity
  FROM rag_chunks
  ORDER BY embedding::halfvec(2048) <=> $query::halfvec(2048)
  LIMIT 5
  ```

  (Cast note from Phase 2 as-built: HNSW on `vector` caps at 2000 dims; the index is on `embedding::halfvec(2048)` — the query must cast the same way or the index is ignored.)
- Log each retrieved chunk: rank, `source`, `heading`, `similarity` (4 decimal places is enough) — eyeballable output is the point of this phase
- Guard: if `rag_chunks` is empty or the query returns 0 rows, exit with a clear message (likely re-run Phase 2)

### Prompt Structure (three layers, in this order)

1. **System/instructions**: "Answer ONLY from the provided context. Cite the source path for every claim, e.g. [1]. If the context does not cover the question, reply exactly: 'Not in the knowledge base.' Do not use outside knowledge."
2. **Context**: the 5 retrieved chunks, each labeled `[1] path :: heading` … `[5] path :: heading`
3. **Question**: the user's question verbatim

- The refuse rule must sit **above** the context — prompt order is an explicit checkpoint in the plan

### Answer Generation

- Call the existing OpenAI-compatible client used in Phases 1-2 (NVIDIA endpoint; reuse whichever chat model convention Phase 1 used — check `rag/01-explore-embeddings.ts` / prior work for the chat model name; make it a constant like the embedding constants)
- Zod-validate the structured answer shape (project habit): `{ answer: string, citations: number[] }` — citations must be indices into the `[1]..[5]` labels. Ask for JSON output, parse, Zod-validate, and on validation failure retry once or fail with a clear error
- Print: the question, the cited answer, then the citation list resolved to `source :: heading`

### Manual Test Run (5 questions, increasing difficulty)

1. Easy: "What is the DevStash rate-limiting approach?" → correct answer + correct citation
2. Cross-file: "What did the user confirm about Zuul gateways?" → answer synthesizing multiple chunks, citations present
3. Absent-topic control: "What's our company's 2027 revenue plan?" → must answer "Not in the knowledge base" (no hallucination)
4-5. Two more self-chosen questions spanning different corpus dirs (`context` / `docs` / `ckb`)

## Checkpoint (must pass before Phase 4)

- [ ] Easy question answers correctly with the right citation
- [ ] The absent-topic control refuses instead of hallucinating
- [ ] Explained each prompt layer (instructions → context (cited) → question) and why the refuse-rule matters
- [ ] Similarities are differentiated (payment-style queries ~0.7+, irrelevant pairs low — contrast present, not everything ~0.5)

## Out of Scope

- No eval set, no `recall@5` measurement, no tuning of `chunkSize`/top-K/overlap (Phase 4)
- No README, no tag, no refactor into `ingest.ts`/`ask.ts`/`evaluate.ts` + `lib/` (Phase 5)
- No WhyJob agent-tool wiring (`search_knowledge_base`) — Phase 5 optional item
- No streaming, no conversation memory — single question in, single answer out

## References

- Plan: `docs/rag-pipeline-execution-plan.md` (Section 5, Phase 3)
- Phase 2 script: `rag/02-ingest.ts` (embedding constants, halfvec cast comment at line 169-175, `toVectorLiteral`)
- Phase 1 script: `rag/01-explore-embeddings.ts` (embedding client + `input_type` findings, cosine helper)
- pgvector cosine-distance operator: `<=>`; `1 - distance` = similarity
- Troubleshooting (from plan Section 10):
  - Refusal question answers anyway → prompt order wrong or chunks leak the answer; keep instructions above context, verify the control question truly has no source
  - Index not used / slow query → missing `::halfvec(2048)` cast in ORDER BY
  - All similarities ~0.5 → embedding call silently returned empty strings; log vector length + first values
