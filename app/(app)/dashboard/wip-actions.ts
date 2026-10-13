'use server';

import { revalidatePath } from 'next/cache';
import { exec, rows } from '@/lib/db/client';
import { getCurrentUser } from '@/lib/auth/current-user';
import { getLocale } from '@/lib/i18n/locale';
import { getDictionary } from '@/lib/i18n/get-dictionary';
import type { WipLimit, WipStatus } from '@/lib/db/types';

export async function getWipLimits(): Promise<WipLimit[]> {
  return rows<WipLimit>(`select * from wip_limits`);
}

// Раньше менять лимиты мог только профиль с ролью admin. Ролей в новой базе
// нет вовсе (их держала таблица profiles), поэтому проверка прав здесь
// переехать было некуда: лимиты меняет любой, кто дошёл до приложения.
// Проверка входа сводится к getCurrentUser() — он бросает исключение, если
// заголовка с почтой нет. Язык берётся из куки.
export async function updateWipLimit(status: WipStatus, limit: number | null): Promise<{ error?: string }> {
  await getCurrentUser();
  const dict = getDictionary(await getLocale());

  try {
    await exec(
      `update wip_limits set limit_count = $1 where status = $2`,
      [limit && limit > 0 ? Math.round(limit) : null, status]
    );
  } catch (e) {
    return { error: e instanceof Error ? e.message : dict.wipLimits.errors.forbidden };
  }

  revalidatePath('/dashboard');
  revalidatePath('/admin');
  return {};
}
