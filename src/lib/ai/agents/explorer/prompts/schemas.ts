// src/lib/ai/agents/explorer/prompts/schemas.ts

/**
 * Provider-Agnostic Decision Schemas
 *
 * The Zod schema is the source of truth for validation.
 * Provider-specific response formats are configured separately.
 */

import { z } from 'zod';

/**
 * Explorer Agent Action Types
 */
export const EXPLORER_ACTIONS = [
  'NAVIGATE',
  'GET_SNAPSHOT',
  'EXTRACT_DOM',
  'EXECUTE_JS',
  'START_NETWORK_MONITORING',
  'GET_NETWORK_LOG',
  'STOP_NETWORK_MONITORING',
  'ANALYZE_DATA',
  'GENERATE_CONFIG',
  'FAIL',
  'REFLECT',
] as const;

export type ExplorerAction = (typeof EXPLORER_ACTIONS)[number];

/**
 * Network filter configuration
 */
export const NETWORK_STATUS_RANGES = ['2xx', '3xx', '4xx', '5xx'] as const;

/**
 * Zod Schema for decision validation
 * This is provider-agnostic and used for parsing responses from any AI model
 */
export const decisionSchema = z.object({
  action: z.enum(EXPLORER_ACTIONS),
  target: z
    .object({
      url: z.string().optional(),
      selectors: z.record(z.string(), z.string()).optional(),
      script: z.string().optional(),
      args: z.record(z.string(), z.unknown()).optional(),
      monitoringId: z.string().optional(),
      filter: z
        .object({
          urlPattern: z.string().optional(),
          methods: z.array(z.string()).optional(),
          statusRange: z.enum(NETWORK_STATUS_RANGES).optional(),
        })
        .optional(),
    })
    .optional(),
  reasoning: z.string(),
  confidence: z.number().min(0).max(100),
});

export type ExplorerDecision = z.infer<typeof decisionSchema>;

/**
 * JSON Schema representation for providers that support it
 * (OpenAI, Groq)
 */
export const DECISION_JSON_SCHEMA = {
  name: 'exploration_decision',
  schema: {
    type: 'object',
    properties: {
      action: {
        type: 'string',
        enum: [...EXPLORER_ACTIONS],
        description: 'The action to take next',
      },
      target: {
        type: 'object',
        properties: {
          url: { type: 'string', description: 'URL for NAVIGATE action' },
          selectors: {
            type: 'object',
            additionalProperties: { type: 'string' },
            description: 'CSS selectors for EXTRACT_DOM action',
          },
          script: { type: 'string', description: 'JavaScript code for EXECUTE_JS action' },
          args: {
            type: 'object',
            additionalProperties: { type: 'object' },
            description: 'Arguments for the JavaScript script',
          },
          monitoringId: { type: 'string', description: 'Monitoring session ID for network actions' },
          filter: {
            type: 'object',
            properties: {
              urlPattern: { type: 'string' },
              methods: { type: 'array', items: { type: 'string' } },
              statusRange: { type: 'string', enum: [...NETWORK_STATUS_RANGES] },
            },
          },
        },
      },
      reasoning: {
        type: 'string',
        description: 'Why this action was chosen, considering current state and goals',
      },
      confidence: {
        type: 'number',
        minimum: 0,
        maximum: 100,
        description: 'Confidence that this action will lead to useful data (0-100)',
      },
    },
    required: ['action', 'reasoning', 'confidence'],
  },
};

/**
 * Prompt instruction for ensuring JSON output (for providers that don't support structured schemas)
 */
export const JSON_MODE_PROMPT_INSTRUCTION = `Your response MUST be a valid JSON object with the following structure:
{
  "action": "ACTION_NAME",
  "target": { /* action-specific parameters */ },
  "reasoning": "Why you chose this action",
  "confidence": 0-100
}

Do not include any text outside the JSON object.`;

/**
 * Parse and validate a raw response string into ExplorerDecision
 * Works with any AI provider's response
 */
export function parseDecisionResponse(rawResponse: string): ExplorerDecision {
  try {
    const parsed = JSON.parse(rawResponse);
    return decisionSchema.parse(parsed);
  } catch (error) {
    if (error instanceof z.ZodError) {
      const issues = error.issues;
      const message = issues.map((e) => e.message).join(', ');
      throw new Error(`Invalid decision format: ${message || error.message}`);
    }
    throw error;
  }
}

/**
 * Backwards compatibility alias
 * @deprecated Use decisionSchema instead
 */
export const groqDecisionSchema = decisionSchema;
export type GroqDecision = ExplorerDecision;