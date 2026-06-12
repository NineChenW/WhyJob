import { z } from 'zod';

// ============================================
// Enums
// ============================================

export const contentTypeSchema = z.enum([
  'company_culture',
  'job_listing',
  'company_wechat',
]);
export type ContentType = z.infer<typeof contentTypeSchema>;

export const parseWithSchema = z.enum(['json', 'cheerio']);
export type ParseWith = z.infer<typeof parseWithSchema>;

export const paginationTypeSchema = z.enum(['page', 'offset', 'cursor']);
export type PaginationType = z.infer<typeof paginationTypeSchema>;

export const taskStatusSchema = z.enum([
  'pending',
  'exploring',
  'complete',
  'failed',
]);
export type TaskStatus = z.infer<typeof taskStatusSchema>;

// ============================================
// Command Interfaces (used by Extension)
// ============================================

export const commandTypeSchema = z.enum(['NAVIGATE', 'GET_SNAPSHOT', 'EXTRACT_DOM']);
export type CommandType = z.infer<typeof commandTypeSchema>;

export interface Command {
  type: CommandType;
  requestId: string;
  params?: {
    url?: string;
    selectors?: Record<string, string>;
  };
}

export interface CommandResult {
  requestId: string;
  success: boolean;
  data?: unknown;
  error?: string;
}

export const commandSchema = z.object({
  type: commandTypeSchema,
  requestId: z.string().min(1),
  params: z
    .object({
      url: z.string().url().optional(),
      selectors: z.record(z.string(), z.string()).optional(),
    })
    .optional(),
});

export const commandResultSchema: z.ZodType<CommandResult> = z.object({
  requestId: z.string().min(1),
  success: z.boolean(),
  data: z.unknown().optional(),
  error: z.string().optional(),
});

// ============================================
// FetchTask Schemas
// ============================================

export const fetchTaskCreateSchema = z.object({
  companyId: z.string().min(1),
  contentTypes: z.array(contentTypeSchema).min(1),
});

export const fetchTaskUpdateSchema = z.object({
  status: taskStatusSchema.optional(),
  config: z.any().optional(),
  reason: z.string().optional(),
  iterations: z.number().int().min(0).optional(),
  confidence: z.number().min(0).max(1).optional(),
});

export const fetchTaskResponseSchema = z.object({
  id: z.string(),
  status: taskStatusSchema,
  config: z.any().optional(),
  reason: z.string().optional(),
  iterations: z.number().optional(),
  confidence: z.number().optional(),
  createdAt: z.date(),
  completedAt: z.date().optional(),
});

// ============================================
// FetchConfig Schemas
// ============================================

export const paginationSchema = z
  .object({
    type: paginationTypeSchema,
    paramName: z.string(),
    maxPages: z.number().int().positive(),
    increment: z.number().optional(),
    stopCondition: z.string().optional(),
  })
  .optional();

export const fetchConfigCreateSchema = z.object({
  companyId: z.string().min(1),
  name: z.string().min(1),
  contentType: contentTypeSchema,
  url: z.string().url(),
  method: z.enum(['GET', 'POST']).default('GET'),
  headers: z.record(z.string(), z.string()).default({}),
  params: z.record(z.string(), z.string()).default({}),
  parseWith: parseWithSchema.default('json'),
  selectors: z.record(z.string(), z.string()).optional(),
  pagination: paginationSchema,
  authRequired: z.boolean().default(false),
  authNote: z.string().optional(),
  isActive: z.boolean().default(true),
  intervalHours: z.number().positive().optional(),
});

export const fetchConfigResponseSchema = z.object({
  id: z.string(),
  companyId: z.string(),
  name: z.string(),
  contentType: contentTypeSchema,
  url: z.string().url(),
  method: z.enum(['GET', 'POST']),
  headers: z.record(z.string(), z.string()),
  params: z.record(z.string(), z.string()),
  parseWith: parseWithSchema,
  selectors: z.record(z.string(), z.string()).optional(),
  pagination: paginationSchema,
  authRequired: z.boolean(),
  authNote: z.string().optional(),
  isActive: z.boolean(),
  intervalHours: z.number().optional(),
  createdAt: z.date(),
  updatedAt: z.date(),
});

// ============================================
// API Request/Response Schemas
// ============================================

// GET /api/agent/commands?extensionId=xxx
export const getCommandsResponseSchema = z.object({
  commands: z.array(commandSchema),
  serverUrl: z.string().optional(),
});

// POST /api/agent/results
export const postResultsRequestSchema = z.object({
  extensionId: z.string().min(1),
  results: z.array(commandResultSchema),
});

export const postResultsResponseSchema = z.object({
  success: z.boolean(),
});

// GET /api/agent/results?extensionId=xxx
export const getResultsResponseSchema = z.object({
  results: z.array(commandResultSchema),
});

// POST /api/explorer/tasks
export const createTaskRequestSchema = fetchTaskCreateSchema;
export const createTaskResponseSchema = z.object({
  taskId: z.string(),
  status: z.enum(['pending']),
});

// GET /api/explorer/tasks/:id
export const getTaskResponseSchema = z.object({
  id: z.string(),
  status: taskStatusSchema,
  config: z.any().optional(),
  reason: z.string().optional(),
  iterations: z.number().optional(),
  confidence: z.number().optional(),
});

// ============================================
// Type Exports
// ============================================

export type FetchTaskCreate = z.infer<typeof fetchTaskCreateSchema>;
export type FetchTaskUpdate = z.infer<typeof fetchTaskUpdateSchema>;
export type FetchConfigCreate = z.infer<typeof fetchConfigCreateSchema>;