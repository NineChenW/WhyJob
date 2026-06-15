# Explorer Agent - Manual Test Plan

**Feature**: Explorer Agent Admin UI + ACT Loop + Config Fetching
**Date**: 2026-06-14
**Status**: Feature Complete

---

## Architecture Overview

```
┌──────────────────────────────────────────────────────────────────────────────┐
│                              Chrome Extension                                   │
│                                                                               │
│  pickup() ──────────► POST /pickup ──────────► Returns taskId             │
│                                                                               │
│  poll commands ───► GET /commands ─────────────────► Returns command          │
│  ?extensionId=xxx&taskId=yyy         (NAVIGATE/EXTRACT_DOM/TEST_API)         │
│                                                                               │
│  execute in browser                                                           │
│                                                                               │
│  post results ────► POST /results ──────────────────► Updates state          │
│                  { extensionId, results[] }                                    │
│                                                                               │
│  repeat until no more commands                                                │
└──────────────────────────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────────────────────────┐
│                              Admin UI (/admin/explorer)                       │
│                                                                               │
│  1. Submit New Task ──► Creates FetchTask (status: pending)                │
│  2. Pending Tasks ────► Shows pending/exploring tasks                       │
│  3. Exploration Results ──► Shows complete/failed tasks                       │
│                         ──► Test Config button                               │
│                         ──► Approve & Save button                              │
└──────────────────────────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────────────────────────┐
│                         Server-side Fetching                                  │
│                                                                               │
│  fetchWithConfig(config) ──► Makes HTTP request with config                  │
│  fetchWithConfigPaginated(config) ──► Fetches multiple pages                  │
│  fetchCompanyData(configs[]) ──► Fetches all configs for a company            │
└──────────────────────────────────────────────────────────────────────────────┘
```

---

## Test Prerequisites

1. **Chrome Extension loaded** in browser
2. **At least 2 companies** in database (e.g., "Tesla", "Stripe")
3. **Extension pointing to** `http://localhost:3000/api/agent`
4. **Admin UI accessible** at `http://localhost:3000/admin/explorer`

---

## Phase 1: Admin UI - Task Submission

### TC-1.1: Create Exploration Task
| Step | Action | Expected |
|------|--------|----------|
| 1 | Navigate to `/admin/explorer` | Page loads with 3 sections |
| 2 | Select company from dropdown | Company selected |
| 3 | Check "Job Listings" checkbox | Checkbox checked |
| 4 | Click "Start Exploration" | Task created, form resets |
| 5 | Success toast appears | "Exploration task created" |
| 6 | Task appears in Pending list | Shows company + content type + status |

### TC-1.2: Form Validation
| Step | Action | Expected |
|------|--------|----------|
| 1 | Click "Start Exploration" without company | Error: "Please select a company" |
| 2 | Select company, click without content type | Error: "Please select at least one content type" |
| 3 | Submit with all 3 content types | Task created with all types |

### TC-1.3: Pending Task Display
| Step | Action | Expected |
|------|--------|----------|
| 1 | Find created task in Pending list | Shows Company, Content Types, Status, Action |
| 2 | Check status badge | "Waiting" in gray |
| 3 | Check Cancel button | Enabled for pending tasks |
| 4 | Task with status "exploring" | Cancel button disabled |

### TC-1.4: Empty States
| Step | Action | Expected |
|------|--------|----------|
| 1 | Ensure no pending tasks | "No pending explorations" message |
| 2 | Ensure no completed tasks | "No completed explorations yet" message |

---

## Phase 2: Chrome Extension - Task Pickup

### TC-2.1: Pickup with No Tasks
| Step | Action | Expected |
|------|--------|----------|
| 1 | Open extension popup | Shows "No pending tasks" |
| 2 | Click "Refresh" | No change, still no tasks |

