// src/lib/ai/agents/explorer/types.ts

/**
 * Content types for exploration targets
 */
export type ContentType = 'company_culture' | 'job_listing' | 'company_wechat';

/**
 * Exploration state for LangGraph
 */
export interface ExplorationState {
  // Task Context
  taskId: string;
  companyId: string;
  company: {
    id: string;
    name: string;
    website?: string;
    industry?: string;
  };
  contentTypes: ContentType[];

  // Iteration Control
  iteration: number;
  maxIterations: number;

  // Memory & History
  pagesVisited: PageVisit[];
  discoveries: Discovery[];
  networkCalls: NetworkCall[];
  toolCalls: ToolCall[];
  errors: ExplorationError[];

  // ReAct Trace (the reasoning chain)
  reactTrace: ReActStep[];

  // Agent State
  currentUrl?: string;
  pendingMonitoringId?: string;

  // Decision from LLM
  currentDecision?: LLMSDecision;
  reflectionNotes?: string;

  // Termination
  shouldContinue: boolean;
  terminationReason?: 'generate_config' | 'fail' | 'max_iterations';
  finalResult?: ExplorationResult;

  // Resume tracking: set to true when an async tool was queued
  // and we should skip LLM call on re-invoke to complete the pending call
  waitingForExtensionResult?: boolean;

  // Metadata
  startTime: Date;
}

/**
 * ReAct reasoning step
 */
export interface ReActStep {
  stepNumber: number;
  thought: string; // Reasoning about current state
  action: string; // Action decided
  actionInput?: unknown; // Input to the action
  observation?: string; // Result of action (filled after tool execution)
  reflection?: string; // Self-correction notes
  timestamp: Date;
}

/**
 * LLM decision output
 */
export interface LLMSDecision {
  action: ExplorationAction;
  target?: {
    url?: string;
    selectors?: Record<string, string>;
    script?: string;
    args?: Record<string, unknown>;
    monitoringId?: string;
    filter?: NetworkFilter;
  };
  reasoning: string;
  confidence: number;
  reflectionPrompt?: string;
}

/**
 * Available exploration actions
 */
export type ExplorationAction =
  | 'NAVIGATE'
  | 'GET_SNAPSHOT'
  | 'EXTRACT_DOM'
  | 'EXECUTE_JS'
  | 'START_NETWORK_MONITORING'
  | 'GET_NETWORK_LOG'
  | 'STOP_NETWORK_MONITORING'
  | 'ANALYZE_DATA'
  | 'TEST_API'
  | 'GENERATE_CONFIG'
  | 'FAIL'
  | 'REFLECT';

/**
 * Network filter configuration
 */
export interface NetworkFilter {
  urlPattern?: string;
  methods?: string[];
  statusRange?: '2xx' | '3xx' | '4xx' | '5xx';
}

/**
 * Page visit record
 */
export interface PageVisit {
  url: string;
  title: string;
  timestamp: Date;
}

/**
 * Discovery types
 */
export type DiscoveryType =
  | 'api_endpoint'
  | 'webpage'
  | 'job_data'
  | 'culture_data'
  | 'requires_auth'
  | 'javascript_required'
  | 'no_content';

/**
 * Discovery record
 */
export interface Discovery {
  id: string;
  type: DiscoveryType;
  url?: string;
  data?: unknown;
  selectors?: Record<string, string>;
  requiresAuth?: boolean;
  reason?: string;
  confidence: number;
  timestamp: Date;
  metadata?: {
    responseType?: string;
    statusCode?: number;
    contentType?: string;
    parseHint?: string;
  };
}

/**
 * Network call record
 */
export interface NetworkCall {
  id: string;
  url: string;
  method: 'GET' | 'POST' | 'PUT' | 'DELETE';
  status: number;
  responseType: 'xhr' | 'fetch' | 'document' | 'other';
  timing: number;
  requestHeaders?: Record<string, string>;
  responseHeaders?: Record<string, string>;
  responseBody?: string;
  timestamp: Date;
}

/**
 * Tool call record
 */
export interface ToolCall {
  tool: ExplorationAction;
  input: Record<string, unknown>;
  output: unknown;
  error?: string;
  timestamp: Date;
  duration: number;
  requestId?: string; // For async tool correlation (extension results)
  status?: 'pending' | 'completed' | 'failed';
}

/**
 * Exploration error
 */
export interface ExplorationError {
  iteration: number;
  tool: ExplorationAction;
  error: string;
  timestamp: Date;
}

/**
 * Final exploration result
 */
export interface ExplorationResult {
  success: boolean;
  taskId: string;
  status: 'complete' | 'failed' | 'max_iterations';
  config?: FetchConfig;
  iterations: number;
  discoveries: Discovery[];
  confidence: number;
  reason?: string;
}

/**
 * FetchConfig for automated data collection
 */
export interface FetchConfig {
  companyId: string;
  name: string;
  contentType: ContentType;
  url: string;
  method: 'GET' | 'POST';
  headers: Record<string, string>;
  params: Record<string, string>;
  parseWith: 'json' | 'cheerio';
  selectors?: Record<string, string>;
  pagination?: {
    type: 'page' | 'offset' | 'cursor';
    paramName: string;
    maxPages: number;
    increment?: number;
    stopCondition?: string;
  };
  authRequired: boolean;
  authNote?: string;
  isActive: boolean;
  intervalHours?: number;
  confidence: number;
}

/**
 * Tool input for Chrome Extension
 */
export interface ToolInput {
  action: ExplorationAction;
  params?: Record<string, unknown>;
}

/**
 * Tool output from Chrome Extension
 */
export interface ToolOutput {
  success: boolean;
  url?: string;
  title?: string;
  html?: string;
  visibleText?: string;
  elements?: Record<string, unknown[]>;
  output?: string;
  error?: string;
  calls?: unknown[];
  monitoringId?: string;
  totalCallsCaptured?: number;
  duration?: number;
  timestamp: string;
}