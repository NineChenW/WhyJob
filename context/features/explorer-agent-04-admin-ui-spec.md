# Explorer Agent - Admin UI Spec

## Overview

Admin UI for submitting exploration tasks and viewing results. Simple form + results display for Iteration 1.

**Iteration 1 Scope**: Task submission form, task status view, config preview.

## Requirements

### Page: /admin/explorer (or section in admin dashboard)

#### Section 1: Submit New Task

```
┌─────────────────────────────────────────────────────────────┐
│                    Explore Company Data                      │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  Company:    [Dropdown - select from existing companies]    │
│                                                              │
│  Content Types (select one or more):                         │
│  ☐ Job Listings (careers page, job board)                   │
│  ☐ Company Culture (about page, values)                     │
│  ☐ WeChat (wechat official account info)                     │
│                                                              │
│                            [Start Exploration]              │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

#### Section 2: Pending Tasks

```
┌─────────────────────────────────────────────────────────────┐
│                    Pending Explorations                      │
├─────────────────────────────────────────────────────────────┤
│  Company          │ Content Types      │ Status  │ Action   │
│  ─────────────────────────────────────────────────────────  │
│  Tesla            │ Job Listings       │ waiting │ Cancel   │
│  Stripe           │ Company Culture    │ waiting │ Cancel   │
│                                                              │
│  Status: waiting = extension not online yet                 │
└─────────────────────────────────────────────────────────────┘
```

#### Section 3: Exploration Results

```
┌─────────────────────────────────────────────────────────────┐
│                    Exploration Results                       │
├─────────────────────────────────────────────────────────────┤
│                                                              │
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
│                                                              │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  Stripe - Job Listings                                       │
│  Status: ❌ Failed | Reason: No accessible API found       │
│                                                              │
│  Attempted:                                                  │
│  ✗ careers.stripe.com - redirected to Lever                │
│  ✗ api.stripe.com/v1/jobs - 401 Unauthorized               │
│                                                              │
│  [Try Again with Different URL]  [Mark as Manual]          │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

### Components

- `CompanySelect`: Dropdown of existing companies
- `ContentTypeCheckbox`: Multi-select checkboxes
- `ExplorationStatusBadge`: waiting/exploring/complete/failed
- `ConfigPreview`: JSON preview of generated FetchConfig
- `ConfidenceBadge`: Visual indicator (green >80, yellow 60-80, red <60)

### User Flow

1. Admin selects company + content types
2. Clicks "Start Exploration"
3. Task appears in "Pending" list
4. When extension is online, task status changes to "Exploring"
5. When complete, result appears in "Results" section
6. Admin can Approve (saves config) or Retry (re-explore)

### Server Actions (Iteration 1)

```typescript
// Create exploration task
submitExplorationTask(input: {
  companyId: string;
  contentTypes: string[];
}): Promise<{ taskId: string; status: string }>;

// Get task status
getExplorationTask(taskId: string): Promise<ExplorationTask>;

// Cancel task
cancelExplorationTask(taskId: string): Promise<void>;

// Get all pending tasks
getPendingExplorationTasks(): Promise<ExplorationTask[]>;

// Get all completed/failed tasks
getExplorationHistory(): Promise<ExplorationTask[]>;

// Approve and save config
approveExplorationConfig(taskId: string): Promise<void>;

// Retry failed task
retryExplorationTask(taskId: string): Promise<void>;
```

## Reference

- `@docs/ai-assist-fetch-info-plan.md` - Full system design
- `@context/features/explorer-agent-03-server-integration-spec.md` - Server API
- `@context/coding-standards.md` - UI standards

## Notes

- Keep UI simple for Iteration 1
- No complex filtering/sorting needed yet
- Use existing shadcn components
- Toast notifications on status changes