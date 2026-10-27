/**
 * Carga OPCIONAL de dados de demonstração (identificados como tal na descrição
 * dos projetos). Grava no Supabase configurado em backend/.env e invalida o
 * cache do dashboard no Redis.
 *
 *   npm run db:seed            # só insere se o banco estiver vazio
 *   npm run db:seed -- --force # insere mesmo com dados existentes
 */
import { Redis } from 'ioredis';
import { cacheKeys, dashboardKeys } from '../src/cache/keys.js';
import { RedisCacheStore } from '../src/cache/redis-cache-store.js';
import { loadConfig } from '../src/config/env.js';
import { addDays, toLocalDate } from '../src/lib/dates.js';
import { createSupabaseClient } from '../src/lib/supabase.js';
import type { TaskPriority, TaskStatus } from '../src/types/domain.js';

try {
  process.loadEnvFile();
} catch {
  // variáveis podem vir do ambiente
}

const config = loadConfig();
const db = createSupabaseClient(config.supabaseUrl, config.supabaseSecretKey);
const force = process.argv.includes('--force');
const today = toLocalDate(new Date(), config.timezone);

/** Instante (ISO) às `hour`h do dia `today + offset`, no fuso de São Paulo (UTC-3). */
const at = (offset: number, hour = 10) =>
  `${addDays(today, offset)}T${String(hour + 3).padStart(2, '0')}:00:00Z`;

const projects = [
  {
    key: 'portal',
    name: 'Portal do Cliente',
    color: '#7c5cff',
    description: 'Projeto de demonstração — redesign da área logada.',
  },
  {
    key: 'mobile',
    name: 'App Mobile',
    color: '#22c55e',
    description: 'Projeto de demonstração — versão 2.0 do aplicativo.',
  },
  {
    key: 'marketing',
    name: 'Marketing Q4',
    color: '#f59e0b',
    description: 'Projeto de demonstração — campanhas do quarto trimestre.',
  },
  {
    key: 'infra',
    name: 'Infraestrutura',
    color: '#38bdf8',
    description: 'Projeto de demonstração — observabilidade, backups e custos de nuvem.',
  },
] as const;

interface SeedTask {
  project: (typeof projects)[number]['key'] | null;
  title: string;
  description?: string;
  status: TaskStatus;
  priority: TaskPriority;
  due?: number;
  created: number;
  completed?: number;
}

const tasks: SeedTask[] = [
  {
    project: 'portal',
    title: 'Mapear jornada de login e recuperação de senha',
    status: 'done',
    priority: 'high',
    due: -6,
    created: -13,
    completed: -8,
  },
  {
    project: 'portal',
    title: 'Protótipo navegável da nova home',
    status: 'done',
    priority: 'medium',
    due: -3,
    created: -12,
    completed: -4,
  },
  {
    project: 'portal',
    title: 'Implementar filtro de faturas por período',
    description: 'Filtro por mês e por status de pagamento.',
    status: 'in_progress',
    priority: 'high',
    due: 2,
    created: -9,
  },
  {
    project: 'portal',
    title: 'Revisar contraste das cores (WCAG AA)',
    status: 'review',
    priority: 'medium',
    due: 1,
    created: -7,
  },
  {
    project: 'portal',
    title: 'Corrigir quebra de layout na tabela de pedidos',
    status: 'todo',
    priority: 'urgent',
    due: -1,
    created: -4,
  },
  {
    project: 'mobile',
    title: 'Configurar notificações push',
    status: 'in_progress',
    priority: 'high',
    due: 4,
    created: -10,
  },
  {
    project: 'mobile',
    title: 'Tela de onboarding em três passos',
    status: 'done',
    priority: 'medium',
    due: -2,
    created: -11,
    completed: -2,
  },
  {
    project: 'mobile',
    title: 'Publicar build de testes interna',
    status: 'todo',
    priority: 'medium',
    due: 6,
    created: -3,
  },
  {
    project: 'mobile',
    title: 'Investigar travamento ao abrir a câmera',
    status: 'todo',
    priority: 'urgent',
    due: 0,
    created: -1,
  },
  {
    project: 'marketing',
    title: 'Calendário editorial de novembro',
    status: 'done',
    priority: 'low',
    due: -5,
    created: -13,
    completed: -6,
  },
  {
    project: 'marketing',
    title: 'Landing page da campanha de Black Friday',
    status: 'review',
    priority: 'high',
    due: 3,
    created: -8,
  },
  {
    project: 'marketing',
    title: 'Briefing dos vídeos curtos',
    status: 'done',
    priority: 'medium',
    due: -1,
    created: -6,
    completed: -1,
  },
  {
    project: 'marketing',
    title: 'Relatório de resultados de outubro',
    status: 'todo',
    priority: 'low',
    due: 9,
    created: -2,
  },
  {
    project: 'infra',
    title: 'Configurar alertas de latência da API',
    status: 'in_progress',
    priority: 'high',
    due: 5,
    created: -12,
  },
  {
    project: 'infra',
    title: 'Revisar política de backup do banco de dados',
    status: 'todo',
    priority: 'medium',
    due: -2,
    created: -5,
  },
  {
    project: 'infra',
    title: 'Atualizar dependências com vulnerabilidades conhecidas',
    status: 'done',
    priority: 'low',
    due: -4,
    created: -9,
    completed: -5,
  },
  {
    project: null,
    title: 'Renovar certificado SSL do domínio',
    status: 'done',
    priority: 'urgent',
    due: 0,
    created: -3,
    completed: 0,
  },
  {
    project: null,
    title: 'Organizar notas da reunião semanal',
    status: 'todo',
    priority: 'low',
    created: 0,
  },
];

async function main() {
  const { count, error } = await db.from('projects').select('id', { count: 'exact', head: true });
  if (error) throw new Error(`Não foi possível acessar o Supabase: ${error.message}`);
  if ((count ?? 0) > 0 && !force) {
    console.log('O banco já possui projetos; seed ignorado. Use "npm run db:seed -- --force".');
    return;
  }

  const { data: inserted, error: projectError } = await db
    .from('projects')
    .insert(projects.map(({ name, color, description }) => ({ name, color, description })))
    .select('id, name');
  if (projectError) throw new Error(`Falha ao criar projetos: ${projectError.message}`);
  const projectId = new Map(
    projects.map((project) => [project.key, inserted.find((p) => p.name === project.name)!.id]),
  );

  const rows = tasks.map((task) => ({
    project_id: task.project ? projectId.get(task.project)! : null,
    title: task.title,
    description: task.description ?? null,
    status: task.status,
    priority: task.priority,
    due_date: task.due === undefined ? null : addDays(today, task.due),
    created_at: at(task.created, 9),
    completed_at: task.completed === undefined ? null : at(task.completed, 16),
  }));
  const { error: taskError } = await db.from('tasks').insert(rows);
  if (taskError) throw new Error(`Falha ao criar tarefas: ${taskError.message}`);

  console.log(
    `Seed concluído: ${projects.length} projetos e ${tasks.length} tarefas de demonstração.`,
  );

  const redis = new Redis(config.redisUrl, { maxRetriesPerRequest: 1, connectTimeout: 2_000 });
  try {
    const deleted = await new RedisCacheStore(redis).invalidate(
      dashboardKeys,
      cacheKeys.dashboardGeneration,
    );
    console.log(`Cache do dashboard invalidado (${deleted} chave(s) removida(s)).`);
  } catch {
    console.warn('Redis indisponível: o cache expira sozinho pelo TTL.');
  } finally {
    redis.disconnect();
  }
}

main().catch((error: Error) => {
  console.error(error.message);
  process.exit(1);
});