### TC-2.2: Pickup with Tasks Available
| Step | Action | Expected |
|------|--------|----------|
| 1 | Create task in admin UI | Task created |
| 2 | Extension calls pickup | Returns taskId + company info |
| 3 | Task status in DB | Changed from "pending" to "exploring" |
| 4 | Extension shows picked up task | Displays task company name |

### TC-2.3: Pickup - Already Processing
| Step | Action | Expected |
|------|--------|----------|
| 1 | Task A picked up by Extension A | Task A status: exploring |
| 2 | Extension B calls pickup | Returns "alreadyProcessing", no new task |
| 3 | Only one task processed at a time | Verified |

---

## Phase 3: ACT Loop - Command Processing

### TC-3.1: First Command - NAVIGATE
| Step | Action | Expected |
|------|--------|----------|
| 1 | Extension polls commands API | GET /commands?taskId=xxx |
| 2 | Agent decides NAVIGATE | Returns NAVIGATE command |
| 3 | Extension updates DB | currentAction: "NAVIGATE" |
| 4 | Extension executes | Browser navigates to company website |

### TC-3.2: Second Command - Careers Page NAVIGATE
| Step | Action | Expected |
|------|--------|----------|
| 1 | Extension posts result of first NAV | POST /results |
| 2 | Agent analyzes result | Creates webpage discovery |
| 3 | Extension polls again | GET /commands?taskId=xxx |
| 4 | Agent decides careers page | Returns NAVIGATE to /careers |

### TC-3.3: TEST_API - Server-Side Execution
| Step | Action | Expected |
|------|--------|----------|
| 1 | After navigating, extension detects API URL | From network calls in page |
| 2 | Agent decides TEST_API | Command returned |
| 3 | Agent executes server-side | testFetchConfig() called |
| 4 | API tested without extension | Real HTTP request made |
| 5 | Success → discovery.type = "api_endpoint" | Confidence +30 |
| 6 | 401/403 → discovery.type = "requires_auth" | Confidence -20 |

### TC-3.4: EXTRACT_DOM - DOM Extraction
| Step | Action | Expected |
|------|--------|----------|
| 1 | Agent decides EXTRACT_DOM | Returns command with selectors |
| 2 | Extension executes in browser | Extracts DOM elements |
| 3 | Extension posts results | POST /results with data |
| 4 | Agent analyzes | Creates webpage discovery with selectors |

### TC-3.5: Max Iterations Reached
| Step | Action | Expected |
|------|--------|----------|
| 1 | Complete 5 iterations without success | Agent decides GENERATE_CONFIG |
| 2 | Has discoveries | Config generated with what we have |
| 3 | No discoveries | Agent decides FAIL |

### TC-3.6: GENERATE_CONFIG - Task Complete
| Step | Action | Expected |
|------|--------|----------|
| 1 | Agent decides GENERATE_CONFIG | Config generated from discoveries |
| 2 | Task updated in DB | status: "complete", config: {...} |
| 3 | Extension polls | Receives empty commands, taskStatus: "complete" |
| 4 | Task appears in "Exploration Results" | Shows in admin UI |

### TC-3.7: FAIL - Task Failed
| Step | Action | Expected |
|------|--------|----------|
| 1 | No content after max iterations | Agent decides FAIL |
| 2 | Task updated in DB | status: "failed", reason: {...} |
| 3 | Task appears in "Exploration Results" | Shows failed status + reason |

---

## Phase 4: Config Validation & Testing

### TC-4.1: Test Config Before Save
| Step | Action | Expected |
|------|--------|----------|
| 1 | Find completed task in results | Config preview shown |
| 2 | Click "Test Config" | POST /api/explorer/configs/test |
| 3 | Real HTTP request made | Tests actual URL |
| 4 | Success response | Shows status 200, response time, data |
| 5 | Failed request | Shows error, errorType |

### TC-4.2: Test Pagination
| Step | Action | Expected |
|------|--------|----------|
| 1 | Submit with fullTest: true | Also tests pagination |
| 2 | Multiple pages fetched | itemCount per page shown |
| 3 | Pagination works | Results from pages 1, 2, 3, etc. |

