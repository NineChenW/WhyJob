Key Architecture Changes

1. Proper ReAct Prompt Chain

System Prompt (role, rules, available tools) +
Context Prompt (dynamic state: pages, discoveries, network calls, errors) +
ReAct Reasoning Prompt (Thought/Action/Confidence pattern)
│
▼
Groq LLM (structured JSON output)
│
▼
{ action, target, reasoning, confidence } 

2. 6-Node LangGraph Graph

llm_decision → check_termination ─┬─→ execute_tool → observe_result → reflect ─┐
                                  │
                                  ├─→ generate_config → END (success)
                                  │
                                  └─→ END (fail/max_iterations) 


3. Chrome Extension as LangGraph Tool

class ChromeExtensionTool implements Tool {
name = 'chrome_extension';
description = 'Control Chrome browser for web exploration...';

async invoke(input: { action: string; params?: Record<string, unknown> }): Promise<ToolResult>;
} 

4. Extensibility Points

Memory: IExplorationMemory interface (checkpoint, restore, retrieveSimilar)
Tools: Chrome Extension + pluggable custom tools
Skills: ISkill interface with SkillRegistry
RAG: IRAGRetriever interface (index, query, delete)
MCP: IMCPClient interface (connect, listTools, callTool) 5. Iteration Guard (5 max)
check_termination node evaluates:
Terminal LLM decision (GENERATE_CONFIG / FAIL)
Max iterations reached
Too many consecutive errors (≥3 after iteration ≥2)



Spec06:

Bro, I've implemented the Explorer Agent - AI Exploration Agent Spec (Iteration 6) according to the spec. Here's what was built:

Summary of Implementation
Files Created

src/lib/ai/agents/explorer/
├── types.ts                    # ExplorationState, LLMSDecision, Discovery, etc.
├── constants.ts                # EXPLORER_CONSTANTS, DEFAULT_SELECTORS
├── prompts/
│   ├── index.ts               # Prompt chain builder
│   ├── system-prompt.ts      # Static system prompt
│   ├── context-prompt.ts     # Dynamic state builder
│   ├── react-prompt.ts       # ReAct reasoning template
│   └── schemas.ts            # Groq decision schema with Zod validation
├── nodes/
│   ├── index.ts              # Node exports
│   ├── llm-decision.ts      # LLM decision node with Groq integration
│   ├── check-termination.ts # Iteration guard node
│   ├── execute-tool.ts      # Chrome Extension tool execution
│   ├── observe-result.ts    # Tool output parsing
│   ├── reflect.ts           # Self-correction node
│   └── generate-config.ts   # FetchConfig generation
├── tools/
│   └── chrome-extension.ts # Chrome Extension Tool for LangGraph
├── result-parser.ts         # Tool output parsing
├── fetchconfig-generator.ts # Discovery → FetchConfig
├── graph.ts                  # LangGraph StateGraph definition
└── index.ts                 # Public exports

src/lib/ai/client.ts           # Groq client integration
Key Features
ReAct Pattern with 6-node LangGraph StateGraph
Prompt Chain: System + Context + ReAct reasoning
6 Node Types: llm_decision → check_termination → execute_tool → observe_result → reflect → (loop or generate_config)
Chrome Extension Tool integrated as LangGraph tool
Groq Integration with structured JSON output and Zod validation
FetchConfig Generator that transforms discoveries into actionable configs
Iteration Guard (5 max iterations, error threshold)
Build Status

✓ Compiled successfully
✓ TypeScript passed
✓ Build passes
New Dependencies
@langchain/langgraph - LangGraph for agent orchestration
@langchain/core - Core LangChain types
openai - OpenAI SDK (for Groq API)
zod - Schema validation
Files modified: package.json, package-lock.json, context/current-feature.md


Summary of AI Provider Abstraction
New Files Created

src/lib/ai/providers/
├── index.ts          # Provider factory, AIClient class, convenience exports
├── types.ts          # AIProvider interface, CompletionParams, ModelConfig
├── config.ts         # Provider configs (Groq, Anthropic, OpenAI) + model lists
└── groq.ts           # Groq provider implementation
Architecture

