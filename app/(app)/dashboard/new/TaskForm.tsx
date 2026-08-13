'use client';

import { useActionState, useState, useTransition } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { CalendarClock, CircleAlert, MapPin } from 'lucide-react';
import { useDictionary } from '@/lib/i18n/LocaleContext';
import { useToast } from '@/components/ToastProvider';
import { fmtDuration } from '@/lib/logic/tasks';
import { createTemplateFromTask } from '@/app/(app)/templates/actions';
import { AssigneeSelect } from './AssigneeSelect';
import { LabelSelect } from './LabelSelect';
import { IconPicker } from '@/components/IconPicker';
import { PrioritySegmented } from '@/components/PrioritySegmented';
import type { TaskFormState } from '../actions';
import type { Label } from '@/lib/supabase/types';

const initialState: TaskFormState = { error: null };

// Пресеты оценки со скрина 07. «1 Tag» — это рабочий день 07:30–16:00,
// то есть 510 минут, а не календарные сутки.
const ESTIMATE_PRESETS = [30, 60, 180, 510];
const WORKDAY_MINUTES = 510;

export function TaskForm({
  action,
  editing,
  editingTaskId = null,
  assignees,
  projects,
  labels,
  currentUserId,
  templates = [],
  templateId = null,
}: {
  action: (prevState: TaskFormState, formData: FormData) => Promise<TaskFormState>;
  editing: {
    title: string;
    description: string;
    location: string;
    deadline: string;
    assigneeIds: string[];
    labelIds: string[];
    projectId: string;
    estimatedMinutes: string;
    icon: string;
    priority: string;
  } | null;
  editingTaskId?: string | null;
  assignees: { id: string; name: string }[];
  projects: { id: string; name: string; color?: string | null }[];
  labels: Label[];
  currentUserId: string;
  templates?: { id: string; title: string }[];
  templateId?: string | null;
}) {
  const dict = useDictionary();
  const router = useRouter();
  const toast = useToast();
  const [state, formAction, pending] = useActionState(action, initialState);
  const [isSavingTemplate, startSaveTemplate] = useTransition();
  // Prefill'd from a template on the "new task" page still counts as
  // creating (not editing) — only editing an existing task (via ?edit=,
  // no templateId ever passed then) shows the edit-specific copy.
  const isEditingExisting = !!editing && !templateId;

  const [deadline, setDeadline] = useState(editing?.deadline ?? '');
  const [estimate, setEstimate] = useState(editing?.estimatedMinutes ?? '');

  // Дедлайн в прошлом — не ошибка, задача просто сразу станет просроченной;
  // предупреждаем об этом прямо под полем (скрин 07). Сравниваем строки
  // yyyy-mm-dd, как и остальной код, — без часовых поясов.
  const todayIso = new Date().toLocaleDateString('en-CA', { timeZone: 'Europe/Berlin' });
  const deadlineInPast = !!deadline && deadline < todayIso;
  const estimateMinutes = Number(estimate);
  const estimateReadable = estimateMinutes > 0 ? fmtDuration(estimateMinutes * 60000, dict.duration) : null;

  function presetLabel(minutes: number): string {
    return minutes === WORKDAY_MINUTES ? dict.taskForm.presetDay : fmtDuration(minutes * 60000, dict.duration);
  }

  function handleSaveAsTemplate() {
    if (!editingTaskId) return;
    startSaveTemplate(() => {
      createTemplateFromTask(editingTaskId).then((result) => {
        if (result?.error) toast.error(result.error);
        else toast.success(dict.templates.savedConfirm);
      });
    });
  }

  return (
    <div className="page-fade">
      <div className="page-header">
        <div>
          <h2 className="section-title">{isEditingExisting ? dict.taskForm.editTitle : dict.taskForm.newTitle}</h2>
          <p className="section-sub">{dict.taskForm.subtitle}</p>
        </div>
        {templates.length > 0 && (
          <label className="template-picker">
            {dict.templates.useTemplate}
            <span className="filter-chip">
              <select
                value={templateId ?? ''}
                onChange={(e) =>
                  router.push(e.target.value ? `/dashboard/new?template=${e.target.value}` : '/dashboard/new')
                }
              >
                <option value="">{dict.templates.noTemplate}</option>
                {templates.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.title}
                  </option>
                ))}
              </select>
            </span>
          </label>
        )}
      </div>

      <form action={formAction} className="task-form-layout">
        {templateId && <input type="hidden" name="templateId" value={templateId} />}

        <div className="form-card task-form-main">
          {state.error && <div className="error-note">{state.error}</div>}
          <div className="field">
            <label>{dict.taskForm.title}</label>
            <div className="title-with-icon">
              <IconPicker name="icon" defaultValue={editing?.icon ?? null} />
              <input type="text" name="title" defaultValue={editing?.title} placeholder={dict.taskForm.titlePlaceholder} />
            </div>
            <p className="field-hint">{dict.taskForm.iconHint}</p>
          </div>
          <div className="field">
            <label>{dict.taskForm.description}</label>
            <textarea
              name="description"
              defaultValue={editing?.description}
              placeholder={dict.taskForm.descriptionPlaceholder}
            />
          </div>
          <div className="field">
            <label>{dict.taskForm.assignees}</label>
            <AssigneeSelect assignees={assignees} defaultSelected={editing ? editing.assigneeIds : [currentUserId]} />
          </div>
          <div className="field">
            <label>{dict.labels.title}</label>
            <LabelSelect labels={labels} defaultSelected={editing?.labelIds ?? []} />
          </div>
          <div className="field">
            <label>{dict.taskForm.location}</label>
            <span className="input-with-icon">
              <MapPin size={15} strokeWidth={1.75} />
              <input
                type="text"
                name="location"
                defaultValue={editing?.location}
                placeholder={dict.taskForm.locationPlaceholder}
              />
            </span>
          </div>
        </div>

        <div className="task-form-side">
          <div className="form-card">
            <div className="form-eyebrow">{dict.taskForm.groupingEyebrow}</div>
            <div className="field">
              <label>{dict.taskForm.project}</label>
              <select name="projectId" defaultValue={editing?.projectId ?? ''}>
                <option value="">{dict.taskForm.noProject}</option>
                {projects.map((p) => (
                  <option key={p.id} value={p.id} style={p.color ? { color: p.color } : undefined}>
                    {p.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="field">
              <label>{dict.priority.label}</label>
              <PrioritySegmented name="priority" defaultValue={editing?.priority ?? null} />
            </div>
          </div>

          <div className="form-card">
            <div className="form-eyebrow">{dict.taskForm.timeEyebrow}</div>
            <div className="field">
              <label>{dict.taskForm.deadline}</label>
              <span className="input-with-icon">
                <CalendarClock size={15} strokeWidth={1.75} />
                <input
                  type="date"
                  name="deadline"
                  value={deadline}
                  onChange={(e) => setDeadline(e.target.value)}
                />
              </span>
              {deadlineInPast && (
                <p className="field-hint field-hint-warning">
                  <CircleAlert size={13} strokeWidth={2} />
                  {dict.taskForm.deadlineInPast}
                </p>
              )}
            </div>
            <div className="field">
              <label>{dict.taskForm.estimate}</label>
              <div className="estimate-row">
                <input
                  type="number"
                  name="estimatedMinutes"
                  min={1}
                  step={1}
                  value={estimate}
                  onChange={(e) => setEstimate(e.target.value)}
                  placeholder={dict.taskForm.estimatePlaceholder}
                />
                {estimateReadable && <span className="estimate-readable">{estimateReadable}</span>}
              </div>
              <div className="estimate-presets">
                {ESTIMATE_PRESETS.map((minutes) => (
                  <button
                    key={minutes}
                    type="button"
                    className={`estimate-preset ${estimateMinutes === minutes ? 'is-active' : ''}`}
                    onClick={() => setEstimate(String(minutes))}
                  >
                    {presetLabel(minutes)}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="task-form-actions">
            <button className="btn btn-primary" disabled={pending} type="submit">
              {pending && <span className="btn-spinner" />}
              {isEditingExisting ? dict.taskForm.submitEdit : dict.taskForm.submitNew}
            </button>
            {isEditingExisting && (
              <div className="task-form-secondary">
                <button
                  type="button"
                  className="btn btn-ghost"
                  disabled={isSavingTemplate}
                  onClick={handleSaveAsTemplate}
                  data-testid="save-as-template-form"
                >
                  {dict.templates.saveAsTemplate}
                </button>
                <Link href="/dashboard" className="btn btn-text">
                  {dict.taskForm.cancel}
                </Link>
              </div>
            )}
          </div>
        </div>
      </form>
    </div>
  );
}
