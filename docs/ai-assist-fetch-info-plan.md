# AI-Assist Fetch Info Research Plan

**Date**: 2026-06-09
**Status**: Research Complete

---

## Executive Summary

This document outlines the architecture and implementation plan for an **AI-driven information fetching system** where:

1. **AI controls a Chrome Extension** to explore target sites, discover APIs, and generate reusable fetch configurations
2. **Server executes simple HTTP fetch** using the AI-generated config (reusable, scalable, Vercel-compatible)
3. **AI evaluates results** and suggests improvements when admin rejects

**Key Innovation**: Unlike traditional scraping where a human figures out the approach, **AI acts as the explorer** — controlling the browser via extension, trying different strategies, and learning from failures.

---

## Spec Iterations

Based on spec-driven development principles, this system is built in **4 iterations**. Each iteration delivers a working, testable system with clear validation criteria.

### Iteration Overview

| Iteration | Focus | Duration | Validation |
|-----------|-------|----------|------------|
| **1: Explore** | Core Explorer Agent | 1-2 weeks | AI generates valid FetchConfig for test companies |
| **2: Evaluate** | Judge Agent + Production | 1-2 weeks | Judge scores quality correctly, fetch runs on schedule |
| **3: Learn** | Memory + Evolution | 1-2 weeks | 2nd attempt on similar company is faster/better |
| **4: Measure** | Evaluation + Polish | 1-2 weeks | 80%+ success rate, can detect/fix performance drops |

### Iteration 1: Core Explorer

**Goal**: Minimal working Explorer Agent that can explore ONE company and generate a valid FetchConfig.

**What's Built**:
```
├── Chrome Extension (basic)
│   ├── NAVIGATE(url) → navigate browser
│   ├── GET_SNAPSHOT() → return HTML + network log
│   └── EXTRACT_DOM(selectors) → query and return elements
│
├── Explorer Agent
│   ├── ACT Loop: Think → Act → Observe (max 5 iterations)
│   ├── decideNextAction() skill
│   ├── analyzeResult() skill
│   └── generateConfig() skill
│
├── Server
│   ├── Task queue (simple: pending → exploring → complete)
│   ├── FetchConfig model
│   └── Extension WebSocket registration
│
└── Admin UI
    └── Task submission form
```

**Validation Criteria**:
- [ ] Can explore Tesla.com/careers and generate FetchConfig
- [ ] Can explore Stripe API and generate FetchConfig
- [ ] Can explore Apple jobs page and generate FetchConfig
- [ ] At least 2/3 test companies produce valid, working configs

**Out of Scope**: Judge agent, memory, production fetch, scheduling

---

### Iteration 2: Judge + Production

**Goal**: Add Judge Agent for quality scoring, production fetch pipeline, and admin review workflow.

**What's Built**:
```
├── Judge Agent
│   ├── scoreQuality() skill → returns 0-100 score
│   ├── findIssues() skill
│   ├── suggestImprovements() skill (on admin rejection)
│   └── Decision logic: AUTO_APPROVE / FLAG_FOR_REVIEW
│
├── Production Fetch Pipeline
│   ├── executeFetch(config) → HTTP fetch + parse
│   ├── Cron trigger (hourly/daily)
│   └── parseWith: JSON or cheerio
│
├── Admin Review UI
│   ├── View generated configs + test results
│   ├── Approve / Reject buttons
│   ├── Feedback input (for rejections)
│   └── Retry trigger
│
└── Integration
    └── Explorer → Judge → Admin Review → Save Config flow
```

**Validation Criteria**:
- [ ] Judge scores known-good fetch as 80+
- [ ] Judge scores known-bad fetch as <60
- [ ] Cron runs fetch daily, data stored in DB
- [ ] Admin can approve/reject, feedback triggers retry
- [ ] New jobs detected → notify users

**Out of Scope**: Memory/learning, metrics dashboard, shadow mode

---

### Iteration 3: Memory + Evolution

**Goal**: Add episodic memory so agents learn from past attempts and improve over time.

**What's Built**:
```
├── Memory Architecture
│   ├── Working Memory (in-session)
│   ├── Episodic Memory (PostgreSQL: past attempts)
│   └── Semantic Memory (Content table: patterns)
│
├── Explorer Agent Enhancements
│   ├── retrieveContext() → find similar companies
│   ├── updateEpisodicMemory() → log each attempt
│   └── Apply successful strategies from memory
│
├── Similar Company Lookup
│   ├── By industry → find companies with similar configs
│   └── By URL pattern → "greenhouse.io" pattern
│
├── Evolution Mechanisms
│   ├── Store successful FetchConfigs by company type
│   ├── Store failed attempts with reason
│   └── On new task: retrieve relevant strategies
│
└── RAG Foundation (SQL-based, no vector DB yet)
    └── Prisma query: find companies with same industry/size
```

**Validation Criteria**:
- [ ] Same company re-explored uses previous context
- [ ] Similar company (same industry) benefits from learned patterns
- [ ] Failed approaches not repeated unnecessarily
- [ ] Exploration iterations decrease by 20%+ on 2nd attempt

**Out of Scope**: Vector search, automated prompt evolution, metrics dashboard

---

### Iteration 4: Evaluation + Polish

**Goal**: Add evaluation harness, metrics tracking, and system health monitoring.

**What's Built**:
```
├── Evaluation Harness
│   ├── Test cases: companies with known-good configs
│   ├── Shadow mode: run new agent alongside production
│   └── Canary deployment: gradual rollout
│
├── Metrics Tracking
│   ├── Success rate (by company type, content type)
│   ├── Average iterations per task
│   ├── Average time per task
│   ├── Admin approval rate
│   └── Quality score trend (alert if declining)
│
├── Alerting System
│   ├── Quality drops below threshold
│   ├── Config goes stale (fetch fails)
│   └── Admin notification (toast/email)
│
├── Prompt Refinement Process
│   ├── Weekly review of failed attempts
│   ├── Update system prompts based on patterns
│   └── A/B testing for prompt variations
│
└── Admin Dashboard
    ├── Exploration success rate
    ├── Quality score trends
    └── Recent failures + suggestions
```

**Validation Criteria**:
- [ ] Can detect quality drop before admin complaint
- [ ] 80%+ of explorations succeed without manual intervention
- [ ] Shadow mode correctly compares old vs new agent
- [ ] Metrics match manual evaluation (within 10%)

---

### What's NOT in Early Iterations

These features are valuable but deferred until the core system works:

| Feature | Why Deferred | When to Add |
|---------|-------------|------------|
| Vector search (pgvector) | SQL similarity works until >100 companies | Iteration 4+ |
| Complex retry logic | Simple retry-3 is fine initially | Iteration 3+ |
| Multi-agent collaboration | Single agent handles all for now | Future |
| Real-time streaming | Not needed for batch exploration | Future |
| Automated prompt evolution | Manual review is fine until metrics exist | Iteration 4 |
| OAuth for auth sites | Admin can handle manually initially | Future |

---

### Iteration Dependency

```
Iteration 1 (Explorer)
       │
       │ (Explorer Agent is foundation)
       ▼
Iteration 2 (Judge + Production)
       │
       │ (Judge needs Explorer to exist)
       ▼
Iteration 3 (Memory)
       │
       │ (Memory stores both Explorer + Judge outcomes)
       ▼
Iteration 4 (Evaluation)
       │
       │ (Metrics measure all previous iterations)
       ▼
  Production Ready
```

---

## Detailed Business Process

This section maps out the complete business flow, showing exactly where AI Agents fit and how they work.

### Business Process Overview

