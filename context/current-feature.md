# Update Rules Of Current Feature (!!!Do not edit this section!!!)

!!! Read this before update. !!!
Do not violate any following rules:

1. Please keep all the comments stay the same.
2. Do not delete the existing history records.
3. Only add a new history record at the end of this file after a feature is stetted completed.
4. Fill the current feature area with the current active feature title.
5. Update status to "In Progress" when starting a new feature.
6. Update status to "Completed" when finishing a feature.
7. Update goals section with current feature requirements.
8. Update notes section with current feature references.
9. Reset the file ready for next feature: set status to "Not Start"

# Current Feature: RAG Pipeline 04 - Measure and Tune (Eval)

<!-- Feature name goes here when active, e.g. # Current Feature: Add Navbar -->

## Status

In Progress

## Goals

- Build a hand-written eval set `rag/04-eval-set.json`: 10 question/expected-source pairs (7 answerable across context/docs/ckb with varied difficulty, 3 should-refuse with `expectedSource: null` + `shouldRefuse: true`)
- Create standalone eval script `rag/04-evaluate.ts` (`npx tsx --env-file=.env rag/04-evaluate.ts`): reuse the Phase 3 retrieval path (nemotron-3-embed-1b, input_type='query', dim 2048, halfvec(2048) cast both sides, top-K=5); hit = any retrieved chunk source matches expected source
- Run the full Phase 3 ask path (LLM + refuse rule) for the 3 should-refuse questions only; pass = answer is exactly the refuse phrasing
- Log per-question results (question, hit/miss or refuse-pass/fail, best similarity) and summary line `recall@5: N/7 answerable, refusals: N/3 correct`
- Extract minimal shared `rag/lib/retrieval.ts` if `rag/03-ask.ts` doesn't cleanly expose retrieval (no deeper refactor — Phase 5 does cleanup)
- Tune one variable at a time, re-running the full eval after each change: chunkSize 800→400→1200 (requires re-ingest + re-embed), top-K 5→3→8, with/without chunkOverlap
- Pick the winning configuration, re-run eval on it one final time, record final numbers

## Notes

