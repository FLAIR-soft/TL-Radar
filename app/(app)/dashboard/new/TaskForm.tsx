'use client';

import { useActionState } from 'react';
import Link from 'next/link';
import type { TaskFormState } from '../actions';

const initialState: TaskFormState = { error: null };

export function TaskForm({
  action,
  editing,
}: {
  action: (prevState: TaskFormState, formData: FormData) => Promise<TaskFormState>;
  editing: {
    person: string;
    title: string;
    description: string;
    location: string;
    deadline: string;
  } | null;
}) {
  const [state, formAction, pending] = useActionState(action, initialState);

  return (
    <>
      <h2 className="section-title">{editing ? 'Редактирование задачи' : 'Новая задача'}</h2>
      <p className="section-sub">
        Заполните поля — задача появится на дешборде со статусом «Ожидание».
      </p>
      <div className="form-card">
        <form action={formAction}>
          {state.error && <div className="error-note">{state.error}</div>}
          <div className="row2">
            <div className="field">
              <label>Человек</label>
              <input type="text" name="person" defaultValue={editing?.person} placeholder="Кто выполняет" />
            </div>
            <div className="field">
              <label>Дедлайн</label>
              <input type="date" name="deadline" defaultValue={editing?.deadline} />
            </div>
          </div>
          <div className="field">
            <label>Название задачи</label>
            <input type="text" name="title" defaultValue={editing?.title} placeholder="Кратко, суть задачи" />
          </div>
          <div className="field">
            <label>Описание</label>
            <textarea name="description" defaultValue={editing?.description} placeholder="Детали задачи" />
          </div>
          <div className="field">
            <label>Место проведения</label>
            <input
              type="text"
              name="location"
              defaultValue={editing?.location}
              placeholder="Где физически проходит"
            />
          </div>
          <div className="form-actions">
            <button className="btn btn-primary" disabled={pending} type="submit">
              {editing ? 'Сохранить изменения' : 'Добавить задачу'}
            </button>
            {editing && (
              <Link href="/dashboard" className="btn btn-ghost">
                Отмена
              </Link>
            )}
          </div>
        </form>
      </div>
    </>
  );
}
