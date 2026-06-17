// src/lib/ai/agents/explorer/prompts/context-prompt.ts

import type { ExplorationState, PageVisit, Discovery, NetworkCall, ExplorationError } from '../types';

/**
 * Build context prompt from current exploration state
 */
export function buildContextPrompt(input: { state: ExplorationState }): string {
  const { state } = input;
  const {
    company,
    contentTypes,
    iteration,
    maxIterations,
    pagesVisited,
    discoveries,
    networkCalls,
    errors,
    reactTrace,
    currentUrl,
  } = state;

  // Format pages visited
  const pagesText = formatPagesVisited(pagesVisited);

  // Format discoveries
  const discoveriesText = formatDiscoveries(discoveries);

  // Format network calls (show most relevant)
  const networkText = formatNetworkCalls(networkCalls);

  // Format errors
  const errorsText = formatErrors(errors);

  // Format ReAct trace
  const traceText = formatReActTrace(reactTrace);

  return `## Current Exploration Task

**Company**: ${company.name} ${company.industry ? `(${company.industry})` : ''}
**Website**: ${company.website || 'Unknown - discover from search'}
**Target Content**: ${contentTypes.join(', ')}
**Current URL**: ${currentUrl || 'None yet'}

## Iteration Progress

- **Iteration**: ${iteration + 1} of ${maxIterations}
- **Pages Visited**: ${pagesVisited.length}
${pagesText}

- **Discoveries**: ${discoveries.length}
${discoveriesText}

- **Network Calls Captured**: ${networkCalls.length}
${networkText}

- **Errors**: ${errors.length}
${errorsText}

## ReAct Reasoning Trace

${traceText}

## Your Task

Based on the current state above, decide your next action. Follow the ReAct pattern:
- **Thought**: Analyze what you've found and what you need
- **Action**: Choose the best tool to make progress
- **Confidence**: Rate your confidence in this action (0-100)

Remember: Prioritize finding JSON APIs over web scraping. Look for /api/, /jobs endpoints.`;
}

function formatPagesVisited(pages: PageVisit[]): string {
  if (pages.length === 0) return '  (No pages visited yet)';

  return pages
    .slice(-5)
    .map((p) => `  - ${p.url} "${p.title}"`)
    .join('\n');
}

function formatDiscoveries(discoveries: Discovery[]): string {
  if (discoveries.length === 0) return '  (No discoveries yet)';

  return discoveries
    .slice(-5)
    .map((d) => {
      const summary = summarizeDiscovery(d);
      return `  - [${d.type}] ${d.url || 'unknown'} (conf: ${d.confidence}%) - ${summary}`;
    })
    .join('\n');
}

function summarizeDiscovery(d: Discovery): string {
  switch (d.type) {
    case 'api_endpoint':
      return 'API endpoint found';
    case 'webpage':
      return d.data ? `Extracted ${Object.keys(d.data as object).length} elements` : 'Web page';
    case 'job_data':
      return 'Job listings detected';
    case 'culture_data':
      return 'Culture content found';
    case 'requires_auth':
      return d.reason || 'Authentication required';
    default:
      return d.reason || d.type;
  }
}

function formatNetworkCalls(calls: NetworkCall[]): string {
  if (calls.length === 0) return '  (No network calls captured)';

  // Show API calls with /api/ or /jobs in URL
  const apiCalls = calls
    .filter((c) => c.url.includes('/api/') || c.url.includes('/jobs') || c.url.includes('/positions'))
    .slice(-5);

  if (apiCalls.length === 0) {
    return '  (No API-like calls found)';
  }

  return apiCalls.map((c) => `  - ${c.method} ${c.url} (${c.status})`).join('\n');
}

function formatErrors(errors: ExplorationError[]): string {
  if (errors.length === 0) return '  (No errors)';

  return errors
    .slice(-3)
    .map((e) => `  - [${e.tool}] ${e.error}`)
    .join('\n');
}

function formatReActTrace(trace: ExplorationState['reactTrace']): string {
  if (trace.length === 0) return '  (Fresh start - no reasoning yet)';

  return trace
    .slice(-3)
    .map((step) => {
      let text = `Step ${step.stepNumber}: ${step.thought}`;
      text += `\n  Action: ${step.action}`;
      if (step.observation) {
        text += `\n  Observation: ${step.observation}`;
      }
      if (step.reflection) {
        text += `\n  Reflection: ${step.reflection}`;
      }
      return text;
    })
    .join('\n\n');
}