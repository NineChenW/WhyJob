# Explorer Agent Admin UI - Manual Test Process

**Feature**: Explorer Agent Admin UI (`/admin/explorer`)
**Date**: 2026-06-13
**Status**: In Progress

---

## Test Setup

### Prerequisites
1. Navigate to `/admin/explorer`
2. Ensure at least one company exists in the database
3. For agent polling tests, Chrome extension must be running

### Test Data Requirements
- **Companies**: At least 2 companies (e.g., "Tesla", "Stripe")
- **Content Types**: All 3 types available (`job_listing`, `company_culture`, `company_wechat`)

---

## Section 1: Submit New Task Form

### TC-1.1: Page Load
| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Navigate to `/admin/explorer` | Page loads with 3 sections: "Explore Company Data", "Pending Explorations", "Exploration Results" |
| 2 | Check "Explore Company Data" card is visible | Card title displayed |
| 3 | Check company dropdown exists | Dropdown shows "Select a company" placeholder |
| 4 | Check content type checkboxes exist | 3 checkboxes: Job Listings, Company Culture, WeChat |
| 5 | Check "Start Exploration" button exists | Button disabled by default |

### TC-1.2: Form Validation - Company Selection
| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Click "Start Exploration" without selecting company | Toast error: "Please select a company" |
| 2 | Select company from dropdown | Company is selected, dropdown shows company name |
| 3 | Click "Start Exploration" without content type | Toast error: "Please select at least one content type" |

### TC-1.3: Form Validation - Content Type Selection
| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Select a company | Company selected |
| 2 | Click "Start Exploration" without any content type | Toast error: "Please select at least one content type" |
| 3 | Check "Job Listings" checkbox | Checkbox marked, label highlighted |
| 4 | Check "Company Culture" checkbox | Both checkboxes marked |
| 5 | Click "Company Culture" to uncheck | Only "Job Listings" remains checked |

### TC-1.4: Form Submission - Success
| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Select a company | Company selected |
| 2 | Check "Job Listings" | Content type selected |
| 3 | Click "Start Exploration" | Button shows "Creating...", then task created |
| 4 | Check success toast | "Exploration task created" toast appears |
| 5 | Verify form reset | Company dropdown back to placeholder, checkboxes cleared |
| 6 | Check task appears in Pending list | New task appears in "Pending Explorations" |

### TC-1.5: Form Submission - Error Handling
| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Submit with valid data when server error occurs | Toast error: "Failed to create task" |
| 2 | Verify button re-enables | Button shows "Start Exploration" again |
| 3 | Try submitting again | Form still functional |

### TC-1.6: Multi-Content Type Selection
| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Select company | Company selected |
| 2 | Check all 3 content types | All 3 checkboxes marked |
| 3 | Submit form | Task created with all 3 content types |
| 4 | Verify Pending list | Task shows "Job Listings, Company Culture, WeChat" |

---

## Section 2: Pending Explorations

### TC-2.1: Empty State
| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Ensure no pending tasks exist | "Pending Explorations" shows "No pending explorations." |
| 2 | Check message styling | Text is small, muted color |

### TC-2.2: Task Display
| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Create a new task | Task appears in Pending list |
| 2 | Check task row displays: Company, Content Types, Status, Action | All 4 columns visible |
| 3 | Verify company name shown | Shows company name (not just ID) |
| 4 | Verify content types shown | Shows readable labels (e.g., "Job Listings") |
| 5 | Verify status badge shown | Shows "Waiting" for pending, "Exploring" for exploring |

### TC-2.3: Status Badges
| Step | Action | Validation |
|------|--------|------------|
| 1 | Find pending task | Badge shows "Waiting" in gray (secondary) |
| 2 | Find exploring task | Badge shows "Exploring" in blue (default) with pulse animation |
| 3 | Verify badge variants | All badges use correct shadcn variants |

### TC-2.4: Cancel Button - Enabled State
| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Find a pending task | Cancel button is enabled |
| 2 | Click Cancel | Button shows "Cancelling..." |
| 3 | Wait for operation | Toast: "Task cancelled" |
| 4 | Verify task removed | Task no longer in Pending list |

