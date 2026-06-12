/**
 * Explorer Agent Server Actions
 *
 * Server actions for the Explorer Agent task management.
 * These are used by React components (admin UI).
 * For extension/agent polling, use the API routes instead.
 */

'use server';

import { revalidatePath } from 'next/cache';
import type { Prisma } from '@prisma/client';
import {
  createFetchTask,
  getFetchTaskById,
  getFetchTasksByStatus,
  getFetchTasksByCompanyId,
  updateFetchTask,
  deleteFetchTask,
  completeFetchTask,
  failFetchTask,
} from '@/lib/db/explorer';
import {
  createFetchConfig,
  getFetchConfigById,
  getFetchConfigsByCompanyId,
  upsertFetchConfig,
  deleteFetchConfig,
} from '@/lib/db/explorer';
import type {
  FetchTaskCreate,
  FetchTaskUpdate,
  FetchConfigCreate,
  TaskStatus,
  ContentType,
} from '@/schemas/explorer';
import type { FetchTask, FetchConfig } from '@prisma/client';

// ============================================
// Task Actions
// ============================================

/**
 * Create a new fetch task
 */
export async function createTaskAction(
  data: FetchTaskCreate
): Promise<{ success: true; data: FetchTask } | { success: false; error: string }> {
  try {
    const task = await createFetchTask(data);
    return { success: true, data: task };
  } catch (error) {
    console.error('[Action] Failed to create task:', error);
    return { success: false, error: 'Failed to create task' };
  }
}

/**
 * Get a task by ID
 */
export async function getTaskAction(
  id: string
): Promise<{ success: true; data: FetchTask | null } | { success: false; error: string }> {
  try {
    const task = await getFetchTaskById(id);
    return { success: true, data: task };
  } catch (error) {
    console.error('[Action] Failed to get task:', error);
    return { success: false, error: 'Failed to get task' };
  }
}

/**
 * Get tasks by status
 */
export async function listTasksByStatusAction(
  status: TaskStatus
): Promise<{ success: true; data: FetchTask[] } | { success: false; error: string }> {
  try {
    const tasks = await getFetchTasksByStatus(status);
    return { success: true, data: tasks };
  } catch (error) {
    console.error('[Action] Failed to list tasks:', error);
    return { success: false, error: 'Failed to list tasks' };
  }
}

/**
 * Get all tasks for a company
 */
export async function getTasksByCompanyAction(
  companyId: string
): Promise<{ success: true; data: FetchTask[] } | { success: false; error: string }> {
  try {
    const tasks = await getFetchTasksByCompanyId(companyId);
    return { success: true, data: tasks };
  } catch (error) {
    console.error('[Action] Failed to get tasks by company:', error);
    return { success: false, error: 'Failed to get tasks' };
  }
}

/**
 * Update a task
 */
export async function updateTaskAction(
  id: string,
  data: FetchTaskUpdate
): Promise<{ success: true; data: FetchTask } | { success: false; error: string }> {
  try {
    const task = await updateFetchTask(id, data);
    revalidatePath('/admin/explorer');
    return { success: true, data: task };
  } catch (error) {
    console.error('[Action] Failed to update task:', error);
    return { success: false, error: 'Failed to update task' };
  }
}

/**
 * Mark task as complete with config
 */
export async function completeTaskAction(
  id: string,
  config: Record<string, unknown>,
  confidence?: number
): Promise<{ success: true; data: FetchTask } | { success: false; error: string }> {
  try {
    const task = await completeFetchTask(id, config as Prisma.InputJsonValue, confidence);
    revalidatePath('/admin/explorer');
    return { success: true, data: task };
  } catch (error) {
    console.error('[Action] Failed to complete task:', error);
    return { success: false, error: 'Failed to complete task' };
  }
}

/**
 * Mark task as failed
 */
export async function failTaskAction(
  id: string,
  reason: string
): Promise<{ success: true; data: FetchTask } | { success: false; error: string }> {
  try {
    const task = await failFetchTask(id, reason);
    revalidatePath('/admin/explorer');
    return { success: true, data: task };
  } catch (error) {
    console.error('[Action] Failed to fail task:', error);
    return { success: false, error: 'Failed to fail task' };
  }
}

/**
 * Delete a task
 */
export async function deleteTaskAction(
  id: string
): Promise<{ success: true; data: FetchTask } | { success: false; error: string }> {
  try {
    const task = await deleteFetchTask(id);
    revalidatePath('/admin/explorer');
    return { success: true, data: task };
  } catch (error) {
    console.error('[Action] Failed to delete task:', error);
    return { success: false, error: 'Failed to delete task' };
  }
}

// ============================================
// Config Actions
// ============================================

/**
 * Create a new fetch config
 */
export async function createConfigAction(
  data: FetchConfigCreate
): Promise<{ success: true; data: FetchConfig } | { success: false; error: string }> {
  try {
    const config = await createFetchConfig(data);
    return { success: true, data: config };
  } catch (error) {
    console.error('[Action] Failed to create config:', error);
    return { success: false, error: 'Failed to create config' };
  }
}

/**
 * Get a config by ID
 */
export async function getConfigAction(
  id: string
): Promise<{ success: true; data: FetchConfig | null } | { success: false; error: string }> {
  try {
    const config = await getFetchConfigById(id);
    return { success: true, data: config };
  } catch (error) {
    console.error('[Action] Failed to get config:', error);
    return { success: false, error: 'Failed to get config' };
  }
}

/**
 * Get all configs for a company
 */
export async function getConfigsByCompanyAction(
  companyId: string
): Promise<{ success: true; data: FetchConfig[] } | { success: false; error: string }> {
  try {
    const configs = await getFetchConfigsByCompanyId(companyId);
    return { success: true, data: configs };
  } catch (error) {
    console.error('[Action] Failed to get configs by company:', error);
    return { success: false, error: 'Failed to get configs' };
  }
}

/**
 * Upsert a config (create or update if exists)
 */
export async function upsertConfigAction(
  companyId: string,
  contentType: ContentType,
  data: Omit<FetchConfigCreate, 'companyId' | 'contentType'>
): Promise<{ success: true; data: FetchConfig } | { success: false; error: string }> {
  try {
    const config = await upsertFetchConfig(companyId, contentType, data);
    return { success: true, data: config };
  } catch (error) {
    console.error('[Action] Failed to upsert config:', error);
    return { success: false, error: 'Failed to upsert config' };
  }
}

/**
 * Delete a config
 */
export async function deleteConfigAction(
  id: string
): Promise<{ success: true; data: FetchConfig } | { success: false; error: string }> {
  try {
    const config = await deleteFetchConfig(id);
    return { success: true, data: config };
  } catch (error) {
    console.error('[Action] Failed to delete config:', error);
    return { success: false, error: 'Failed to delete config' };
  }
}