```
┌─────────────────────────────────────────────────────────────────────────────────┐
                           COMPLETE BUSINESS FLOW
┌─────────────────────────────────────────────────────────────────────────────────┐

  ┌─────────────────────────────────────────────────────────────────────────┐
  │                    PHASE 1: ADMIN INITIATION                              │
  │                                                                          │
  │  Admin clicks "Add Company Data"                                          │
  │       │                                                                  │
  │       ▼                                                                  │
  │  Select company → Select content types (culture/jobs/wechat) → Submit     │
  │       │                                                                  │
  │       ▼                                                                  │
  │  Task created: { companyId, contentTypes[], status: 'pending' }          │
  │                                                                          │
  └─────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
  ┌─────────────────────────────────────────────────────────────────────────┐
  │                    PHASE 2: AI EXPLORATION                                 │
  │                                                                          │
  │  ┌─────────────────────────────────────────────────────────────────┐    │
  │  │              EXPLORER AGENT WORK LOOP                             │    │
  │  │                                                                  │    │
  │  │  Iteration 1:                                                     │    │
  │  │    AI decides: "Try careers page first"                          │    │
  │  │    Extension.navigate('company.com/careers')                     │    │
  │  │    Extension.getPageSnapshot() → returns HTML + network log       │    │
  │  │    AI analyzes: "Found /api/jobs endpoint! Extract it."           │    │
  │  │                                                                  │    │
  │  │  Iteration 2:                                                     │    │
  │  │    AI decides: "Test discovered API"                             │    │
  │  │    Extension.testAPI({ url, params }) → returns JSON sample      │    │
  │  │    AI analyzes: "API returns 50 jobs, perfect!"                 │    │
  │  │                                                                  │    │
  │  │  Iteration 3 (if needed):                                        │    │
  │  │    AI decides: "Now find culture page"                           │    │
  │  │    Extension.navigate('company.com/about')                       │    │
  │  │    Extension.extractDOM({ title: 'h1', culture: '.culture' })   │    │
  │  │    AI generates selectors from DOM analysis                      │    │
  │  │                                                                  │    │
  │  │  Max 5 iterations → Generate FetchConfig                         │    │
  │  │                                                                  │    │
  │  └─────────────────────────────────────────────────────────────────┘    │
  │                                                                          │
  │  Output: FetchConfig for each content type                               │
  │                                                                          │
  └─────────────────────────────────────────────────────────────────────────┘
                                    │
                          ┌─────────┴─────────┐
                          │                   │
                          ▼                   ▼
                   ┌────────────┐      ┌────────────┐
                   │  Success   │      │  Failed    │
                   │ config gen │      │  (report)  │
                   └─────┬──────┘      └────────────┘
                         │
                         ▼
  ┌─────────────────────────────────────────────────────────────────────────┐
  │                    PHASE 3: ADMIN REVIEW                                  │
  │                                                                          │
  │  Admin receives notification: "Exploration complete for Tesla"           │
  │       │                                                                  │
  │       ▼                                                                  │
  │  Admin views:                                                            │
  │    - Generated FetchConfigs (with test results)                          │
  │    - Sample data extracted                                               │
  │    - AI confidence score                                                 │
  │       │                                                                  │
  │       ├─── Approve ────→ Config saved → Scheduling enabled               │
  │       │                                                                  │
  │       └─── Reject ────→ AI receives feedback → Retries (max 3)          │
  │                                                                          │
  └─────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
  ┌─────────────────────────────────────────────────────────────────────────┐
  │                    PHASE 4: PRODUCTION FETCH                             │
  │                                                                          │
  │  Cron triggers (hourly/daily) → executeFetch(config) → parse → store    │
  │       │                                                                  │
  │       ▼                                                                  │
  │  JUDGE AGENT evaluates:                                                   │
  │    - Data completeness (are fields populated?)                            │
  │    - Data quality (does it look valid?)                                  │
  │    - Score 0-100, store with fetch result                                │
  │       │                                                                  │
  │       ▼                                                                  │
  │  If score < threshold → flag for admin review                            │
  │       │                                                                  │
  │       ▼                                                                  │
  │  New jobs detected → notify following users                              │
  │                                                                          │
  └─────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────────────┐
```

### Step-by-Step Work Loop: Explorer Agent

The Explorer Agent runs a deliberate Think → Act → Observe loop:

```typescript
// EXPLORER AGENT WORK LOOP
class ExplorerAgent {
  async explore(task: ExplorationTask): Promise<ExplorationResult> {

    // STEP 0: Initialize Working Memory
    const memory = {
      task,
      iterations: [],
      discoveries: [],
      pagesVisited: [],
      configDraft: null
    };

    // STEP 1: Retrieve Context from Memory (RAG/Similarity)
    const priorKnowledge = await this.retrieveContext(task);
    // Returns: similar companies, successful strategies, failed approaches

    // STEP 2: ACT LOOP (max 5 iterations)
    for (let i = 0; i < MAX_ITERATIONS; i++) {

      // STEP 2a: THINK - AI decides next action
      const currentState = {
        task: memory.task,
        iteration: i,
        pagesVisited: memory.pagesVisited,
        discoveries: memory.discoveries,
        priorKnowledge
      };

      const decision = await this.decideNextAction(currentState);

      // STEP 2b: ACT - Execute the action
      let result;
      switch (decision.action) {
        case 'NAVIGATE':
          result = await this.extension.navigate(decision.url);
          break;
        case 'EXTRACT_DOM':
          result = await this.extension.extractElements(decision.selectors);
          break;
        case 'TEST_API':
          result = await this.extension.testAPI(decision.apiConfig);
          break;
        case 'GENERATE_CONFIG':
          return this.generateFinalConfig(memory);
        case 'FAIL':
          return { success: false, reason: decision.reason };
      }

      // STEP 2c: OBSERVE - Record what happened
      memory.iterations.push({ iteration: i, decision, result, timestamp: new Date() });

      // Analyze result and update discoveries
      const discovery = this.analyzeResult(result, decision);
      if (discovery) {
        memory.discoveries.push(discovery);
      }

      // STEP 2d: STORE IN MEMORY
      await this.updateEpisodicMemory(memory);
    }

    // STEP 3: Generate Final Config from Discoveries
    return this.generateFinalConfig(memory);
  }
}
```

### Step-by-Step Work Loop: Judge Agent

The Judge Agent evaluates after production fetch:

```typescript
// JUDGE AGENT WORK LOOP
class JudgeAgent {
  async evaluate(fetchResult: FetchResult): Promise<QualityReport> {

    // STEP 1: Fetch quality evaluation
    const evaluation = await this.scoreQuality(fetchResult);

    // STEP 2: Store evaluation for evolution
    await this.storeEvaluation(fetchResult, evaluation);

    // STEP 3: Decision - auto-approve or flag for review
    if (evaluation.score >= QUALITY_THRESHOLD) {
      return { ...evaluation, decision: 'AUTO_APPROVED', action: 'store' };
    } else if (evaluation.score >= MIN_THRESHOLD) {
      return { ...evaluation, decision: 'BELOW_THRESHOLD', action: 'flag_for_review' };
    } else {
      return { ...evaluation, decision: 'POOR_QUALITY', action: 'flag_for_review', suggestRetry: true };
    }
  }

  // OPTIMIZATION SKILL (on admin rejection)
  async suggestImprovements(rejectedResult: FetchResult, adminFeedback: string): Promise<OptimizationSuggestion> {
    const prompt = `...`;
    return JSON.parse(await this.ai.complete(prompt));
  }
}
```

### Complete Data Flow Diagram

```
ADMIN
 │
 ▼
┌──────────────────┐     ┌───────────────────────────────────────────────┐
│ Submit Task      │────▶│ Task Created: { companyId, contentTypes[] }  │
└──────────────────┘     └───────────────────────┬───────────────────────┘
                                                  │
                                                  ▼
                              ┌───────────────────────────────────────────────┐
                              │              EXPLORER AGENT                    │
                              │                                                │
                              │  Input: { company, contentTypes, context }      │
                              │         │                                      │
                              │         ▼                                      │
                              │  ┌─────────────────────────────────────┐       │
                              │  │         ACT LOOP (max 5)            │       │
                              │  │                                      │       │
                              │  │  Think: Decide next action          │       │
                              │  │       │                              │       │
                              │  │       ▼                              │       │
                              │  │  Act: Extension command             │       │
                              │  │       │                              │       │
                              │  │       ▼                              │       │
                              │  │  Observe: Page snapshot/API resp    │       │
                              │  │       │                              │       │
                              │  │       ▼                              │       │
                              │  │  Learn: Store in memory             │       │
                              │  │                                      │       │
                              │  └─────────────────────────────────────┘       │
                              │         │                                      │
                              │         ▼                                      │
                              │  Output: FetchConfig + confidence score       │
                              │                                                │
                              └───────────────────────┬───────────────────────┘
                                                    │
                          ┌─────────────────────────┴─────────────────────────┐
                          │                                                   │
                          ▼                                                   ▼
                    ┌──────────┐                                       ┌──────────┐
                    │  Config  │                                       │   No     │
                    │  Ready   │                                       │  Config  │
                    └────┬─────┘                                       └──────────┘
                         │
                         ▼
  ┌─────────────────────────────────────────────────────────────────────────┐
  │                        ADMIN REVIEW                                      │
  │                                                                          │
  │  Admin sees: config + test data + confidence                            │
  │       │                                                                   │
  │       ├─── Approve ────▶ Save Config ──▶ Schedule Enabled                │
  │       │                                                                   │
  │       └─── Reject ────▶ Feedback ──▶ AI Retry (max 3)                   │
  │                            │                                             │
  │                            ▼                                             │
  │                     JUDGE AGENT: suggestImprovements()                  │
  │                                                                          │
  └─────────────────────────────────────────────────────────────────────────┘
                                     │
                                     ▼
  ┌─────────────────────────────────────────────────────────────────────────┐
  │                    PRODUCTION (Scheduled/Cron)                          │
  │                                                                          │
  │  Cron tick ──▶ executeFetch(config) ──▶ fetch(url) ──▶ parse ──▶ store│
  │                                    │                                      │
  │                                    ▼                                      │
  │                         ┌─────────────────┐                            │
  │                         │  JUDGE AGENT     │                            │
  │                         │                  │                            │
  │                         │ score = 85 ──────▶ AUTO APPROVED             │
  │                         │ score = 60 ──────▶ FLAG for review            │
  │                         │ score = 30 ──────▶ FLAG + suggest retry       │
  │                         └────────┬────────┘                             │
  │                                  │                                       │
  │                                  ▼                                       │
  │                      ┌──────────────────────┐                          │
  │                      │  New Jobs Detected?  │                          │
  │                      └──────────────────────┘                          │
  │                                                                          │
  └─────────────────────────────────────────────────────────────────────────┘

USERS (who follow company)
 │
 ◀──── Notify: New job at Tesla!
```

