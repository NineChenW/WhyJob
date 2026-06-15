/**
 * Explorer Agent Database Operations
 *
 * Prisma helpers for FetchTask and FetchConfig models.
 */

import { prisma } from '@/lib/prisma';
import type {
  FetchTask,
  FetchConfig,
  Prisma,
} from '@prisma/client';
import type {
  FetchTaskCreate,
  FetchTaskUpdate,
  FetchConfigCreate,
  TaskStatus,
  ContentType,
} from '@/schemas/explorer';

// ============================================
// FetchTask Operations
// ============================================

/**
 * Create a new fetch task
 */
export async function createFetchTask(
  data: FetchTaskCreate
): Promise<FetchTask> {
  return prisma.fetchTask.create({
    data: {
      companyId: data.companyId,
      contentTypes: data.contentTypes as string[],
      status: 'pending',
      iterations: 0,
    },
  });
}

/**
 * Get a fetch task by ID
 */
export async function getFetchTaskById(
  id: string
): Promise<FetchTask | null> {
  return prisma.fetchTask.findUnique({
    where: { id },
  });
}

/**
 * Get all tasks for a company
 */
export async function getFetchTasksByCompanyId(
  companyId: string
): Promise<FetchTask[]> {
  return prisma.fetchTask.findMany({
    where: { companyId },
    orderBy: { createdAt: 'desc' },
  });
}

/**
 * Get tasks by status
 */
export async function getFetchTasksByStatus(
  status: TaskStatus
): Promise<FetchTask[]> {
  return prisma.fetchTask.findMany({
    where: { status },
    orderBy: { createdAt: 'asc' },
  });
}

/**
 * Get pending tasks (for agent polling)
 * Returns tasks waiting for exploration
 */
export async function getPendingFetchTasks(
  limit = 10
): Promise<FetchTask[]> {
  return prisma.fetchTask.findMany({
    where: { status: 'pending' },
    orderBy: { createdAt: 'asc' },
    take: limit,
  });
}

/**
 * Update a fetch task
 */
export async function updateFetchTask(
  id: string,
  data: FetchTaskUpdate
): Promise<FetchTask> {
  const updateData: Prisma.FetchTaskUpdateInput = {
    ...data,
  };

  // Set completedAt when transitioning to complete/failed
  if (data.status === 'complete' || data.status === 'failed') {
    updateData.completedAt = new Date();
  }

  return prisma.fetchTask.update({
    where: { id },
    data: updateData,
  });
}

/**
 * Update task status only
 */
export async function updateFetchTaskStatus(
  id: string,
  status: TaskStatus,
  extra?: {
    reason?: string;
    confidence?: number;
  }
): Promise<FetchTask> {
  const data: Prisma.FetchTaskUpdateInput = {
    status,
    ...extra,
  };

  if (status === 'complete' || status === 'failed') {
    data.completedAt = new Date();
  }

  return prisma.fetchTask.update({
    where: { id },
    data,
  });
}

/**
 * Increment task iteration count
 */
export async function incrementFetchTaskIterations(
  id: string
): Promise<FetchTask> {
  return prisma.fetchTask.update({
    where: { id },
    data: {
      iterations: { increment: 1 },
    },
  });
}

/**
 * Mark task as complete with config
 */
export async function completeFetchTask(
  id: string,
  config: Prisma.InputJsonValue,
  confidence?: number
): Promise<FetchTask> {
  return prisma.fetchTask.update({
    where: { id },
    data: {
      status: 'complete',
      config,
      confidence,
      completedAt: new Date(),
    },
  });
}

/**
 * Mark task as failed
 */
export async function failFetchTask(
  id: string,
  reason: string
): Promise<FetchTask> {
  return prisma.fetchTask.update({
    where: { id },
    data: {
      status: 'failed',
      reason,
      completedAt: new Date(),
    },
  });
}

/**
 * Delete a fetch task
 */
