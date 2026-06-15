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

- [x] Update `types.ts` - Add new types for Iteration 2 commands
  - `ExecuteJsParams`, `ExecuteJsResult`
  - `StartNetworkMonitoringResult`
  - `GetNetworkLogParams`, `GetNetworkLogResult`, `CapturedNetworkCall`
  - `StopNetworkMonitoringParams`, `StopNetworkMonitoringResult`
  - Update `Command` type union to include new commands
  - Update `CommandResult` data union

- [x] Update `service-worker.ts` - Add network monitoring state and handlers
  - Add `NetworkCallStore` interface and `networkMonitorStore` state
  - Add `activeMonitoringId`, `capturedCalls`, `lastGetNetworkLogTime` state variables
  - Add `executeJs()` function using `chrome.scripting.executeScript`
  - Add `executeStartNetworkMonitoring()` - initializes `chrome.webRequest.onCompleted` listener
  - Add `executeGetNetworkLog()` - returns captured calls with filtering
  - Add `executeStopNetworkMonitoring()` - removes listener, returns stats
  - Add new cases to `executeCommands()` switch statement
  - Update `executeNavigate()` to reset network calls on new navigation

- [x] Update `content-script.ts` - No changes needed (EXECUTE_JS handled via chrome.scripting in service worker)

- [x] Manifest permissions already present (`webRequest`, `scripting`, `webNavigation`)

- [x] Run `npm run build` in `explorer-extension/` directory

- [x] All extension tests pass (16 tests via `npx vitest run`)

## Notes

### Files to Modify

| File | Changes |
|------|---------|
| `explorer-extension/types.ts` | Add 8+ new types/interfaces |
| `explorer-extension/service-worker.ts` | Add network monitoring state + 4 command executors |
| `explorer-extension/content-script.ts` | Add EXECUTE_JS handler |
| `explorer-extension/manifest.json` | Permissions already present |

### Implementation Order

1. **types.ts** - Define all new types first (prerequisite for everything else)
2. **service-worker.ts** - Add network monitoring infrastructure
3. **service-worker.ts** - Add command executors for each new command
4. **content-script.ts** - Add EXECUTE_JS handler
5. **Build & Test**

### Key Implementation Details

**Network Monitoring (service-worker.ts)**:
```typescript
// State structure
interface NetworkCallStore {
  [monitoringId: string]: {
    calls: CapturedNetworkCall[];
    startTime: number;
  };
}

let networkMonitorStore: NetworkCallStore = {};
let activeMonitoringId: string | null = null;
let capturedCalls: CapturedNetworkCall[] = [];
let lastGetNetworkLogTime = 0;

// START_NETWORK_MONITORING creates a monitoring session and starts listening
// Uses chrome.webRequest.onCompleted (not onBeforeRequest) to capture completed responses
// Filter: onCompleted only captures finished requests with timing data
// STOP_NETWORK_MONITORING cleans up listener when monitoringId is stopped
```

**EXECUTE_JS (content-script.ts)**:
```typescript
// Uses chrome.scripting.executeScript in MV3
// args object injected and accessible via `args.keyName` in script
// Capture console.log output via custom console override
// Timeout: 5000ms (not 10s like navigation)
// Return: { success, output?, error?, duration }
```

**GET_SNAPSHOT Update**:
- On navigation (executeNavigate), clear existing network calls
- `networkCalls` array in SnapshotResult now populated from capturedCalls (not just ADD_NETWORK_CALL messages)
- Network calls captured between navigation and snapshot are included

**Error Handling**:
| Command | Timeout | Error Response |
|---------|---------|----------------|
| EXECUTE_JS | 5s | `{ success: false, error: "Script timeout after 5000ms" }` |
| START_NETWORK_MONITORING | - | `{ success: false, error: "Monitoring already active" }` |
| GET_NETWORK_LOG | - | `{ calls: [], count: 0, hasMore: false }` (no error, empty result) |
| STOP_NETWORK_MONITORING | - | `{ success: false, error: "Invalid monitoringId" }` |

### Existing Code Reference

- `service-worker.ts:314-355` - `executeCommands()` switch statement pattern to follow
- `service-worker.ts:391-501` - `executeNavigate()` for navigation timeout pattern
- `content-script.ts:22-42` - Message listener pattern to follow
- `types.ts:23-27` - Command type union pattern

### No API Changes

HTTP polling protocol unchanged. New commands added to existing command queue.

## History

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