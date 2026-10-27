-- =============================================================================
-- TaskFlow — esquema inicial
-- Tabelas: projects, tasks, task_events
-- Regras de negócio no banco: updated_at automático, completed_at consistente
-- com o status e histórico de eventos gerado por trigger (atômico com a escrita).
-- =============================================================================

create extension if not exists pg_trgm with schema extensions;

-- -----------------------------------------------------------------------------
-- Tipos enumerados
-- -----------------------------------------------------------------------------
create type public.task_status as enum ('todo', 'in_progress', 'review', 'done');
create type public.task_priority as enum ('low', 'medium', 'high', 'urgent');
create type public.task_event_type as enum (
  'created',
  'updated',
  'status_changed',
  'priority_changed',
  'due_date_changed',
  'project_changed',
  'completed',
  'reopened'
);

-- -----------------------------------------------------------------------------
-- projects
-- -----------------------------------------------------------------------------
create table public.projects (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text,
  color text not null default '#7c5cff',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint projects_name_length check (char_length(btrim(name)) between 1 and 80),
  constraint projects_description_length check (description is null or char_length(description) <= 500),
  constraint projects_color_hex check (color ~ '^#[0-9a-fA-F]{6}$')
);

-- Nome único sem diferenciar maiúsculas/minúsculas.
create unique index projects_name_unique_idx on public.projects (lower(btrim(name)));

-- -----------------------------------------------------------------------------
-- tasks
-- -----------------------------------------------------------------------------
create table public.tasks (
  id uuid primary key default gen_random_uuid(),
  -- Ao excluir um projeto, as tarefas permanecem e ficam "sem projeto".
  project_id uuid references public.projects (id) on delete set null,
  title text not null,
  description text,
  status public.task_status not null default 'todo',
  priority public.task_priority not null default 'medium',
  due_date date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  completed_at timestamptz,
  constraint tasks_title_length check (char_length(btrim(title)) between 1 and 160),
  constraint tasks_description_length check (description is null or char_length(description) <= 5000),
  -- completed_at existe se, e somente se, a tarefa está concluída.
  constraint tasks_completed_at_consistency check ((status = 'done') = (completed_at is not null))
);

create index tasks_project_id_idx on public.tasks (project_id);
create index tasks_status_idx on public.tasks (status);
create index tasks_priority_idx on public.tasks (priority);
create index tasks_created_at_idx on public.tasks (created_at desc);
-- Índice parcial: consulta de tarefas atrasadas/pendentes por prazo.
create index tasks_open_due_date_idx on public.tasks (due_date) where status <> 'done';
-- Busca por título com ILIKE '%termo%'.
create index tasks_title_trgm_idx on public.tasks using gin (title extensions.gin_trgm_ops);