### Specific AI Agent Functions

| Function | Explorer Agent | Judge Agent | Where |
|----------|---------------|-------------|-------|
| **Decide strategy** | Yes | No | Start of exploration |
| **Navigate browser** | Yes | No | Act phase |
| **Analyze page/API** | Yes | No | Observe phase |
| **Generate FetchConfig** | Yes | No | After exploration |
| **Score quality** | No | Yes | After production fetch |
| **Find issues** | No | Yes | Quality evaluation |
| **Suggest improvements** | No | Yes | On admin rejection |

### Edge Cases & Handling

```typescript
// EDGE CASE 1: No accessible data source found
if (discovery.type === 'FAIL_NO_ACCESSIBLE_SOURCE') {
  // Mark company as requiring manual research
  // Notify admin: "Could not find accessible data for company X"
}

// EDGE CASE 2: Auth required (LinkedIn, etc.)
if (discovery.requiresAuth) {
  // Set authRequired = true in config
  // Admin must handle manually
}

// EDGE CASE 3: Partial success (some content types found, some not)
if (partialSuccess) {
  // Generate config for successful ones
  // Report failure for others
}

// EDGE CASE 4: Config works but data quality degrades over time
if (qualityTrend === 'DECLINING') {
  // Alert admin: "Data quality dropped"
  // Trigger re-exploration
}

// EDGE CASE 5: Website changes breaking the config
if (fetchFails || qualitySuddenlyDrops) {
  // Mark config as potentially stale
  // Trigger re-exploration
}
```

---

## 0. Agent Evolution & Architecture

This section defines how AI agents learn, evolve, and maintain context across interactions.

### 0.1 Agent Evolution Loop

The core principle: **every interaction improves future performance**. Agents learn from successes and failures through a continuous feedback loop.

```
┌─────────────────────────────────────────────────────────────────────────┐
│                      Agent Evolution Loop                                │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  ┌──────────┐     ┌──────────────────────────────────────────────────┐  │
│  │  Input   │────▶│                  ACT Loop                        │  │
│  │  Task   │     │  ┌────────┐  ┌────────┐  ┌────────┐  ┌─────────┐   │  │
│  └──────────┘     │  │Observe │─▶│ Think  │─▶│  Act   │─▶│Observe │   │  │
│                   │  │        │  │        │  │        │  │(loop)  │   │  │
│                   │  └────────┘  └────────┘  └────────┘  └────┬────┘   │  │
│                   └────────────────────────────────────────────│────────┘  │
│                                                                    │        │
│                                          ┌─────────────────────────┘        │
│                                          │                                  │
│              ┌───────────────────────────┼───────────────────────────┐     │
│              │                           │                           │     │
│              ▼                           ▼                           ▼     │
│       ┌───────────┐             ┌─────────────┐             ┌──────────┐   │
│       │  Success │             │  Partial   │             │ Failure  │   │
│       │  Store   │             │   Store    │             │  Store   │   │
│       │ pattern  │             │  partially │             │ analyze  │   │
│       └─────┬─────┘             └──────┬─────┘             └────┬────┘   │
│             │                          │                          │       │
│             └──────────────────────────┼──────────────────────────┘       │
│                                        ▼                                  │
│                          ┌─────────────────────────────┐                   │
│                          │      Update Memory          │                   │
│                          │  (Strategy + Context + RAG) │                   │
│                          └─────────────────────────────┘                   │
│                                        │                                  │
│                                        ▼                                  │
│                          ┌─────────────────────────────┐                   │
│                          │  Better Next Attempt        │                   │
│                          │  (Similar task → learned   │                   │
│                          │   strategy applies)         │                   │
│                          └─────────────────────────────┘                   │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
```

### Learning Modes

| Mode | How It Works | Use Case | Complexity |
|------|--------------|----------|------------|
| **Pattern Matching** | Store successful configs by company type | "Tech companies → LinkedIn API" | Low |
| **Feedback Integration** | Admin feedback updates strategy | Reject → AI adapts approach | Low |
| **RAG Retrieval** | Find similar past tasks, apply their strategies | Company X similar to successful Y | Medium |
| **Periodic Review** | Batch analyze failures, update system prompts | Weekly prompt improvements | Medium |

### 0.2 Memory Architecture

Agents have multiple memory types, each serving a different purpose:

```
┌─────────────────────────────────────────────────────────────────────────┐
│                         Memory Architecture                              │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  ┌─────────────────────────────────────────────────────────────────────┐ │
│  │  WORKING MEMORY (Short-Term, In-Memory)                             │ │
│  │  • Current task context                                             │ │
│  │  • Pages visited this session                                       │ │
│  │  • Data collected so far                                           │ │
│  │  • Scratchpad for reasoning                                        │ │
│  │                                                                     │ │
│  │  Lifetime: Single task execution                                    │ │
│  │  Storage: JavaScript variables                                      │ │
│  └─────────────────────────────────────────────────────────────────────┘ │
│                                    │                                     │
│                                    ▼                                     │
│  ┌─────────────────────────────────────────────────────────────────────┐ │
│  │  EPISODIC MEMORY (Medium-Term, Database)                             │ │
│  │  • Past exploration attempts (success + failure)                    │ │
│  │  • Company-specific strategies that worked                          │ │
│  │  • Admin feedback history                                          │ │
│  │                                                                     │ │
│  │  Lifetime: Months, queryable                                        │ │
│  │  Storage: PostgreSQL (FetchTask, Content tables)                    │ │
│  └─────────────────────────────────────────────────────────────────────┘ │
│                                    │                                     │
│                                    ▼                                     │
│  ┌─────────────────────────────────────────────────────────────────────┐ │
│  │  SEMANTIC MEMORY (Long-Term, Knowledge Base)                         │ │
│  │  • Company type patterns ("Series A startups use Greenhouse")        │ │
│  │  • Industry conventions ("Tech companies list jobs on LinkedIn")    │ │
│  │  • Strategy performance stats by category                           │ │
│  │                                                                     │ │
│  │  Lifetime: Permanent, evolves slowly                                │ │
│  │  Storage: Content table + future vector store                      │ │
│  └─────────────────────────────────────────────────────────────────────┘ │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
```

### Database Integration with Existing Schema

Leverage the existing **Content table pattern** for memory storage:

```typescript
// Store exploration memory as Content entries
const memoryContentTypes = {
  exploration_episode: {
    // Stores: { companyId, strategy, success, dataQuality, errors, timestamp }
  },
  strategy_pattern: {
    // Stores: { companyType, industry, url, parseMethod, successRate }
  },
  admin_feedback: {
    // Stores: { taskId, approved, feedback, AIResponse }
  },
  company_pattern: {
    // Stores: { pattern: "greenhouse", companies: [...], successRate }
  }
};
```

### 0.3 Context Engineering

Structured context windows enable better AI reasoning:

```typescript
// Good context structure vs bad context structure

// ❌ BAD: Flat, disorganized
`Fetch company data for Tesla. They are automotive/tech. Check their careers page.
Also check LinkedIn. If that fails try Glassdoor. We need job listings.`

// ✅ GOOD: Structured, hierarchical
const structuredContext = {
  task: {
    type: 'exploration',
    goal: 'Discover job listings + culture for {company}',
    targetContentTypes: ['job_listing', 'company_culture'],
    maxIterations: 5
  },
  companyProfile: {
    name: 'Tesla',
    industry: 'automotive/tech',
    knownUrls: ['tesla.com/careers'],
    size: '10,000+',
    stage: 'public'
  },
  priorKnowledge: {
    similarCompaniesWorked: ['SpaceX', 'Rivian'], // From memory
    successfulStrategies: ['Greenhouse API', 'LinkedIn Scraper'],
    failedApproaches: ['Indeed API'] // Failed before
  },
  constraints: {
    authRequired: ['LinkedIn'], // Marked in memory
    antiBotSites: ['Indeed'],
    priorityOrder: ['careers_page', 'linkedin', 'glassdoor']
  }
};
```

