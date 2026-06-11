# Explorer Agent - Core Loop Spec

## Overview

Explorer Agent runs an ACT (Observe → Think → Act → Observe) loop to explore company websites and generate FetchConfig. It controls the Chrome Extension via **HTTP polling**.

**Iteration 1 Scope**: Basic ACT loop with max 5 iterations, simple decision logic.

## Requirements

### Core Loop

```typescript
async function explore(task: ExplorationTask): Promise<ExplorationResult> {
  // 1. Initialize working memory
  const memory = initializeMemory(task);

  // 2. Retrieve context (empty in Iteration 1, memory comes Iteration 3)
  const priorKnowledge = await retrieveContext(task); // Returns empty for now

  // 3. ACT Loop (max 5 iterations)
  for (let i = 0; i < MAX_ITERATIONS; i++) {
    // THINK: Decide next action
    const decision = await decideNextAction({
      task,
      iteration: i,
      pagesVisited: memory.pagesVisited,
      discoveries: memory.discoveries,
      priorKnowledge
    });

    // ACT: Execute via extension
    const result = await executeAction(decision, extension);

    // OBSERVE: Analyze result
    const discovery = analyzeResult(result, decision);
    if (discovery) {
      memory.discoveries.push(discovery);
    }

    // Learn: Store in memory (Iteration 3)
    await updateMemory(memory);

    // Check stopping conditions
    if (decision.action === 'GENERATE_CONFIG') {
      return generateFinalConfig(memory);
    }
    if (decision.action === 'FAIL') {
      return { success: false, reason: decision.reason };
    }
  }

  // Max iterations reached
  return generateFinalConfig(memory); // Try with what we have
}
```

### Skills (Iteration 1)

#### 1. decideNextAction(state)
Decision logic using simple rules + AI:

```
Input: { task, iteration, pagesVisited, discoveries, priorKnowledge }

Priority Logic:
1. If iteration === 0 AND no pages visited → NAVIGATE to company's known URL or careers page
2. If we have API endpoint in discoveries → TEST_API
3. If we have page HTML in discoveries → ANALYZE and decide: another page or GENERATE_CONFIG
4. If no discoveries after 2 iterations → FAIL (no accessible source)

AI assists with:
- Which specific URL to try next
- Which selectors to extract
- When to give up and generate config
```

AI prompt structure:
```
You are exploring ${company.name} (${company.industry}) to find ${contentTypes}.
${priorKnowledge ? `Prior knowledge: ${priorKnowledge}` : ''}
Pages visited: ${pagesVisited.length}
Discoveries: ${discoveries.map(d => d.type).join(', ') || 'None'}

Available actions: NAVIGATE, EXTRACT_DOM, TEST_API, GENERATE_CONFIG, FAIL

Decide next action and provide reasoning.
```

#### 2. analyzeResult(result, decision)
Extract useful information from action result:

```
Output: Discovery | null
{
  type: 'api_endpoint' | 'webpage' | 'requires_auth' | 'no_content';
  url?: string;
  data?: any;           // API response or HTML
  selectors?: object;  // For webpages
  requiresAuth?: boolean;
  reason?: string;      // For no_content
}
```

#### 3. generateFinalConfig(memory)
Create FetchConfig from discoveries:

```typescript
{
  companyId: memory.task.companyId;
  contentType: memory.task.contentTypes[0]; // Primary
  name: `${company.name} - ${contentTypes.join('+')}`;
  url: pickBestUrl(memory.discoveries);
  method: 'GET';
  headers: { 'User-Agent': 'WhyJobBot/1.0' };
  params: {};
  parseWith: inferParseMethod(memory.discoveries); // 'json' | 'cheerio'
  selectors: buildSelectors(memory.discoveries);
  pagination: inferPagination(memory.discoveries);
  authRequired: memory.discoveries.some(d => d.requiresAuth);
  confidence: calculateConfidence(memory.discoveries); // 0-100
}
```

### Constants (Iteration 1)

```typescript
MAX_ITERATIONS = 5;
QUALITY_THRESHOLD = 70;
NETWORK_TIMEOUT = 10000; // 10s
```

## Reference

- `@docs/ai-assist-fetch-info-plan.md` - Full system design
- `@context/features/explorer-agent-01-chrome-extension-spec.md` - Extension commands
- `src/lib/ai/agents/explorer-agent.ts` - Implementation

## Notes

- Keep AI prompts simple for Iteration 1
- Use rule-based fallback if AI decision is unclear
- Track iterations and discoveries in working memory
- Confidence score helps admin decide whether to approve