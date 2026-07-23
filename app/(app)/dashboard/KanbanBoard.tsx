'use client';

import { useState, useTransition } from 'react';
import {
  DndContext,
  useDraggable,
  useDroppable,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from '@dnd-kit/core';
import { STATUS_COLOR, compareByDeadlineUrgency, isValidKanbanTransition } from '@/lib/logic/tasks';
import { useDictionary } from '@/lib/i18n/LocaleContext';
import { useToast } from '@/components/ToastProvider';
import { setStatus } from './actions';
import { TaskCard } from './TaskCard';
import type { Task, TaskPause, TaskStatus, Label } from '@/lib/supabase/types';

const COLUMNS: TaskStatus[] = ['waiting', 'in_progress', 'paused'];

export function KanbanBoard({
  tasks,
  limitByStatus,
  pausesByTask,
  assigneeNamesByTask,
  projectNames,
  pausedByNameByTask,
  profileNames,
  commentCountsByTask,
  checklistProgressByTask,
  labelsByTask,
}: {
  tasks: Task[];
  limitByStatus?: Map<string, number | null>;
  pausesByTask: Map<string, TaskPause[]>;
  assigneeNamesByTask: Map<string, string[]>;
  projectNames: Map<string, string>;
  pausedByNameByTask: Map<string, string | null>;
  profileNames: Map<string, string>;
  commentCountsByTask: Map<string, number>;
  checklistProgressByTask: Map<string, { done: number; total: number }>;
  labelsByTask?: Map<string, Label[]>;
}) {
  const dict = useDictionary();
  const toast = useToast();
  const [, startTransition] = useTransition();
  // Optimistic status overrides, keyed by task id — cleared implicitly once
  // revalidatePath() (inside setStatus) refreshes `tasks` with the confirmed
  // value from the server, or explicitly on a rejected transition (rollback).
  const [overrides, setOverrides] = useState<Record<string, TaskStatus>>({});
  const [activeTask, setActiveTask] = useState<Task | null>(null);
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

  function statusOf(task: Task): TaskStatus {
    return overrides[task.id] ?? task.status;
  }

  function handleDragStart(event: DragStartEvent) {
    const task = tasks.find((t) => t.id === event.active.id);
    setActiveTask(task ?? null);
  }

  function handleDragEnd(event: DragEndEvent) {
    setActiveTask(null);
    const { active, over } = event;
    if (!over) return;

    const taskId = String(active.id);
    const newStatus = over.id as TaskStatus;
    const task = tasks.find((t) => t.id === taskId);
    if (!task) return;

    const currentStatus = statusOf(task);
    if (currentStatus === newStatus || !isValidKanbanTransition(currentStatus, newStatus)) return;

    setOverrides((prev) => ({ ...prev, [taskId]: newStatus }));
    startTransition(() => {
      setStatus(taskId, newStatus).then((result) => {
        if (result?.error) {
          setOverrides((prev) => {
            const next = { ...prev };
            delete next[taskId];
            return next;
          });
          toast.error(result.error);
        }
      });
    });
  }

  return (
    <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
      <div className="kanban">
        {COLUMNS.map((s, colIndex) => {
          const items = tasks.filter((t) => statusOf(t) === s).sort(compareByDeadlineUrgency);
          const isValidTarget = activeTask ? isValidKanbanTransition(statusOf(activeTask), s) : false;
          const limit = limitByStatus?.get(s) ?? null;
          const atLimit = limit !== null && items.length >= limit;
          return (
            <KanbanColumn key={s} status={s} isValidTarget={isValidTarget} isDragging={!!activeTask}>
              <div className="col-head">
                <span
                  className={`signal ${s === 'in_progress' ? 'pulsing' : ''}`}
                  style={{ background: STATUS_COLOR[s] }}
                ></span>
                {dict.status[s]}{' '}
                <span className={`col-count ${atLimit ? 'col-count-limit' : ''}`}>
                  {items.length}
                  {limit !== null ? `/${limit}` : ''}
                </span>
              </div>
              <div className="card-stack">
                {items.length ? (
                  items.map((t, i) => (
                    <DraggableTaskCard key={t.id} task={t}>
                      <TaskCard
                        task={t}
                        pauses={pausesByTask.get(t.id) ?? []}
                        assigneeNames={assigneeNamesByTask.get(t.id) ?? []}
                        projectName={t.project_id ? projectNames.get(t.project_id) ?? null : null}
                        pausedByName={pausedByNameByTask.get(t.id) ?? null}
                        profileNames={profileNames}
                        commentCount={commentCountsByTask.get(t.id) ?? 0}
                        checklistProgress={checklistProgressByTask.get(t.id)}
                        labels={labelsByTask?.get(t.id) ?? []}
                        style={{ animationDelay: `${(colIndex * 3 + i) * 40}ms` }}
                      />
                    </DraggableTaskCard>
                  ))
                ) : (
                  <div className="empty-note">{dict.dashboard.empty}</div>
                )}
              </div>
            </KanbanColumn>
          );
        })}
      </div>
    </DndContext>
  );
}

function KanbanColumn({
  status,
  isValidTarget,
  isDragging,
  children,
}: {
  status: TaskStatus;
  isValidTarget: boolean;
  isDragging: boolean;
  children: React.ReactNode;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: status });
  const classes = ['kanban-col'];
  if (isDragging) classes.push(isValidTarget ? 'kanban-col-droppable' : 'kanban-col-no-drop');
  if (isOver && isValidTarget) classes.push('kanban-col-over');
  return (
    <div className={classes.join(' ')} ref={setNodeRef}>
      {children}
    </div>
  );
}

function DraggableTaskCard({ task, children }: { task: Task; children: React.ReactNode }) {
  // Only the pointer listeners are spread, not dnd-kit's `attributes`
  // (role="button", tabIndex) — the card already contains real buttons and
  // links, and declaring the whole wrapper as a nested "button" would be
  // invalid a11y for no gain, since only PointerSensor is wired up here
  // (no keyboard-drag support to make that role meaningful). The existing
  // status buttons remain the accessible/keyboard path, per design.
  const { listeners, setNodeRef, transform, isDragging } = useDraggable({ id: task.id });
  // useDraggable only reports the offset — applying it as a transform is on us.
  const style: React.CSSProperties | undefined = transform
    ? { transform: `translate3d(${transform.x}px, ${transform.y}px, 0)` }
    : undefined;
  return (
    <div
      ref={setNodeRef}
      style={style}
      {...listeners}
      className={`draggable-task ${isDragging ? 'task-card-dragging' : ''}`}
    >
      {children}
    </div>
  );
}
