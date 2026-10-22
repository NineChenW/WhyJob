# RAG Pipeline 04 - Measure and Tune (Eval) Spec

## Overview

Phase 4 of the RAG Pipeline execution plan (`docs/rag-pipeline-execution-plan.md`, Section 6). Turn "I followed a tutorial" into "I engineered retrieval quality": build a small hand-written eval set, measure retrieval quality (`recall@5` + refusal correctness), tune retrieval parameters one variable at a time, and record the before/after numbers. This phase produces the README numbers and the interview story.

**Pipeline context**: Builds on Phase 3 (`rag/03-ask.ts`), which closed the ask loop (embed → top-5 via pgvector halfvec cosine → cited LLM answer). Phase 4 reuses **only the retrieval half** (embed query → SQL top-K) — no LLM answer generation in the eval loop. This is exactly the plan's intent: keep retrieval queryable in isolation.

## Requirements

### Eval Set

- New `rag/04-eval-set.json`: **10 question / expected-source pairs**, hand-written (you know the corpus)
  - 7 answerable: question + the `source` path (or distinctive path fragment) a correct top-5 retrieval must surface
  - 3 should-refuse: question on topics absent from the corpus (e.g. "What's our company's 2027 revenue plan?"), `expectedSource: null` + `shouldRefuse: true`
- Distribute the 7 answerable questions across the corpus dirs (`context` / `docs` / `ckb`) and difficulty levels (easy single-file, cross-file synthesis) — the plan warns: an eval set that's too easy will show no tuning signal, which wastes the phase

### Eval Script

- New `rag/04-evaluate.ts` (standalone, runnable via `npx tsx --env-file=.env rag/04-evaluate.ts`; no UI)
- For each eval question:
  - Retrieve top-K (default 5) via the same retrieval path as Phase 3: NVIDIA `nemotron-3-embed-1b`, `input_type: 'query'`, dim 2048, pgvector query with the `::halfvec(2048)` cast on both sides (mirror Phase 2/3 or the HNSW index is ignored)
  - **Answerable**: hit if any retrieved chunk's `source` matches the expected source (exact path or unambiguous fragment — define the match rule in the script and keep it simple); miss otherwise
  - **Should-refuse**: retrieval-side, mark correct if retrieval returns low-similarity results — but the real refusal check is an LLM call with the Phase 3 prompt (instructions-above-context, refuse rule). Run the full ask path for the 3 refusal questions only, and check the answer is exactly the refuse phrasing
- Log per-question results (question, hit/miss or refuse-pass/fail, best similarity) and a summary line:

  ```
  recall@5: N/7 answerable, refusals: N/3 correct
  ```

- Reuse retrieval logic from Phase 3 rather than re-implementing it. If `rag/03-ask.ts` doesn't cleanly expose it, extract a minimal `rag/lib/retrieval.ts` (query embedding + SQL) shared by both scripts — no deeper refactor (Phase 5 does cleanup)

### Tuning (one variable at a time)

- Re-run the full eval after **each single change**; never change two variables in one run. Keep a results table (in the script's output and later the README):

  | Run | chunkSize | overlap | top-K | recall@5 | refusals |
  | --- | --------- | ------- | ----- | -------- | -------- |
  | baseline | 800 | 100 | 5 | (fill) | (fill) |

  Tuning moves from the plan:
  - `chunkSize` 800 → 400 → 1200 (pick the best)
  - top-K 5 → 3 → 8
  - with / without `chunkOverlap`
- Changing `chunkSize`/`overlap` requires **re-ingesting** (re-run `rag/02-ingest.ts` into the same `rag_chunks` table after clearing it) and re-embedding — budget the API cost (~2964 chunks per re-ingest at current corpus size; it's cheap but not free, so don't sweep the grid blindly)
- Pick the winning configuration, re-run the eval on it one final time, and record the final numbers

## Checkpoint (must pass before Phase 5)

- [ ] Results table shows at least one tuning move that measurably improved recall (e.g. "chunkSize 800→400 lifted recall@5 from 5/7 to 7/7"); if no move helps, the eval set is too easy — add harder cross-file questions, that's signal not failure
- [ ] Explained *why* the winning move helped, in terms of chunk granularity vs. context dilution
- [ ] The 3 should-refuse questions pass on the winning configuration
- [ ] Final numbers are recorded and ready for the README (Phase 5)
- [ ] Can say the interview sentence: this eval loop is the TDD-fixture habit applied to retrieval

## Out of Scope

- No README, no tag, no pipeline cleanup/dead-code removal (Phase 5)
- No refactor into `ingest.ts`/`ask.ts`/`evaluate.ts` + full `lib/` (Phase 5)
- No WhyJob agent-tool wiring (`search_knowledge_base`) — Phase 5 optional item
- No metric beyond recall@5 + refusal correctness (no MRR, no precision, no LLM-as-judge)
- No automated CI wiring — the eval is a manually-run script

## References

- Plan: `docs/rag-pipeline-execution-plan.md` (Section 6, Phase 4)
- Phase 3 script: `rag/03-ask.ts` (retrieval to reuse; refusal prompt for the 3 refusal questions)
- Phase 2 script: `rag/02-ingest.ts` (re-ingest loop for chunkSize/overlap changes; embedding constants, `toVectorLiteral`, halfvec cast)
- Troubleshooting (from plan Section 10):
  - Eval shows no tuning improvement → eval set too easy or corpus too small; add harder cross-file questions
  - Refusal question answers anyway → prompt order wrong or chunks leak the answer; keep instructions above context, verify the control question truly has no source
  - Similarities all ~0.5 → embedding call silently returned empty strings; log vector length + first values
