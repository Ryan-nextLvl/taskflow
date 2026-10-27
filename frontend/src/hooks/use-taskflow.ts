import {
  keepPreviousData,
  useMutation,
  useQuery,
  useQueryClient,
  type QueryClient,
} from '@tanstack/react-query';
import { toast } from 'sonner';
import { errorMessage } from '@/lib/api';
import { dashboardApi, projectsApi, systemApi, tasksApi } from '@/services/taskflow-api';
import type { ProjectPayload, Task, TaskFilters, TaskPayload } from '@/types/api';

export const queryKeys = {
  dashboard: ['dashboard'] as const,
  tasks: ['tasks'] as const,
  taskList: (filters: TaskFilters) => ['tasks', 'list', filters] as const,
  task: (id: string) => ['tasks', 'detail', id] as const,
  taskEvents: (id: string) => ['tasks', 'events', id] as const,
  projects: ['projects'] as const,
  health: ['health'] as const,
  diagnostics: (token: string) => ['diagnostics', token] as const,
};

/** Após qualquer escrita, recarrega o que depende das tarefas. */
function refreshTaskData(client: QueryClient) {
  void client.invalidateQueries({ queryKey: queryKeys.tasks });
  void client.invalidateQueries({ queryKey: queryKeys.dashboard });
  void client.invalidateQueries({ queryKey: queryKeys.projects });
  void client.invalidateQueries({ queryKey: ['diagnostics'] });
}

// ---------------------------------------------------------------- consultas

export const useDashboardSummary = () =>
  useQuery({
    queryKey: queryKeys.dashboard,
    queryFn: ({ signal }) => dashboardApi.summary(signal),
  });

export const useTasks = (filters: TaskFilters) =>
  useQuery({
    queryKey: queryKeys.taskList(filters),
    queryFn: ({ signal }) => tasksApi.list(filters, signal),
    placeholderData: keepPreviousData,
  });

export const useTask = (id: string) =>
  useQuery({ queryKey: queryKeys.task(id), queryFn: ({ signal }) => tasksApi.get(id, signal) });

export const useTaskEvents = (id: string) =>
  useQuery({
    queryKey: queryKeys.taskEvents(id),
    queryFn: ({ signal }) => tasksApi.events(id, signal),
  });

export const useProjects = () =>
  useQuery({ queryKey: queryKeys.projects, queryFn: ({ signal }) => projectsApi.list(signal) });

export const useHealth = () =>
  useQuery({
    queryKey: queryKeys.health,
    queryFn: ({ signal }) => systemApi.health(signal),
    refetchInterval: 30_000,
    retry: false,
  });

// ---------------------------------------------------------------- tarefas

export function useCreateTask() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (payload: TaskPayload) => tasksApi.create(payload),
    onSuccess: ({ data }) => {
      toast.success('Tarefa criada', { description: data.title });
      refreshTaskData(client);
    },
    onError: (error) =>
      toast.error('Não foi possível criar a tarefa', { description: errorMessage(error) }),
  });
}

export function useUpdateTask() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: TaskPayload; silent?: boolean }) =>
      tasksApi.update(id, payload),
    // Atualização otimista: o status muda na tela antes da resposta do servidor.
    onMutate: async ({ id, payload }) => {
      await client.cancelQueries({ queryKey: queryKeys.tasks });
      const snapshots = client.getQueriesData<{ data: Task[] }>({ queryKey: ['tasks', 'list'] });
      for (const [key, value] of snapshots) {
        if (!value) continue;
        client.setQueryData(key, {
          ...value,
          data: value.data.map((task) => (task.id === id ? { ...task, ...payload } : task)),
        });
      }
      return { snapshots };
    },
    onError: (error, _vars, context) => {
      for (const [key, value] of context?.snapshots ?? []) client.setQueryData(key, value);
      toast.error('Não foi possível atualizar a tarefa', { description: errorMessage(error) });
    },
    onSuccess: ({ data }, { silent }) => {
      client.setQueryData(queryKeys.task(data.id), data);
      if (!silent) toast.success('Tarefa atualizada', { description: data.title });
    },
    onSettled: () => refreshTaskData(client),
  });
}

export function useDeleteTask() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (task: Task) => tasksApi.remove(task.id),
    onSuccess: (_result, task) => {
      toast.success('Tarefa excluída', { description: task.title });
      client.removeQueries({ queryKey: queryKeys.task(task.id) });
      refreshTaskData(client);
    },
    onError: (error) =>
      toast.error('Não foi possível excluir a tarefa', { description: errorMessage(error) }),
  });
}

// ---------------------------------------------------------------- projetos

export function useSaveProject() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: ({ id, payload }: { id?: string; payload: ProjectPayload }) =>
      id ? projectsApi.update(id, payload) : projectsApi.create(payload),
    onSuccess: ({ data }, { id }) => {
      toast.success(id ? 'Projeto atualizado' : 'Projeto criado', { description: data.name });
      refreshTaskData(client);
    },
  });
}

export function useDeleteProject() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => projectsApi.remove(id),
    onSuccess: ({ data }) => {
      toast.success('Projeto excluído', {
        description:
          data.detachedTasks > 0
            ? `${data.detachedTasks} tarefa(s) ficaram sem projeto.`
            : undefined,
      });
      refreshTaskData(client);
    },
    onError: (error) =>
      toast.error('Não foi possível excluir o projeto', { description: errorMessage(error) }),
  });
}
