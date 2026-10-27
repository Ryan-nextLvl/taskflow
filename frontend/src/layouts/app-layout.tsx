import {
  Activity,
  FolderKanban,
  LayoutDashboard,
  ListTodo,
  Plus,
  SquareKanban,
  type LucideIcon,
} from 'lucide-react';
import { NavLink, Outlet, useLocation } from 'react-router';
import { useEffect } from 'react';
import { useTaskDialog } from '@/components/task-dialog-context';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { useHealth } from '@/hooks/use-taskflow';
import { cn } from '@/lib/utils';

interface NavItem {
  to: string;
  label: string;
  short: string;
  icon: LucideIcon;
  end?: boolean;
}

const WORKSPACE_NAV: NavItem[] = [
  { to: '/', label: 'Dashboard', short: 'Início', icon: LayoutDashboard, end: true },
  { to: '/tasks', label: 'Tarefas', short: 'Tarefas', icon: ListTodo },
  { to: '/board', label: 'Quadro Kanban', short: 'Quadro', icon: SquareKanban },
  { to: '/projects', label: 'Projetos', short: 'Projetos', icon: FolderKanban },
];

const SYSTEM_NAV: NavItem[] = [
  { to: '/diagnostics', label: 'Diagnóstico do cache', short: 'Cache', icon: Activity },
];

function Logo() {
  return (
    <div className="flex items-center gap-2.5">
      <div className="grid size-7 place-items-center rounded-lg bg-primary shadow-[0_0_0_1px_rgba(255,255,255,0.12)_inset]">
        <svg viewBox="0 0 24 24" className="size-4 text-white" aria-hidden>
          <path
            d="M5 12.5l4.5 4.5L19 7.5"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.6"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </div>
      <span className="text-[15px] font-semibold tracking-tight">TaskFlow</span>
    </div>
  );
}

function SidebarLink({ item }: { item: NavItem }) {
  const Icon = item.icon;
  return (
    <NavLink
      to={item.to}
      end={item.end}
      className={({ isActive }) =>
        cn(
          'group flex h-9 items-center gap-2.5 rounded-lg px-2.5 text-sm transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring/60',
          isActive
            ? 'bg-sidebar-accent font-medium text-foreground'
            : 'text-sidebar-foreground/75 hover:bg-white/[0.04] hover:text-foreground',
        )
      }
    >
      {({ isActive }) => (
        <>
          <Icon
            className={cn('size-4', isActive ? 'text-primary' : 'text-muted-foreground')}
            aria-hidden
          />
          {item.label}
        </>
      )}
    </NavLink>
  );
}

function StatusDot({ ok, loading }: { ok: boolean; loading: boolean }) {
  return (
    <span
      className={cn(
        'size-1.5 rounded-full',
        loading ? 'bg-muted-foreground/50' : ok ? 'bg-emerald-400' : 'bg-red-400',
      )}
      aria-hidden
    />
  );
}

function HealthIndicator() {
  const { data, isLoading, isError } = useHealth();
  const services = [
    {
      name: 'Supabase',
      ok: !isError && Boolean(data?.services.supabase.ok),
      ms: data?.services.supabase.latencyMs,
    },
    {
      name: 'Redis',
      ok: !isError && Boolean(data?.services.redis.ok),
      ms: data?.services.redis.latencyMs,
    },
  ];
  return (
    <div className="rounded-lg border border-white/[0.06] bg-white/[0.02] p-3">
      <div className="mb-2 text-[11px] font-medium tracking-wide text-muted-foreground uppercase">
        Serviços
      </div>
      <ul className="space-y-1.5">
        {services.map((service) => (
          <li key={service.name} className="flex items-center justify-between text-xs">
            <span className="flex items-center gap-2">
              <StatusDot ok={service.ok} loading={isLoading} />
              {service.name}
            </span>
            <span className="font-mono text-muted-foreground tabular">
              {isLoading
                ? '…'
                : service.ok && service.ms != null
                  ? `${Math.round(service.ms)} ms`
                  : 'offline'}
            </span>
          </li>
        ))}
      </ul>
      {isError && <p className="mt-2 text-[11px] text-red-300">API inacessível</p>}
    </div>
  );
}

