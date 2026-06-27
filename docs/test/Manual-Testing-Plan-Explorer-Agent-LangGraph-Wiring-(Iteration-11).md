# Manual Testing Plan: Explorer Agent - LangGraph Wiring (Iteration 11)

## Architecture Recap

```
Pickup → runExplorerGraph starts → async command queued → returns (waitingForExtensionResult)
Commands GET → returns queued command → Extension executes → POST /results
Results POST → updates state log (status=1) → Extension polls /process
Process → runExplorerGraph resumes → observe_result → reflect → llm_decision → loop
...continue until generate_config/fail/max_iterations → END
```

---

### Prerequisites

1. **Chrome Extension** running in debug mode
2. **Next.js dev server** running (`npm run dev`)
3. **Database** accessible (Neon PostgreSQL or local)
4. **GROQ_API_KEY** configured in `.env` (for LLM decisions)

---

### Test Case 1: End-to-End Flow with Real Company

**Steps:**

1. **Open Admin UI** → Navigate to `/admin/explorer`

2. **Submit a task** for a known company (e.g., Stripe at `https://stripe.com`)

3. **Pickup the task** → Extension or admin polls `POST /api/explorer/tasks/pickup`
   - Expected: Task status changes from `pending` → `exploring`
   - Expected: `runExplorerGraph()` starts (check server logs for `[Pickup] Starting runExplorerGraph`)

4. **Poll Commands** → Extension polls `GET /api/agent/commands?extensionId=xxx&taskId=yyy`
   - Expected: Returns a command (e.g., `NAVIGATE` with Stripe careers URL)
   - Expected: `currentAction`/`currentTarget` set in `FetchTask`

5. **Execute Command** → Extension sends `POST /api/agent/commands` with taskId and commands
   - This queues the command in the extension

6. **Post Results** → After executing, extension sends `POST /api/agent/results`
   - Expected: Results API updates `AgentStateLog` (status=1)
   - Expected: Task status remains `exploring` (ready for resume)

7. **Resume via Process** → Extension or admin polls `POST /api/explorer/tasks/process`
   - Expected: `runExplorerGraph()` resumes from saved state
   - Expected: Loop continues to `observe_result` → `reflect` → `llm_decision`

8. **Repeat steps 4-7** until terminal state (check logs for iteration progress)

9. **Final State** → Task transitions to `complete` or `failed`
   - Check `FetchTask.config` contains the generated `FetchConfig`

**Verification Points:**
- [ ] Server logs show `runExplorerGraph` starting and resuming
- [ ] `AgentStateLog` entries created with status=0 (hang) and status=1 (resume)
- [ ] `FetchTask.currentAction/currentTarget` cleared after command execution
- [ ] Iteration count increments correctly
- [ ] Final config generated with correct `FetchConfig` structure

---

### Test Case 2: Commands GET - LangGraph vs Rule-Based Flow

**Steps:**

1. **Submit a task** for a company via Admin UI

2. **Pickup task** → `POST /api/explorer/tasks/pickup`

3. **Poll Commands** → `GET /api/agent/commands?extensionId=xxx&taskId=yyy`
   - Expected: Returns command (LangGraph flow via `currentAction`)

4. **Check server logs** for:
   - `[Commands] LangGraph agent has queued command: NAVIGATE` (new flow)
   - vs `[Commands] Calling decideNextAction()` (rule-based fallback)

**Verification Points:**
- [ ] With `currentAction` set: Returns queued command immediately (no `decideNextAction` call)
- [ ] Without `currentAction`: Falls back to rule-based `decideNextAction`

---

### Test Case 3: Process Endpoint Resume

**Steps:**

1. **Submit and pickup a task** (long-running exploration)

2. **Trigger hang state** → Async command queued, graph returns early

3. **Post results** → `POST /api/agent/results` with extension result

4. **Poll Process** → `POST /api/explorer/tasks/process`
   - Expected: Finds task with status `exploring`
   - Expected: Calls `getResumeContext()` to load saved state
   - Expected: Resumes graph from where it left off

