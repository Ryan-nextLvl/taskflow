import {
  Circle,
  CircleCheck,
  CircleDashed,
  CircleDot,
  SignalHigh,
  SignalLow,
  SignalMedium,
  TriangleAlert,
  type LucideIcon,
} from 'lucide-react';
import type { TaskPriority, TaskSort, TaskStatus } from '@/types/api';

interface Meta {
  label: string;
  /** Cor de destaque (texto/ícone) com contraste adequado no fundo escuro. */
  color: string;
  icon: LucideIcon;
}

export const STATUS_META: Record<TaskStatus, Meta> = {
  todo: { label: 'A fazer', color: '#a1a9b8', icon: Circle },
  in_progress: { label: 'Em andamento', color: '#5ab8f0', icon: CircleDashed },
  review: { label: 'Em revisão', color: '#f2b443', icon: CircleDot },
  done: { label: 'Concluída', color: '#3fcf8e', icon: CircleCheck },
};

export const PRIORITY_META: Record<TaskPriority, Meta> = {
  low: { label: 'Baixa', color: '#a1a9b8', icon: SignalLow },
  medium: { label: 'Média', color: '#5ab8f0', icon: SignalMedium },
  high: { label: 'Alta', color: '#f2b443', icon: SignalHigh },
  urgent: { label: 'Urgente', color: '#f87171', icon: TriangleAlert },
};

export const PROJECT_COLORS = [
  '#7c5cff',
  '#38bdf8',
  '#22c55e',
  '#f59e0b',
  '#f43f5e',
  '#e879f9',
  '#14b8a6',
  '#94a3b8',
];

export const SORT_OPTIONS: Array<{ value: TaskSort; label: string }> = [
  { value: 'created_at', label: 'Data de criação' },
  { value: 'due_date', label: 'Prazo' },
  { value: 'priority', label: 'Prioridade' },
  { value: 'updated_at', label: 'Última atualização' },
];
