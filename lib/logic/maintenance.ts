import { tx } from '@/lib/db/client';
import { berlinCalendarDate, workWindowForBerlinDay } from '@/lib/logic/berlin-time';
import { computeNextRunAt } from '@/lib/logic/recurring';
import type { PoolClient } from 'pg';
import type { RecurringFrequency } from '@/lib/db/types';

/**
 * Этап 8. Замена планировщика Supabase.
 *
 * На pg_cron висели две вещи: автопауза всех задач «в работе» в 16:00 и
 * исполнение правил повторяющихся задач. На MIDAS планировщика нет, поэтому
 * обе выполняются лениво — при первом заходе человека на доску после того,
 * как для них настало время. Для человека результат тот же: он всё равно
 * видит доску только когда открыл её.
 *
 * Обе операции идемпотентны и защищены блокировкой на время транзакции:
 * два одновременных захода не создадут ни двойной паузы, ни двойной задачи.
 */

// Ключ блокировки. Соседний с ключом раннера миграций (4815162342), чтобы
// было видно, что это соседние служебные механизмы.
const LOCK_KEY = 4815162343;

function dateKey(year: number, month: number, day: number): string {
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

export interface MaintenanceResult {
  skipped: boolean;
  pausedTasks: number;
  createdTasks: number;
}

export async function runDueMaintenance(now = new Date()): Promise<MaintenanceResult> {
  return tx(async (client) => {
    // Блокировка уровня транзакции: снимается сама, в том числе при ошибке.
    // Не дождавшийся её заход просто уходит — работу уже делает другой.
    const lock = await client.query<{ locked: boolean }>(
      'select pg_try_advisory_xact_lock($1) as locked',
      [LOCK_KEY]
    );
    if (!lock.rows[0]?.locked) {
      return { skipped: true, pausedTasks: 0, createdTasks: 0 };
    }

    const { year, month, day } = berlinCalendarDate(now);
    const today = dateKey(year, month, day);

    return {
      skipped: false,
      pausedTasks: await autoPause(client, now, year, month, day, today),
      createdTasks: await runRecurringRules(client, today),
    };
  });
}

/**
 * Автопауза. Раньше её раз в 15 минут дёргал pg_cron и ставил паузу на момент
 * срабатывания — то есть с опозданием до четверти часа. Здесь момент паузы
 * считается точно: конец рабочего окна той даты, 16:00 по Мюнхену с учётом
 * перевода часов. Задним числом — и поэтому точнее прежнего.
 */
async function autoPause(
  client: PoolClient,
  now: Date,
  year: number,
  month: number,
  day: number,
  today: string
): Promise<number> {
  const { end } = workWindowForBerlinDay(year, month, day);
  if (now.getTime() < end) return 0; // рабочий день ещё идёт

  const state = await client.query<{ value: string | null }>(
    `select value #>> '{}' as value from system_state where key = 'last_auto_pause_date'`
  );
  if (state.rows[0]?.value === today) return 0; // сегодня уже отработали

  const pausedAt = new Date(end).toISOString();

  // Открытую паузу не дублируем: задача могла быть поставлена на паузу
  // человеком и снова запущена — тогда открытой записи нет и пауза нужна.
  const paused = await client.query(
    `insert into task_pauses (task_id, paused_at, auto)
     select t.id, $1::timestamptz, true
       from tasks t
      where t.status = 'in_progress'
        and t.deleted_at is null
        and not exists (
          select 1 from task_pauses p
           where p.task_id = t.id and p.resumed_at is null
        )`,
    [pausedAt]
  );

  await client.query(
    `update tasks set status = 'paused'
      where status = 'in_progress' and deleted_at is null`
  );

  await client.query(
    `insert into system_state (key, value, updated_at)
     values ('last_auto_pause_date', to_jsonb($1::text), now())
     on conflict (key) do update
       set value = excluded.value, updated_at = now()`,
    [today]
  );

  return paused.rowCount ?? 0;
}

/**
 * Повторяющиеся правила. Если приложение не открывали несколько дней,
 * просроченное правило создаёт одну задачу, а не по одной за каждый
 * пропущенный день: пять одинаковых задач в понедельник — мусор, а не польза.
 * Следующий запуск считается от сегодняшней даты, поэтому правило не
 * срабатывает повторно в том же заходе.
 */
async function runRecurringRules(client: PoolClient, today: string): Promise<number> {
  const due = await client.query<{
    rule_id: string;
    frequency: RecurringFrequency;
    weekday: number | null;
    day_of_month: number | null;
    created_by: string | null;
    title: string;
    description: string | null;
    location: string | null;
    estimated_minutes: number | null;
    priority: string | null;
    icon: string | null;
    project_id: string | null;
    checklist: string[] | null;
  }>(
    `select r.id as rule_id, r.frequency, r.weekday, r.day_of_month, r.created_by,
            t.title, t.description, t.location, t.estimated_minutes,
            t.priority, t.icon, t.project_id, t.checklist
       from recurring_rules r
       join task_templates t on t.id = r.template_id
      where r.active
        and r.deleted_at is null
        and t.deleted_at is null
        and r.next_run_at <= $1::date
      order by r.next_run_at`,
    [today]
  );

  for (const rule of due.rows) {
    const created = await client.query<{ id: string }>(
      `insert into tasks (title, description, location, estimated_minutes,
                          priority, icon, project_id, created_by)
       values ($1, coalesce($2, ''), coalesce($3, ''), $4, $5, $6, $7, $8)
       returning id`,
      [
        rule.title,
        rule.description,
        rule.location,
        rule.estimated_minutes,
        rule.priority,
        rule.icon,
        rule.project_id,
        rule.created_by,
      ]
    );

    const checklist = rule.checklist ?? [];
    if (checklist.length) {
      await client.query(
        `insert into task_checklist_items (task_id, title, position)
         select $1::uuid, item, (ord - 1)::int
           from unnest($2::text[]) with ordinality as x(item, ord)`,
        [created.rows[0].id, checklist]
      );
    }

    await client.query(
      `update recurring_rules set next_run_at = $1::date where id = $2`,
      [computeNextRunAt(rule.frequency, rule.weekday, rule.day_of_month, today), rule.rule_id]
    );

    await client.query(
      `insert into activity_log (entity_type, entity_id, event_type, actor, detail)
       values ('task', $1, 'created', null, jsonb_build_object('recurringRuleId', $2::text))`,
      [created.rows[0].id, rule.rule_id]
    );
  }

  return due.rows.length;
}