### Few-Shot Examples in Context

```typescript
const explorationExamples = [
  {
    input: { company: 'Stripe', industry: 'fintech', target: 'job_listing' },
    chainOfThought: [
      '1. Check if Stripe has public careers API → yes, find.glimmer.com',
      '2. Parse JSON response for structured job data',
      '3. Verify completeness → 95% of jobs captured'
    ],
    output: {
      success: true,
      config: {
        url: 'https://careers.stripe.com/api/jobs',
        parseWith: 'json',
        pagination: { type: 'page', maxPages: 3 }
      }
    }
  },
  {
    input: { company: 'Local Restaurant', industry: 'food', target: 'job_listing' },
    chainOfThought: [
      '1. No public careers page → check Indeed aggregator',
      '2. Indeed blocks scraping → mark as authRequired',
      '3. Alternative: manually check and mark'
    ],
    output: {
      success: false,
      reason: 'No accessible source, requires manual intervention',
      suggestedAction: 'admin_manual_review'
    }
  }
];
```

### 0.4 Workflow Patterns

```
┌─────────────────────────────────────────────────────────────────────────┐
│                    Exploration Workflow (State Machine)                 │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  ┌─────────┐    ┌────────────┐    ┌──────────┐    ┌──────────────┐     │
│  │ PENDING │───▶│DISCOVERING │───▶│SCRAPING │───▶│  SYNTHESIZING │     │
│  └─────────┘    └────────────┘    └──────────┘    └──────┬───────┘     │
│       │                                                        │         │
│       │        ┌──────────────────────────────────────────────┼─────┐   │
│       │        │                                              │     │   │
│       │        ▼                                              ▼     │   │
│       │  ┌──────────────┐                          ┌──────────┐  │   │
│       │  │  EXPLORING   │◀─────────────────────────│RETRYING │  │   │
│       │  └──────┬───────┘                           └──────────┘  │   │
│       │         │                                             │     │   │
│       │         │ Max iterations or explicit fail              │     │   │
│       │         ▼                                             │     │   │
│       │  ┌──────────────┐                                      │     │   │
│       │  │    FAILED    │──────────────────────────────────────┘     │   │
│       │  └──────────────┘                                              │   │
│       │                                                                │   │
│       │         Admin manual intervention or new attempt               │   │
│       │                                                                │   │
│       └────────────────────────────────────────────────────────────────┘   │
│       │                                                                  │
│       ▼                                                                  │
│  ┌──────────────┐                                                        │
│  │   COMPLETE   │                                                        │
│  │ (Config Gen) │                                                        │
│  └──────────────┘                                                        │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
```

### Parallel vs Sequential Fetching

```typescript
// Parallel: Fetch multiple content types simultaneously
const [careers, culture, news] = await Promise.all([
  fetchWithRetry(careersConfig),
  fetchWithRetry(cultureConfig),
  fetchWithRetry(newsConfig)
]);

// Sequential: When one depends on another
const careersResult = await fetchCareers(company);
const cultureResult = await fetchCulture(company, careersResult.website);
```

### 0.5 RAG Strategy

**When to use RAG**:
- Find similar companies that had successful configurations
- Retrieve relevant past strategies for a new task
- Access company-specific knowledge from previous interactions

**RAG Architecture** (Phase later, not for initial implementation):

```
┌─────────────────────────────────────────────────────────────────────────┐
│                         RAG Pipeline                                    │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  Data Sources                          Query                             │
│  ┌─────────────────┐                 ┌─────────────────┐              │
│  │ Past Successful │                │ │ "Similar to     │              │
│  │ Configs         │                │ │  Stripe?"       │              │
│  └────────┬────────┘                 └────────┬────────┘              │
│           │                                 │                          │
│           ▼                                 ▼                          │
│  ┌─────────────────────────────────────────────────────────────────────┐ │
│  │                    Embed & Store (pgvector later)                   │ │
│  │  Chunk: company_type + industry + config_success + patterns         │ │
│  └─────────────────────────────────────────────────────────────────────┘ │
│                                    │                                     │
│                                    ▼                                     │
│                         ┌─────────────────┐                            │
│                         │ Similarity      │                            │
│                         │ Search (top-3)  │                            │
│                         └────────┬────────┘                            │
│                                  │                                     │
│                                  ▼                                     │
│                         ┌─────────────────┐                            │
│                         │ Context Builder │                            │
│                         │ (inject into    │                            │
│                         │  prompt)        │                            │
│                         └─────────────────┘                            │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
```

**Initial Implementation (No Vector DB)**:
```typescript
// Use SQL-based similarity for now
const similarCompanies = await prisma.company.findMany({
  where: {
    industry: company.industry,
    // Simple text match for initial version
  },
  include: {
    contents: {
      where: { contentType: 'strategy_pattern' }
    }
  }
});
```

### 0.6 Evaluation Harness

Continuous evaluation ensures agents improve over time:

```typescript
interface EvaluationHarness {
  // Test cases stored in database
  testCases: Array<{
    id: string;
    companyId: string;
    companyName: string;
    industry: string;
    expectedContentTypes: string[];
    difficulty: 'easy' | 'medium' | 'hard';
  }>;

  // Metrics to track
  metrics: {
    // Task completion
    successRate: number;        // % of tasks that completed
    configQuality: number;       // AI-judged quality of generated config
    dataCompleteness: number;   // % of expected fields populated

    // Efficiency
    avgIterations: number;       // Should decrease over time
    avgTimePerTask: number;     // Should decrease over time
    retryRate: number;          // Should decrease over time

    // User satisfaction
    adminApprovalRate: number;   // % approved without major changes
    rejectionReason: string[];  // Categorize reasons for failures
  };

  // Evaluation methods
  shadowMode: boolean;    // Run new agent alongside production
  canaryDeployment: boolean; // Gradually roll out to % of tasks
}

// Automated evaluation after each exploration
async function evaluateExploration(taskId: string, result: ExplorationResult) {
  const evaluation = await ai.judge({
    task: await getTask(taskId),
    result: result,
    criteria: QUALITY_CRITERIA[task.contentType]
  });

  await storeEvaluation({
    taskId,
    metrics: {
      success: result.config !== null,
      iterations: result.iterations,
      dataQuality: evaluation.score,
      adminApproved: result.isApproved
    }
  });

  // If metrics are degrading, alert for review
  if (metrics.successRate < THRESHOLD) {
    await notifyAdmin('Agent performance degraded');
  }
}
```

### 0.7 Agent Implementation Structure

```typescript
// src/lib/agents/base-agent.ts
interface AIAgent {
  id: string;
  name: string;

  // Memory
  workingMemory: WorkingMemory;
  episodicMemory: EpisodicMemory;
  semanticMemory: SemanticMemory;

  // Tools
  tools: AgentTools;

  // Skills
  skills: AgentSkills;

  // Graph (workflow)
  graph: AgentGraph;

  // Methods
  run(input: AgentInput): Promise<AgentOutput>;
  learn(feedback: Feedback): Promise<void>;  // Evolution
  evaluate(output: AgentOutput): Evaluation;
}

// src/lib/agents/explorer-agent.ts
class ExplorerAgent implements AIAgent {
  id = 'explorer';
  name = 'Company Data Explorer';

  workingMemory = {
    currentTask: null,
    pagesVisited: [],
    discoveries: [],
    currentUrl: null
  };

  skills = {
    decideNextAction: this.decideNextAction.bind(this),
    generateConfig: this.generateConfig.bind(this),
    assessQuality: this.assessQuality.bind(this)
  };

  tools = {
    navigate: (url: string) => extension.navigate(url),
    snapshot: () => extension.getPageSnapshot(),
    extractDOM: (selectors: string[]) => extension.extractDOM(selectors),
    testAPI: (config: APIConfig) => extension.testAPI(config),
    getNetworkLog: () => extension.getNetworkLog()
  };

  graph = explorationGraph; // Defined workflow
}

// src/lib/agents/judge-agent.ts
class JudgeAgent implements AIAgent {
  id = 'judge';
  name = 'Content Quality Judge';

  skills = {
    scoreQuality: this.scoreQuality.bind(this),
    findIssues: this.findIssues.bind(this),
    suggestImprovements: this.suggestImprovements.bind(this)
  };

  // Judge doesn't need browser tools
  tools = {
    fetch: (url: string) => fetch(url),
    parseJSON: (text: string) => JSON.parse(text),
    parseHTML: (html: string) => load(html)
  };
}
```

