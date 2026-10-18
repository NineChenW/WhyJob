# RAG Pipeline Execution Plan — Item 1 of 12-gap-closing-plan (zhuidemai-full-stack-engineer)

> Purpose: turn gap-close Item 1 ("build a minimal RAG pipeline over a real document set, ~1 weekend") into a step-by-step execution plan sized to your current ability. You finish with: committed code in the WhyJob repo (or a sibling), a README with a real query/answer pair, interview-defensible RAG knowledge, and an upgraded CKB record. Everything below stays inside the honest claim ceiling: **project-tier, never production**.

## 0. Why this plan fits your current ability

You are not starting from zero. From the CKB (`projects/whyjob-ai-agent`, `projects/devstash`):

- You already run **LangChain.js** state-graph agents with prompt chains, tool calling, and `interrupt()`-style suspension.
- You already use **Neon PostgreSQL** (via the Neon MCP server) and **Prisma**.
- You already call **OpenAI-compatible Chat Completions APIs** with JSON-mode responses (DevStash AI features, SiliconFlow/GLM-4-9B path).
- You already practice **Zod schema validation** on LLM output and **spec-driven development with Claude Code**.

The only genuinely new concepts in RAG are: (1) **embeddings** (text → vector), (2) **similarity search** (find nearest vectors), (3) **chunking** (split documents so retrieval works). This plan introduces exactly those three, in that order, each with a checkpoint before moving on.

**Total budget: ~10–12 hours across one weekend** (Saturday 6–7h, Sunday 4–5h). Each phase is a separate commit, so you can stop after any phase and still have something.

## 1. Scope decisions (fixed, to avoid weekend drift)

| Decision | Choice | Why |
| --- | --- | --- |
| Codebase | **Extend WhyJob repo** (new `rag/` directory, standalone script first) | Reuses your existing Neon DB, LangChain.js deps, and OpenAI-compatible client; one repo = one story for interviews |
| Document corpus | **The CreateResume repo's own `.md` docs** (context/, docs/, ckb/ — ~dozens of files) | Real, meaningful content; you can sanity-check retrieval quality by eye; great interview line: "I RAG'd my own career knowledge base" |
| Embedding provider | Same OpenAI-compatible endpoint you already use (SiliconFlow/GLM path), or OpenAI `text-embedding-3-small` if you have a key | Zero new accounts; embeddings APIs are interchangeable |
| Vector store | **pgvector on Neon** (preferred) or in-memory/Chroma fallback | pgvector = one more SQL extension on a DB you already operate; strongest interview signal; Neon supports pgvector |
| UI | None. CLI script + README | UI is not the point; skip it |
| Framework | Plain LangChain.js text-splitter + embeddings + direct pgvector queries. **Do not** use LangChain's full RAG chain abstraction | You must be able to explain every line; the abstraction hides the three concepts you're learning |

## 2. Pre-flight (Friday evening, ~30 min)

- [ ] `git -C <whyjob-repo> checkout -b feat/rag-pipeline`
- [ ] Confirm Neon connection string works (`psql $NEON_URL -c "select 1"`)
- [ ] Confirm your OpenAI-compatible API key works with an embeddings call (one curl; see phase 1)
- [ ] Enable pgvector on the Neon database: `CREATE EXTENSION IF NOT EXISTS vector;`
- [ ] Read (skim only, 15 min): https://js.langchain.com/docs/tutorials/rag/ — just to see the vocabulary (loader → splitter → embeddings → store → retriever). The tutorial builds with in-memory vectors; you'll swap the store for pgvector.

## 3. Phase 1 — Feel embeddings (Saturday morning, ~1.5h)

**Goal:** before any pipeline code, understand what a vector is by playing with real ones.

1. Write `rag/01-explore-embeddings.ts`: embed 5 short strings — e.g. `"payment reconciliation"`, `"how to reconcile payments"`, `"LangGraph state graph"`, `" Douyin ad placement"`, `"recipe for dumplings"`.
2. Print the vector length (e.g. 1536 floats) and the first 8 values.
3. Write a cosine-similarity helper (~10 lines, no library) and print the 5×5 similarity matrix.

**Checkpoint (must pass before phase 2):**
- [ ] The two payment sentences score high (~0.7–0.9) with each other, low (~0.2–0.4) with "dumplings".
- [ ] You can say in one sentence what an embedding is: *a fixed-length vector where semantic similarity becomes geometric proximity*.

