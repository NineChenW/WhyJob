// src/lib/ai/agents/explorer/types.ts

/**
 * Content types for exploration targets
 */
export type ContentType = 'company_culture' | 'job_listing' | 'company_wechat';

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
  type: ExplorationAction;
  input: Record<string, unknown>;
  output: unknown;
  error?: string;
  timestamp: Date;
  duration: number;
  requestId?: string;
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

// ============================================
// Domain-organized State (LangGraph-compatible)
// ============================================

/**
 * Task identity — who and what we're exploring
 */
export interface TaskInfo {
  taskId: string;
  companyId: string;
  company: {
    id: string;
    name: string;
    website?: string;
    industry?: string;
  };
  contentTypes: ContentType[];
}

/**
 * Iteration control — loop state
 */
export interface IterationControl {
  iteration: number;
  maxIterations: number;
  shouldContinue: boolean;
  terminationReason?: 'generate_config' | 'fail' | 'max_iterations';
}

/**
 * Collective memory — discoveries across all iterations
 */
export interface ExplorationMemory {
  pagesVisited: PageVisit[];
  discoveries: Discovery[];
  errors: ExplorationError[];
}

/**
 * LLM decision output
 */
export interface LLMDecision {
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
 * Per-iteration snapshot — ALL activity for ONE iteration together
 */
export interface IterationSnapshot {
  stepNumber: number;
  thought: string;
  decision: LLMDecision;
  toolCall?: ToolCall;
  networkCalls: NetworkCall[];
  observation?: string;
  reflectionNotes?: string;
  timestamp: Date;
}

/**
 * Iteration history — all snapshots in order
 */
export interface IterationHistory {
  snapshots: IterationSnapshot[];
  waitingForExtensionResult?: boolean;
}

/**
 * Agent context — current state
 */
export interface AgentContext {
  currentUrl?: string;
  pendingMonitoringId?: string;
}

/**
 * Final result data
 */
export interface ExplorationResultData {
  success: boolean;
  taskId: string;
  status: 'complete' | 'failed' | 'max_iterations';
  config?: FetchConfig;
  confidence: number;
  reason?: string;
}

/**
 * Exploration state for LangGraph — all domain data organized
 */
export interface ExplorationState {
  // Identity
  task: TaskInfo;

  // Loop control
  iteration: IterationControl;

  // Collective memory across iterations
  memory: ExplorationMemory;

  // Per-iteration breakdown (one snapshot = one iteration)
  history: IterationHistory;

  // Current context
  context: AgentContext;

  // Final output
  result?: ExplorationResultData;

  // Metadata
  startTime: Date;
}