### TC-2.5: Cancel Button - Disabled State
| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Find an exploring task (status = 'exploring') | Cancel button is **disabled** |
| 2 | Verify disabled styling | Button grayed out, cursor not-allowed |
| 3 | Try to click disabled button | No action occurs |

### TC-2.6: Cancel Button - Error Case
| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Attempt to cancel when server fails | Toast error: "Failed to cancel task" |
| 2 | Verify button re-enables | Button returns to "Cancel" |

### TC-2.7: Multiple Tasks Sorting
| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Create 3 tasks for different companies | Tasks listed |
| 2 | Check order | Oldest task first (by createdAt ascending) |

### TC-2.8: Auto-Refresh
| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Open page, note pending tasks | Current count visible |
| 2 | Wait 5+ seconds (without refresh) | Data auto-refreshes |
| 3 | External: Mark task complete via API | Task moves to Results section |

---

## Section 3: Exploration Results

### TC-3.1: Empty State
| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Ensure no completed/failed tasks | "Exploration Results" shows "No completed explorations yet." |
| 2 | Check message styling | Text is small, muted color |

### TC-3.2: Complete Task Display
| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Find completed task | Shows company name + content type |
| 2 | Check status badge | "Complete" in green (default badge) |
| 3 | Check confidence badge | Shows percentage (e.g., "85%") |
| 4 | Check iterations count | Shows "Iterations: X" |
| 5 | Check config preview | JSON config displayed in formatted block |
| 6 | Check action buttons | "Approve & Save" and "Retry" buttons visible |

### TC-3.3: Confidence Badge Colors
| Step | Action | Validation |
|------|--------|------------|
| 1 | Find task with confidence >= 80% | Badge is green (default variant) |
| 2 | Find task with confidence 60-79% | Badge is yellow/orange (secondary variant) |
| 3 | Find task with confidence < 60% | Badge is red (destructive variant) |
| 4 | Check null/undefined confidence | Shows "—" placeholder |

### TC-3.4: Config Preview Display
| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Find completed task with config | ConfigPreview component visible |
| 2 | Check JSON formatting | URL, method, parseWith, pagination, etc. displayed |
| 3 | Check URL field | Shows discovered API/website URL |
| 4 | Check method | Shows "GET" or "POST" |
| 5 | Check parseWith | Shows "json" or "cheerio" |
| 6 | Check pagination | Shows pagination config if present |

### TC-3.5: Approve & Save - Success
| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Click "Approve & Save" on complete task | Button shows "Saving..." |
| 2 | Wait for operation | Toast: "Config approved and saved" |
| 3 | Verify config saved | Config accessible via API |

### TC-3.6: Approve & Save - Error Case
| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Click "Approve & Save" when server fails | Toast error: "Failed to approve config" |
| 2 | Verify button re-enables | Button returns to "Approve & Save" |
| 3 | Retry | Should work on second attempt (if server recovered) |

### TC-3.7: Approve & Save - Without Config
| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Find complete task without config (edge case) | "Approve & Save" button hidden or disabled |
| 2 | Verify error toast if clicked | "No config to approve" |

### TC-3.8: Retry - Complete Task
| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Click "Retry" on complete task | Button shows "Retrying..." |
| 2 | Wait for operation | Toast: "Task reset to pending" |
| 3 | Verify task moved | Task appears in Pending list |
| 4 | Verify status | Task status = "pending" |

### TC-3.9: Retry - Failed Task
| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Find failed task | Shows "Try Again" button instead of "Retry" |
| 2 | Click "Try Again" | Task resets to pending |
| 3 | Verify task moved | Task appears in Pending list |

### TC-3.10: Failed Task Display
| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Find failed task | Badge shows "Failed" in red (destructive) |
| 2 | Check reason displayed | "Reason: [error message]" shown |
| 3 | Verify no config preview | Config preview not shown |
| 4 | Check "Try Again" button | Only retry button visible, no "Approve" |