**Why this phase exists:** every later debugging session (phase 4) depends on being able to eyeball similarity numbers and know whether retrieval *should* work.

## 4. Phase 2 — Chunk the corpus (Saturday midday, ~1.5h)

**Goal:** turn the CreateResume `.md` files into retrievable units.

1. Write `rag/02-ingest.ts`:
   - Read all `context/**/*.md`, `docs/**/*.md`, `ckb/**/*.md` from a configurable path.
   - Split each file with LangChain's `RecursiveCharacterTextSplitter` — start with `chunkSize: 800, chunkOverlap: 100` (the tutorial's defaults; you'll tune in phase 4).
   - Metadata per chunk: `{ source: relative-path, heading: nearest markdown heading, type: context|docs|ckb }`.
2. Embed every chunk and insert into Neon: table `rag_chunks (id bigserial pk, content text, embedding vector(1536), source text, heading text)`; create an HNSW index (`USING hnsw (embedding vector_cosine_ops)`).
3. Log counts: files → chunks.

**Checkpoint:**
- [ ] ~100–400 chunks inserted (fine either way); spot-check 3 rows — content matches its `source`.
- [ ] You can answer: *why 800/100 and not 8000/0?* (Because retrieval returns whole chunks — too big dilutes context in the prompt; too small loses surrounding meaning; overlap prevents cutting a sentence mid-thought across a boundary.)

**Cost guard:** batching 300 chunks × 1536-dim is a few cents at small-model pricing — don't over-engineer batching; just chunk the insert loop at ~50 rows per transaction.

## 5. Phase 3 — The retrieval loop (Saturday afternoon, ~2h)

**Goal:** query → relevant chunks → LLM answer with citations.

1. Write `rag/03-ask.ts`:
   - Embed the query (same model as ingestion — **never mix embedding models**).
   - `SELECT content, source, heading, 1 - (embedding <=> $1) AS similarity FROM rag_chunks ORDER BY embedding <=> $1 LIMIT 5` (pgvector cosine-distance operator `<=>`).
   - Build a prompt: system rule *"Answer ONLY from the provided context; cite source paths; say 'not in the knowledge base' if the context doesn't cover it"*, then the 5 chunks (label each with `[1] path`), then the question.
   - Call your existing OpenAI-compatible client; **Zod-validate** the shape of your structured answer block (you already have this habit from WhyJob).
2. Run 5 questions of increasing difficulty:
   - Easy: "What is the DevStash rate-limiting approach?"
   - Cross-file: "What did the user confirm about Zuul gateways?"
   - Absent-topic control: "What's our company's 2027 revenue plan?" → must answer "not in the knowledge base".

**Checkpoint (the core RAG skill):**
- [ ] Easy question answers correctly with the right citation.
- [ ] The absent-topic question refuses instead of hallucinating.
- [ ] You can explain each prompt layer: instructions → context (cited) → question, and why the refuse-rule matters.

## 6. Phase 4 — Measure and tune (Sunday morning, ~2.5h)

**Goal:** this is the phase that upgrades "I followed a tutorial" into "I engineered retrieval quality" — and it produces your README numbers.

1. Build `rag/04-eval-set.json`: **10 question/expected-source pairs** you write yourself (you know the corpus; e.g. *Q: "Which JD required JWT+RBAC?" → expects `positions/.../04-evidence-match.md` or the RBAC ckb record*). 7 answerable, 3 should-refuse.
2. Write `rag/04-evaluate.ts`: for each question, retrieve top-5, check whether an expected source appears (hit/miss); log per-question results and a summary line `recall@5: N/7 answerable, refusals: N/3 correct`.
3. Tune **one variable at a time**, re-running the eval each time — keep a tiny results table:
   - `chunkSize` 800 → 400 → 1200 (pick the best)
   - top-K 5 → 3 → 8
   - with/without `chunkOverlap`
4. Pick the winner; record final numbers in the README.

**Checkpoint (this is the interview story):**
- [ ] Your table shows at least one tuning move that measurably improved recall (e.g. "chunkSize 800→400 lifted recall@5 from 5/7 to 7/7").
- [ ] You can explain *why* it helped, in terms of chunk granularity vs. context dilution.

