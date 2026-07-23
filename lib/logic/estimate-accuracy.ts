import type { Task, TaskPause, TaskAssignee } from '@/lib/supabase/types';
import { netDuration } from './tasks';

export interface EstimateAccuracyStat {
  id: string;
  name: string;
  taskCount: number;
  avgRatio: number; // fakticheskoye / otsenka; 1 = tochno v otsenku, >1 dol'she, <1 bystreye
}

// Tochnost' otsenok po lyudyam (Etap 11): dlya kazhdoy zavershyonnoy zadachi
// s zapolnennoy estimated_minutes berem sootnosheniye fakt/otsenka (netDuration,
// t.e. chistoye vremya v rabote bez pauz — tot zhe pokazatel', chto uzhe
// pokazyvayetsya na kartochke i v arkhive), i pripisyvayem yego kazhdomu
// tekushchemu ispolnitelyu etoy zadachi.
export function computeEstimateAccuracy(params: {
  profiles: { id: string; name: string }[];
  tasks: Task[];
  pauses: TaskPause[];
  assignees: TaskAssignee[];
}): EstimateAccuracyStat[] {
  const { profiles, tasks, pauses, assignees } = params;

  const pausesByTask = new Map<string, TaskPause[]>();
  for (const p of pauses) {
    const list = pausesByTask.get(p.task_id) ?? [];
    list.push(p);
    pausesByTask.set(p.task_id, list);
  }

  const assigneesByTask = new Map<string, string[]>();
  for (const a of assignees) {
    if (a.removed_at) continue;
    const list = assigneesByTask.get(a.task_id) ?? [];
    list.push(a.assignee_id);
    assigneesByTask.set(a.task_id, list);
  }

  const ratiosByPerson = new Map<string, number[]>();
  for (const task of tasks) {
    if (task.status !== 'done' || !task.estimated_minutes) continue;
    const actualMs = netDuration(task, pausesByTask.get(task.id) ?? []);
    if (!actualMs) continue;
    const estimateMs = task.estimated_minutes * 60000;
    const ratio = actualMs / estimateMs;
    for (const personId of assigneesByTask.get(task.id) ?? []) {
      const list = ratiosByPerson.get(personId) ?? [];
      list.push(ratio);
      ratiosByPerson.set(personId, list);
    }
  }

  return profiles
    .map((p) => {
      const ratios = ratiosByPerson.get(p.id) ?? [];
      return {
        id: p.id,
        name: p.name,
        taskCount: ratios.length,
        avgRatio: ratios.length ? ratios.reduce((sum, r) => sum + r, 0) / ratios.length : 0,
      };
    })
    .filter((s) => s.taskCount > 0);
}
