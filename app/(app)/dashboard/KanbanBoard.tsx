'use client';

import { useState, useTransition } from 'react';
import {
  DndContext,
  DragOverlay,
  useDraggable,
  useDroppable,
  MouseSensor,
  TouchSensor,
  KeyboardSensor,
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
  // Task ids with a setStatus() call in flight — dragging the same card again
  // before the server confirms/rejects would race the optimistic override.
  const [pendingIds, setPendingIds] = useState<Set<string>>(new Set());
  const [activeTask, setActiveTask] = useState<Task | null>(null);
  // MouseSensor (not PointerSensor) + TouchSensor kept deliberately separate:
  // PointerSensor's onPointerDown activator also fires for touch input, so
  // pairing it with TouchSensor would race the mouse's 5px activation
  // against the touch long-press delay and win, breaking column scroll on
  // touch. MouseSensor only reacts to real mousedown, so the two never
  // compete for the same gesture.
  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 5 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 8 } }),
    useSensor(KeyboardSensor)
  );

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
    setPendingIds((prev) => new Set(prev).add(taskId));
    startTransition(() => {
      setStatus(taskId, newStatus).then((result) => {
        setPendingIds((prev) => {
          const next = new Set(prev);
          next.delete(taskId);
          return next;
        });
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
                    <DraggableTaskCard key={t.id} task={t} disabled={pendingIds.has(t.id)}>
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
      <DragOverlay dropAnimation={{ duration: 200, easing: 'ease' }}>
        {activeTask ? (
          <div className="task-card-overlay">
            <TaskCard
              task={activeTask}
              pauses={pausesByTask.get(activeTask.id) ?? []}
              assigneeNames={assigneeNamesByTask.get(activeTask.id) ?? []}
              projectName={activeTask.project_id ? projectNames.get(activeTask.project_id) ?? null : null}
              pausedByName={pausedByNameByTask.get(activeTask.id) ?? null}
              profileNames={profileNames}
              commentCount={commentCountsByTask.get(activeTask.id) ?? 0}
              checklistProgress={checklistProgressByTask.get(activeTask.id)}
              labels={labelsByTask?.get(activeTask.id) ?? []}
            />
          </div>
        ) : null}
      </DragOverlay>
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

function DraggableTaskCard({
  task,
  disabled,
  children,
}: {
  task: Task;
  disabled?: boolean;
  children: React.ReactNode;
}) {
  // `attributes` (role="button", tabIndex, aria-*) are spread now that
  // KeyboardSensor makes keyboard dragging real — the card does still nest
  // real buttons/links, which isn't strictly valid nested-interactive-content
  // markup, but it's the same tradeoff every kanban UI with keyboard drag
  // makes (Trello, Linear, GitHub Projects): the wrapper is Tab-reachable,
  // its own buttons stay reachable right after it in DOM order.
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id: task.id, disabled });
  // No transform here: DragOverlay renders the moving clone, so the source
  // slot just sits still and fades (task-card-dragging) instead of tracking
  // the pointer itself.
  return (
    <div
      ref={setNodeRef}
      {...attributes}
      {...listeners}
      className={`draggable-task ${isDragging ? 'task-card-dragging' : ''} ${disabled ? 'draggable-task-disabled' : ''}`}
    >
      {children}
    </div>
  );
}