### TC-4.3: Validation
| Step | Action | Expected |
|------|--------|----------|
| 1 | Check isJson flag | true for API endpoints |
| 2 | Check isHtml flag | true for scraped pages |
| 3 | Check itemCount | Shows how many items found |

---

## Phase 5: Admin UI - Config Approval

### TC-5.1: Approve & Save Config
| Step | Action | Expected |
|------|--------|----------|
| 1 | Find completed task in results | Config preview shown |
| 2 | Click "Approve & Save" | upsertConfigAction() called |
| 3 | Config saved to DB | FetchConfig table has new record |
| 4 | Success toast | "Config approved and saved" |
| 5 | Config appears in company configs | Can be fetched via API |

### TC-5.2: Retry Failed Task
| Step | Action | Expected |
|------|--------|----------|
| 1 | Find failed task | Shows reason |
| 2 | Click "Try Again" | retryTaskAction() called |
| 3 | Task status reset to "pending" | Can be picked up again |

### TC-5.3: Cancel Pending Task
| Step | Action | Expected |
|------|--------|----------|
| 1 | Find pending task | Cancel button enabled |
| 2 | Click "Cancel" | cancelTaskAction() called |
| 3 | Task deleted from DB | No longer in list |

---

## Phase 6: Server-Side Fetching

### TC-6.1: fetchWithConfig - Basic
| Step | Action | Expected |
|------|--------|----------|
| 1 | Use approved config | fetchWithConfig(config) |
| 2 | Makes HTTP request | With URL, method, headers from config |
| 3 | Success response | Returns data, responseTime |
| 4 | Failed response | Returns error, success: false |

### TC-6.2: fetchWithConfig - JSON Parsing
| Step | Action | Expected |
|------|--------|----------|
| 1 | Config with parseWith: "json" | Response parsed as JSON |
| 2 | Array response | itemCount set |
| 3 | Object response | itemCount: 1 |

### TC-6.3: fetchWithConfig - Cheerio
| Step | Action | Expected |
|------|--------|----------|
| 1 | Config with parseWith: "cheerio" | Returns raw HTML text |
| 2 | Data not parsed | Just returns string |

### TC-6.4: fetchWithConfigPaginated
| Step | Action | Expected |
|------|--------|----------|
| 1 | Call with maxPages: 3 | Fetches 3 pages |
| 2 | Each page uses pagination param | page=1, page=2, page=3 |
| 3 | Empty page stops pagination | Stops if itemCount: 0 |

### TC-6.5: fetchCompanyData
| Step | Action | Expected |
|------|--------|----------|
| 1 | Call with multiple configs | All fetched in parallel |
| 2 | Returns Record<string, FetchResult> | Keyed by configId |

### TC-6.6: Timeout Handling
| Step | Action | Expected |
|------|--------|----------|
| 1 | Request takes too long | Aborted after timeout |
| 2 | Returns error | errorType: "timeout" |

### TC-6.7: Auth Error Handling
| Step | Action | Expected |
|------|--------|----------|
| 1 | Endpoint returns 401/403 | success: false |
| 2 | errorType: "auth" | Indicates auth issue |

---

## Phase 7: End-to-End Flow

### TC-7.1: Complete Happy Path
| Step | Action | Expected |
|------|--------|----------|
| 1 | Create task for Stripe | status: pending |
| 2 | Extension picks up task | status: exploring |
| 3 | Extension navigates to stripe.com | |
| 4 | Extension detects API from network calls | |
| 5 | Agent tests API endpoint | Real request, works |
| 6 | Agent generates config | confidence: 85% |
| 7 | Task complete | status: complete |
| 8 | View in admin UI | Config preview shown |
| 9 | Test config | Success |
| 10 | Approve & Save | Config in DB |
| 11 | Fetch with config | Data returned |