**Verification Points:**
- [ ] Server logs show `[Process] Resuming task XXX from saved state`
- [ ] Graph continues from `observe_result` node (not restart at `llm_decision`)

---

### Test Case 4: Terminal States

**Steps:**

1. **Submit a task** and let the agent explore

2. **Observe termination** when:
   - **GENERATE_CONFIG**: Agent gathered enough data
   - **FAIL**: Error or impossible state
   - **MAX_ITERATIONS**: Hit iteration limit (default 5)

3. **Check final task state** in database:
   ```sql
   SELECT id, status, config, confidence, completed_at, reason
   FROM "FetchTask"
   WHERE company_id = 'your-company-id'
   ORDER BY created_at DESC;
   ```

**Verification Points:**
- [ ] `status = 'complete'` with valid `config` JSON
- [ ] `status = 'failed'` with `reason` field
- [ ] `completed_at` timestamp set

---

### Test Case 5: Multiple Tasks Sequential Processing

**Steps:**

1. **Submit 2-3 tasks** for different companies

2. **Pickup first task** → Starts exploring

3. **Complete first task** → Status → `complete`

4. **Pickup next task** → Second task starts

**Verification Points:**
- [ ] Only one task at a time has status `exploring`
- [ ] Subsequent pickups pick up oldest `pending` task

---

### Test Case 6: Backward Compatibility (Rule-Based Flow)

**Steps:**

1. **Create a task directly** in database with NO `currentAction` set:
   ```sql
   INSERT INTO "FetchTask" (id, "companyId", "contentTypes", status, iterations)
   VALUES ('test-task-001', 'company-xxx', ARRAY['job_listing'], 'pending', 0);
   ```

2. **Poll Commands** → Should fall back to rule-based `decideNextAction`

**Verification Points:**
- [ ] Server log shows `[Commands] Calling decideNextAction()`
- [ ] Old flow still works when LangGraph state not present

---

### Debug Commands

```bash
# Check task status
curl -s "http://localhost:3000/api/explorer/tasks" | jq .

# Pickup task
curl -s -X POST "http://localhost:3000/api/explorer/tasks/pickup" | jq .

# Get commands
curl -s "http://localhost:3000/api/agent/commands?extensionId=shared&taskId=TASK_ID" | jq .

# Poll process
curl -s -X POST "http://localhost:3000/api/explorer/tasks/process" | jq .

# Check state logs
# Use DBeaver or psql to query AgentStateLog table
```

---

### Expected Server Log Output

```
[Pickup] Starting pickup request...
[Pickup] Task XXX is now 'exploring'
[Pickup] Starting runExplorerGraph for task XXX...
[runExplorerGraph] llm_decision → NAVIGATE to https://stripe.com/jobs
[runExplorerGraph] execute_tool → async command queued, status=0
[Pickup] runExplorerGraph completed for task XXX (waitingForExtensionResult=true)

# After extension executes and posts results:
[Results] Updated hanging log with result, status=1
[Results] Triggered resume for task XXX

# On resume:
[Process] Processing task: XXX
[Process] Resuming task XXX from saved state
[runExplorerGraph] Resuming from saved state for task XXX
[runExplorerGraph] observe_result → reflect → llm_decision → loop
...
[runExplorerGraph] generate_config → test_config → END
[Pickup] runExplorerGraph completed for task XXX (terminationReason=generate_config)
```

---

### Summary Checklist

- [ ] Test Case 1: End-to-end flow with real company
- [ ] Test Case 2: Commands GET LangGraph vs rule-based
- [ ] Test Case 3: Process endpoint resume
- [ ] Test Case 4: Terminal states (complete/fail/max_iterations)
- [ ] Test Case 5: Multiple sequential tasks
- [ ] Test Case 6: Backward compatibility
- [ ] Build passes
- [ ] 149 tests pass
