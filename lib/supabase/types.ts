export type UserRole = 'viewer' | 'editor' | 'admin';
export type TaskStatus = 'waiting' | 'in_progress' | 'paused' | 'done';
export type Locale = 'ru' | 'de' | 'en';
export type Priority = 'low' | 'medium' | 'high' | 'urgent';

export type Profile = {
  id: string;
  name: string;
  username: string;
  role: UserRole;
  created_at: string;
  locale: Locale;
};

export type Task = {
  id: string;
  title: string;
  description: string;
  location: string;
  deadline: string | null;
  status: TaskStatus;
  created_at: string;
  started_at: string | null;
  completed_at: string | null;
  created_by: string | null;
  updated_by: string | null;
  deleted_at: string | null;
  project_id: string | null;
  estimated_minutes: number | null;
  icon: string | null;
  priority: Priority | null;
};

export type Project = {
  id: string;
  name: string;
  description: string | null;
  location: string | null;
  owner_id: string | null;
  created_at: string;
  created_by: string | null;
  deleted_at: string | null;
  icon: string | null;
  priority: Priority | null;
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
  assignee_id: string;
  added_at: string;
  added_by: string | null;
  removed_at: string | null;
  removed_by: string | null;
};

export type ActivityEntityType = 'task' | 'project';
export type ActivityEventType =
  | 'created'
  | 'updated'
  | 'status_changed'
  | 'deleted'
  | 'assignee_added'
  | 'assignee_removed'
  | 'comment_added'
  | 'checklist_item_added';

export type ActivityLog = {
  id: string;
  entity_type: ActivityEntityType;
  entity_id: string;
  event_type: ActivityEventType;
  actor_id: string | null;
  detail: Record<string, unknown> | null;
  created_at: string;
};

export type TaskComment = {
  id: string;
  task_id: string;
  author_id: string | null;
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

export type NotificationType = 'assigned' | 'unassigned' | 'deadline_soon' | 'comment';

export type Notification = {
  id: string;
  recipient_id: string;
  type: NotificationType;
  task_id: string;
  payload: Record<string, unknown> | null;
  read_at: string | null;
  created_at: string;
};

export type NotificationView = Notification & {
  taskTitle: string | null;
  taskStatus: TaskStatus | null;
};

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: Profile;
        Insert: Partial<Profile> & Pick<Profile, 'id' | 'name' | 'username'>;
        Update: Partial<Profile>;
        Relationships: [];
      };
      tasks: {
        Row: Task;
        Insert: Partial<Task> & Pick<Task, 'title'>;
        Update: Partial<Task>;
        Relationships: [];
      };
      task_pauses: {
        Row: TaskPause;
        Insert: Partial<TaskPause> & Pick<TaskPause, 'task_id'>;
        Update: Partial<TaskPause>;
        Relationships: [];
      };
      projects: {
        Row: Project;
        Insert: Partial<Project> & Pick<Project, 'name'>;
        Update: Partial<Project>;
        Relationships: [];
      };
      task_assignees: {
        Row: TaskAssignee;
        Insert: Partial<TaskAssignee> & Pick<TaskAssignee, 'task_id' | 'assignee_id'>;
        Update: Partial<TaskAssignee>;
        Relationships: [];
      };
      system_state: {
        Row: { key: string; value: string | null };
        Insert: { key: string; value?: string | null };
        Update: { key?: string; value?: string | null };
        Relationships: [];
      };
      activity_log: {
        Row: ActivityLog;
        Insert: Partial<ActivityLog> & Pick<ActivityLog, 'entity_type' | 'entity_id' | 'event_type'>;
        Update: Partial<ActivityLog>;
        Relationships: [];
      };
      task_comments: {
        Row: TaskComment;
        Insert: Partial<TaskComment> & Pick<TaskComment, 'task_id' | 'body'>;
        Update: Partial<TaskComment>;
        Relationships: [];
      };
      notifications: {
        Row: Notification;
        Insert: Partial<Notification> & Pick<Notification, 'recipient_id' | 'type' | 'task_id'>;
        Update: Partial<Notification>;
        Relationships: [];
      };
      task_checklist_items: {
        Row: TaskChecklistItem;
        Insert: Partial<TaskChecklistItem> & Pick<TaskChecklistItem, 'task_id' | 'title'>;
        Update: Partial<TaskChecklistItem>;
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
  };
}