┌─────────────────────────────────────────────────────────┐
│                      AI Client Layer                     │
│  ┌─────────────────────────────────────────────────┐    │
│  │  AIClient / createCompletion()                  │    │
│  └─────────────────────────────────────────────────┘    │
│                         │                                │
│         ┌───────────────┼───────────────┐               │
│         ▼               ▼               ▼               │
│  ┌──────────┐  ┌────────────┐  ┌────────────┐        │
│  │   Groq    │  │ Anthropic  │  │  OpenAI    │        │
│  │ Provider  │  │  Provider  │  │  Provider  │        │
│  └──────────┘  └────────────┘  └────────────┘        │
│         ▲                                                │
│         │        src/lib/ai/client.ts                  │
└─────────┼────────────────────────────────────────────────┘
          │                    │
          ▼                    ▼
┌─────────────────────────────────────┐
│       Explorer Agent Nodes          │
│  llm-decision.ts etc.              │
└─────────────────────────────────────┘
Configuration (src/lib/ai/providers/config.ts)
Provider	Models Available	Default Model
Groq	llama-3.3-70b-versatile, llama-3.1-70b-versatile, mixtral-8x7b, llama-3.2-3b-preview	llama-3.3-70b-versatile
Anthropic	claude-sonnet-4, claude-opus-4, claude-3.5-sonnet, claude-3.5-haiku	claude-sonnet-4
OpenAI	gpt-4o, gpt-4o-mini, gpt-4-turbo, o1-preview	gpt-4o
Usage

// Option 1: Using AIClient class
import { AIClient, EXPLORER_MODEL_CONFIG } from '@/lib/ai/client';

const client = new AIClient('groq'); // or 'anthropic', 'openai'
const result = await client.complete({
  model: 'llama-3.3-70b-versatile',
  messages: [{ role: 'user', content: 'Hello' }],
});

// Option 2: Using convenience function
import { createCompletion } from '@/lib/ai/client';

const result = await createCompletion({
  model: 'gpt-4o',
  messages: [{ role: 'user', content: 'Hello' }],
}, 'openai');

// Option 3: Switch provider at runtime
client.setProvider('anthropic');
Adding a New Provider
Create src/lib/ai/providers/anthropic.ts implementing AIProvider interface
Add provider config to src/lib/ai/providers/config.ts
Register in src/lib/ai/providers/index.ts switch statement



Refactored schemas.ts to be Provider-Agnostic
Before	After
GROQ_DECISION_SCHEMA (Groq-specific)	DECISION_JSON_SCHEMA (generic JSON Schema)
groqDecisionSchema	decisionSchema (provider-agnostic Zod schema)
Type GroqDecision	Type ExplorerDecision
No explicit prompt instruction	Added JSON_MODE_PROMPT_INSTRUCTION for providers without native schema support
New Exports

// Provider-agnostic Zod schema (source of truth)
export const decisionSchema: z.ZodObject<...>
export type ExplorerDecision = z.infer<typeof decisionSchema>

// JSON Schema for OpenAI/Groq structured output
export const DECISION_JSON_SCHEMA: { name: 'exploration_decision'; schema: {...} }

// Prompt instruction for providers without structured output support
export const JSON_MODE_PROMPT_INSTRUCTION: string

// Enum exports for reuse
export const EXPLORER_ACTIONS: readonly ['NAVIGATE', 'GET_SNAPSHOT', ...]
export const NETWORK_STATUS_RANGES: readonly ['2xx', '3xx', '4xx', '5xx']

// Parsing function that works with any provider
export function parseDecisionResponse(rawResponse: string): ExplorerDecision
How Different Providers Work Now

// For OpenAI/Groq (supports JSON schema)
aiClient.complete({
  response_format: { type: 'json_schema', json_schema: DECISION_JSON_SCHEMA }
});

// For Anthropic (no JSON schema, uses prompt instruction)
aiClient.complete({
  messages: [
    { role: 'system', content: SYSTEM_PROMPT + JSON_MODE_PROMPT_INSTRUCTION },
    { role: 'user', content: ... }
  ]
});
// Then parse with: parseDecisionResponse(result.content)