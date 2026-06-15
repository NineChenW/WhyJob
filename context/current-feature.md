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

# Current Feature

## Status

In Progress

## Goals

- [x] Create admin page at `/admin/explorer`
- [x] Submit New Task form with company dropdown + content type checkboxes
- [x] Pending Tasks list showing waiting/exploring status
- [x] Exploration Results section with config preview and Approve/Retry actions
- [x] Server actions: submitExplorationTask, getExplorationTask, cancelExplorationTask, getPendingExplorationTasks, getExplorationHistory, approveExplorationConfig, retryExplorationTask
- [x] Components: CompanySelect, ContentTypeCheckbox, ExplorationStatusBadge, ConfigPreview, ConfidenceBadge

## Notes

**Implementation Complete** - Build passes, implementation matches spec.

### UI Layout (3 Sections)

**Section 1: Submit New Task**
```
┌─────────────────────────────────────────────────────────────┐
│                    Explore Company Data                      │
├─────────────────────────────────────────────────────────────┤
│  Company:    [Dropdown - select from existing companies]    │
│                                                              │
│  Content Types (select one or more):                         │
│  ☐ Job Listings (careers page, job board)                   │
│  ☐ Company Culture (about page, values)                     │
│  ☐ WeChat (wechat official account info)                    │
│                                                              │
│                            [Start Exploration]              │
└─────────────────────────────────────────────────────────────┘
```

**Section 2: Pending Tasks**
```
┌─────────────────────────────────────────────────────────────┐
│                    Pending Explorations                      │
├─────────────────────────────────────────────────────────────┤
│  Company          │ Content Types      │ Status  │ Action   │
│  ─────────────────────────────────────────────────────────  │
│  Tesla            │ Job Listings       │ waiting │ Cancel   │
│  Stripe           │ Company Culture    │ waiting │ Cancel   │
└─────────────────────────────────────────────────────────────┘
Status: waiting = extension not online yet, exploring = in progress
```

**Section 3: Exploration Results**
```
┌─────────────────────────────────────────────────────────────┐
│                    Exploration Results                       │
├─────────────────────────────────────────────────────────────┤
│  Tesla - Job Listings                                       │
│  Status: ✅ Complete | Confidence: 85% | Iterations: 3     │
│                                                              │
│  Discovered:                                                 │
│  ✓ Found careers.tesla.com API                              │
│  ✓ Returns structured JSON                                  │
│  ✓ 50 jobs per page, pagination works                      │
│                                                              │
│  Generated Config Preview:                                  │
│  ┌─────────────────────────────────────────────────────┐  │
│  │ url: https://careers.tesla.com/api/jobs               │  │
│  │ method: GET                                          │  │
│  │ parseWith: json                                      │  │
│  │ pagination: { type: page, maxPages: 10 }            │  │
│  └─────────────────────────────────────────────────────┘  │
│                                                              │
│  [Approve & Save]  [Retry]  [View Test Data]               │
├─────────────────────────────────────────────────────────────┤
│  Stripe - Job Listings                                       │
│  Status: ❌ Failed | Reason: No accessible API found       │
│                                                              │
│  Attempted:                                                  │
│  ✗ careers.stripe.com - redirected to Lever                │
│  ✗ api.stripe.com/v1/jobs - 401 Unauthorized               │
│                                                              │
│  [Try Again with Different URL]  [Mark as Manual]          │
└─────────────────────────────────────────────────────────────┘
```

### Data Models

**FetchTask** (from `explorer-agent-03-server-integration-spec.md`):
```typescript
{
  id: string;
  companyId: string;
  contentTypes: string[];  // ['company_culture', 'job_listing', 'company_wechat']
  status: 'pending' | 'exploring' | 'complete' | 'failed';
  config: Json?;           // FetchConfig if successful
  reason: string?;         // Failure reason if failed
  iterations: number;
  confidence: number?;
  createdAt: Date;
  completedAt: Date?;
}
```

**FetchConfig**:
```typescript
{
  id: string;
  companyId: string;
  name: string;
  contentType: 'company_culture' | 'job_listing' | 'company_wechat';
  url: string;
  method: 'GET' | 'POST';
  headers: Json;
  params: Json;
  parseWith: 'json' | 'cheerio';
  selectors: Json?;
  pagination: Json?;
  authRequired: boolean;
  authNote: string?;
  isActive: boolean;
  intervalHours: number?;
}
```

### Content Types (enum)
- `job_listing` - Careers page, job board
- `company_culture` - About page, values
- `company_wechat` - WeChat official account info

### Server Actions

```typescript
// Create exploration task
submitExplorationTask(input: {
  companyId: string;
  contentTypes: string[];
}): Promise<{ taskId: string; status: string }>;

// Get task status
getExplorationTask(taskId: string): Promise<ExplorationTask>;

// Cancel task (only if pending)
cancelExplorationTask(taskId: string): Promise<void>;

// Get all pending/exploring tasks
getPendingExplorationTasks(): Promise<ExplorationTask[]>;

// Get completed/failed tasks
getExplorationHistory(): Promise<ExplorationTask[]>;

// Approve and save config to FetchConfig
approveExplorationConfig(taskId: string): Promise<void>;

// Retry failed task (reset status to pending)
retryExplorationTask(taskId: string): Promise<void>;
```

### File Structure
```
src/
├── actions/
│   └── explorer.ts           # All server actions above
├── components/
│   └── admin/
│       └── explorer/
│           ├── explorer-page.tsx       # Main admin page (server component)
│           ├── task-form.tsx           # Section 1: Submit form
│           ├── task-list.tsx           # Section 2: Pending tasks
│           ├── exploration-results.tsx # Section 3: Results
│           ├── config-preview.tsx      # JSON preview of FetchConfig
│           └── status-badge.tsx       # ExplorationStatusBadge + ConfidenceBadge
├── app/
│   └── admin/
│       └── explorer/
│           └── page.tsx    # Route page (client wrapper if needed)
└── lib/
    └── db/
        └── explorer.ts    # DB helpers (may already exist from server integration)
```

### Key Implementation Notes

- Use existing shadcn/ui components (Card, Button, Checkbox, Select, Badge, Textarea, Table)
- Company dropdown: fetch companies via `getCompanies()` action (exists)
- Content types checkbox: multi-select with enum values from schema
- Task list: auto-refresh every 5 seconds OR use optimistic updates
- Config preview: render as formatted JSON in `<pre>` with syntax highlighting
- Toast notifications on: task created, task completed, config approved, task failed
- Status badges: `waiting` (gray), `exploring` (blue/animated), `complete` (green), `failed` (red)
- Confidence colors: green >80%, yellow 60-80%, red <60%

### References

- [docs/ai-assist-fetch-info-plan.md](docs/ai-assist-fetch-info-plan.md)
- [explorer-agent-03-server-integration-spec.md](context/features/explorer-agent-03-server-integration-spec.md)
- UI: Use existing shadcn components, keep simple for Iteration 1
- Toast notifications on status changes

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
