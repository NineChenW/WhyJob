// src/app/api/explorer/run/route.ts

/**
 * Explorer Agent Run API
 *
 * Directly invokes the Explorer Agent and returns step-by-step progress.
 * For testing the AI exploration loop without the full Chrome Extension infrastructure.
 */

import { NextRequest, NextResponse } from 'next/server';
import { initializeExplorationState } from '@/lib/ai/agents/explorer/graph';
import { buildPromptChain, DECISION_JSON_SCHEMA } from '@/lib/ai/agents/explorer/prompts';
import { buildFetchConfig } from '@/lib/ai/agents/explorer';
import { EXPLORER_CONSTANTS, EXPLORATION_ACTION, TERMINAL_ACTIONS } from '@/lib/ai/agents/explorer/constants';
import { explorerComplete, isExplorerAgentAIConfigured } from '@/lib/ai/client';
import { ExplorationStateWrapper } from '@/lib/ai/agents/explorer/domain';
import type { ExplorationState, LLMDecision, Discovery, IterationSnapshot } from '@/lib/ai/agents/explorer/types';
import type { ChatCompletionMessageParam } from 'openai/resources/index';

interface RunRequest {
  companyName: string;
  companyWebsite?: string;
  companyIndustry?: string;
  contentTypes: Array<'company_culture' | 'job_listing' | 'company_wechat'>;
  maxIterations?: number;
  taskId?: string;
  chromeExtensionUrl?: string;
}

interface StepResult {
  step: number;
  action: string;
  reasoning: string;
  confidence: number;
  target?: Record<string, unknown>;
  observation?: string;
  discoveries?: number;
  error?: string;
}

/**
 * Execute a single LLM decision loop
 */
async function executeLLMLoop(
  state: ExplorationState,
  stepNumber: number
): Promise<{ decision: LLMDecision; snapshot: IterationSnapshot }> {
  const wrapper = new ExplorationStateWrapper(state);
  const includeReflection = !wrapper.isFirstIteration();

  const { systemPrompt, userPrompt } = buildPromptChain({
    state,
    includeReflection,
  });

  const reflectionHint = includeReflection
    ? '\n\n[Reflection] Consider if previous actions led to progress. Adjust strategy if needed.'
    : '';

  const messages: ChatCompletionMessageParam[] = [
    { role: 'system', content: systemPrompt },
    { role: 'user', content: userPrompt + reflectionHint },
  ];

  const result = await explorerComplete({
    messages,
    response_format: { type: 'json_schema', json_schema: DECISION_JSON_SCHEMA },
  });

  const rawResponse = result.content;
  if (!rawResponse) throw new Error('Empty AI response');

  const decision = JSON.parse(rawResponse) as LLMDecision;

  const snapshot: IterationSnapshot = {
    stepNumber,
    thought: decision.reasoning,
    decision,
    toolCall: undefined,
    networkCalls: [],
    timestamp: new Date(),
  };

  return { decision, snapshot };
}

/**
 * Simulate tool execution (when Chrome Extension is not available)
 */
function simulateToolExecution(
  action: string,
  target: Record<string, unknown> | undefined,
  wrapper: ExplorationStateWrapper
): { output: string; newDiscoveries: Discovery[] } {
  switch (action) {
    case EXPLORATION_ACTION.NAVIGATE: {
      const url = target?.url as string;
      return {
        output: JSON.stringify({
          success: true,
          url,
          title: url.includes('stripe') ? 'Stripe Jobs' : 'Company Careers',
          visibleText: 'Join our team... We are hiring...',
        }),
        newDiscoveries: [],
      };
    }

    case EXPLORATION_ACTION.GET_SNAPSHOT: {
      return {
        output: JSON.stringify({
          success: true,
          url: wrapper.context.currentUrl || wrapper.task.companyWebsite,
          title: 'Careers Page',
          visibleText: 'Open Positions\n\nSenior Engineer\n- 5+ years experience\n- Python, React\n\nProduct Manager\n- 3+ years experience\n\nView All Jobs →',
        }),
        newDiscoveries: [{
          id: `discovery-${Date.now()}`,
          type: 'job_data',
          data: { positions: 12, departments: ['Engineering', 'Product'] },
          confidence: 85,
          timestamp: new Date(),
        }],
      };
    }

    case EXPLORATION_ACTION.GET_NETWORK_LOG: {
      return {
        output: JSON.stringify({
          success: true,
          calls: [
            { url: 'https://api.stripe.com/v1/jobs', method: 'GET', status: 200 },
            { url: 'https://api.stripe.com/v1/departments', method: 'GET', status: 200 },
          ],
          totalCallsCaptured: 2,
        }),
        newDiscoveries: [{
          id: `discovery-${Date.now()}`,
          type: 'api_endpoint',
          url: 'https://api.stripe.com/v1/jobs',
          data: { method: 'GET', responseType: 'json' },
          confidence: 90,
          timestamp: new Date(),
        }],
      };
    }

    case EXPLORATION_ACTION.EXTRACT_DOM: {
      return {
        output: JSON.stringify({
          success: true,
          elements: {
            jobTitle: ['Senior Engineer', 'Product Manager', 'Staff Designer'],
            department: ['Engineering', 'Product', 'Design'],
            location: ['San Francisco', 'New York', 'Remote'],
          },
        }),
        newDiscoveries: [{
          id: `discovery-${Date.now()}`,
          type: 'job_data',
          data: { positions: 15, extracted: true },
          confidence: 88,
          timestamp: new Date(),
        }],
      };
    }

    default:
      return {
        output: JSON.stringify({ success: true, message: 'Action completed' }),
        newDiscoveries: [],
      };
  }
}

