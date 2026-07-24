import type { Priority } from '@/lib/supabase/types';

export const PRIORITY_COLOR: Record<Priority, string> = {
  low: 'var(--priority-low)',
  medium: 'var(--priority-medium)',
  high: 'var(--priority-high)',
  urgent: 'var(--priority-urgent)',
};