export async function deleteFetchTask(id: string): Promise<FetchTask> {
  return prisma.fetchTask.delete({
    where: { id },
  });
}

// ============================================
// FetchConfig Operations
// ============================================

/**
 * Create a new fetch config
 */
export async function createFetchConfig(
  data: FetchConfigCreate
): Promise<FetchConfig> {
  return prisma.fetchConfig.create({
    data: {
      companyId: data.companyId,
      name: data.name,
      contentType: data.contentType as string,
      url: data.url,
      method: data.method,
      headers: data.headers as Prisma.InputJsonValue,
      params: data.params as Prisma.InputJsonValue,
      parseWith: data.parseWith,
      selectors: data.selectors as Prisma.InputJsonValue | undefined,
      pagination: data.pagination as Prisma.InputJsonValue | undefined,
      authRequired: data.authRequired,
      authNote: data.authNote,
      isActive: data.isActive,
      intervalHours: data.intervalHours,
    },
  });
}

/**
 * Get a fetch config by ID
 */
export async function getFetchConfigById(
  id: string
): Promise<FetchConfig | null> {
  return prisma.fetchConfig.findUnique({
    where: { id },
  });
}

/**
 * Get all configs for a company
 */
export async function getFetchConfigsByCompanyId(
  companyId: string
): Promise<FetchConfig[]> {
  return prisma.fetchConfig.findMany({
    where: { companyId },
    orderBy: { createdAt: 'desc' },
  });
}

/**
 * Get config by company and content type (unique constraint)
 */
export async function getFetchConfigByCompanyAndType(
  companyId: string,
  contentType: ContentType
): Promise<FetchConfig | null> {
  return prisma.fetchConfig.findUnique({
    where: {
      companyId_contentType: {
        companyId,
        contentType: contentType as string,
      },
    },
  });
}

/**
 * Get active configs for a company
 */
export async function getActiveFetchConfigs(
  companyId: string
): Promise<FetchConfig[]> {
  return prisma.fetchConfig.findMany({
    where: {
      companyId,
      isActive: true,
    },
    orderBy: { createdAt: 'desc' },
  });
}

/**
 * Update a fetch config
 */
export async function updateFetchConfig(
  id: string,
  data: Partial<FetchConfigCreate>
): Promise<FetchConfig> {
  return prisma.fetchConfig.update({
    where: { id },
    data: {
      ...(data.name !== undefined && { name: data.name }),
      ...(data.url !== undefined && { url: data.url }),
      ...(data.method !== undefined && { method: data.method }),
      ...(data.headers !== undefined && {
        headers: data.headers as Prisma.InputJsonValue,
      }),
      ...(data.params !== undefined && {
        params: data.params as Prisma.InputJsonValue,
      }),
      ...(data.parseWith !== undefined && { parseWith: data.parseWith }),
      ...(data.selectors !== undefined && {
        selectors: data.selectors as Prisma.InputJsonValue,
      }),
      ...(data.pagination !== undefined && {
        pagination: data.pagination as Prisma.InputJsonValue,
      }),
      ...(data.authRequired !== undefined && {
        authRequired: data.authRequired,
      }),
      ...(data.authNote !== undefined && { authNote: data.authNote }),
      ...(data.isActive !== undefined && { isActive: data.isActive }),
      ...(data.intervalHours !== undefined && {
        intervalHours: data.intervalHours,
      }),
    },
  });
}

/**
 * Upsert a fetch config (create or update if exists)
 */
export async function upsertFetchConfig(
  companyId: string,
  contentType: ContentType,
  data: Omit<FetchConfigCreate, 'companyId' | 'contentType'>
): Promise<FetchConfig> {
  const { headers, params, ...rest } = data;

  return prisma.fetchConfig.upsert({
    where: {
      companyId_contentType: {
        companyId,
        contentType: contentType as string,
      },
    },
    update: {
      ...rest,
      headers: headers as Prisma.InputJsonValue,
      params: params as Prisma.InputJsonValue,
      selectors: rest.selectors as Prisma.InputJsonValue | undefined,
      pagination: rest.pagination as Prisma.InputJsonValue | undefined,
    },
    create: {
      companyId,
      contentType: contentType as string,
      ...rest,
      headers: headers as Prisma.InputJsonValue,
      params: params as Prisma.InputJsonValue,
      selectors: rest.selectors as Prisma.InputJsonValue | undefined,
      pagination: rest.pagination as Prisma.InputJsonValue | undefined,
    },
  });
}

