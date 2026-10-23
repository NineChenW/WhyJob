# RAG Pipeline 05 - Harden and Document Spec

## Overview

Phase 5 of the RAG Pipeline execution plan (`docs/rag-pipeline-execution-plan.md`, Section 7). Harden and document: clean the scripts into one readable pipeline, write `rag/README.md` with the eval numbers and a scope-honesty section, commit + push, tag `rag-v0.1`. This is the closing phase — it turns four working scripts into a presentable, interview-defensible artifact.

**Pipeline context**: Builds on Phase 4 (eval + tuning, winner: chunkSize 400, overlap 0, topK 5 → recall 7/7, refusals 3/3). The shared `lib/` extraction the plan deferred to this phase already happened incrementally (`rag/lib/embeddings.ts`, `rag/lib/retrieval.ts`, `rag/lib/ask.ts`, `rag/lib/eval.ts` were extracted during Phases 3–4), so cleanup here is lighter than the plan assumed: verify the lib split is clean, remove dead code, no structural refactor.

## Requirements

### 1. Pipeline Cleanup

- Final layout: `rag/01-explore-embeddings.ts`, `rag/02-ingest.ts`, `rag/03-ask.ts`, `rag/04-evaluate.ts`, `rag/04-eval-set.json`, `rag/lib/` + `rag/*.test.ts`
- Keep the numbered script names as-is — the numbering is the execution narrative, and the plan's target names (`ingest.ts`, `ask.ts`, `evaluate.ts`) would churn imports and docs for no gain
- Delete dead code only: leftover commented blocks, unused exports, debug logging that's not part of a script's purpose. Do not rename, reorganize, or "improve" working code
- Every script must still run as documented: `npx tsx --env-file=.env rag/<NN-name>.ts` (04-evaluate keeps its topK argv override)
- Verify nothing broke: `npm run test:run` + `npm run build` must pass, and a re-run of the eval on the winning config must reproduce recall 7/7, refusals 3/3

### 2. README (`rag/README.md`)

- **What it is** (2 sentences) + architecture diagram in text (files → splitter → embeddings → pgvector → retriever → LLM)
- **Reproduce instructions**: fresh clone + `.env` keys + the exact commands to run ingest → ask → eval end-to-end (the done-definition requires a fresh clone to reproduce the demo)
- **Eval table** with before/after tuning numbers (from Phase 4's 11-run results table), including the winner row (chunkSize 400, overlap 0, topK 5) and why it won
- **One full example**: a real question, the retrieved sources, the cited answer
- **As-built corrections** worth noting in the README: vector dim 2048 (not 1536), halfvec HNSW expression index (and why phase 3 mirrors the cast), embedding model `nemotron-3-embed-1b` with `input_type: 'query'` on both ingest and query sides, chat model history (llama-3.3-70b retired → nemotron-3-super-120b-a12b → nemotron-3-ultra-550b-a55b)
- **Scope honesty section** (interviewers check): personal project extension; corpus = own career knowledge base; no production traffic; not enterprise RAG
- Do **not** paste chat transcripts or API keys into the README

### 3. Commit, Push, Tag

- Conventional commits, focused (cleanup and README may be one commit or two — keep them separate if the cleanup diff is non-trivial)
- Push to main per the standard workflow (branch → merge, or direct if trivial)
- Tag `rag-v0.1` on the final commit

### 4. Optional (only if time remains, skip without guilt)

- Wire `ask.ts` into WhyJob as an agent tool: the agent gets a `search_knowledge_base` tool (1-hour change that upgrades the story from "a RAG script" to "my agent can consult my knowledge base")
- If done, this becomes its own follow-up feature/spec — do not silently fold agent integration into this cleanup phase

## Checkpoint (Done-Definition)

From plan Section 8, the parts owned by this phase:

- [ ] `git push` done; fresh clone + README instructions reproduce the demo end-to-end
- [ ] Eval summary printed by the eval run shows the recall numbers recorded in the README (7/7 answerable, 3/3 refusals on the winner config)
- [ ] Refusal behavior demonstrated (absent-topic control passes)
- [ ] README scope section present (project-tier, personal)
- [ ] Tag `rag-v0.1` pushed
- [ ] `npm run test:run` + `npm run build` pass after cleanup

The understanding questions in plan Section 8 (explain embeddings, chunk size, same-model rule, `<=>`, HNSW, failure modes, access isolation) are self-check items — not code deliverables, but the README should contain enough material to answer each from it.

## Out of Scope

- No new retrieval features, no re-tuning (Phase 4 is closed; the winner config is frozen)
- No metric additions (MRR, precision, LLM-as-judge)
- No UI
- No CI wiring for the eval
- No WhyJob agent-tool wiring (optional item; if done, it's a separate follow-up feature)
- No CKB / evidence-match / interview-bank updates (plan Section 9 — that's the post-completion workflow step, outside the repo)

## References

- Plan: `docs/rag-pipeline-execution-plan.md` (Section 7, Phase 5; Section 8 done-definition; Section 11 the honest claim sentence)
- Phase 4 results: `context/current-feature.md` history 2026-10-23 entry (11-run tuning table, winner config, as-built model corrections)
- Scripts: `rag/01-explore-embeddings.ts` – `rag/04-evaluate.ts`, `rag/lib/` (`embeddings.ts`, `retrieval.ts`, `ask.ts`, `eval.ts`)
- Eval set: `rag/04-eval-set.json`
- Troubleshooting (from plan Section 10): fresh-clone failure → usually a missing env var not listed in README; eval numbers drift after cleanup → cleanup touched retrieval/embedding constants, revert and re-diff
