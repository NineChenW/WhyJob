# Explorer Agent - Server Integration Spec

## Overview

Server handles task queue management, FetchConfig persistence, and HTTP-based coordination between Explorer Agent and Chrome Extension.

**Iteration 1 Scope**: Simple task queue (pending → exploring → complete/failed), basic FetchConfig model, HTTP polling relay.

## Requirements

### Task Queue States

```
pending → exploring → complete
                    ↘ failed
```

**State Transitions**:
- `pending`: Task created, waiting for extension online
- `exploring`: Extension connected, AI actively exploring
- `complete`: Config generated successfully
- `failed`: Max iterations or unrecoverable error

### Database Model: FetchTask (Iteration 1)

```typescript
model FetchTask {
  id          String   @id @default(cuid())
  companyId   String
  contentTypes String[] // ['company_culture', 'job_listing', 'company_wechat']
  status      String   @default('pending')
  // 'pending' | 'exploring' | 'complete' | 'failed'

  // Exploration result
  config      Json?    // FetchConfig if successful
  reason      String?   // Failure reason if failed
  iterations  Int       @default(0)

  // AI confidence
  confidence  Float?

  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt
  completedAt DateTime?

  @@index([status])
  @@index([companyId])
}
```

### Database Model: FetchConfig (Iteration 1)

```typescript
model FetchConfig {
  id          String   @id @default(cuid())
  companyId   String
  name        String   // Human-readable name

  // Content type (single per config)
  contentType String   // 'company_culture' | 'job_listing' | 'company_wechat'

  // URL and method
  url         String
  method      String   @default("GET")

  // Headers
  headers     Json     @default("{}")

  // Query params (for pagination)
  params      Json     @default("{}")

  // Parse method
  parseWith   String   @default("json") // 'json' | 'cheerio'
  selectors   Json?    // For cheerio: { field: 'selector' }

  // Pagination
  pagination  Json?    // { type: 'page' | 'offset', paramName, maxPages }

  // Auth
  authRequired Boolean @default(false)
  authNote     String?

  // Metadata
  isActive    Boolean  @default(true)
  intervalHours Int?    // null = manual only

  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  @@unique([companyId, contentType])
}
```

### HTTP Polling Protocol

```
Extension                         Server                         Explorer Agent
  │                                  │                                  │
  │──── GET /api/agent/commands ───▶│                                  │
  │◄─── { commands: [...] } ─────────│                                  │
  │                                  │                                  │
  │  (execute command in browser)     │                                  │
  │                                  │                                  │
  │──── POST /api/agent/results ────▶│                                  │
  │      { results: [...] }           │                                  │
  │◄─── { success: true } ───────────│                                  │
  │                                  │                                  │
  │                                  │◄──── GET /results?extensionId=xxx │
  │                                  │───── { results: [...] } ─────────▶│
  │                                  │                                  │
  │                                  │◄──── POST /commands ──────────────│
  │                                  │───── { success: true } ──────────▶│
```

### API Endpoints

#### GET /api/agent/commands
Extension polls for pending commands.

Query params: `?extensionId=xxx`

Response:
```typescript
{
  commands: Command[];
  serverUrl?: string;
}
```

#### POST /api/agent/results
Extension posts command execution results.

Body:
```typescript
{
  extensionId: string;
  results: CommandResult[];
}
```

#### GET /api/agent/results
Agent polls for command results.

Query params: `?extensionId=xxx`

Response:
```typescript
{
  results: CommandResult[];
}
```

#### POST /api/explorer/tasks
Create new exploration task.

```typescript
// Request
{
  companyId: string;
  contentTypes: string[];
}

// Response
{
  taskId: string;
  status: 'pending';
}
```

#### GET /api/explorer/tasks/:id
Get task status and result.

```typescript
// Response
{
  id: string;
  status: string;
  config?: FetchConfig;
  reason?: string;
  iterations?: number;
  confidence?: number;
}
```

## Reference

- `@docs/ai-assist-fetch-info-plan.md` - Full system design
- `@context/features/explorer-agent-01-chrome-extension-spec.md` - Extension commands
- `@context/features/explorer-agent-02-agent-core-spec.md` - Agent loop

## Notes

- HTTP polling is serverless-friendly (unlike WebSocket)
- Extension polls every 2 seconds
- Commands stored in shared bucket for testing (no extensionId required)
- Results posted to shared bucket so agent can poll them
- Task assignment is fire-and-forget for Iteration 1

### Prisma Migration

Add to `prisma/schema.prisma`:

