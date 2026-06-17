// src/lib/ai/agents/explorer/prompts/react-prompt.ts

/**
 * ReAct reasoning prompt template
 * This is appended to the user prompt to guide the LLM through the ReAct pattern
 */
export const REACT_REASONING_PROMPT = `

## ReAct Reasoning Pattern

Follow this pattern for each decision:

**Thought**: Analyze the current situation. What have we discovered? What information do we still need? What patterns have we seen?

**Action**: Based on your analysis, what is the next best action? Consider:
- If no pages visited yet → NAVIGATE to company website
- If just navigated → GET_SNAPSHOT to capture content
- If page has interactive elements → EXECUTE_JS to load more
- If we see API patterns in network → GET_NETWORK_LOG to find endpoints
- If we found a good data source → GENERATE_CONFIG
- If we're stuck with no progress → FAIL

**Confidence**: Rate your confidence (0-100) that this action will lead to useful data.

Important Decision Heuristics:
- Jobs in URL path (e.g., /api/jobs, /careers/jobs) = high confidence
- JSON responses from XHR = high confidence
- Job listing keywords in HTML = medium confidence
- Authentication required = lower confidence
- Too many errors without progress = consider FAIL

Your response must be a valid JSON object:
{
  "action": "ACTION_NAME",
  "target": { /* relevant parameters */ },
  "reasoning": "Your thought process",
  "confidence": 0-100
}`;