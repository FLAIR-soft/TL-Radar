import { createClient } from 'npm:@supabase/supabase-js@2'

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!  // обходит RLS, только на сервере
)

// Chistaya kalendarnaya arifmetika — dublirovana iz lib/logic/recurring.ts,
// t.k. Edge Function razvyortyvayetsya otdel'no ot Next.js-prilozheniya i ne
// mozhet import'irovat' yego fayly (sm. auto-pause/notify-deadline-soon —
// tot zhe printsip samodostatochnosti). Uchityvayem tol'ko rabochiye dni.
function isoWeekday(d: Date): number {
  const day = d.getUTCDay()
  return day === 0 ? 7 : day
}

function addDaysUTC(d: Date, days: number): Date {
  const copy = new Date(d)
  copy.setUTCDate(copy.getUTCDate() + days)
  return copy
}

function toDateKey(d: Date): string {
  return d.toISOString().slice(0, 10)
}

function daysInMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month + 1, 0)).getUTCDate()
}

function monthCandidate(year: number, month: number, day: number): Date {
  return new Date(Date.UTC(year, month, Math.min(day, daysInMonth(year, month))))
}

function nextWorkday(fromKey: string): string {
  let d = addDaysUTC(new Date(fromKey + 'T00:00:00Z'), 1)
  while (isoWeekday(d) > 5) d = addDaysUTC(d, 1)
  return toDateKey(d)
}

function nextWeekday(fromKey: string, weekday: number): string {
  let d = addDaysUTC(new Date(fromKey + 'T00:00:00Z'), 1)
  while (isoWeekday(d) !== weekday) d = addDaysUTC(d, 1)
  return toDateKey(d)
}

function nextMonthDay(fromKey: string, dayOfMonth: number): string {
  const from = new Date(fromKey + 'T00:00:00Z')
  const year = from.getUTCFullYear()
  const month = from.getUTCMonth()
  let candidate = monthCandidate(year, month, dayOfMonth)
  if (candidate <= from) {
    candidate = monthCandidate(year, month + 1, dayOfMonth)
  }
  while (isoWeekday(candidate) > 5) candidate = addDaysUTC(candidate, 1)
  return toDateKey(candidate)
}

function computeNextRunAt(
  frequency: string,
  weekday: number | null,
  dayOfMonth: number | null,
  fromKey: string
): string {
  if (frequency === 'daily') return nextWorkday(fromKey)
  if (frequency === 'weekly') return nextWeekday(fromKey, weekday!)
  return nextMonthDay(fromKey, dayOfMonth!)
}

Deno.serve(async () => {
  const berlinNow = new Date(
    new Date().toLocaleString('en-US', { timeZone: 'Europe/Berlin' })
  )
  const minutesSinceMidnight = berlinNow.getHours() * 60 + berlinNow.getMinutes()

  // Pravila obrabatyvayutsya raz v den', v nachale rabochego okna.
  if (minutesSinceMidnight < 7 * 60 + 30 || minutesSinceMidnight >= 8 * 60 + 30) {
    return new Response('Не время для повторяющихся правил', { status: 200 })
  }

  const todayKey = berlinNow.toISOString().slice(0, 10)

  const { data: rules } = await supabase
    .from('recurring_rules')
    .select('id, template_id, frequency, weekday, day_of_month, created_by')
    .eq('active', true)
    .is('deleted_at', null)
    .lte('next_run_at', todayKey)

  let created = 0

  for (const rule of rules ?? []) {
    const { data: template } = await supabase
      .from('task_templates')
      .select('title, description, location, estimated_minutes, priority, icon, project_id, checklist')
      .eq('id', rule.template_id)
      .is('deleted_at', null)
      .maybeSingle()

    if (template) {
      const { data: task } = await supabase
        .from('tasks')
        .insert({
          title: template.title,
          description: template.description,
          location: template.location,
          estimated_minutes: template.estimated_minutes,
          priority: template.priority,
          icon: template.icon,
          project_id: template.project_id,
          status: 'waiting',
          created_by: rule.created_by,
          updated_by: rule.created_by,
        })
        .select('id')
        .single()

      if (task) {
        created++

        if (rule.created_by) {
          await supabase.from('task_assignees').insert({
            task_id: task.id,
            assignee_id: rule.created_by,
            added_at: new Date().toISOString(),
            added_by: rule.created_by,
          })
        }

        const checklist = (template.checklist as string[] | null) ?? []
        for (let i = 0; i < checklist.length; i++) {
          await supabase
            .from('task_checklist_items')
            .insert({ task_id: task.id, title: checklist[i], position: i })
        }

        await supabase.from('activity_log').insert({
          entity_type: 'task',
          entity_id: task.id,
          event_type: 'created',
          actor_id: rule.created_by,
          detail: { title: template.title, recurring: true },
        })
      }
    }

    const nextRunAt = computeNextRunAt(rule.frequency, rule.weekday, rule.day_of_month, todayKey)
    await supabase.from('recurring_rules').update({ next_run_at: nextRunAt }).eq('id', rule.id)
  }

  return new Response(`Повторяющиеся правила: ${created} задач создано`, { status: 200 })
})