### TC-7.2: Failed Path
| Step | Action | Expected |
|------|--------|----------|
| 1 | Create task for unknown company | |
| 2 | Extension picks up task | |
| 3 | No careers page found | |
| 4 | No API found | |
| 5 | Max iterations reached | |
| 6 | Agent fails task | status: failed |
| 7 | View in admin UI | Reason shown |
| 8 | Click "Try Again" | Task reset to pending |
| 9 | Fix issue and try again | |

### TC-7.3: Auth Required Path
| Step | Action | Expected |
|------|--------|----------|
| 1 | Company requires auth | |
| 2 | API returns 401 | |
| 3 | Discovery: requires_auth | |
| 4 | Config generated | authRequired: true |
| 5 | Config saved | authNote should explain |

---

## Test Data Requirements

### Companies
| Name | Website | Content Types |
|------|---------|---------------|
| Tesla | https://tesla.com | job_listing |
| Stripe | https://stripe.com | job_listing, company_culture |
| Google | https://google.com | job_listing |
| Unknown Corp | (no website) | job_listing |

### Expected Outcomes
| Company | Expectation | Confidence |
|--------|-------------|------------|
| Tesla | API endpoint found | 80-90% |
| Stripe | API endpoint found | 80-90% |
| Google | Jobs page works | 70-80% |
| Unknown | FAIL - no website | 0% |

---

## Validation Checklist

### Admin UI
- [ ] Task creation works with all 3 content types
- [ ] Validation prevents empty submissions
- [ ] Pending list updates automatically (5s polling)
- [ ] Cancel only works for pending tasks
- [ ] Results show config preview
- [ ] Test Config button works
- [ ] Approve & Save stores config
- [ ] Retry resets task to pending

### Chrome Extension
- [ ] Picks up pending task
- [ ] Doesn't pick up already processing task
- [ ] Executes NAVIGATE commands
- [ ] Posts results after execution
- [ ] Handles GENERATE_CONFIG (stops polling)
- [ ] Handles FAIL (shows error)

### Agent Logic
- [ ] First iteration → NAVIGATE to company website
- [ ] Tests API endpoints server-side
- [ ] Extracts DOM when needed
- [ ] Generates valid FetchConfig
- [ ] Respects max iterations
- [ ] Handles auth errors correctly

### Server-Side Fetching
- [ ] fetchWithConfig works with JSON configs
- [ ] fetchWithConfig works with HTML configs
- [ ] Pagination fetches multiple pages
- [ ] Timeout is enforced
- [ ] Auth errors are detected
- [ ] fetchCompanyData fetches multiple configs

### Database
- [ ] FetchTask state persists correctly
- [ ] FetchConfig is created/updated on approve
- [ ] Agent state (pagesVisited, discoveries) persists

---

## Browser Compatibility
- [ ] Chrome (latest) - Required for extension
- [ ] Extension popup loads
- [ ] Extension communicates with server

## Notes

1. **Extension must be running** for ACT loop to work
2. **Real company websites** - Use actual URLs for testing
3. **Timeout on TEST_API** - Configured in explorer-act.ts
4. **Pagination** - Only tested if config has pagination config

---

## Debugging

### Check Extension Logs
```
[Explorer Extension] Starting poll loop
[Explorer Extension] Picked up task: xxx
[Explorer Extension] Executing: NAVIGATE (xxx)
[Explorer Extension] Received 1 command(s)
```

### Check Agent Logs
```
[Agent] Task xxx: NAVIGATE https://tesla.com
[Agent] Task xxx: TEST_API https://api.tesla.com/jobs
[Agent] Task xxx: GENERATE_CONFIG
[Agent] Task xxx completed with confidence 85%
```

### Check API Logs
```
[API] Picked up task: xxx
[Results] Task xxx: Processed NAVIGATE, iterations: 1
```

---

## Sign-Off

| Tester | Date | Result |
|--------|------|--------|
| | | |
| | | |