### 0.8 File Structure

```
src/
├── lib/
│   ├── ai/
│   │   ├── client.ts              # Unified AI client (Anthropic/Groq)
│   │   ├── providers.ts           # Provider abstraction
│   │   │
│   │   ├── agents/
│   │   │   ├── base-agent.ts      # Common agent interface
│   │   │   ├── explorer-agent.ts   # Exploration agent
│   │   │   ├── judge-agent.ts     # Quality evaluation agent
│   │   │   │
│   │   │   ├── memory/
│   │   │   │   ├── working.ts     # In-session memory
│   │   │   │   ├── episodic.ts    # Past interactions (DB)
│   │   │   │   └── semantic.ts    # Patterns/knowledge (DB)
│   │   │   │
│   │   │   ├── skills/
│   │   │   │   ├── decision-making.ts
│   │   │   │   ├── config-generation.ts
│   │   │   │   └── quality-scoring.ts
│   │   │   │
│   │   │   └── graphs/
│   │   │       ├── exploration-graph.ts
│   │   │       └── evaluation-graph.ts
│   │   │
│   │   ├── evaluation/
│   │   │   ├── harness.ts         # Test harness
│   │   │   ├── metrics.ts         # Metric definitions
│   │   │   └── evaluator.ts       # Evaluation logic
│   │   │
│   │   └── prompts/
│   │       ├── explorer-prompt.ts
│   │       ├── judge-prompt.ts
│   │       └── templates/
│   │           ├── company-research.ts
│   │           └── few-shot-examples.ts
│   │
│   └── evaluation/
│       ├── harness.ts             # Agent testing harness
│       └── metrics.ts             # What to measure
```

### 0.9 Evolution Over Time

| Phase | What's Implemented | Memory Type | Evolution |
|-------|-------------------|-------------|-----------|
| **1 (Now)** | Basic exploration | Working only | Pattern matching from content |
| **2** | Add episodic memory | Working + Episodic | Admin feedback → strategy updates |
| **3** | Add semantic memory | + Semantic | RAG similarity search |
| **4** | Automated prompts | All + Evaluation | Prompt evolution from metrics |

---

## 1. AI Model Selection

### Dev/Test Stage: Use Groq (Fully Free)

For development and testing with low invocation volume, **Groq** is the best choice:

| Provider | Model | Cost | Free Tier | Best For |
|----------|-------|------|-----------|----------|
| **Groq** | Llama 3 70B | Free | Unlimited (rate-limited) | Dev/test phase, fast inference |
| **Anthropic** | Claude 3.5 Haiku | $0.25/1M | $5 credits | Production - quality judgment |
| **OpenAI** | GPT-4o Mini | $0.15/1M | $5 credits | Production - structured extraction |
| **NVIDIA NIM** | Llama/Mistral | Credits | Limited free credits | Not recommended for dev (complex setup) |

**Groq Free Tier Details**:
- Rate limit: ~14-30 requests/minute (varies by model)
- Models available: Llama 3 70B, Mixtral 8x7B, Gemma 2B
- No time limit on free usage
- Perfect for: development, testing, low-volume production

**NVIDIA NIM Note**: While NVIDIA NIM offers free credits for Llama/Mistral models, the setup is more complex and rate limits are tighter. **Groq is recommended** for your dev/test phase.

### Architecture Decision: Unified AI Provider Interface

```
┌─────────────────────────────────────────────────────────────┐
│                    AI Provider Abstraction Layer            │
├─────────────────────────────────────────────────────────────┤
│  interface AIProvider {                                     │
│    // Exploration (controls extension)                       │
│    explore(task: FetchTask): Promise<ExplorationResult>   │
│    decideNextAction(context: ExplorationContext): Action  │
│    generateConfig(discoveries: Discovery[]): FetchConfig  │
│                                                             │
│    // Quality evaluation                                    │
│    evaluateQuality(content: string, criteria: Criteria)    │
│                                                             │
│    // Optimization on rejection                             │
│    suggestImprovements(config: FetchConfig, feedback: string) │
│  }                                                         │
├─────────────────────────────────────────────────────────────┤
│  Implementations:                                          │
│  - GroqProvider (Groq) - free tier, exploration            │
│  - ClaudeAIProvider (Anthropic) - better for judgment     │
│  - OpenAIProvider (OpenAI) - structured output            │
└─────────────────────────────────────────────────────────────┘
```

**Why This Approach**:
1. AI does the intelligent work (exploration, decision-making)
2. Easy to swap providers (Groq free → Anthropic for production)
3. Provider abstraction means no code changes when switching
4. Future-proof for resume generation and mock interview features

---

## 2. Web Crawler Tool Selection

### Hybrid Architecture: AI + Extension for Exploration, HTTP for Production

The key insight is **separation of concerns**:
- **AI + Chrome Extension** (exploration) = Figure out HOW to get data
- **Server HTTP Fetch** (production) = Actually get the data (reusable, scalable)

```
┌────────────────────────────────────────────────────────────────────────┐
│              Phase 1: AI-Controlled Exploration                         │
├────────────────────────────────────────────────────────────────────────┤
│                                                                        │
│  Admin initiates: "Fetch company culture for Apple"                   │
│       │                                                               │
│       ▼                                                               │
│  ┌─────────────────────────────────────────────────────────────────┐  │
│  │  AI Agent (Groq) ←→ Chrome Extension ←→ Browser                  │  │
│  │                                                                   │  │
│  │  1. AI decides: "Try their careers page first"                   │  │
│  │  2. Extension navigates browser to careers.apple.com            │  │
│  │  3. Extension returns page state (HTML/API calls captured)       │  │
│  │  4. AI analyzes response:                                        │  │
│  │     - If API found → use it directly                             │  │
│  │     - If HTML page → extract selectors with cheerio             │  │
│  │  5. AI generates FetchConfig from discovery                     │  │
│  │  6. AI tests config with 1-2 pages                              │  │
│  │                                                                   │  │
│  │  Max 5 iterations per exploration (avoid infinite loops)         │  │
│  └─────────────────────────────────────────────────────────────────┘  │
│       │                                                               │
│       ▼                                                               │
│  FetchConfig generated (or failed with reason)                        │
│                                                                        │
└────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│                    Phase 2: Production (Server)                        │
├────────────────────────────────────────────────────────────────────────┤
│                                                                        │
│  Saved FetchConfig                                                     │
│       │                                                               │
│       ▼                                                               │
│  Server does simple HTTP fetch (NO browser, NO AI):                    │
│  fetch(config.url, { headers, params }) → parse → store               │
│       │                                                               │
│       ▼                                                               │
│  Admin reviews → Approve/Reject → AI learns from feedback             │
│                                                                        │
└────────────────────────────────────────────────────────────────────────┘
```

### AI Exploration Agent Role

The AI is the **active explorer**, not just a tool. It:

```typescript
interface AIExplorationAgent {
  // Decide next action based on current state
  decideAction(context: ExplorationContext): Promise<Action>;

  // Analyze what the extension returned
  analyzeResult(pageState: PageState): Promise<Analysis>;

  // Generate FetchConfig from successful exploration
  generateConfig(discoveries: Discovery[]): FetchConfig;

  // Determine if exploration should continue or end
  shouldContinue(iterations: number, findings: Finding[]): boolean;
}

enum ExplorationAction {
  NAVIGATE,        // Go to a URL
  INJECT_SCRIPT,   // Run JS in page to trigger API calls
  EXTRACT_DOM,     // Get page content for selector analysis
  TEST_API,        // Try discovered API endpoint
  INTERACT,        // Click/scroll to load more content
  PARSE_HTML,      // Use cheerio on current page
  GENERATE_CONFIG, // Done, create FetchConfig
  FAIL             // Cannot find data source
}
```

### Chrome Extension Role (AI's Browser Interface)

The extension is **AI's eyes and hands** in the browser:

```typescript
// Extension listens for commands from AI server
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  switch (message.type) {
    case 'NAVIGATE':
      // Navigate to URL, wait for load
      navigateTo(message.url).then(sendResponse);
      break;

    case 'GET_NETWORK_LOG':
      // Return captured API calls (XHR/fetch)
      sendResponse(getNetworkCalls());

    case 'GET_PAGE_SNAPSHOT':
      // Return page state for AI to analyze
      sendResponse({
        url: window.location.href,
        html: document.body.innerHTML,
        title: document.title,
        visibleText: document.body.innerText.slice(0, 5000)
      });

    case 'EXECUTE_JAVASCRIPT':
      // Run JS to trigger dynamic content (infinite scroll, tabs, etc.)
      const result = eval(message.script);
      sendResponse(result);

    case 'EXTRACT_ELEMENTS':
      // Extract specific elements by CSS selector
      const elements = Array.from(document.querySelectorAll(message.selector))
        .map(el => ({
          tag: el.tagName,
          text: el.innerText?.slice(0, 200),
          href: el.href || el.src || null,
          rect: el.getBoundingClientRect()
        }));
      sendResponse(elements);
  }
  return true; // async response
});
```