### TC-3.11: Results Sorting
| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Check order of history tasks | Most recent first (by completedAt descending) |

---

## Server Actions Test Coverage

### TC-4.1: createTaskAction
| Input | Expected |
|-------|----------|
| Valid companyId + contentTypes[] | Returns `{ success: true, data: FetchTask }` |
| Missing companyId | Action error: "Failed to create task" |
| Empty contentTypes | Action error: "Failed to create task" |
| Invalid companyId | Prisma error (foreign key constraint) |

### TC-4.2: cancelTaskAction
| Input | Expected |
|-------|----------|
| Valid pending task ID | Returns `{ success: true }`, task deleted |
| Non-existent task ID | Returns `{ success: false, error: "Task not found" }` |
| Exploring task ID | Returns `{ success: false, error: "Only pending tasks can be cancelled" }` |
| Complete task ID | Returns `{ success: false, error: "Only pending tasks can be cancelled" }` |
| Failed task ID | Returns `{ success: false, error: "Only pending tasks can be cancelled" }` |

### TC-4.3: retryTaskAction
| Input | Expected |
|-------|----------|
| Valid task ID | Returns `{ success: true }`, status reset to 'pending' |
| Non-existent task ID | Prisma error or `{ success: false }` |
| Pending task ID | Works (resets to pending again) |

### TC-4.4: upsertConfigAction
| Input | Expected |
|-------|----------|
| Valid config data | Returns `{ success: true, data: FetchConfig }` |
| Config already exists for company+contentType | Updates existing config |
| No config data (incomplete) | Returns `{ success: false, error: ... }` |

### TC-4.5: getActiveTasksAction
| Input | Expected |
|-------|----------|
| No params | Returns all pending + exploring tasks sorted by createdAt asc |
| Empty result | Returns `{ success: true, data: [] }` |

### TC-4.6: getTaskHistoryAction
| Input | Expected |
|-------|----------|
| No params | Returns all complete + failed tasks sorted by completedAt desc |
| Empty result | Returns `{ success: true, data: [] }` |

---

## Edge Cases

### EC-1: Missing Company Name
| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Task exists for deleted company | Shows company ID instead of name |
| 2 | Verify graceful fallback | `"Unknown"` or just ID displayed |

### EC-2: Unknown Content Type
| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Task has unknown content type | Falls back to showing raw type string |
| 2 | Verify no crash | Component continues to render |

### EC-3: Network Failure During Auto-Refresh
| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Network goes down | Old data still displayed |
| 2 | Network recovers | Next auto-refresh succeeds |
| 3 | Verify no error toast flood | Errors handled gracefully |

### EC-4: Concurrent Actions
| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Click Cancel on task A while refreshing | No race condition |
| 2 | Both operations complete | UI consistent |

---

## Validation Checklist

### Form Validation
- [ ] Cannot submit without company
- [ ] Cannot submit without content type
- [ ] Can select multiple content types
- [ ] Form resets after successful submission
- [ ] Loading state during submission

### Pending List
- [ ] Shows pending and exploring tasks
- [ ] Cancel only enabled for pending tasks
- [ ] Status badges correct (Waiting/Exploring)
- [ ] Auto-refresh every 5 seconds
- [ ] Empty state message when no tasks

### Results Section
- [ ] Shows complete and failed tasks
- [ ] Config preview for complete tasks
- [ ] Reason displayed for failed tasks
- [ ] Approve & Save works for complete tasks
- [ ] Retry works for both complete and failed
- [ ] Confidence badge colors correct
- [ ] Sorting: newest first

### Server Actions
- [ ] All CRUD operations work
- [ ] Proper error messages on failure
- [ ] Revalidation triggers UI update

---

## Browser Compatibility
- [ ] Chrome (latest)
- [ ] Firefox (latest)
- [ ] Safari (latest)

## Responsive
- [ ] Desktop (1280px+)
- [ ] Tablet (768px - 1279px)
- [ ] Mobile (320px - 767px)