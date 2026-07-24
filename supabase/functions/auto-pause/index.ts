import { createClient } from 'npm:@supabase/supabase-js@2'

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!  // обходит RLS, только на сервере
)

Deno.serve(async () => {
  const berlinNow = new Date(
    new Date().toLocaleString('en-US', { timeZone: 'Europe/Berlin' })
  )
  const hour = berlinNow.getHours()
  const todayKey = berlinNow.toISOString().slice(0, 10)

  if (hour < 16) {
    return new Response('Ещё не 16:00 по Мюнхену', { status: 200 })
  }

  const { data: state } = await supabase
    .from('system_state')
    .select('value')
    .eq('key', 'last_auto_pause_date')
    .single()

  if (state?.value === todayKey) {
    return new Response('Уже выполнено сегодня', { status: 200 })
  }

  const nowIso = new Date().toISOString()

  const { data: activeTasks } = await supabase
    .from('tasks')
    .select('id')
    .eq('status', 'in_progress')

  for (const t of activeTasks ?? []) {
    await supabase.from('task_pauses').insert({
      task_id: t.id,
      paused_at: nowIso,
      auto: true
    })
    await supabase.from('tasks').update({ status: 'paused' }).eq('id', t.id)
  }

  await supabase
    .from('system_state')
    .update({ value: todayKey })
    .eq('key', 'last_auto_pause_date')

  return new Response(`Автопауза: ${activeTasks?.length ?? 0} задач`, { status: 200 })
})