### Communication Flow: AI ↔ Extension

```
Admin: "Fetch culture info for Tesla"

Server                          AI Agent                         Extension
  │                                │                                  │
  │──── SUBMIT_TASK ───────────> │                                  │
  │                                │                                  │
  │                                │──── NAVIGATE(careers.tesla.com) ──>│
  │                                │<─── PAGE_SNAPSHOT ────────────────│
  │                                │                                  │
  │                                │ AI analyzes: "No /api/jobs found │
  │                                │           Try /about or /culture"│
  │                                │                                  │
  │                                │──── NAVIGATE(tesla.com/culture) ─>│
  │                                │<─── PAGE_SNAPSHOT ────────────────│
  │                                │                                  │
  │                                │ AI analyzes: "Found values section│
  │                                │           Using selectors..."    │
  │                                │                                  │
  │                                │──── GENERATE_CONFIG ─────────────>│
  │                                │    url: tesla.com/culture        │
  │                                │    method: GET                   │
  │                                │    parseWith: cheerio            │
  │                                │    selectors: {...}              │
  │                                │<─── TEST_RESULT ─────────────────│
  │                                │                                  │
  │<──── CONFIG_READY ─────────── │                                  │
  │                                │                                  │
  │ (Server now uses config to fetch)                                 │
```

### Server-Side Fetch (Production - Reusable)

This is the actual data fetching that runs in production:

```typescript
// src/lib/crawler/fetch.ts

interface FetchConfig {
  id: string;
  name: string;
  contentType: 'company_culture' | 'company_wechat' | 'job_listing';
  url: string;
  method: 'GET' | 'POST';
  headers: Record<string, string>;
  params: Record<string, string>;  // Supports {{page}}, {{offset}} templates
  body?: string;
  parseWith: 'json' | 'cheerio';
  selectors?: Record<string, string>;  // For cheerio parsing
  pagination?: {
    type: 'page' | 'offset' | 'cursor';
    paramName: string;
    maxPages: number;
    stopCondition?: string;  // JSON path or CSS selector
  };
}

async function executeFetch(config: FetchConfig, context: FetchContext): Promise<FetchResult> {
  const allData: any[] = [];
  
  for (let i = 0; i < (config.pagination?.maxPages || 1); i++) {
    // Substitute template params
    const resolvedParams = resolveParams(config.params, { page: i, offset: i * 20 });
    
    const response = await fetch(buildUrl(config.url, resolvedParams), {
      method: config.method,
      headers: config.headers,
      body: config.body ? resolveTemplate(config.body, { page: i }) : undefined,
    });
    
    if (config.parseWith === 'json') {
      const data = await response.json();
      allData.push(...(Array.isArray(data) ? data : [data]));
      
      // Check stop condition
      if (config.pagination?.stopCondition && isEmpty(getPath(data, config.pagination.stopCondition))) {
        break;
      }
    } else {
      const html = await response.text();
      const $ = load(html);
      const extracted: Record<string, string> = {};
      
      for (const [key, selector] of Object.entries(config.selectors || {})) {
        extracted[key] = $(selector).text().trim();
      }
      allData.push(extracted);
    }
  }
  
  return { data: allData, pagesFetched: allData.length };
}
```

### Fetch Config Examples

```typescript
// Saved configs for different sources

const exampleConfigs = {
  // 1. Simple static page - company culture
  cultureStatic: {
    id: 'culture-001',
    name: 'Example Corp Culture Page',
    contentType: 'company_culture',
    url: 'https://example.com/about/culture',
    method: 'GET',
    headers: { 'User-Agent': 'WhyJobBot/1.0' },
    params: {},
    parseWith: 'cheerio',
    selectors: {
      title: 'h1',
      description: '.culture-content p',
      values: '.values li',
      image: '.hero-image::attr(src)'
    }
  },
  
  // 2. Job listing API endpoint
  jobsAPI: {
    id: 'jobs-001',
    name: 'Example Corp Careers API',
    contentType: 'job_listing',
    url: 'https://example.com/careers/api/positions',
    method: 'GET',
    headers: { 
      'Accept': 'application/json',
      'User-Agent': 'WhyJobBot/1.0'
    },
    params: { page: '{{page}}', size: '20' },
    parseWith: 'json',
    pagination: {
      type: 'page',
      paramName: 'page',
      maxPages: 10,
      stopCondition: 'data.positions'  // Stop when no more positions
    }
  },
  
  // 3. Requires auth - admin must handle manually
  jobsWithAuth: {
    id: 'jobs-002',
    name: 'LinkedIn Jobs',
    contentType: 'job_listing',
    url: 'https://linkedin.com/jobs/api/jobs',
    method: 'GET',
    headers: {},
    params: {},
    parseWith: 'json',
    authRequired: true,  // Extension detects this
    authNote: 'Requires LinkedIn login - admin must manually export'
  },
  
  // 4. Form-based search
  jobsSearchForm: {
    id: 'jobs-003',
    name: 'Indeed Job Search',
    contentType: 'job_listing',
    url: 'https://www.indeed.com/jobs',
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'User-Agent': 'WhyJobBot/1.0'
    },
    params: {},
    body: 'q={{query}}&l={{location}}&start={{offset}}',
    parseWith: 'cheerio',
    selectors: {
      title: '.jobTitle',
      company: '.companyName',
      location: '.companyLocation',
      summary: '.job-snippet'
    },
    pagination: {
      type: 'offset',
      paramName: 'start',
      maxPages: 20,
      increment: 10
    }
  }
};
```

### Why This Works

| Aspect | AI + Extension (Exploration) | Server Production |
|--------|------------------------------|-------------------|
| Browser complexity | AI controls extension | Simple HTTP fetch |
| AI involvement | Active explorer (decides actions) | Evaluator only |
| Auth handling | Admin does manually during explore | Config marks `authRequired` |
| Anti-bot | AI navigates carefully | Never hits (uses discovered API) |
| Scalability | N/A (one-time per config) | Infinite (just HTTP calls) |
| Cost | Groq free tier (exploration) | Near zero |
| Speed | ~10-30s per exploration | <100ms per page |

### Comparison: All Approaches

| Approach | AI-Driven | Vercel Compatible | Scalability | Best For |
|----------|----------|-------------------|-------------|----------|
| **This Hybrid (AI + Extension)** | ✅ Yes | ✅ Perfectly | Infinite | Your use case |
| Manual Extension Only | ❌ No | ✅ | Infinite | Simple cases |
| Playwright in Vercel | N/A | ⚠️ Limited | Low | Not recommended |
| Browserless.io API | ❌ No | ✅ | High | JS-rendered only |
| Jina Reader | ❌ No | ✅ | High | Static pages |
| fetch + cheerio only | ❌ No | ✅ | High | Known APIs |

---

## 3. Database Queue Architecture

### New Tables Required

```prisma
// Task Queue for information fetching
model FetchTask {
  id             String   @id @default(cuid())
  companyId      String
  contentType    String   // 'company_culture' | 'company_wechat' | 'job_listing'
  fetchConfigId  String   // Reference to the FetchConfig used
  status         String   @default('pending') // 'pending' | 'processing' | 'completed' | 'failed' | 'needs_review'

  // Execution context (page number for pagination)
  context        Json?    // { page: number, offset: number }

  result         String?  // Raw fetched content
  parsedResult   Json?    // Structured result after parsing

  retryCount     Int      @default(0)
  lastError      String?

  createdAt      DateTime @default(now())
  updatedAt      DateTime @updatedAt
  completedAt    DateTime?

  // Admin review fields
  reviewedBy     String?
  reviewedAt     DateTime?
  reviewNote     String?  // Admin's feedback if rejected
  isApproved     Boolean?

  @@index([status, createdAt])
  @@index([companyId, contentType])
}

// Stores approved fetch configurations (created by extension, saved by admin)
model FetchConfig {
  id          String   @id @default(cuid())
  companyId   String
  contentType String   // 'company_culture' | 'company_wechat' | 'job_listing'
  name        String   // Human-readable name

  // Full fetch configuration (created by Chrome extension)
  url         String
  method      String   @default("GET")  // GET or POST
  headers     Json     @default("{}")
  params      Json     @default("{}")   // URL params (supports {{page}} templates)
  body        String?  // For POST requests
  parseWith   String   @default("json") // 'json' or 'cheerio'
  selectors   Json?    // CSS selectors for cheerio parsing

  // Pagination config
  pagination  Json?    // { type: 'page'|'offset', paramName, maxPages, stopCondition }

  // Auth flag (if true, this config requires auth that admin must handle)
  authRequired Boolean @default(false)
  authNote    String?

  // Scheduling
  isActive    Boolean  @default(true)
  intervalHours Int?   // null = manual only, number = auto-refresh interval

  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  @@unique([companyId, contentType])
}

// User-Company relationship (from research prompt)
model UserCompany {
  id        String   @id @default(cuid())
  userId    String
  companyId String
  addedAt   DateTime @default(now())

  // Track if user wants notifications for this company
  notifyOnNewJobs Boolean @default(false)

  @@unique([userId, companyId])
}

// User-Job relationship
model UserJob {
  id        String   @id @default(cuid())
  userId    String
  jobId     String
  status    String   @default('saved') // 'saved' | 'applied' | 'interviewing' | 'rejected' | 'accepted'
  notes     String?
  addedAt   DateTime @default(now())

  @@unique([userId, jobId])
}
```