```prisma
model FetchTask {
  id          String   @id @default(cuid())
  companyId   String
  contentTypes String[]
  status      String   @default("pending")

  config      Json?
  reason      String?
  iterations  Int      @default(0)
  confidence  Float?

  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt
  completedAt DateTime?

  @@index([status])
  @@index([companyId])
}

model FetchConfig {
  id          String   @id @default(cuid())
  companyId   String
  name        String
  contentType String

  url         String
  method      String   @default("GET")
  headers     Json     @default("{}")
  params      Json     @default("{}")
  parseWith   String   @default("json")
  selectors   Json?
  pagination  Json?

  authRequired Boolean @default(false)
  authNote     String?

  isActive    Boolean  @default(true)
  intervalHours Int?

  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  @@unique([companyId, contentType])
}
```

### Zod Schemas

```typescript
// src/schemas/explorer.ts

import { z } from 'zod';

export const contentTypeSchema = z.enum(['company_culture', 'job_listing', 'company_wechat']);
export const parseWithSchema = z.enum(['json', 'cheerio']);
export const paginationTypeSchema = z.enum(['page', 'offset', 'cursor']);

export const fetchTaskCreateSchema = z.object({
  companyId: z.string().min(1),
  contentTypes: z.array(contentTypeSchema).min(1),
});

export const fetchTaskResponseSchema = z.object({
  id: z.string(),
  status: z.enum(['pending', 'exploring', 'complete', 'failed']),
  config: z.any().optional(),
  reason: z.string().optional(),
  iterations: z.number().optional(),
  confidence: z.number().optional(),
  createdAt: z.date(),
  completedAt: z.date().optional(),
});

export const fetchConfigSchema = z.object({
  id: z.string(),
  companyId: z.string(),
  name: z.string(),
  contentType: contentTypeSchema,
  url: z.string().url(),
  method: z.enum(['GET', 'POST']).default('GET'),
  headers: z.record(z.string()).default({}),
  params: z.record(z.string()).default({}),
  parseWith: parseWithSchema.default('json'),
  selectors: z.record(z.string()).optional(),
  pagination: z.object({
    type: paginationTypeSchema,
    paramName: z.string(),
    maxPages: z.number().positive(),
    increment: z.number().optional(),
    stopCondition: z.string().optional(),
  }).optional(),
  authRequired: z.boolean().default(false),
  authNote: z.string().optional(),
  isActive: z.boolean().default(true),
  intervalHours: z.number().positive().optional(),
});
```

### File Structure

```
src/
├── lib/
│   ├── ai/
│   │   ├── client.ts              # AI client wrapper (Groq)
│   │   ├── prompts/
│   │   │   └── explorer.ts        # Explorer prompt templates
│   │   └── agents/
│   │       └── explorer-agent.ts  # Explorer Agent implementation
│   │
│   ├── db/
│   │   └── explorer.ts            # Explorer DB functions
│   │
│   └── http/
│       └── relay.ts               # HTTP polling relay logic
│
├── actions/
│   └── explorer.ts                # Server actions
│
├── components/
│   └── admin/
│       └── explorer/
│           ├── explorer-page.tsx  # Main admin page
│           ├── task-form.tsx      # Submit task form
│           ├── task-list.tsx      # Pending/complete lists
│           ├── config-preview.tsx
│           └── status-badge.tsx
│
├── app/
│   └── admin/
│       └── explorer/
│           └── page.tsx          # Admin explorer page route
│   └── api/
│       └── agent/
│           ├── commands/route.ts
│           └── results/route.ts
│
└── chrome-extension/              # Separate package
    ├── manifest.json
    ├── service-worker.ts
    └── popup/
```

### HTTP Relay Implementation

```typescript
// src/lib/http/relay.ts

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

// In-memory stores for testing (use Redis/DB in production)
const commandQueue = new Map<string, Command[]>();
const resultStore = new Map<string, CommandResult[]>();

function addCommand(extensionId: string, command: Command) {
  const existing = commandQueue.get(extensionId) || [];
  existing.push(command);
  commandQueue.set(extensionId, existing);
}

function getCommands(extensionId: string): Command[] {
  const commands = commandQueue.get(extensionId) || [];
  commandQueue.delete(extensionId);
  return commands;
}

function addResult(extensionId: string, result: CommandResult) {
  const existing = resultStore.get(extensionId) || [];
  existing.push(result);
  resultStore.set(extensionId, existing);
}

function getResults(extensionId: string): CommandResult[] {
  const results = resultStore.get(extensionId) || [];
  resultStore.delete(extensionId);
  return results;
}
```