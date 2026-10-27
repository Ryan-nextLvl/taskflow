export const TASK_STATUSES = ['todo', 'in_progress', 'review', 'done'] as const;
export const TASK_PRIORITIES = ['low', 'medium', 'high', 'urgent'] as const;

export type TaskStatus = (typeof TASK_STATUSES)[number];

export const TASK_STATUS_LABELS: Record<TaskStatus, string> = {
  todo: 'A fazer',
  in_progress: 'Em andamento',
  review: 'Em revisão',
  done: 'Concluída',
};
export type TaskPriority = (typeof TASK_PRIORITIES)[number];

export type TaskEventType =
  | 'created'
  | 'updated'
  | 'status_changed'
  | 'priority_changed'
  | 'due_date_changed'
  | 'project_changed'
  | 'completed'
  | 'reopened';

export interface Project {
  id: string;
  name: string;
  description: string | null;
  color: string;
  created_at: string;
  updated_at: string;
}

export interface ProjectWithStats extends Project {
  task_count: number;
  done_count: number;
}

export interface ProjectSummary {
  id: string;
  name: string;
  color: string;
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

export interface TaskEvent {
  id: number;
  task_id: string;
  event_type: TaskEventType;
  description: string;
  metadata: Record<string, unknown>;
  created_at: string;
}

/** Colunas mínimas usadas no cálculo dos indicadores. */
export interface TaskMetricRow {
  status: TaskStatus;
  priority: TaskPriority;
  due_date: string | null;
  created_at: string;
  completed_at: string | null;
  project_id: string | null;
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

export interface Paginated<T> {
  items: T[];
  total: number;
}