### Task Processing Flow

```
┌─────────────────────────────────────────────────────────────────────┐
│                     Async Exploration Flow                           │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  1. Admin submits task (e.g., "Fetch Tesla culture")                │
│     └─> Task queued, status: "waiting_for_extension"                 │
│                                                                      │
│  2. Admin opens Chrome with extension (any time)                    │
│     └─> Extension registers with server: "I'm online"               │
│                                                                      │
│  3. Server picks up task, starts AI exploration                     │
│     └─> status: "exploring"                                         │
│     └─> AI ↔ Extension ←→ Browser (real-time)                        │
│                                                                      │
│  4. Exploration completes (success or failed)                       │
│     └─> status: "config_ready" or "exploration_failed"              │
│     └─> Admin notified (toast / email)                               │
│                                                                      │
│  5. Admin reviews result (at their convenience)                     │
│     └─> Approve → Config saved, scheduling enabled                  │
│     └─> Reject → AI gets feedback → can retry                        │
│                                                                      │
└─────────────────────────────────────────────────────────────────────┘
```

---

## 4. AI's Two Roles

AI serves **two distinct functions** in this system:

| Role | When | What AI Does |
|------|------|--------------|
| **Explorer** | During exploration phase | Controls browser via extension, decides navigation, generates FetchConfig |
| **Judge** | During evaluation phase | Scores fetched content quality, suggests improvements on rejection |

### Role 1: AI as Explorer

During exploration, AI controls the Chrome Extension to discover data sources:

```typescript
// AI Exploration Loop
async function exploreWithAI(task: FetchTask): Promise<ExplorationResult> {
  const discoveries: Discovery[] = [];
  let currentUrl = task.startUrl;

  for (let i = 0; i < MAX_ITERATIONS; i++) {
    // 1. Get current page state from extension
    const pageState = await extension.getPageSnapshot();

    // 2. AI analyzes and decides next action
    const decision = await ai.decideNextAction({
      task,
      pageState,
      previousDiscoveries: discoveries,
      iteration: i
    });

    // 3. Execute decision
    switch (decision.action) {
      case 'NAVIGATE':
        await extension.navigateTo(decision.url);
        break;

      case 'EXTRACT_DOM':
        const elements = await extension.extractElements(decision.selectors);
        discoveries.push({ type: 'dom', data: elements });
        break;

      case 'TEST_API':
        const apiResult = await extension.testApi(decision.apiConfig);
        discoveries.push({ type: 'api', data: apiResult });
        break;

      case 'GENERATE_CONFIG':
        return ai.generateConfig(discoveries);

      case 'FAIL':
        return { success: false, reason: decision.reason };
    }
  }

  return { success: false, reason: 'Max iterations reached' };
}
```

### Role 2: AI as Judge

After fetching, AI evaluates content quality and suggests improvements:

```typescript
// Step 1: Initial Evaluation (automated)
async function evaluateFetchResult(task: FetchTask): Promise<QualityReport> {
  const evaluation = await aiProvider.evaluate({
    content: task.result,
    contentType: task.contentType,
    criteria: QUALITY_CRITERIA[task.contentType]
  });

  return {
    score: evaluation.score,        // 0-100
    issues: evaluation.issues,      // List of problems found
    suggestions: evaluation.suggestions
  };
}

// Step 2: Optimization Suggestion (on admin rejection)
async function suggestOptimization(task: FetchTask, adminFeedback: string): Promise<OptimizationPlan> {
  const response = await aiProvider.suggestImprovements({
    currentResult: task.result,
    contentType: task.contentType,
    feedback: adminFeedback,
    currentConfig: task.fetchConfig
  });

  return {
    newConfig: response.updatedConfig,
    alternativeUrls: response.alternativeUrls,
    reasoning: response.reasoning
  };
}
```

### Quality Criteria by Content Type

```typescript
const QUALITY_CRITERIA = {
  company_culture: {
    required: ['价值观', '工作环境', '员工评价'],
    minLength: 500,
    freshness: '30d',  // Content should be within 30 days
    sources: ['官网', 'LinkedIn', 'Glassdoor']
  },
  company_wechat: {
    required: ['公众号名称', '二维码图片', '最新文章'],
    verifyQR: true,
    freshness: '7d'
  },
  job_listing: {
    required: ['职位名称', '薪资范围', '职位描述', '发布时间'],
    validateUrl: true,  // URL should be direct job posting
    freshness: '7d'
  }
};
```

---

## 5. Background Processing Architecture

**Note**: With the Chrome Extension + HTTP Fetch architecture, processing is **extremely lightweight** — no browser binaries, just simple HTTP calls following the saved FetchConfig. This works perfectly in Vercel free tier.

### Vercel-Compatible Options

| Approach | Pros | Cons | Cost |
|----------|------|------|------|
| **Vercel Cron + API** | Native, no external deps | Max 10 minute execution | Free |
| **QStash (Upstash)** | Reliable, retry logic | External service | Free tier available |
| **Neon Serverless + pg_cron** | DB-native | PostgreSQL only | Included with Neon |
| **Separate Worker App** | Full control | More infrastructure | $5-20/mo |

### Recommended: Hybrid Approach

```typescript
// 1. API Route for task submission
export async function POST(req: Request) {
  const task = await createFetchTask(req.body);
  // Return immediately, queue for background
  return Response.json({ taskId: task.id }, { status: 202 });
}

// 2. Vercel Cron runs every minute (free tier)
export async function GET(req: Request) {
  const pendingTasks = await prisma.fetchTask.findMany({
    where: { status: 'pending' },
    take: 5
  });

  for (const task of pendingTasks) {
    // Process with waitUntil for background execution
    event.waitUntil(processTask(task));
  }

  return Response.json({ processed: pendingTasks.length });
}

// 3. Actual processing (uses saved FetchConfig)
async function processTask(task: FetchTask) {
  const config = await getFetchConfig(task.fetchConfigId);
  const result = await executeFetch(config);

  // AI evaluation
  const quality = await evaluateFetchResult({ ...task, result });

  await prisma.fetchTask.update({
    where: { id: task.id },
    data: {
      status: quality.score > 70 ? 'completed' : 'needs_review',
      result: result.content,
      parsedResult: quality.structured
    }
  });
}
```

---

## 6. Event Trigger for New Jobs

### Design for Future Implementation

```typescript
// When new job is fetched and approved
async function onNewJobFetched(task: FetchTask) {
  // Find all users following this company
  const followers = await prisma.userCompany.findMany({
    where: { companyId: task.companyId, notifyOnNewJobs: true },
    include: { user: true }
  });

  // Publish to notification topic
  for (const follow of followers) {
    await qstash.publishJSON({
      url: `${BASE_URL}/api/notifications`,
      body: {
        userId: follow.userId,
        type: 'new_job',
        companyId: task.companyId,
        jobPreview: task.parsedResult?.title
      }
    });
  }
}
```

**Extension Point**: The job-user matching AI (not implemented) would be triggered here to analyze if the new job matches each following user's profile.

---

## 7. Scalable AI Layer Design

### Provider Configuration

