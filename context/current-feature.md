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

# Current Feature

## Status

Not Started

## Goals

-

## Notes

-



## History

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