# Explorer Agent - Core Loop

## Status

Complete

## Goals

- [x] Implement `explore()` function with ACT loop (max 5 iterations)
- [x] Implement `decideNextAction()` with priority rules + heuristic fallback
- [x] Implement `analyzeResult()` to extract discoveries from action results
- [x] Implement `generateFinalConfig()` to build FetchConfig from discoveries
- [x] Implement `initializeMemory()`, `updateMemory()`, `retrieveContext()` for working memory
- [x] HttpExtension for Chrome Extension HTTP polling communication
- [x] 27 unit tests for pure utility functions

## Notes

**Implementation completed and tested successfully via end-to-end test.**

Protocol uses HTTP polling (not WebSocket):
- Extension polls: `GET /commands?extensionId=xxx`
- Extension posts: `POST /results { extensionId, results }`
- Agent polls: `GET /results?extensionId=shared`

## History

- **2026-06-11**: Explorer Agent - Core Loop - ACT loop with HTTP polling, 27 tests, end-to-end verified
- **2026-06-11**: Explorer Agent - Chrome Extension (Iteration 1) - Manifest V3 extension with NAVIGATE, GET_SNAPSHOT, EXTRACT_DOM commands. HTTP polling protocol for serverless compatibility.

## Notes

### Overview

Explorer Agent runs an **ACT loop** (Observe → Think → Act → Observe) to explore company websites and generate `FetchConfig`. It controls the Chrome Extension via WebSocket.

**Iteration 1 Scope**: Basic ACT loop with max 5 iterations, simple decision logic.

### Key Types

```typescript
// Input
interface ExplorationTask {
  companyId: string;
  company: { name: string; website?: string; industry?: string };
  contentTypes: string[];  // e.g., ['careers', 'jobs', 'culture']
}

// Output
interface ExplorationResult {
  success: boolean;
  config?: FetchConfig;
  reason?: string;
}

// Working Memory
interface ExplorationMemory {
  task: ExplorationTask;
  pagesVisited: string[];
  discoveries: Discovery[];
  iteration: number;
}

// Discovery
interface Discovery {
  type: 'api_endpoint' | 'webpage' | 'requires_auth' | 'no_content';
  url?: string;
  data?: unknown;
  selectors?: Record<string, string>;
  requiresAuth?: boolean;
  reason?: string;
}

// Decision
interface Decision {
  action: 'NAVIGATE' | 'EXTRACT_DOM' | 'TEST_API' | 'GENERATE_CONFIG' | 'FAIL';
  targetUrl?: string;
  selectors?: Record<string, string>;
  reason?: string;
}
```

### Core Algorithm (ACT Loop)

```typescript
async function explore(task: ExplorationTask): Promise<ExplorationResult> {
  // 1. Initialize working memory
  const memory = initializeMemory(task);

  // 2. Retrieve context (empty in Iteration 1)
  const priorKnowledge = await retrieveContext(task);

  // 3. ACT Loop (max 5 iterations)
  for (let i = 0; i < MAX_ITERATIONS; i++) {
    memory.iteration = i;

    // THINK: Decide next action
    const decision = await decideNextAction({
      task,
      iteration: i,
      pagesVisited: memory.pagesVisited,
      discoveries: memory.discoveries,
      priorKnowledge
    });

    // ACT: Execute via extension
    const result = await executeAction(decision, extension);

    // OBSERVE: Analyze result
    const discovery = analyzeResult(result, decision);
    if (discovery) {
      memory.discoveries.push(discovery);
      memory.pagesVisited.push(decision.targetUrl);
    }

    // Update memory (persists across iterations)
    await updateMemory(memory);

    // Stopping conditions
    if (decision.action === 'GENERATE_CONFIG') {
      return generateFinalConfig(memory);
    }
    if (decision.action === 'FAIL') {
      return { success: false, reason: decision.reason };
    }
  }

  // Max iterations reached — return what we have
  return generateFinalConfig(memory);
}
```

### Decision Logic (`decideNextAction`)

Priority rules:
1. If `iteration === 0` AND no pages visited → `NAVIGATE` to company URL or careers page
2. If we have API endpoint in discoveries → `TEST_API`
3. If we have page HTML in discoveries → `ANALYZE` and decide: another page or `GENERATE_CONFIG`
4. If no discoveries after 2 iterations → `FAIL` (no accessible source)

AI assists with:
- Which specific URL to try next
- Which selectors to extract
- When to give up and generate config

### Result Analysis (`analyzeResult`)

Extract useful information from action result:
- `api_endpoint` — Found API URL with JSON response
- `webpage` — Found HTML page with content
- `requires_auth` — Page requires authentication
- `no_content` — No useful content found

### FetchConfig Output (`generateFinalConfig`)

```typescript
{
  companyId: string;
  contentType: string;
  name: string;
  url: string;
  method: 'GET';
  headers: { 'User-Agent': 'WhyJobBot/1.0' };
  params: Record<string, string>;
  parseWith: 'json' | 'cheerio';
  selectors: Record<string, string>;
  pagination?: { type: 'offset' | 'cursor' | 'page'; param: string };
  authRequired: boolean;
  confidence: number;  // 0-100
}
```

### Key Constants

| Constant | Value | Description |
|----------|-------|-------------|
| `MAX_ITERATIONS` | 5 | Max ACT loop iterations |
| `QUALITY_THRESHOLD` | 70 | Min confidence to auto-approve |
| `NETWORK_TIMEOUT` | 10000 | Network timeout in ms |

### Reference Files

- `context/features/explorer-agent-02-agent-core-spec.md` — This spec
- `context/features/explorer-agent-01-chrome-extension-spec.md` — Extension commands
- `docs/ai-assist-fetch-info-plan.md` — Full system design
- `src/lib/ai/agents/explorer-agent.ts` — Implementation target

### Extension Commands (from spec)

| Command | Description |
|---------|-------------|
| `NAVIGATE` | Navigate to URL, wait for load |
| `GET_SNAPSHOT` | Get accessibility tree |
| `EXTRACT_DOM` | Extract content using selectors |

## History

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