```typescript
// src/lib/ai/providers.ts
export interface AIProviderConfig {
  name: string;
  provider: 'anthropic' | 'openai' | 'groq';
  apiKey: string;
  baseUrl?: string;
  models: {
    extraction: string;   // For content extraction
    judgment: string;     // For quality evaluation
    optimization: string; // For improvement suggestions
  };
  rateLimits: {
    requestsPerMinute: number;
    tokensPerMinute: number;
  };
  costPerMillionTokens: {
    input: number;
    output: number;
  };
}

// Dev/Test: Use Groq (free)
// Production: Swap to Anthropic/OpenAI
export const AI_PROVIDERS = {
  groq: {
    name: 'Groq',
    provider: 'groq' as const,
    apiKey: process.env.GROQ_API_KEY!,
    baseUrl: 'https://api.groq.com/openai/v1',
    models: {
      extraction: 'llama-3.1-70b-versatile',
      judgment: 'llama-3.1-70b-versatile',
      optimization: 'llama-3.1-70b-versatile',
    },
    rateLimits: { requestsPerMinute: 30, tokensPerMinute: 6000 },
    costPerMillionTokens: { input: 0, output: 0 }, // Free tier
  },
  anthropic: {
    name: 'Anthropic',
    provider: 'anthropic' as const,
    apiKey: process.env.ANTHROPIC_API_KEY!,
    models: {
      extraction: 'claude-3-haiku-20240307',
      judgment: 'claude-3-haiku-20240307',
      optimization: 'claude-3-sonnet-20240229',
    },
    rateLimits: { requestsPerMinute: 50, tokensPerMinute: 100000 },
    costPerMillionTokens: { input: 0.25, output: 1.25 },
  },
} as const;
```

### Vercel AI SDK Integration

```typescript
// Install: npm install @ai-sdk/openai ai
// Note: Vercel AI SDK supports Anthropic, OpenAI, Groq via OpenAI-compatible API

import { generateText } from 'ai';
import { openai } from '@ai-sdk/openai';

// Use Groq (OpenAI-compatible API) for free tier
const groq = openai('groq', {
  apiKey: process.env.GROQ_API_KEY,
  baseURL: 'https://api.groq.com/openai/v1',
});

export async function evaluateWithAI(
  content: string,
  contentType: string,
  provider: keyof typeof AI_PROVIDERS = 'groq'
) {
  const model = AI_PROVIDERS[provider].models.judge;
  const client = provider === 'groq' ? groq : openai(provider);

  const result = await generateText({
    model: client(model),
    messages: [
      {
        role: 'user',
        content: `Evaluate this content for quality (${contentType}):

${content.slice(0, 4000)}

Return JSON:
{
  "score": 0-100,
  "issues": ["problem 1", "problem 2"],
  "suggestions": ["improvement 1"]
}`
      }
    ],
    temperature: 0.3,
    maxTokens: 1000,
  });

  return JSON.parse(result.text);
}

export async function suggestOptimization(
  task: FetchTask,
  adminFeedback: string,
  provider: keyof typeof AI_PROVIDERS = 'groq'
) {
  const model = AI_PROVIDERS[provider].models.optimization;
  const client = provider === 'groq' ? groq : openai(provider);

  const result = await generateText({
    model: client(model),
    messages: [
      {
        role: 'user',
        content: `Admin rejected this fetch result for ${task.contentType}:

Original URL: ${task.url}
Admin Feedback: ${adminFeedback}

Current result:
${task.result?.slice(0, 3000)}

Suggest improvements:
1. Which crawler to use (Jina for static, Browserless for dynamic)
2. What parameters to adjust
3. Alternative URLs to try

Return JSON:
{
  "recommendedCrawler": "jina|browserless",
  "newParams": {"key": "value"},
  "alternativeUrls": ["url1", "url2"],
  "reasoning": "why this approach"
}`
      }
    ],
    temperature: 0.4,
    maxTokens: 1500,
  });

  return JSON.parse(result.text);
}
```

---

## 8. Implementation Phases

### Phase 1: Chrome Extension + AI Exploration Agent (3-4 days)
- [ ] Build Chrome extension with:
  - Message listener for AI commands
  - Network interceptor (capture API calls)
  - Page snapshotter (return HTML/DOM state)
  - JavaScript executor (trigger dynamic content)
  - Element extractor (querySelector helpers)
- [ ] Implement AI Exploration Agent:
  - Groq integration for exploration prompts
  - Decision loop: analyze state → decide action → repeat
  - FetchConfig generator from discoveries
  - Max iteration guard (5 loops per task)
- [ ] Test AI ↔ Extension communication
- [ ] Test with real company sites (Apple, Tesla, etc.)

### Phase 2: Server Foundation + Production Fetch (2-3 days)
- [ ] Add FetchTask, FetchConfig tables to Prisma schema
- [ ] Create `/api/fetch-tasks` routes (submit, status, review)
- [ ] Implement `executeFetch()` using saved FetchConfig
- [ ] Implement **fetch + cheerio** for HTML parsing
- [ ] Implement **fetch + JSON** for API responses
- [ ] Implement **fetch + Jina Reader** fallback for complex HTML
- [ ] Admin UI for reviewing AI-generated configs

### Phase 3: AI Quality Evaluation + Optimization (2-3 days)
- [ ] Implement AI quality evaluation (score 0-100)
- [ ] Implement AI optimization suggestions on admin rejection
- [ ] Admin review UI (approve/reject results)
- [ ] Feedback loop: reject → AI learns → retries
- [ ] Setup provider swap (Groq free → Anthropic/OpenAI)

### Phase 4: User Features + Scheduling (2-3 days)
- [ ] Add UserCompany, UserJob tables
- [ ] Company following functionality for users
- [ ] Cron job for scheduled fetches using saved configs
- [ ] Notification stub (QStash integration for new jobs)
- [ ] Job matching extension point (future AI feature)

---

## 9. Cost Estimation (Vercel Free Tier)

| Component | Free Tier | Notes |
|-----------|-----------|-------|
| **AI - Groq** | **$0** | Unlimited requests (rate-limited) |
| **AI - Anthropic** | $5 credits | Only needed for production quality |
| **Jina Reader** | 10k calls/month | Fallback for complex HTML |
| **cheerio** | **$0** | Free, for HTML parsing |
| **Chrome Extension** | **$0** | Dev tool, not production |
| **Vercel Cron** | Free | Max 10min execution, 10s timeout on hobby |
| **QStash** | 5k messages/day | Only needed for notifications |
| **Neon** | 0.5GB storage | Included |
| **Total** | **$0** | ✅ Fully free for dev/test |

**Production Cost** (when ready to scale):
- Add Anthropic/OpenAI: ~$5-20/month depending on volume
- Jina Reader: ~$15/month if 10k calls insufficient
- Vercel Pro (if needed): $20/month

---

## 10. Open Questions / Decisions Needed

### Confirmed Decisions (based on your feedback)
✅ **AI as active explorer** - AI controls Chrome Extension to discover data sources
✅ **Groq for dev/test** - Fully free, no credits to run out
✅ **Hybrid architecture** - AI+Extension for exploration, simple HTTP fetch for production
✅ **Vercel free tier compatible** - No browser binaries, just HTTP fetch + cheerio/Jina
✅ **AI has two roles** - Explorer (during exploration) + Judge (during evaluation)

### Still Need Your Input

1. **Notification delivery method?**
   - In-app notifications (stored in DB, shown on dashboard)
   - Email via Resend (already in stack)
   - Both

2. **How often should jobs auto-refresh for followed companies?**
   - Hourly: reasonable for active job markets
   - Daily: sufficient, saves resources
   - Manual only: admin triggers refresh

3. **Admin online for exploration?**
   - ✅ **Async exploration** - Admin submits task, when admin's Chrome (with extension) is online, AI explores in real-time, admin notified when done

   **How extension registration works:**
   ```
   Admin's Chrome + Extension                Server
   ┌─────────────────────────┐        ┌─────────────────────┐
   │ Extension loaded        │──POST──│ /api/extension/     │
   │                         │        │   register          │
   │                         │        │                     │
   │                         │◄───────│ Extension ID        │
   │                         │        │ (for WebSocket)     │
   │                         │        │                     │
   │◄───── WebSocket connect ─────────│                     │
   │                         │        │                     │
   │  Ready for tasks ──────►│        │                     │
   └─────────────────────────┘        └─────────────────────┘
   ```

   Server maintains list of online extensions → assigns pending tasks when extension connects

4. **Company addition permission?**
   - You mentioned admin-only for adding companies
   - Normal users can only search and follow
   - Confirm: Should normal users be able to suggest new companies?

---

## Sources

- [Vercel AI SDK Documentation](https://sdk.vercel.ai)
- [Groq API](https://console.groq.com)
- [Jina AI Reader API](https://jina.ai/reader)
- [cheerio - Fast HTML parser](https://cheerio.js.org)
- [Prisma Documentation](https://prisma.io/docs)
- [Upstash QStash](https://upstash.com/qstash)
- [Vercel Cron Jobs](https://vercel.com/docs/cron-jobs)
- [Chrome Extension Development](https://developer.chrome.com/docs/extensions/)