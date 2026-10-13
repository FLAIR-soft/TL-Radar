// Типы строк базы MIDAS. Отличие от прежних типов Supabase одно, но сквозное:
// пользователь — это почта в нижнем регистре, а не uuid профиля. Ролей,
// юзернеймов и паролей больше нет: кто вошёл, решает Entra через шлюз.

export type TaskStatus = 'waiting' | 'in_progress' | 'paused' | 'done';
export type Priority = 'low' | 'medium' | 'high' | 'urgent';
export type Locale = 'ru' | 'de' | 'en';

export type Person = {
  email: string;
  display_name: string | null;
  created_at: string;
  last_seen_at: string | null;
};

export type Task = {
  id: string;
  title: string;
  description: string;
  location: string;
  deadline: string | null;
  late_reason: string | null;
  status: TaskStatus;
  priority: Priority | null;
  icon: string | null;
  project_id: string | null;
  estimated_minutes: number | null;
  created_at: string;
  started_at: string | null;
  completed_at: string | null;
  created_by: string | null;
  updated_by: string | null;
  deleted_at: string | null;
};

export type Project = {
  id: string;
  name: string;
  description: string | null;
  location: string | null;
  owner_email: string | null;
  icon: string | null;
  color: string | null;
  priority: Priority | null;
  created_at: string;
  created_by: string | null;
  deleted_at: string | null;
};

export type TaskPause = {
  id: string;
  task_id: string;
  paused_at: string;
  resumed_at: string | null;
  auto: boolean;
  created_by: string | null;
};

export type TaskAssignee = {
  id: string;
  task_id: string;
  assignee_email: string;
  added_at: string;
  added_by: string | null;
  removed_at: string | null;
  removed_by: string | null;
};

export type Label = {
  id: string;
  name: string;
  color: string;
  created_at: string;
  created_by: string | null;
  deleted_at: string | null;
};

export type TaskComment = {
  id: string;
  task_id: string;
  author: string | null;
  body: string;
  created_at: string;
  deleted_at: string | null;
};

export type TaskChecklistItem = {
  id: string;
  task_id: string;
  title: string;
  done: boolean;
  position: number;
  created_at: string;
  deleted_at: string | null;
};

export type TaskTemplate = {
  id: string;
  title: string;
  description: string | null;
  location: string | null;
  estimated_minutes: number | null;
  priority: Priority | null;
  icon: string | null;
  project_id: string | null;
  checklist: string[] | null;
  created_at: string;
  created_by: string | null;
  deleted_at: string | null;
};

export type RecurringFrequency = 'daily' | 'weekly' | 'monthly';

export type RecurringRule = {
  id: string;
  template_id: string;
  frequency: RecurringFrequency;
  weekday: number | null;
  day_of_month: number | null;
  next_run_at: string;
  active: boolean;
  created_at: string;
  created_by: string | null;
  deleted_at: string | null;
};

export type SavedView = {
  id: string;
  email: string;
  name: string;
  filters: { qs: string };
  created_at: string;
  deleted_at: string | null;
};

export type ActivityEntityType = 'task' | 'project';
export type ActivityEventType =
  | 'created' | 'updated' | 'status_changed' | 'deleted'
  | 'assignee_added' | 'assignee_removed'
  | 'comment_added' | 'checklist_item_added';

export type ActivityLog = {
  id: string;
  entity_type: ActivityEntityType;
  entity_id: string;
  event_type: ActivityEventType;
  actor: string | null;
  detail: Record<string, unknown> | null;
  created_at: string;
};

export type NotificationType = 'assigned' | 'unassigned' | 'deadline_soon' | 'comment' | 'mention';

export type Notification = {
  id: string;
  recipient_email: string;
  type: NotificationType;
  task_id: string | null;
  payload: Record<string, unknown> | null;
  read_at: string | null;
  created_at: string;
};

export type WipStatus = 'waiting' | 'in_progress' | 'paused';

export type WipLimit = {
  status: WipStatus;
  limit_count: number | null;
};
