import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { createBrowserRouter } from 'react-router';
import { RouterProvider } from 'react-router/dom';
import { Toaster } from 'sonner';
import { TaskDialogProvider } from '@/components/task-dialog-provider';
import { TooltipProvider } from '@/components/ui/tooltip';
import { ApiError } from '@/lib/api';
import { AppLayout } from '@/layouts/app-layout';
import './index.css';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 10_000,
      // Não insiste em erros do cliente (4xx); tenta de novo falhas de rede/servidor.
      retry: (count, error) =>
        !(error instanceof ApiError && error.status >= 400 && error.status < 500) && count < 2,
    },
  },
});

function Root() {
  return (
    <TaskDialogProvider>
      <AppLayout />
    </TaskDialogProvider>
  );
}

function PageFallback() {
  return <div className="h-dvh bg-background" aria-busy="true" />;
}

// Cada página é carregada sob demanda (Recharts só no dashboard, dnd-kit só no quadro).
const router = createBrowserRouter([
  {
    element: <Root />,
    HydrateFallback: PageFallback,
    children: [
      {
        index: true,
        lazy: () => import('@/pages/dashboard-page').then((m) => ({ Component: m.DashboardPage })),
      },
      {
        path: 'tasks',
        lazy: () => import('@/pages/tasks-page').then((m) => ({ Component: m.TasksPage })),
      },
      {
        path: 'tasks/:id',
        lazy: () =>
          import('@/pages/task-detail-page').then((m) => ({ Component: m.TaskDetailPage })),
      },
      {
        path: 'board',
        lazy: () => import('@/pages/board-page').then((m) => ({ Component: m.BoardPage })),
      },
      {
        path: 'projects',
        lazy: () => import('@/pages/projects-page').then((m) => ({ Component: m.ProjectsPage })),
      },
      {
        path: 'diagnostics',
        lazy: () =>
          import('@/pages/diagnostics-page').then((m) => ({ Component: m.DiagnosticsPage })),
      },
      {
        path: '*',
        lazy: () => import('@/pages/not-found-page').then((m) => ({ Component: m.NotFoundPage })),
      },
    ],
  },
]);

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <TooltipProvider delayDuration={300}>
        <RouterProvider router={router} />
        <Toaster
          theme="dark"
          position="bottom-right"
          richColors
          closeButton
          toastOptions={{ className: 'font-sans' }}
          offset={{ bottom: 24 }}
          mobileOffset={{ bottom: 88 }}
        />
      </TooltipProvider>
    </QueryClientProvider>
  </StrictMode>,
);
