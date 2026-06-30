// src/lib/ai/agents/explorer/prompts/context-prompt.ts

/**
 * Build context prompt from current exploration state
 */

import type { ExplorationState, PageVisit, Discovery, NetworkCall, ExplorationError } from '../../../types';
import { ExplorationStateWrapper } from '../../../domain';

/**
 * Build context prompt from current exploration state
 */
export function buildContextPrompt(input: { state: ExplorationState }): string {
  const wrapper = new ExplorationStateWrapper(input.state);

  const task = wrapper.task;
  const iteration = wrapper.iteration;
  const memory = wrapper.memory;
  const context = wrapper.context;
  const snapshots = wrapper.history.snapshots;

  // Format pages visited
  const pagesText = formatPagesVisited(memory.pagesVisited);

  // Format discoveries
  const discoveriesText = formatDiscoveries(memory.discoveries);

  // Format network calls (show most relevant)
  const networkCalls = wrapper.history.allNetworkCalls;
  const networkText = formatNetworkCalls(networkCalls);

  // Format errors
  const errorsText = formatErrors(memory.errors);

  // Format ReAct trace (last 3 snapshots)
  const traceText = formatReActTrace(snapshots);

  return `## Current Exploration Task

**Company**: ${task.company.name} ${task.company.industry ? `(${task.company.industry})` : ''}
**Website**: ${task.companyWebsite || 'Unknown - discover from search'}
**Target Content**: ${task.contentTypes.join(', ')}
**Current URL**: ${context.currentUrl || 'None yet'}

## Iteration Progress

- **Iteration**: ${iteration.iteration + 1} of ${iteration.maxIterations}
- **Pages Visited**: ${memory.pagesVisited.length}
${pagesText}

- **Discoveries**: ${memory.discoveryCount}
${discoveriesText}

- **Network Calls Captured**: ${networkCalls.length}
${networkText}

- **Errors**: ${memory.errors.length}
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

function formatReActTrace(snapshots: import('../../../types').IterationSnapshot[]): string {
  if (snapshots.length === 0) return '  (Fresh start - no reasoning yet)';

  return snapshots
    .slice(-3)
    .map((step) => {
      let text = `Step ${step.stepNumber}: ${step.thought}`;
      text += `\n  Action: ${step.decision?.action}`;
      if (step.observation) {
        text += `\n  Observation: ${step.observation}`;
      }
      if (step.reflectionNotes) {
        text += `\n  Reflection: ${step.reflectionNotes}`;
      }
      return text;
    })
    .join('\n\n');
}