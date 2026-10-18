# RAG Pipeline 01 - Explore Embeddings Spec

## Overview

Phase 1 of the RAG Pipeline execution plan (`docs/rag-pipeline-execution-plan.md`). Before any pipeline code, understand what a vector is by playing with real ones: embed a few short strings, print vector details, and compute cosine similarity with a hand-written helper (no library).

**Pipeline context**: This is the foundation phase. Phases 2-5 (chunking, retrieval loop, eval/tuning, hardening) build on the embedding understanding established here.

## Requirements

### Script

- New `rag/01-explore-embeddings.ts` (standalone script, runnable via `tsx`/`ts-node`; no UI)
- Embed 5 short strings:
  - `"payment reconciliation"`
  - `"how to reconcile payments"`
  - `"LangGraph state graph"`
  - `"Douyin ad placement"`
  - `"recipe for dumplings"`

### Output

- Print the vector length and the first 8 values of each embedding
- Print a 5x5 cosine-similarity matrix between all pairs

### Cosine Similarity Helper

- Hand-written, ~10 lines, no external library
- Lives in the same file (not exported; file-local per coding standards)

### Embedding Provider

- Use NVIDIA `nemotron-3-embed-1b` via the existing OpenAI-compatible endpoint
- No new accounts; embeddings APIs are interchangeable
- Model name must be logged in output (phases 2-3 must reuse the exact same model — never mix embedding models)

## Checkpoint (must pass before Phase 2)

- [ ] The two payment sentences score high (~0.7-0.9) with each other, low (~0.2-0.4) with "dumplings"
- [ ] One-sentence articulation of what an embedding is: *a fixed-length vector where semantic similarity becomes geometric proximity*

## Out of Scope

- No chunking, no document ingestion (Phase 2)
- No pgvector / database writes
- No retrieval loop or LLM answering (Phase 3)
- No UI

## References

- Plan: `docs/rag-pipeline-execution-plan.md` (Section 3, Phase 1)
- LangChain.js RAG tutorial (skim for vocabulary only): https://js.langchain.com/docs/tutorials/rag/
- Debug aid: if all similarities sit ~0.5 with no contrast, the embedding call likely returned empty strings — log vector length + first values
