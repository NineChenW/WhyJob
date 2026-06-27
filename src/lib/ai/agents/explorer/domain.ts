// src/lib/ai/agents/explorer/domain.ts

/**
 * Exploration State Wrapper
 *
 * Provides a clean API for state access and mutations.
 * All state operations go through this wrapper - no direct field access.
 *
 * Mutation methods modify internal state and return `this` for chaining.
 * Read methods provide typed access to state fields.
 */

import type {
  ExplorationState,
  TaskInfo,
  IterationControl,
  ExplorationMemory,
  IterationHistory,
  AgentContext,
  IterationSnapshot,
  LLMDecision,
  ToolCall,
  NetworkCall,
  Discovery,
  ExplorationError,
  PageVisit,
  ExplorationResultData,
  FetchConfig,
} from './types';
import {
  TERMINATION_REASON,
  EXPLORER_CONSTANTS,
} from './constants';

// ============================================
// Iteration Control Wrapper
// ============================================

export class IterationControlWrapper {
  constructor(private control: IterationControl) {}

  get iteration(): number {
    return this.control.iteration;
  }

  get maxIterations(): number {
    return this.control.maxIterations;
  }

  get shouldContinue(): boolean {
    return this.control.shouldContinue;
  }

  get terminationReason(): IterationControl['terminationReason'] {
    return this.control.terminationReason;
  }

  get progress(): string {
    return `${this.control.iteration + 1} of ${this.control.maxIterations}`;
  }

  get isMaxReached(): boolean {
    return this.control.iteration >= this.control.maxIterations;
  }

  get isFirstIteration(): boolean {
    return this.control.iteration === 0;
  }
}

// ============================================
// Task Info Wrapper
// ============================================

export class TaskInfoWrapper {
  constructor(private task: TaskInfo) {}

  get taskId(): string {
    return this.task.taskId;
  }

  get companyId(): string {
    return this.task.companyId;
  }

  get company(): TaskInfo['company'] {
    return this.task.company;
  }

  get contentTypes(): TaskInfo['contentTypes'] {
    return this.task.contentTypes;
  }

  get companyName(): string {
    return this.task.company.name;
  }

  get companyWebsite(): string | undefined {
    return this.task.company.website;
  }
}

// ============================================
// Exploration Memory Wrapper
// ============================================

export class ExplorationMemoryWrapper {
  constructor(private memory: ExplorationMemory) {}

  get pagesVisited(): PageVisit[] {
    return this.memory.pagesVisited;
  }

  get discoveries(): Discovery[] {
    return this.memory.discoveries;
  }

  get errors(): ExplorationError[] {
    return this.memory.errors;
  }

  get discoveryCount(): number {
    return this.memory.discoveries.length;
  }

  get lastDiscovery(): Discovery | undefined {
    return this.memory.discoveries[this.memory.discoveries.length - 1];
  }

  get lastPageVisit(): PageVisit | undefined {
    return this.memory.pagesVisited[this.memory.pagesVisited.length - 1];
  }

  get hasApiDiscovery(): boolean {
    return this.memory.discoveries.some((d) => d.type === 'api_endpoint');
  }

  get hasJobDiscovery(): boolean {
    return this.memory.discoveries.some(
      (d) => d.type === 'job_data' || d.type === 'webpage'
    );
  }

  get hasAnyDiscovery(): boolean {
    return this.memory.discoveries.length > 0;
  }

  getErrorsForIteration(iteration: number): ExplorationError[] {
    return this.memory.errors.filter((e) => e.iteration === iteration);
  }

  getRecentErrors(count: number): ExplorationError[] {
    return this.memory.errors.slice(-count);
  }

  hasRecentErrorsInLastN(iterations: number): boolean {
    const lastN = this.memory.errors.slice(-iterations * 3);
    const uniqueIterations = new Set(lastN.map((e) => e.iteration));
    return uniqueIterations.size >= iterations;
  }

  /**
   * Calculate overall confidence from discoveries
   */
  calculateConfidence(): number {
    const discoveries = this.memory.discoveries;
    if (discoveries.length === 0) return 0;

    const avgConfidence = discoveries.reduce((sum, d) => sum + d.confidence, 0) / discoveries.length;

    // Boost for API endpoints
    const hasApi = this.hasApiDiscovery;
    const boost = hasApi ? 15 : 0;

    // Reduce for errors
    const errorCount = discoveries.filter((d) => d.type === 'no_content' || !d.confidence).length;
    const penalty = errorCount * 5;

    return Math.max(0, Math.min(100, avgConfidence + boost - penalty));
  }
}

