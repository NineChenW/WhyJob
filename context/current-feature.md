# Current Feature

## Status
Complete

## Goals
- [x] Add FetchTask and FetchConfig models to Prisma schema
- [x] Create Prisma migration for new models
- [x] Implement HTTP polling relay in `src/lib/http/relay.ts`
- [x] Create API routes: `/api/agent/commands`, `/api/agent/results`, `/api/explorer/tasks`
- [x] Implement explorer server actions in `src/actions/explorer.ts`
- [x] Create DB helper functions in `src/lib/db/explorer.ts`
- [x] Add Zod schemas in `src/schemas/explorer.ts`
- [x] Verify build passes

## Notes
- HTTP polling is serverless-friendly (unlike WebSocket)
- Extension polls every 2 seconds
- Commands stored in shared bucket for testing
- Results posted to shared bucket so agent can poll them
- Task assignment is fire-and-forget for Iteration 1
- `intervalHours: null` = manual only (not automatic polling)
- Added debug endpoint `POST /api/agent/commands` for manual testing
- Fixed extension default port from 3001 to 3000

### Task States
```
pending → exploring → complete
                    ↘ failed
```
- `pending`: Task created, waiting for extension online
- `exploring`: Extension connected, AI actively exploring
- `complete`: Config generated successfully
- `failed`: Max iterations or unrecoverable error

### Content Types
- `company_culture`
- `job_listing`
- `company_wechat`

### Parse Methods
- `json` - Parse as JSON
- `cheerio` - CSS selector extraction

### Pagination Types
- `page` - Page number parameter
- `offset` - Offset parameter
- `cursor` - Cursor-based pagination

### HTTP Polling Flow
```
Extension ──GET /commands──▶ Server
         ◀──{ commands }───

Extension ──POST /results──▶ Server
         ◀──{ success }────

                    Server ──GET /results──▶ Explorer Agent
                    Server ◀──{ results }───

                    Server ◀──POST /commands─ Explorer Agent
                    Server ──{ success }───▶ Explorer Agent
```

### Command Interface
```typescript
interface Command {
  type: 'NAVIGATE' | 'GET_SNAPSHOT' | 'EXTRACT_DOM';
  requestId: string;
  params?: { url?: string; selectors?: Record<string, string> };
}

interface CommandResult {
  requestId: string;
  success: boolean;
  data?: unknown;
  error?: string;
}
```

### API Endpoints
| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/agent/commands?extensionId=xxx` | Extension polls for pending commands |
| POST | `/api/agent/commands` | Debug: add commands to queue |
| POST | `/api/agent/results` | Extension posts command execution results |
| GET | `/api/agent/results?extensionId=xxx` | Agent polls for command results |
| POST | `/api/explorer/tasks` | Create new exploration task |
| GET | `/api/explorer/tasks/:id` | Get task status and result |

### Reference
- `@context/features/explorer-agent-03-server-integration-spec.md` - Full spec with exact schemas
- `@docs/ai-assist-fetch-info-plan.md` - Full system design

## History

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