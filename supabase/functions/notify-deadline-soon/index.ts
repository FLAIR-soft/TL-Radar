import { createClient } from 'npm:@supabase/supabase-js@2'

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!  // обходит RLS, только на сервере
)

Deno.serve(async () => {
  const berlinNow = new Date(
    new Date().toLocaleString('en-US', { timeZone: 'Europe/Berlin' })
  )
  const minutesSinceMidnight = berlinNow.getHours() * 60 + berlinNow.getMinutes()

  if (minutesSinceMidnight < 7 * 60 + 30 || minutesSinceMidnight >= 16 * 60) {
    return new Response('Вне рабочих часов', { status: 200 })
  }

  const todayKey = berlinNow.toISOString().slice(0, 10)

  const { data: dueTasks } = await supabase
    .from('tasks')
    .select('id, title, deadline')
    .eq('deadline', todayKey)
    .neq('status', 'done')
    .is('deleted_at', null)

  let created = 0

  for (const t of dueTasks ?? []) {
    const { data: assignees } = await supabase
      .from('task_assignees')
      .select('assignee_id')
      .eq('task_id', t.id)
      .is('removed_at', null)

    for (const a of assignees ?? []) {
      // Анти-дубли: не создавать, если уже есть непрочитанное deadline_soon
      // по этой же задаче для того же получателя.
      const { data: existing } = await supabase
        .from('notifications')
        .select('id')
        .eq('recipient_id', a.assignee_id)
        .eq('task_id', t.id)
        .eq('type', 'deadline_soon')
        .is('read_at', null)
        .maybeSingle()

      if (existing) continue

      await supabase.from('notifications').insert({
        recipient_id: a.assignee_id,
        type: 'deadline_soon',
        task_id: t.id,
        payload: { title: t.title, deadline: t.deadline },
      })
      created++
    }
  }

  return new Response(`Deadline-soon: ${created} уведомлений`, { status: 200 })
})