// ============================================
// Iteration Snapshot Wrapper
// ============================================

export class IterationSnapshotWrapper {
  constructor(private snapshot: IterationSnapshot) {}

  get stepNumber(): number {
    return this.snapshot.stepNumber;
  }

  get thought(): string {
    return this.snapshot.thought;
  }

  get decision(): LLMDecision | undefined {
    return this.snapshot.decision;
  }

  get toolCall(): ToolCall | undefined {
    return this.snapshot.toolCall;
  }

  get networkCalls(): NetworkCall[] {
    return this.snapshot.networkCalls;
  }

  get observation(): string | undefined {
    return this.snapshot.observation;
  }

  get reflectionNotes(): string | undefined {
    return this.snapshot.reflectionNotes;
  }

  get timestamp(): Date {
    return this.snapshot.timestamp;
  }

  get hasToolCall(): boolean {
    return this.snapshot.toolCall !== undefined;
  }

  get isPending(): boolean {
    return this.snapshot.toolCall?.status === 'pending';
  }

  get isCompleted(): boolean {
    return this.snapshot.toolCall?.status === 'completed';
  }

  get isFailed(): boolean {
    return this.snapshot.toolCall?.status === 'failed';
  }

  get toolCallDuration(): number {
    return this.snapshot.toolCall?.duration ?? 0;
  }

  get networkCallCount(): number {
    return this.snapshot.networkCalls.length;
  }

  get action(): string | undefined {
    return this.snapshot.decision?.action;
  }

  get isTerminalAction(): boolean {
    const action = this.action;
    return action === 'GENERATE_CONFIG' || action === 'FAIL';
  }
}

// ============================================
// Iteration History Wrapper
// ============================================

export class IterationHistoryWrapper {
  constructor(private history: IterationHistory) {}

  get snapshots(): IterationSnapshot[] {
    return this.history.snapshots;
  }

  get waitingForExtensionResult(): boolean | undefined {
    return this.history.waitingForExtensionResult;
  }

  get snapshotCount(): number {
    return this.history.snapshots.length;
  }

  get lastSnapshot(): IterationSnapshot | undefined {
    return this.history.snapshots[this.history.snapshots.length - 1];
  }

  get lastToolCall(): ToolCall | undefined {
    return this.lastSnapshot?.toolCall;
  }

  get allToolCalls(): ToolCall[] {
    return this.history.snapshots
      .map((s) => s.toolCall)
      .filter((c): c is ToolCall => c !== undefined);
  }

  get allNetworkCalls(): NetworkCall[] {
    return this.history.snapshots.flatMap((s) => s.networkCalls);
  }

  get hasPendingTool(): boolean {
    return this.lastSnapshot?.toolCall?.status === 'pending';
  }

  get completedSnapshots(): IterationSnapshot[] {
    return this.history.snapshots.filter(
      (s) => s.toolCall?.status === 'completed'
    );
  }

  get isWaitingForExtension(): boolean {
    return this.history.waitingForExtensionResult === true;
  }
}

// ============================================
// Agent Context Wrapper
// ============================================

export class AgentContextWrapper {
  constructor(private context: AgentContext) {}

  get currentUrl(): string | undefined {
    return this.context.currentUrl;
  }

  get pendingMonitoringId(): string | undefined {
    return this.context.pendingMonitoringId;
  }
}

// ============================================
// Main State Wrapper
// ============================================

export class ExplorationStateWrapper {
  constructor(private state: ExplorationState) {}

  // ============================================
  // Read Accessors
  // ============================================

  get task(): TaskInfoWrapper {
    return new TaskInfoWrapper(this.state.task);
  }

  get iteration(): IterationControlWrapper {
    return new IterationControlWrapper(this.state.iteration);
  }

  get memory(): ExplorationMemoryWrapper {
    return new ExplorationMemoryWrapper(this.state.memory);
  }

  get history(): IterationHistoryWrapper {
    return new IterationHistoryWrapper(this.state.history);
  }

  get context(): AgentContextWrapper {
    return new AgentContextWrapper(this.state.context);
  }

  get result(): ExplorationResultData | undefined {
    return this.state.result;
  }

  get startTime(): Date {
    return this.state.startTime;
  }

  // Raw state access (for LangGraph serialization)
  get raw(): ExplorationState {
    return this.state;
  }

  // ============================================
  // State Query Methods
  // ============================================

  isFirstIteration(): boolean {
    return this.history.snapshotCount === 0;
  }

  isTerminated(): boolean {
    return !this.iteration.shouldContinue;
  }