- Spec: `context/features/rag-pipeline-04-eval-spec.md`; Plan: `docs/rag-pipeline-execution-plan.md` (Section 6, Phase 4)
- Builds on Phase 3 (`rag/03-ask.ts`) — eval reuses only the retrieval half; no LLM answer generation for the 7 answerable questions
- Match rule for expected source (exact path or unambiguous fragment) must be defined in the script and kept simple
- Re-ingest at chunkSize/overlap changes = clear `rag_chunks` then re-run `rag/02-ingest.ts` (~2964 chunks per run, budget API cost, don't sweep the grid blindly)
- Checkpoint: at least one tuning move measurably improved recall; explain why it won (chunk granularity vs context dilution); 3 refusals pass on winning config; final numbers ready for README (Phase 5)
- Troubleshooting: no tuning improvement → eval set too easy, add harder cross-file questions; refusal answers anyway → keep instructions above context, verify control question has no source; similarities all ~0.5 → embedding call returned empty strings, log vector length + first values
- Out of scope: README/tag/cleanup (Phase 5), refactor into ingest/ask/evaluate + full lib/ (Phase 5), agent-tool wiring, metrics beyond recall@5 + refusal correctness, CI wiring

## History

- **2026-10-22**: RAG Pipeline 03 - Retrieval Loop (Ask) - Created rag/03-ask.ts: argv question with usage guard, empty-rag_chunks guard, top-5 retrieval via pgvector cosine distance with the halfvec(2048) cast (HNSW index used), three-layer prompt with refuse rule above context, cited JSON answer, citations printed resolved to source :: heading. Extracted rag/lib/embeddings.ts (shared nemotron-3-embed-1b client, input_type='query', dim 2048 guard) and rag/lib/ask.ts (buildPrompt, parseStructuredAnswer with Zod {answer, citations} capped [1..5], generateAnswer with JSON mode + one retry) — pure logic unit-tested (21 new tests). As-built correction: NVIDIA retired meta/llama-3.3-70b-instruct (410 Gone), chat model switched to nvidia/nemotron-3-super-120b-a12b (JSON mode, reasoning model needing larger max_tokens); provider defaults updated. vitest includes rag/**/*.test.ts. Retrieval kept separable from answer generation for Phase 4 eval. 119 tests pass, build passes.
- **2026-10-19**: RAG Pipeline 02 - Ingest Corpus - Created rag/02-ingest.ts: reads CreateResume markdown corpus (119 files across context/docs/ckb), splits by markdown headings then RecursiveCharacterTextSplitter at 800/100, embeds with NVIDIA nemotron-3-embed-1b (input_type='query', dim 2048), inserts into rag_chunks on Neon pgvector with halfvec HNSW cosine index. As-built corrections: vector(2048) not 1536 (measured dimension); HNSW on vector caps at 2000 dims so index uses halfvec expression indexing — phase 3 must mirror the cast in ORDER BY. 119 files -> 2964 chunks inserted, 3-row spot-check passes, 98 tests pass, build passes.
- **2026-10-18**: RAG Pipeline 01 - Explore Embeddings - Created rag/01-explore-embeddings.ts standalone script: embeds 5 sample strings via NVIDIA nemotron-3-embed-1b (OpenAI-compatible endpoint), prints vector length + first 8 values, 5x5 cosine-similarity matrix with hand-written helper. Key finding: input_type='query' required for meaningful contrast (payment pair 0.87, cross-topic ~0.1); phases 2-3 must reuse same model + input_type. Build passes, 98 tests pass.
- **2026-06-29**: Explorer Extension Protocol Alignment (Iteration 13) - Updated commands/results APIs to use proper PollResponse/ResultPayload types from explorer-extension. Created shared types in src/lib/http/explorer-types.ts. Test page now properly tests extension polling pattern. Build passes, 96 tests pass.
- **2026-06-29**: Explorer Extension Refactor - Refactored service-worker.ts to meet code quality standards: each method shows clear process steps, each step with sub-methods or ≤3 lines. Added command handler map, navigation helpers, network filter helpers, content script caller, and polling loop helpers. Build passes, tests pass.
- **2026-06-22**: Explorer Agent - Checkpointer + Interrupt (Iteration 12) - Add PostgresSaver checkpointer, use interrupt() for async pause/resume, remove all AgentStateLog dependencies. Build passes, tests pass.
- **2026-06-19**: Explorer Agent - LangGraph Wiring (Iteration 11) - runExplorerGraph resume mode, pickup/process endpoints wired to LangGraph, Commands GET returns queued commands. Build passes, 149 tests pass.
- **2026-06-18**: Explorer Agent - AI Agent Integration (Iteration 10) - AgentStateLog model, state-log.ts, async execute_tool with hang/resume, test_config node, Results API resume trigger. Build passes, 149 tests pass.
- **2026-06-16**: Explorer Agent - AI Exploration Agent (Iteration 6) - LangGraph ReAct implementation with 6 nodes, Groq integration, Chrome Extension Tool, FetchConfig generator. Build passes.
- **2026-06-15**: Explorer Agent - Chrome Extension (Iteration 2) - EXECUTE_JS, START/GET/STOP_NETWORK_MONITORING commands. 4 new commands, 34 tests, build passes. Manual testing via popup debug UI.
- **2026-06-15**: Explorer Agent - Admin UI (Iteration 4) - Admin UI at /admin/explorer with Submit Task form, Pending Tasks list, and Exploration Results with Approve/Retry. 8 server actions, 6 components, build passes.
- **2026-06-11**: Explorer Agent - Server Integration (Iteration 3) - FetchTask/FetchConfig models, HTTP polling relay, API routes, DB helpers, 17 unit tests
- **2026-06-11**: Explorer Agent - Core Loop - ACT loop with HTTP polling, 27 unit tests, end-to-end verified with Stripe careers page
- **2026-06-11**: Explorer Agent - Chrome Extension (Iteration 1) - Manifest V3 extension with NAVIGATE, GET_SNAPSHOT, EXTRACT_DOM commands. HTTP polling protocol for serverless compatibility.
- **2026-06-10**: Explorer Agent - Chrome Extension Spec (Iteration 1)
- **2026-06-09**: AI Explorer Agent - comprehensive research on AI agent evolution, memory, RAG, workflows. Created plan and 5 spec files for Iteration 1.
- **2026-06-08**: Company Table Add Columns
- **2026-06-07**: Company Batch Create
- **2026-06-06**: Company Batch Import Dialog
- **2026-06-05**: Company Create (Modal Dialog)
- **2026-06-04**: Dashboard Company Spec
- **2026-06-03**: Database Seed Script
- **2026-06-02**: Prisma + Neon PostgreSQL Setup
- **2026-06-01**: Company View Phase 1
- **2026-05-27**: Dashboard UI Phase 1-2
- **2026-05-26**: Initial Next.js and Tailwind CSS v4 setup