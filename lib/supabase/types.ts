export type UserRole = 'viewer' | 'editor' | 'admin';
export type TaskStatus = 'waiting' | 'in_progress' | 'paused' | 'done';
export type Locale = 'ru' | 'de' | 'en';

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
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
  };
}
