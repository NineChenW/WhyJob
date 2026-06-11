# Explorer Agent - Iteration 1 Test Spec

## Overview

This spec defines validation criteria and test cases for Iteration 1: Core Explorer Agent.

## Validation Criteria

Iteration 1 is complete when ALL of the following are true:

- [ ] Can explore Tesla.com/careers and generate FetchConfig
- [ ] Can explore Stripe API and generate FetchConfig
- [ ] Can explore Apple jobs page and generate FetchConfig
- [ ] At least 2/3 test companies produce valid, working configs

---

## Test Cases

### TC-01: Extension Registration

**Description**: Chrome Extension polls for commands when loaded.

**Prerequisites**: Extension installed, server running

**Steps**:
1. Open Chrome with extension installed
2. Check extension starts polling (GET /api/agent/commands)
3. Verify extension can receive commands

**Expected**:
- Extension polls server every 2 seconds
- Commands are received and executed
- Results are posted back (POST /api/agent/results)

**Pass Criteria**: Extension can receive commands and post results

---

### TC-02: NAVIGATE Command

**Description**: Extension can navigate browser to a URL.

**Steps**:
1. Send NAVIGATE command with `url: "https://example.com"`
2. Wait for response (timeout 10s)

**Expected**:
```json
{
  "success": true,
  "url": "https://example.com",
  "title": "Example Domain"
}
```

**Pass Criteria**: Returns success with current URL and title

---

### TC-03: GET_SNAPSHOT Command

**Description**: Extension captures current page state.

**Steps**:
1. Navigate to `https://example.com`
2. Send GET_SNAPSHOT command
3. Receive snapshot data

**Expected**:
```typescript
{
  url: string;           // "https://example.com"
  title: string;         // "Example Domain"
  html: string;         // Full HTML content
  visibleText: string;  // First 5000 chars of body text
  networkCalls: Array<{
    url: string;
    method: string;
    status: number;
    responseType: string;
  }>;
  timestamp: Date;
}
```

**Pass Criteria**: All fields populated, HTML is valid, networkCalls captures at least some requests

---

### TC-04: EXTRACT_DOM Command

**Description**: Extension extracts DOM elements by selectors.

**Steps**:
1. Navigate to `https://example.com`
2. Send EXTRACT_DOM with selectors:
```json
{
  "selectors": {
    "title": "h1",
    "paragraph": "p",
    "link": "a"
  }
}
```

**Expected**:
```typescript
{
  "elements": {
    "title": [{ "tag": "H1", "text": "Example Domain", "href": null }],
    "paragraph": [{ "tag": "P", "text": "..." }],
    "link": [{ "tag": "A", "text": "More information...", "href": "https://..." }]
  }
}
```

**Pass Criteria**: Returns correct elements with proper structure

---

### TC-05: Explorer Agent - Tesla Careers

**Description**: AI explores Tesla careers page and generates FetchConfig.

**Prerequisites**: Extension online, Tesla exists in database

**Steps**:
1. Submit exploration task for Tesla, content type: `job_listing`
2. AI performs ACT loop (up to 5 iterations)
3. Receive result

**Expected**:
```typescript
{
  "success": true,
  "config": {
    "companyId": "tesla-id",
    "contentType": "job_listing",
    "name": "Tesla - job_listing",
    "url": "https://careers.tesla.com/api/jobs",  // or valid Tesla careers URL
    "method": "GET",
    "parseWith": "json",  // or "cheerio"
    "pagination": { "type": "page", "maxPages": 10 }
  },
  "iterations": 3,
  "confidence": 70  // minimum threshold
}
```

**Pass Criteria**:
- Config has valid URL (not 404)
- Parsing method matches actual data format
- Fetch with config returns valid job data

---

### TC-06: Explorer Agent - Stripe API

**Description**: AI explores Stripe API and generates FetchConfig.

**Steps**: Same as TC-05, targeting Stripe

**Expected**: Valid FetchConfig targeting Stripe's job API or careers page

**Pass Criteria**: Config produces structured job data