  hasDiscoveries(): boolean {
    return this.memory.hasAnyDiscovery;
  }

  shouldGenerateConfig(): boolean {
    return this.memory.hasJobDiscovery || this.memory.hasApiDiscovery;
  }

  hasPendingToolCall(): boolean {
    return this.history.hasPendingTool;
  }

  isWaitingForExtension(): boolean {
    return this.history.isWaitingForExtension;
  }

  get lastDecision(): LLMDecision | undefined {
    return this.history.lastSnapshot?.decision;
  }

  get lastAction(): string | undefined {
    return this.history.lastSnapshot?.decision?.action;
  }

  isTerminalAction(): boolean {
    const action = this.lastAction;
    return action === 'GENERATE_CONFIG' || action === 'FAIL';
  }

  // ============================================
  // Mutation Methods (modify state, return this)
  // ============================================

  /**
   * Record LLM decision - creates new iteration snapshot
   */
  recordDecision(decision: LLMDecision): this {
    const snapshot: IterationSnapshot = {
      stepNumber: this.state.history.snapshots.length + 1,
      thought: decision.reasoning,
      decision,
      toolCall: undefined,
      networkCalls: [],
      observation: undefined,
      reflectionNotes: undefined,
      timestamp: new Date(),
    };
    this.state.history.snapshots.push(snapshot);
    return this;
  }

  /**
   * Record page navigation and visit
   */
  navigateTo(url: string, pageTitle: string): this {
    this.state.context.currentUrl = url;
    this.state.memory.pagesVisited.push({
      url,
      title: pageTitle,
      timestamp: new Date(),
    });
    return this;
  }

  /**
   * Record discoveries found during exploration
   */
  addDiscoveries(discoveries: Discovery[]): this {
    this.state.memory.discoveries.push(...discoveries);
    return this;
  }

  /**
   * Advance to next iteration
   */
  advanceIteration(): this {
    this.state.iteration.iteration += 1;
    return this;
  }

  /**
   * Terminate exploration
   */
  terminate(reason: IterationControl['terminationReason']): this {
    this.state.iteration.shouldContinue = false;
    this.state.iteration.terminationReason = reason;
    return this;
  }

  /**
   * Set waiting for extension result flag
   */
  setWaitingForExtension(waiting: boolean): this {
    this.state.history.waitingForExtensionResult = waiting;
    return this;
  }

  /**
   * Complete pending tool call from extension result
   */
  completePendingToolCall(output: unknown, error?: string): this {
    const lastSnapshot = this.history.lastSnapshot;
    if (lastSnapshot?.toolCall?.status === 'pending') {
      lastSnapshot.toolCall = {
        ...lastSnapshot.toolCall,
        output,
        error,
        status: error ? 'failed' : 'completed',
      };
    }
    return this;
  }

  /**
   * Update last snapshot with tool call result
   */
  recordToolResult(toolCall: ToolCall, observation: string, networkCalls: NetworkCall[]): this {
    const lastSnapshot = this.history.lastSnapshot;
    if (lastSnapshot) {
      lastSnapshot.toolCall = toolCall;
      lastSnapshot.observation = observation;
      lastSnapshot.networkCalls = networkCalls;
    }
    return this;
  }

  /**
   * Set observation on last snapshot
   */
  setObservation(observation: string): this {
    const lastSnapshot = this.history.lastSnapshot;
    if (lastSnapshot) {
      lastSnapshot.observation = observation;
    }
    return this;
  }

  /**
   * Set reflection notes on last snapshot
   */
  setReflection(reflection: string): this {
    const lastSnapshot = this.history.lastSnapshot;
    if (lastSnapshot) {
      lastSnapshot.reflectionNotes = reflection;
    }
    return this;
  }

  /**
   * Record error
   */
  addError(error: ExplorationError): this {
    this.state.memory.errors.push(error);
    return this;
  }

  /**
   * Set monitoring ID
   */
  setMonitoringId(id: string | undefined): this {
    this.state.context.pendingMonitoringId = id;
    return this;
  }

  /**
   * Set result data
   */
  setResult(result: ExplorationResultData): this {
    this.state.result = result;
    return this;
  }

  // ============================================
  // Partial State Export
  // ============================================

  /**
   * Extract Partial<ExplorationState> for LangGraph
   */
  toPartial(): Partial<ExplorationState> {
    return {
      task: this.state.task,
      iteration: this.state.iteration,
      memory: this.state.memory,
      history: this.state.history,
      context: this.state.context,
      result: this.state.result,
      startTime: this.state.startTime,
    };
  }
}