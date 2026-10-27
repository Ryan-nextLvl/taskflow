export const TASK_STATUSES = ['todo', 'in_progress', 'review', 'done'] as const;
export const TASK_PRIORITIES = ['low', 'medium', 'high', 'urgent'] as const;

export type TaskStatus = (typeof TASK_STATUSES)[number];
export type TaskPriority = (typeof TASK_PRIORITIES)[number];

export interface ProjectSummary {
  id: string;
  name: string;
  color: string;
}

export interface Project extends ProjectSummary {
  description: string | null;
  created_at: string;
  updated_at: string;
}

export interface ProjectWithStats extends Project {
  task_count: number;
  done_count: number;
}

export interface Task {
  id: string;
  project_id: string | null;
  title: string;
  description: string | null;
  status: TaskStatus;
  priority: TaskPriority;
  due_date: string | null;
  created_at: string;
  updated_at: string;
  completed_at: string | null;
  project: ProjectSummary | null;
}

export type TaskEventType =
  | 'created'
  | 'updated'
  | 'status_changed'
  | 'priority_changed'
  | 'due_date_changed'
  | 'project_changed'
  | 'completed'
  | 'reopened';

export interface TaskEvent {
  id: number;
  task_id: string;
  event_type: TaskEventType;
  description: string;
  metadata: Record<string, unknown>;
  created_at: string;
}

export interface Pagination {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

export type CacheStrategy = 'HIT' | 'MISS' | 'BYPASS';

export interface CacheMeta {
  strategy: CacheStrategy;
  key: string;
  ttlSeconds: number;
  ttlRemaining: number | null;
  cachedAt: string | null;
  durationMs: number;
  notice?: string;
}

export interface InvalidationRecord {
  at: string;
  reason: string;
  ok: boolean;
  keysDeleted: number;
  error?: string;
}

export interface DashboardSummary {
  generatedAt: string;
  timezone: string;
  today: string;
  totals: {
    total: number;
    todo: number;
    inProgress: number;
    review: number;
    done: number;
    pending: number;
    overdue: number;
    dueToday: number;
    dueNext7Days: number;
    completionRate: number;
    completedLast7Days: number;
    createdLast7Days: number;
  };
  byStatus: Array<{ status: TaskStatus; count: number }>;
  byPriority: Array<{ priority: TaskPriority; total: number; open: number }>;
  byProject: Array<{
    projectId: string | null;
    name: string;
    color: string;
    total: number;
    done: number;
  }>;
  productivity: Array<{ date: string; created: number; completed: number }>;
}

export interface CacheEvent {
  at: string;
  type: CacheStrategy | 'INVALIDATE' | 'INVALIDATE_FAILED' | 'STALE_WRITE_SKIPPED';
  message: string;
  durationMs?: number;
}

export interface CacheDiagnostics {
  redis: { status: string; connected: boolean; latencyMs: number | null };
  cache: {
    key: string;
    generationKey: string;
    ttlSeconds: number;
    exists: boolean;
    ttlRemaining: number | null;
    pendingInvalidation: boolean;
  };
  stats: {
    hits: number;
    misses: number;
    bypasses: number;
    hitRate: number | null;
    invalidations: number;
    failedInvalidations: number;
    staleWritesSkipped: number;
    since: string;
    scope: string;
  };
  lastRequest: { strategy: CacheStrategy; durationMs: number; at: string } | null;
  lastInvalidation: InvalidationRecord | null;
  events: CacheEvent[];
}

export interface HealthStatus {
  status: 'ok' | 'degraded' | 'down';
  services: {
    supabase: { ok: boolean; latencyMs: number | null };
    redis: { ok: boolean; status: string; latencyMs: number | null };
  };
  uptimeSeconds: number;
}

export type TaskSort = 'created_at' | 'due_date' | 'priority' | 'updated_at';

export interface TaskFilters {
  search?: string;
  status?: TaskStatus;
  priority?: TaskPriority;
  projectId?: string;
  overdue?: boolean;
  sort?: TaskSort;
  order?: 'asc' | 'desc';
  page?: number;
  pageSize?: number;
}

export interface TaskPayload {
  title?: string;
  description?: string | null;
  status?: TaskStatus;
  priority?: TaskPriority;
  due_date?: string | null;
  project_id?: string | null;
}

export interface ProjectPayload {
  name?: string;
  description?: string | null;
  color?: string;
}
