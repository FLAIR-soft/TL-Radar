'use server';

import { revalidatePath } from 'next/cache';
import { exec, row } from '@/lib/db/client';
import { getCurrentUser } from '@/lib/auth/current-user';
import { getLocaleCookie } from '@/lib/i18n/cookie';
import { getDictionary } from '@/lib/i18n/get-dictionary';
import { LABEL_COLORS } from '@/lib/logic/label-colors';
import type { ActivityEventType, Priority } from '@/lib/db/types';

// Проверять вход здесь больше нечего: за шлюзом MIDAS неаутентифицированный
// посетитель до приложения не доходит, а getCurrentUser() бросает исключение,
// если заголовка с почтой нет. Язык берётся из куки, а не из профиля.
async function requireAuth() {
  const user = await getCurrentUser();
  const dict = getDictionary(await getLocaleCookie());
  return { user, dict };
}

// Запись события в журнал. Раньше этим занимался logActivity() из
// lib/logic/activity-log.ts, но он принимал клиент Supabase, которого больше
// нет. Поведение сохранено: ошибка записи в журнал не должна ломать само
// действие, поэтому она глотается.
async function logProjectActivity(
  projectId: string,
  eventType: ActivityEventType,
  actor: string,
  detail?: Record<string, unknown>
): Promise<void> {
  try {
    await exec(
      `insert into activity_log (entity_type, entity_id, event_type, actor, detail)
       values ('project', $1, $2, $3, $4)`,
      [projectId, eventType, actor, detail ?? null]
    );
  } catch {
    // журнал не критичен для основного действия
  }
}

export interface ProjectFormState {
  error: string | null;
}

const PRIORITIES: Priority[] = ['low', 'medium', 'high', 'urgent'];

function readProjectFields(formData: FormData) {
  const name = String(formData.get('name') || '').trim();
  const description = String(formData.get('description') || '').trim();
  const location = String(formData.get('location') || '').trim();
  // Имя поля формы не меняется: теперь в нём лежит почта владельца.
  const ownerEmail = String(formData.get('ownerId') || '').trim();
  const icon = String(formData.get('icon') || '').trim();
  const priorityRaw = String(formData.get('priority') || '').trim();
  const colorRaw = String(formData.get('color') || '').trim();
  return {
    name,
    description: description || null,
    location: location || null,
    owner_email: ownerEmail || null,
    icon: icon || null,
    priority: ((PRIORITIES as string[]).includes(priorityRaw) ? priorityRaw : null) as Priority | null,
    color: (LABEL_COLORS as readonly string[]).includes(colorRaw) ? colorRaw : null,
  };
}

export async function createProject(
  _prevState: ProjectFormState,
  formData: FormData
): Promise<ProjectFormState> {
  const { user, dict } = await requireAuth();
  const fields = readProjectFields(formData);

  if (!fields.name) {
    return { error: dict.projects.errors.missingName };
  }

  let project: { id: string } | null = null;
  try {
    project = await row<{ id: string }>(
      `insert into projects (name, description, location, owner_email, icon, priority, color, created_by)
       values ($1, $2, $3, $4, $5, $6, $7, $8)
       returning id`,
      [
        fields.name,
        fields.description,
        fields.location,
        fields.owner_email,
        fields.icon,
        fields.priority,
        fields.color,
        user.email,
      ]
    );
  } catch (e) {
    return { error: e instanceof Error ? e.message : dict.projects.errors.missingName };
  }

  if (!project) {
    return { error: dict.projects.errors.missingName };
  }

  await logProjectActivity(project.id, 'created', user.email, { name: fields.name });

  revalidatePath('/projects');
  revalidatePath('/dashboard/new');
  return { error: null };
}

export async function editProject(
  projectId: string,
  _prevState: ProjectFormState,
  formData: FormData
): Promise<ProjectFormState> {
  const { user, dict } = await requireAuth();
  const fields = readProjectFields(formData);

  if (!fields.name) {
    return { error: dict.projects.errors.missingName };
  }

  try {
    await exec(
      `update projects
          set name = $1,
              description = $2,
              location = $3,
              owner_email = $4,
              icon = $5,
              priority = $6,
              color = $7
        where id = $8`,
      [
        fields.name,
        fields.description,
        fields.location,
        fields.owner_email,
        fields.icon,
        fields.priority,
        fields.color,
        projectId,
      ]
    );
  } catch (e) {
    return { error: e instanceof Error ? e.message : dict.projects.errors.missingName };
  }

  await logProjectActivity(projectId, 'updated', user.email, { name: fields.name });

  revalidatePath('/projects');
  revalidatePath('/dashboard/new');
  return { error: null };
}

export async function deleteProject(projectId: string) {
  const user = await getCurrentUser();
  await exec(`update projects set deleted_at = now() where id = $1`, [projectId]);
  await logProjectActivity(projectId, 'deleted', user.email);
  revalidatePath('/projects');
  revalidatePath('/dashboard/new');
}