-- -----------------------------------------------------------------------------
-- task_events (histórico)
-- -----------------------------------------------------------------------------
create table public.task_events (
  -- Identidade sequencial: ordena de forma estável eventos gravados na mesma transação.
  id bigint generated always as identity primary key,
  task_id uuid not null references public.tasks (id) on delete cascade,
  event_type public.task_event_type not null,
  description text not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index task_events_task_id_created_at_idx on public.task_events (task_id, created_at desc, id desc);

-- -----------------------------------------------------------------------------
-- Funções auxiliares
-- -----------------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create or replace function public.task_status_label(s public.task_status)
returns text
language sql
immutable
set search_path = ''
as $$
  select case s
    when 'todo' then 'A fazer'
    when 'in_progress' then 'Em andamento'
    when 'review' then 'Em revisão'
    when 'done' then 'Concluída'
  end;
$$;

create or replace function public.task_priority_label(p public.task_priority)
returns text
language sql
immutable
set search_path = ''
as $$
  select case p
    when 'low' then 'Baixa'
    when 'medium' then 'Média'
    when 'high' then 'Alta'
    when 'urgent' then 'Urgente'
  end;
$$;

-- Mantém completed_at coerente com o status (o cliente nunca define este campo).
create or replace function public.tasks_sync_completed_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.status = 'done' then
    if tg_op = 'INSERT' then
      -- A API nunca envia completed_at; o valor explícito só é aceito em cargas (seed).
      new.completed_at := coalesce(new.completed_at, now());
    elsif old.status <> 'done' then
      new.completed_at := now();
    else
      new.completed_at := old.completed_at;
    end if;
  else
    new.completed_at := null;
  end if;
  return new;
end;
$$;

-- Registra o histórico da tarefa na mesma transação da escrita.
create or replace function public.tasks_log_events()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  changed_fields text[] := '{}';
  old_project text;
  new_project text;
begin
  if tg_op = 'INSERT' then
    insert into public.task_events (task_id, event_type, description, metadata, created_at)
    values (
      new.id,
      'created',
      'Tarefa criada com status "' || public.task_status_label(new.status) || '"',
      jsonb_build_object('status', new.status, 'priority', new.priority),
      new.created_at
    );
    return new;
  end if;

  if new.status is distinct from old.status then
    insert into public.task_events (task_id, event_type, description, metadata)
    values (
      new.id,
      case
        when new.status = 'done' then 'completed'::public.task_event_type
        when old.status = 'done' then 'reopened'::public.task_event_type
        else 'status_changed'::public.task_event_type
      end,
      case
        when new.status = 'done' then 'Tarefa concluída'
        when old.status = 'done' then 'Tarefa reaberta com status "' || public.task_status_label(new.status) || '"'
        else 'Status alterado de "' || public.task_status_label(old.status) || '" para "' || public.task_status_label(new.status) || '"'
      end,
      jsonb_build_object('from', old.status, 'to', new.status)
    );
  end if;

  if new.priority is distinct from old.priority then
    insert into public.task_events (task_id, event_type, description, metadata)
    values (
      new.id,
      'priority_changed',
      'Prioridade alterada de "' || public.task_priority_label(old.priority) || '" para "' || public.task_priority_label(new.priority) || '"',
      jsonb_build_object('from', old.priority, 'to', new.priority)
    );
  end if;

  if new.due_date is distinct from old.due_date then
    insert into public.task_events (task_id, event_type, description, metadata)
    values (
      new.id,
      'due_date_changed',
      case
        when new.due_date is null then 'Prazo removido'
        when old.due_date is null then 'Prazo definido para ' || to_char(new.due_date, 'DD/MM/YYYY')
        else 'Prazo alterado de ' || to_char(old.due_date, 'DD/MM/YYYY') || ' para ' || to_char(new.due_date, 'DD/MM/YYYY')
      end,
      jsonb_build_object('from', old.due_date, 'to', new.due_date)
    );
  end if;

  if new.project_id is distinct from old.project_id then
    select p.name into old_project from public.projects p where p.id = old.project_id;
    select p.name into new_project from public.projects p where p.id = new.project_id;
    insert into public.task_events (task_id, event_type, description, metadata)
    values (
      new.id,
      'project_changed',
      case
        when new.project_id is null and old_project is null then 'Projeto excluído; tarefa ficou sem projeto'
        when new.project_id is null then 'Tarefa removida do projeto "' || old_project || '"'
        when old.project_id is null then 'Tarefa adicionada ao projeto "' || new_project || '"'
        else 'Projeto alterado de "' || coalesce(old_project, '—') || '" para "' || new_project || '"'
      end,
      jsonb_build_object('from', old.project_id, 'to', new.project_id)
    );
  end if;

  if new.title is distinct from old.title then
    changed_fields := array_append(changed_fields, 'título');
  end if;
  if new.description is distinct from old.description then
    changed_fields := array_append(changed_fields, 'descrição');
  end if;
  if array_length(changed_fields, 1) > 0 then
    insert into public.task_events (task_id, event_type, description, metadata)
    values (
      new.id,
      'updated',
      'Campos atualizados: ' || array_to_string(changed_fields, ', '),
      jsonb_build_object('fields', to_jsonb(changed_fields))
    );
  end if;

  return new;
end;
$$;

-- -----------------------------------------------------------------------------
-- Triggers
-- -----------------------------------------------------------------------------
create trigger projects_set_updated_at
  before update on public.projects
  for each row execute function public.set_updated_at();

create trigger tasks_set_updated_at
  before update on public.tasks
  for each row execute function public.set_updated_at();

create trigger tasks_sync_completed_at
  before insert or update of status on public.tasks
  for each row execute function public.tasks_sync_completed_at();

create trigger tasks_log_events
  after insert or update on public.tasks
  for each row execute function public.tasks_log_events();

-- -----------------------------------------------------------------------------
-- Segurança: Row Level Security
-- O TaskFlow não expõe as tabelas ao navegador. Toda leitura/escrita passa pela
-- API (back-end), que usa a chave secreta (service_role) — esta ignora RLS.
-- RLS habilitado e sem políticas = as chaves públicas (anon/authenticated) não
-- leem nem escrevem nada, mesmo que alguém as obtenha.
-- -----------------------------------------------------------------------------
alter table public.projects enable row level security;
alter table public.tasks enable row level security;
alter table public.task_events enable row level security;

revoke all on table public.projects, public.tasks, public.task_events from anon, authenticated;
grant select, insert, update, delete on table public.projects, public.tasks, public.task_events to service_role;
