Please explain "embedding::halfvec(2048) <=> query::halfvec(2048)"

Bro, let me break down that expression piece by piece.

## The full SQL

```sql
ORDER BY embedding::halfvec(2048) <=> '[...]'::halfvec(2048)
LIMIT 5
```

## Part 1: The `::` casts

`::` is PostgreSQL's cast syntax — `embedding::halfvec(2048)` converts the `embedding` column to the `halfvec` type with 2048 dimensions.

**Why is this cast needed at all?** Your embeddings are 2048-dim, stored as `vector(2048)`. Here's the catch:

- pgvector's **HNSW index on plain `vector` caps at 2000 dimensions** — you literally cannot build one on a 2048-dim `vector` column
- pgvector's **`halfvec` type (half-precision floats, 2 bytes each) allows up to 4000 dims** — so 2048 fits

So in Phase 2 ([02-ingest.ts](rag/02-ingest.ts)), the index was created on an _expression_:

```sql
CREATE INDEX ... USING hnsw (embedding::halfvec(2048) halfvec_cosine_ops)
```

This is called an **expression index**: the index isn't on the raw column, it's on the result of casting the column to halfvec.

**The critical rule:** a Postgres expression index is only used when the query's `ORDER BY` computes the _exact same expression_. If your query wrote:

```sql
ORDER BY embedding <=> $query   -- ❌ index ignored → sequential scan over 2964 rows
```

Postgres wouldn't match it to the indexed expression and would fall back to a full table scan — slow, and defeating the whole point of HNSW. By casting identically on both sides in the query, the planner recognizes the indexed expression and uses the index. That's why the comment in the code says "the query must cast the same way or the index is ignored."

There's a small accuracy trade-off: half-precision rounds each float component from 4 bytes to 2, so distance calculations are slightly less precise — negligible in practice for retrieval ranking.

## Part 2: The `<=>` operator

`<=>` is pgvector's **cosine distance** operator (one of three: `<->` is L2/Euclidean, `<#>` is negative inner product).

Cosine distance = `1 − cosine similarity`. It measures the _angle_ between two vectors, ignoring magnitude — the standard choice for text embeddings, where "how similar in meaning" matters, not vector length.

- `0` → identical direction (maximally similar)
- `1` → orthogonal (unrelated)
- `2` → opposite directions

## Part 3: Why it appears twice in the SELECT

```sql
SELECT ...,
       1 - (embedding::halfvec(2048) <=> ${queryLiteral}::halfvec(2048)) AS similarity
FROM rag_chunks
ORDER BY embedding::halfvec(2048) <=> ${queryLiteral}::halfvec(2048)
```

- The **ORDER BY** occurrence does the actual work: sort by cosine distance ascending = most similar first, take top 5.
- The **SELECT** occurrence reuses the same distance, but transforms it for display: `1 - distance = similarity`, so the log shows an intuitive number where **higher = more relevant** (~0.7–0.8 for on-topic chunks, low for irrelevant — your Phase 4 checkpoint expects exactly this differentiation).

## Part 4: The query side

`'${queryLiteral}'::halfvec(2048)` casts the _question's embedding_ — formatted as a Postgres vector literal string like `'[0.0123,-0.0456,...]'` — to the same `halfvec(2048)` type. Both sides of `<=>` must be the same type, and both casts together are what let the planner match the expression index.

## TL;DR

> "Compare each chunk's embedding (cast to half-precision 2048-dim so the HNSW index can exist and be used) against the question's embedding the same way, using cosine distance, and return the 5 closest — reporting similarity as `1 − distance` so bigger means better."
