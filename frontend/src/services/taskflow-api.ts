import { apiRequest } from '@/lib/api';
import type {
  CacheDiagnostics,
  CacheMeta,
  DashboardSummary,
  HealthStatus,
  InvalidationRecord,
  Pagination,
  Project,
  ProjectPayload,
  ProjectWithStats,
  Task,
  TaskEvent,
  TaskFilters,
  TaskPayload,
} from '@/types/api';

interface Mutation<T> {
  data: T;
  meta: { cacheInvalidation: InvalidationRecord };
}

/** Funções de acesso à API REST do back-end (rotas em backend/src/routes). */
export const tasksApi = {
  list: (filters: TaskFilters, signal?: AbortSignal) =>
    apiRequest<{ data: Task[]; pagination: Pagination }>('/tasks', {
      query: { ...filters },
      signal,
    }),
  get: (id: string, signal?: AbortSignal) =>
    apiRequest<{ data: Task }>(`/tasks/${id}`, { signal }).then((r) => r.data),
  events: (id: string, signal?: AbortSignal) =>
    apiRequest<{ data: TaskEvent[] }>(`/tasks/${id}/events`, { signal }).then((r) => r.data),
  create: (body: TaskPayload) => apiRequest<Mutation<Task>>('/tasks', { method: 'POST', body }),
  update: (id: string, body: TaskPayload) =>
    apiRequest<Mutation<Task>>(`/tasks/${id}`, { method: 'PATCH', body }),
  remove: (id: string) =>
    apiRequest<Mutation<{ id: string }>>(`/tasks/${id}`, { method: 'DELETE' }),
};

export const projectsApi = {
  list: (signal?: AbortSignal) =>
    apiRequest<{ data: ProjectWithStats[] }>('/projects', { signal }).then((r) => r.data),
  create: (body: ProjectPayload) =>
    apiRequest<Mutation<Project>>('/projects', { method: 'POST', body }),
  update: (id: string, body: ProjectPayload) =>
    apiRequest<Mutation<Project>>(`/projects/${id}`, { method: 'PATCH', body }),
  remove: (id: string) =>
    apiRequest<Mutation<{ id: string; detachedTasks: number }>>(`/projects/${id}`, {
      method: 'DELETE',
    }),
};

export const dashboardApi = {
  summary: (signal?: AbortSignal) =>
    apiRequest<{ data: DashboardSummary; meta: { cache: CacheMeta } }>('/dashboard/summary', {
      signal,
    }),
};

export const systemApi = {
  health: (signal?: AbortSignal) => apiRequest<HealthStatus>('/health', { signal }),
  cacheDiagnostics: (token: string, signal?: AbortSignal) =>
    apiRequest<{ data: CacheDiagnostics }>('/diagnostics/cache', {
      headers: { 'x-diagnostics-token': token },
      signal,
    }).then((r) => r.data),
  invalidateCache: (token: string) =>
    apiRequest<{ data: InvalidationRecord }>('/diagnostics/cache/invalidate', {
      method: 'POST',
      headers: { 'x-diagnostics-token': token },
    }).then((r) => r.data),
};