/**
 * Delete a fetch config
 */
export async function deleteFetchConfig(id: string): Promise<FetchConfig> {
  return prisma.fetchConfig.delete({
    where: { id },
  });
}

/**
 * Delete all configs for a company
 */
export async function deleteFetchConfigsByCompanyId(
  companyId: string
): Promise<{ count: number }> {
  return prisma.fetchConfig.deleteMany({
    where: { companyId },
  });
}

// ============================================
// Agent State Operations
// ============================================

/**
 * Discovery structure for agent memory
 */
export interface Discovery {
  type: 'api_endpoint' | 'webpage' | 'requires_auth' | 'no_content';
  url?: string;
  data?: unknown;
  selectors?: Record<string, string>;
  requiresAuth?: boolean;
  reason?: string;
}

/**
 * Update agent state after action result
 */
export async function updateAgentState(
  id: string,
  data: {
    pagesVisited?: string[];
    discoveries?: Discovery[];
    currentAction?: string | null;
    currentTarget?: string | null;
    iterations?: number;
  }
): Promise<FetchTask> {
  return prisma.fetchTask.update({
    where: { id },
    data: {
      ...(data.pagesVisited !== undefined && {
        pagesVisited: data.pagesVisited,
      }),
      ...(data.discoveries !== undefined && {
        discoveries: data.discoveries as unknown as Prisma.InputJsonValue,
      }),
      ...(data.currentAction !== undefined && {
        currentAction: data.currentAction,
      }),
      ...(data.currentTarget !== undefined && {
        currentTarget: data.currentTarget,
      }),
      ...(data.iterations !== undefined && {
        iterations: data.iterations,
      }),
    },
  });
}

/**
 * Add a discovery to the task
 */
export async function addDiscovery(
  id: string,
  discovery: Discovery
): Promise<FetchTask> {
  const task = await prisma.fetchTask.findUnique({ where: { id } });
  if (!task) throw new Error('Task not found');

  const discoveries = (task.discoveries as unknown as Discovery[]) || [];
  discoveries.push(discovery);

  const pagesVisited = [...task.pagesVisited];
  if (discovery.url && !pagesVisited.includes(discovery.url)) {
    pagesVisited.push(discovery.url);
  }

  return prisma.fetchTask.update({
    where: { id },
    data: {
      discoveries: discoveries as unknown as Prisma.InputJsonValue,
      pagesVisited,
    },
  });
}

/**
 * Set current action (for tracking what's being executed)
 */
export async function setCurrentAction(
  id: string,
  action: string,
  target?: string
): Promise<FetchTask> {
  return prisma.fetchTask.update({
    where: { id },
    data: {
      currentAction: action,
      currentTarget: target ?? null,
    },
  });
}

/**
 * Clear current action (after result is processed)
 */
export async function clearCurrentAction(
  id: string
): Promise<FetchTask> {
  return prisma.fetchTask.update({
    where: { id },
    data: {
      currentAction: null,
      currentTarget: null,
    },
  });
}

/**
 * Get task with company info for agent
 */
export async function getTaskWithCompany(
  id: string
): Promise<FetchTask & { company: { name: string; website: string | null; industry: string | null } | null }> {
  const task = await prisma.fetchTask.findUnique({
    where: { id },
  });

  if (!task) return null as unknown as FetchTask & { company: { name: string; website: string | null; industry: string | null } | null };

  const company = await prisma.company.findUnique({
    where: { id: task.companyId },
  });

  return {
    ...task,
    company,
  };
}