**This eval loop is exactly the TDD-fixture habit from your Evaluator A work (`skills/llm-eval-benchmarking`) applied to retrieval — say that sentence in interviews; it is your strongest differentiator.**

## 7. Phase 5 — Harden and document (Sunday afternoon, ~1.5h)

1. Clean the three scripts into one readable pipeline (`ingest.ts`, `ask.ts`, `evaluate.ts` + shared `lib/`); delete dead code.
2. Write `rag/README.md`:
   - What it is (2 sentences) + architecture diagram in text (files → splitter → embeddings → pgvector → retriever → LLM).
   - The eval table with before/after tuning numbers.
   - One full example: a question, the retrieved sources, the cited answer.
   - **Scope honesty section** (interviewers check): personal project extension; corpus = own career knowledge base; no production traffic; not enterprise RAG.
3. Commit + push; tag `rag-v0.1`.
4. *(Optional, only if time remains)*: wire `ask.ts` into WhyJob as an agent tool (the agent gets a `search_knowledge_base` tool) — a 1-hour change that upgrades the story from "a RAG script" to "my agent can now consult my knowledge base." Skip without guilt; the script alone satisfies Item 1.

## 8. Done-definition checklist (run before claiming completion)

**Working system:**
- [ ] `git push` done; fresh clone + README instructions reproduce the demo end-to-end.
- [ ] Eval summary printed by `npm run rag:eval` shows the recall numbers in the README.
- [ ] Refusal behavior demonstrated (absent-topic control passes).

**Understanding (answer these without notes — this is the "did I truly gain it" test):**
- [ ] Explain embeddings and cosine similarity to a non-ML engineer in 2 sentences.
- [ ] Explain why chunk size matters, and name the failure modes of too-big and too-small.
- [ ] Explain why query and documents must use the same embedding model.
- [ ] Explain what `<=>` does in the pgvector query and why an HNSW index matters at scale.
- [ ] Name 3 real RAG failure modes you saw or would expect (e.g. retrieval misses → hallucination; chunk boundary cuts context; mixed-model embeddings garbage) and one mitigation each.
- [ ] Explain how you'd add "access isolation" to this RAG if two business lines shared it (row-level tenant column + query filter — connect it to your RBAC/Skill-Gateway interview narrative).

**Honest-framing check:**
- [ ] README scope section present (project-tier, personal).
- [ ] You would describe it as "built a working RAG pipeline over my own document corpus as a project extension" — never "production RAG experience".

## 9. After completion — CKB refinement (hand back to the workflow)

1. Update `ckb/projects/whyjob-ai-agent.md`: add a RAG section (design, pgvector choice, eval numbers, the same-embedding-model and chunk-size lessons in your words); status stays `user-confirmed` for facts, the build is `artifact-backed` (repo commit).
2. Update `positions/zhuidemai-full-stack-engineer/04-evidence-match.md` row 2 (RAG half 0 → 3.5) and re-score `12-gap-closing-plan.md` (weighted avg 3.82 → ~3.96).
3. Update `08-interview-question-bank.md`: replace the placeholder RAG after-study answer with your real numbers and the tuning anecdote.

## 10. Failure recovery

| Symptom | Likely cause | Fix |
| --- | --- | --- |
| Embedding API 401/404 | wrong model name for your endpoint | check the provider's embedding model list; SiliconFlow/OpenAI naming differs |
| pgvector `type "vector" does not exist` | extension not enabled on this Neon branch | re-run `CREATE EXTENSION vector;` on the *connected* branch |
| All similarities ~0.5, no contrast | embedding call silently returned empty strings | log vector length + first values (phase 1 exists for exactly this) |
| Refusal question answers anyway | prompt order wrong or chunks leak the answer | keep instructions above context; add an explicit refuse rule; verify the control question truly has no source |
| Eval shows no tuning improvement | eval set too easy or corpus too small | add harder cross-file questions; that's signal, not failure |

## 11. What you will honestly be able to say afterwards

> "I built a working RAG pipeline — chunking, embeddings, pgvector storage, grounded generation with citations, and a small eval harness with measured recall before/after tuning — as an extension of my open-source LangChain agent. Project-tier, not production, but I can walk through every trade-off."

That sentence is Item 1 done, CKB-upgradable, and interview-defensible.
