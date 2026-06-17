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
import { parseToolResult, buildFetchConfig } from '@/lib/ai/agents/explorer';
import { EXPLORER_CONSTANTS, TERMINAL_ACTIONS } from '@/lib/ai/agents/explorer/constants';
import { explorerComplete, isExplorerAgentAIConfigured } from '@/lib/ai/client';
import type { ExplorationState, ReActStep, LLMSDecision, Discovery } from '@/lib/ai/agents/explorer/types';
import type { ChatCompletionMessageParam } from 'openai/resources/index';

interface RunRequest {
  companyName: string;
  companyWebsite?: string;
  companyIndustry?: string;
  contentTypes: Array<'company_culture' | 'job_listing' | 'company_wechat'>;
  maxIterations?: number;
  taskId?: string;
  chromeExtensionUrl?: string; // If provided, uses real Chrome Extension
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
): Promise<{ decision: LLMSDecision; reactStep: ReActStep }> {
  const { systemPrompt, userPrompt } = buildPromptChain({
    state,
    includeReflection: state.reactTrace.length > 0,
  });

  const reflectionHint = state.reactTrace.length > 0
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

  const decision = JSON.parse(rawResponse);

  const reactStep: ReActStep = {
    stepNumber,
    thought: decision.reasoning,
    action: decision.action,
    actionInput: decision.target,
    timestamp: new Date(),
  };

  return { decision, reactStep };
}

/**
 * Simulate tool execution (when Chrome Extension is not available)
 * Returns mock data based on the action
 */
function simulateToolExecution(
  action: string,
  target: Record<string, unknown> | undefined,
  state: ExplorationState
): { output: string; newDiscoveries: Discovery[] } {
  const discoveries: Discovery[] = [];

  switch (action) {
    case 'NAVIGATE': {
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

    case 'GET_SNAPSHOT': {
      return {
        output: JSON.stringify({
          success: true,
          url: state.currentUrl || state.company.website,
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

    case 'GET_NETWORK_LOG': {
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

    case 'EXTRACT_DOM': {
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

    // Validate
    if (!companyName) {
      return NextResponse.json({ error: 'companyName is required' }, { status: 400 });
    }
    if (!contentTypes || contentTypes.length === 0) {
      return NextResponse.json({ error: 'contentTypes is required' }, { status: 400 });
    }

    // Initialize state
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

    // Check AI provider configuration
    if (!isExplorerAgentAIConfigured()) {
      return NextResponse.json(
        { error: 'Explorer Agent AI not configured. Please set NVIDIA_API_KEY or GROQ_API_KEY.' },
        { status: 500 }
      );
    }

    // Run the exploration loop
    const steps: StepResult[] = [];
    let state: ExplorationState = initialState;
    let stepNumber = 0;

    while (state.shouldContinue && state.iteration < state.maxIterations) {
      stepNumber++;

      // 1. Get LLM decision
      let decision: LLMSDecision;
      let reactStep: ReActStep;

      try {
        const result = await executeLLMLoop(state, stepNumber);
        decision = result.decision;
        reactStep = result.reactStep;
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        console.log("executeLLMLoop error:", errorMessage);
        // Fallback decision on error
        decision = {
          action: state.pagesVisited.length === 0 ? 'NAVIGATE' : 'GENERATE_CONFIG',
          target: {
            url: state.company.website || `https://www.${companyName.toLowerCase().replace(/\s+/g, '')}.com`,
          },
          reasoning: `Fallback due to error: ${errorMessage}`,
          confidence: 30,
        };
        reactStep = {
          stepNumber,
          thought: decision.reasoning,
          action: decision.action,
          actionInput: decision.target,
          timestamp: new Date(),
        };
      }

      // Add decision to state
      state = {
        ...state,
        currentDecision: decision,
        reactTrace: [...state.reactTrace, reactStep],
      };

      // Check termination
      const isTerminal = TERMINAL_ACTIONS.includes(decision.action as typeof TERMINAL_ACTIONS[number]);

      // Record step
      const stepResult: StepResult = {
        step: stepNumber,
        action: decision.action,
        reasoning: decision.reasoning,
        confidence: decision.confidence,
        target: decision.target as Record<string, unknown>,
      };

      // Execute tool if not terminal
      if (!isTerminal) {
        // Simulate or real tool execution
        if (chromeExtensionUrl) {
          // Real Chrome Extension execution would go here
          // For now, fall back to simulation
          stepResult.observation = 'Chrome Extension execution not yet implemented in this API';
        } else {
          // Simulate tool execution
          const { output, newDiscoveries } = simulateToolExecution(
            decision.action,
            decision.target as Record<string, unknown> | undefined,
            state
          );
          stepResult.observation = output;

          // Add discoveries
          if (newDiscoveries.length > 0) {
            state = {
              ...state,
              discoveries: [...state.discoveries, ...newDiscoveries],
            };
            stepResult.discoveries = state.discoveries.length;
          }
        }

        // Update iteration
        state = { ...state, iteration: state.iteration + 1 };

        // Set current URL if navigating
        if (decision.action === 'NAVIGATE' && decision.target?.url) {
          state = { ...state, currentUrl: decision.target.url as string };
          state = {
            ...state,
            pagesVisited: [
              ...state.pagesVisited,
              { url: decision.target.url as string, title: companyName, timestamp: new Date() },
            ],
          };
        }
      }

      steps.push(stepResult);

      // Check for termination
      if (decision.action === 'GENERATE_CONFIG' || decision.action === 'FAIL') {
        state = {
          ...state,
          shouldContinue: false,
          terminationReason: decision.action === 'GENERATE_CONFIG' ? 'generate_config' : 'fail',
        };
        break;
      }

      if (state.iteration >= state.maxIterations) {
        state = {
          ...state,
          shouldContinue: false,
          terminationReason: 'max_iterations',
        };
        break;
      }
    }

    // Generate final config if we have discoveries
    let finalConfig = null;
    if (state.discoveries.length > 0) {
      finalConfig = buildFetchConfig(state);
    }

    return NextResponse.json({
      success: true,
      taskId,
      company: state.company,
      iterations: state.iteration,
      totalSteps: steps.length,
      steps,
      discoveries: state.discoveries,
      finalResult: {
        success: state.discoveries.length > 0,
        taskId,
        status: state.terminationReason === 'fail' ? 'failed' :
                state.iteration >= state.maxIterations ? 'max_iterations' : 'complete',
        config: finalConfig,
        iterations: state.iteration,
        discoveries: state.discoveries,
        confidence: state.discoveries.length > 0
          ? Math.min(95, 50 + state.discoveries.length * 10)
          : 0,
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