export async function POST(request: NextRequest) {
  try {
    const body: RunRequest = await request.json();
    const {
      companyName,
      companyWebsite,
      companyIndustry,
      contentTypes,
      maxIterations = 5,
      taskId = `task-${Date.now()}`,
      chromeExtensionUrl,
    } = body;

    if (!companyName) {
      return NextResponse.json({ error: 'companyName is required' }, { status: 400 });
    }
    if (!contentTypes || contentTypes.length === 0) {
      return NextResponse.json({ error: 'contentTypes is required' }, { status: 400 });
    }

    const initialState = initializeExplorationState({
      taskId,
      companyId: `company-${Date.now()}`,
      company: {
        id: `company-${Date.now()}`,
        name: companyName,
        website: companyWebsite || `https://www.${companyName.toLowerCase().replace(/\s+/g, '')}.com`,
        industry: companyIndustry,
      },
      contentTypes,
      maxIterations,
    });

    if (!isExplorerAgentAIConfigured()) {
      return NextResponse.json(
        { error: 'Explorer Agent AI not configured. Please set NVIDIA_API_KEY or GROQ_API_KEY.' },
        { status: 500 }
      );
    }

    const steps: StepResult[] = [];
    let wrapper = new ExplorationStateWrapper(initialState);
    let stepNumber = 0;

    while (wrapper.iteration.shouldContinue && wrapper.iteration.iteration < wrapper.iteration.maxIterations) {
      stepNumber++;

      let decision: LLMDecision;
      let snapshot: IterationSnapshot;

      try {
        const result = await executeLLMLoop(wrapper.raw, stepNumber);
        decision = result.decision;
        snapshot = result.snapshot;
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        console.log("executeLLMLoop error:", errorMessage);

        const fallbackUrl = wrapper.task.companyWebsite ||
          `https://www.${companyName.toLowerCase().replace(/\s+/g, '')}.com`;

        decision = {
          action: wrapper.memory.pagesVisited.length === 0 ? EXPLORATION_ACTION.NAVIGATE : EXPLORATION_ACTION.GENERATE_CONFIG,
          target: { url: fallbackUrl },
          reasoning: `Fallback due to error: ${errorMessage}`,
          confidence: EXPLORER_CONSTANTS.LOW_CONFIDENCE,
        };
        snapshot = {
          stepNumber,
          thought: decision.reasoning,
          decision,
          toolCall: undefined,
          networkCalls: [],
          timestamp: new Date(),
        };
      }

      // Record the decision
      wrapper.recordDecision(decision);

      const isTerminal = TERMINAL_ACTIONS.includes(decision.action as typeof TERMINAL_ACTIONS[number]);

      const stepResult: StepResult = {
        step: stepNumber,
        action: decision.action,
        reasoning: decision.reasoning,
        confidence: decision.confidence,
        target: decision.target as Record<string, unknown>,
      };

      if (!isTerminal) {
        if (chromeExtensionUrl) {
          stepResult.observation = 'Chrome Extension execution not yet implemented in this API';
        } else {
          const { output, newDiscoveries } = simulateToolExecution(
            decision.action,
            decision.target as Record<string, unknown> | undefined,
            wrapper
          );
          stepResult.observation = output;

          if (newDiscoveries.length > 0) {
            wrapper.addDiscoveries(newDiscoveries);
            stepResult.discoveries = wrapper.memory.discoveryCount;
          }
        }

        // Advance iteration
        wrapper.advanceIteration();

        // Handle navigation
        if (decision.action === EXPLORATION_ACTION.NAVIGATE && decision.target?.url) {
          wrapper.navigateTo(decision.target.url as string, companyName);
        }
      }

      steps.push(stepResult);

      // Check termination conditions
      if (decision.action === EXPLORATION_ACTION.GENERATE_CONFIG || decision.action === EXPLORATION_ACTION.FAIL) {
        wrapper.terminate(decision.action === EXPLORATION_ACTION.GENERATE_CONFIG ? 'generate_config' : 'fail');
        break;
      }

      if (wrapper.iteration.isMaxReached) {
        wrapper.terminate('max_iterations');
        break;
      }
    }

    const finalConfig = buildFetchConfig(wrapper.raw);

    return NextResponse.json({
      success: true,
      taskId,
      company: wrapper.task.company,
      iterations: wrapper.iteration.iteration,
      totalSteps: steps.length,
      steps,
      discoveries: wrapper.memory.discoveries,
      finalResult: {
        success: wrapper.hasDiscoveries(),
        taskId,
        status: wrapper.iteration.terminationReason === 'fail' ? 'failed' :
                wrapper.iteration.isMaxReached ? 'max_iterations' : 'complete',
        config: finalConfig ?? undefined,
        confidence: wrapper.memory.calculateConfidence(),
      },
    });
  } catch (error) {
    console.error('[explorer/run] Error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal error' },
      { status: 500 }
    );
  }
}