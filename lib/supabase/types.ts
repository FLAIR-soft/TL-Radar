export type UserRole = 'viewer' | 'editor' | 'admin';
export type TaskStatus = 'waiting' | 'in_progress' | 'paused' | 'done';

export type Profile = {
  id: string;
  name: string;
  role: UserRole;
  created_at: string;
};

export type Task = {
  id: string;
  person: string;
  title: string;
  description: string;
  location: string;
  deadline: string | null;
  status: TaskStatus;
  created_at: string;
  started_at: string | null;
  completed_at: string | null;
  created_by: string | null;
};

export type TaskPause = {
  id: string;
  task_id: string;
  paused_at: string;
  resumed_at: string | null;
  auto: boolean;
};

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: Profile;
        Insert: Partial<Profile> & Pick<Profile, 'id' | 'name'>;
        Update: Partial<Profile>;
        Relationships: [];
      };
      tasks: {
        Row: Task;
        Insert: Partial<Task> & Pick<Task, 'person' | 'title'>;
        Update: Partial<Task>;
        Relationships: [];
      };
      task_pauses: {
        Row: TaskPause;
        Insert: Partial<TaskPause> & Pick<TaskPause, 'task_id'>;
        Update: Partial<TaskPause>;
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