---

### TC-07: Explorer Agent - Apple Jobs

**Description**: AI explores Apple jobs page and generates FetchConfig.

**Steps**: Same as TC-05, targeting Apple

**Expected**: Valid FetchConfig targeting Apple careers page

**Pass Criteria**: Config produces structured job data

---

### TC-08: Task Queue State Transitions

**Description**: Task progresses through proper states.

**Steps**:
1. Create task → verify status `pending`
2. Extension connects → verify status `exploring`
3. Exploration completes → verify status `complete`
4. Save config → verify config persisted

**Expected States**:
```
pending → exploring → complete
                    ↘ failed
```

**Pass Criteria**: All transitions correct, no stuck states

---

### TC-09: Admin UI - Submit Task

**Description**: Admin can submit exploration task.

**Steps**:
1. Navigate to admin explorer page
2. Select company from dropdown
3. Check content types (job_listing)
4. Click "Start Exploration"

**Expected**:
- Task appears in pending list
- Task status shows `waiting` or `exploring`

**Pass Criteria**: Task created in database, appears in UI

---

### TC-10: Admin UI - View Results

**Description**: Admin can view exploration results.

**Steps**:
1. Complete exploration (TC-05)
2. Navigate to results section
3. View generated config

**Expected**:
- Shows company name + content type
- Shows status: complete/failed
- Shows confidence score
- Shows config preview

**Pass Criteria**: All information displayed correctly

---

### TC-11: Admin UI - Approve Config

**Description**: Admin approves config, it gets saved.

**Steps**:
1. Complete exploration with valid config
2. Click "Approve & Save"
3. Verify config saved to FetchConfig table

**Expected**:
- Config persisted with `isActive: true`
- Task marked as complete

**Pass Criteria**: Config retrievable from FetchConfig table

---

### TC-12: Error Handling - Navigation Failure

**Description**: Handles invalid URLs gracefully.

**Steps**:
1. Send NAVIGATE with `url: "https://invalid-domain-that-does-not-exist.xyz"`
2. Wait for response

**Expected**:
```json
{
  "success": false,
  "error": "Navigation failed: net::ERR_NAME_NOT_RESOLVED"
}
```

**Pass Criteria**: Returns error object, doesn't crash

---

### TC-13: Error Handling - Timeout

**Description**: Navigation times out after 10s.

**Steps**:
1. Send NAVIGATE to very slow site (or non-routable IP)
2. Wait >10s

**Expected**:
```json
{
  "success": false,
  "error": "Navigation timeout after 10000ms"
}
```

**Pass Criteria**: Returns error within reasonable time, doesn't hang

---

## Test Execution Order

Run tests in this order:

```
Phase 1: Extension (can run in parallel)
├── TC-01: Extension Registration (HTTP polling)
├── TC-02: NAVIGATE Command
├── TC-03: GET_SNAPSHOT Command
├── TC-04: EXTRACT_DOM Command
├── TC-12: Error - Navigation Failure
└── TC-13: Error - Timeout

Phase 2: Explorer Agent (sequential)
├── TC-05: Tesla Careers
├── TC-06: Stripe API
└── TC-07: Apple Jobs

Phase 3: Task Queue
└── TC-08: State Transitions

Phase 4: Admin UI
├── TC-09: Submit Task
├── TC-10: View Results
└── TC-11: Approve Config
```

## Success Criteria

Iteration 1 is complete when:
- All 13 test cases pass
- At least 2 of 3 companies (TC-05, TC-06, TC-07) produce valid configs
- No crashes, no stuck tasks
- Admin can complete full workflow: submit → explore → approve

---

## Reference

- Chrome Extension Spec: `@context/features/explorer-agent-01-chrome-extension-spec.md`
- Agent Core Spec: `@context/features/explorer-agent-02-agent-core-spec.md`
- Server Spec: `@context/features/explorer-agent-03-server-integration-spec.md`
- Admin UI Spec: `@context/features/explorer-agent-04-admin-ui-spec.md`