export function AppLayout() {
  const openTaskDialog = useTaskDialog();
  const { pathname } = useLocation();

  useEffect(() => {
    window.scrollTo({ top: 0 });
  }, [pathname]);

  return (
    <div className="min-h-dvh">
      <a
        href="#conteudo"
        className="sr-only z-50 rounded-md bg-primary px-3 py-2 text-sm text-primary-foreground focus:not-sr-only focus:fixed focus:top-3 focus:left-3"
      >
        Pular para o conteúdo
      </a>

      {/* Sidebar (desktop) */}
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-60 flex-col border-r border-sidebar-border bg-sidebar px-3 py-4 lg:flex">
        <div className="px-2.5 pb-6">
          <Logo />
        </div>
        <Button className="mb-6 justify-between" onClick={() => openTaskDialog()}>
          <span className="flex items-center gap-2">
            <Plus /> Nova tarefa
          </span>
          <kbd className="rounded border border-white/20 px-1.5 font-mono text-[10px] text-white/80">
            N
          </kbd>
        </Button>
        <nav aria-label="Principal" className="flex flex-1 flex-col gap-6">
          <div className="space-y-0.5">
            <div className="px-2.5 pb-1.5 text-[11px] font-medium tracking-wide text-muted-foreground/80 uppercase">
              Workspace
            </div>
            {WORKSPACE_NAV.map((item) => (
              <SidebarLink key={item.to} item={item} />
            ))}
          </div>
          <div className="space-y-0.5">
            <div className="px-2.5 pb-1.5 text-[11px] font-medium tracking-wide text-muted-foreground/80 uppercase">
              Sistema
            </div>
            {SYSTEM_NAV.map((item) => (
              <SidebarLink key={item.to} item={item} />
            ))}
          </div>
        </nav>
        <HealthIndicator />
      </aside>

      {/* Barra superior (mobile/tablet) */}
      <header className="sticky top-0 z-30 flex h-14 items-center justify-between border-b border-white/[0.06] bg-background/85 px-4 backdrop-blur-md lg:hidden">
        <Logo />
        <Tooltip>
          <TooltipTrigger asChild>
            <Button size="icon" onClick={() => openTaskDialog()} aria-label="Nova tarefa">
              <Plus />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Nova tarefa</TooltipContent>
        </Tooltip>
      </header>

      <main id="conteudo" className="pb-24 lg:pb-10 lg:pl-60">
        <div className="mx-auto w-full max-w-7xl px-4 pt-6 sm:px-6 lg:px-10 lg:pt-10">
          <Outlet />
        </div>
      </main>

      {/* Navegação inferior (mobile/tablet) */}
      <nav
        aria-label="Principal"
        className="fixed inset-x-0 bottom-0 z-30 border-t border-white/[0.06] bg-background/90 pb-[env(safe-area-inset-bottom)] backdrop-blur-md lg:hidden"
      >
        <ul className="mx-auto grid max-w-lg grid-cols-5">
          {[...WORKSPACE_NAV, ...SYSTEM_NAV].map((item) => {
            const Icon = item.icon;
            return (
              <li key={item.to}>
                <NavLink
                  to={item.to}
                  end={item.end}
                  className={({ isActive }) =>
                    cn(
                      'flex h-16 flex-col items-center justify-center gap-1 text-[11px] font-medium outline-none focus-visible:bg-white/5',
                      isActive ? 'text-foreground' : 'text-muted-foreground',
                    )
                  }
                >
                  {({ isActive }) => (
                    <>
                      <Icon className={cn('size-5', isActive && 'text-primary')} aria-hidden />
                      {item.short}
                    </>
                  )}
                </NavLink>
              </li>
            );
          })}
        </ul>
      </nav>
    </div>
  );
}
