import { addDays, toLocalDate } from '../lib/dates.js';
import {
  TASK_PRIORITIES,
  TASK_STATUSES,
  type DashboardSummary,
  type ProjectSummary,
  type TaskMetricRow,
} from '../types/domain.js';

interface ComputeOptions {
  now: Date;
  timezone: string;
  /** Quantidade de dias da série de produtividade. */
  days?: number;
}

const NO_PROJECT_COLOR = '#64748b';

/**
 * Calcula os indicadores do dashboard a partir das tarefas persistidas.
 * Função pura: mesma entrada, mesma saída (facilita testes e o cache).
 */
export function computeDashboardSummary(
  rows: TaskMetricRow[],
  projects: ProjectSummary[],
  { now, timezone, days = 14 }: ComputeOptions,
): DashboardSummary {
  const today = toLocalDate(now, timezone);
  const in7Days = addDays(today, 7);
  const seriesStart = addDays(today, -(days - 1));
  const last7Start = addDays(today, -6);

  const statusCount = Object.fromEntries(TASK_STATUSES.map((s) => [s, 0])) as Record<
    (typeof TASK_STATUSES)[number],
    number
  >;
  const priorityCount = Object.fromEntries(
    TASK_PRIORITIES.map((p) => [p, { total: 0, open: 0 }]),
  ) as Record<(typeof TASK_PRIORITIES)[number], { total: number; open: number }>;
  const projectCount = new Map<string | null, { total: number; done: number }>();
  const series = new Map<string, { created: number; completed: number }>();
  for (let i = 0; i < days; i += 1)
    series.set(addDays(seriesStart, i), { created: 0, completed: 0 });

  let overdue = 0;
  let dueToday = 0;
  let dueNext7Days = 0;
  let completedLast7Days = 0;
  let createdLast7Days = 0;

  for (const row of rows) {
    const isDone = row.status === 'done';
    statusCount[row.status] += 1;
    priorityCount[row.priority].total += 1;
    if (!isDone) priorityCount[row.priority].open += 1;

    const project = projectCount.get(row.project_id) ?? { total: 0, done: 0 };
    project.total += 1;
    if (isDone) project.done += 1;
    projectCount.set(row.project_id, project);

    if (!isDone && row.due_date) {
      if (row.due_date < today) overdue += 1;
      else if (row.due_date === today) dueToday += 1;
      else if (row.due_date <= in7Days) dueNext7Days += 1;
    }

    const createdDay = toLocalDate(row.created_at, timezone);
    const createdBucket = series.get(createdDay);
    if (createdBucket) createdBucket.created += 1;
    if (createdDay >= last7Start && createdDay <= today) createdLast7Days += 1;

    if (isDone && row.completed_at) {
      const completedDay = toLocalDate(row.completed_at, timezone);
      const completedBucket = series.get(completedDay);
      if (completedBucket) completedBucket.completed += 1;
      if (completedDay >= last7Start && completedDay <= today) completedLast7Days += 1;
    }
  }

  const total = rows.length;
  const done = statusCount.done;

  const byProject: DashboardSummary['byProject'] = projects.map((project) => ({
    projectId: project.id,
    name: project.name,
    color: project.color,
    total: projectCount.get(project.id)?.total ?? 0,
    done: projectCount.get(project.id)?.done ?? 0,
  }));
  const withoutProject = projectCount.get(null);
  if (withoutProject) {
    byProject.push({
      projectId: null,
      name: 'Sem projeto',
      color: NO_PROJECT_COLOR,
      ...withoutProject,
    });
  }
  byProject.sort((a, b) => b.total - a.total || a.name.localeCompare(b.name, 'pt-BR'));

  return {
    generatedAt: now.toISOString(),
    timezone,
    today,
    totals: {
      total,
      todo: statusCount.todo,
      inProgress: statusCount.in_progress,
      review: statusCount.review,
      done,
      pending: total - done,
      overdue,
      dueToday,
      dueNext7Days,
      completionRate: total === 0 ? 0 : Math.round((done / total) * 1000) / 10,
      completedLast7Days,
      createdLast7Days,
    },
    byStatus: TASK_STATUSES.map((status) => ({ status, count: statusCount[status] })),
    byPriority: TASK_PRIORITIES.map((priority) => ({ priority, ...priorityCount[priority] })),
    byProject,
    productivity: [...series.entries()].map(([date, counts]) => ({ date, ...counts })),
  };
}
