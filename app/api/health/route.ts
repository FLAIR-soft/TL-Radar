import { headers } from 'next/headers';
import { NextResponse } from 'next/server';
import { Client } from 'pg';

// Диагностика этапа 0 плана 2026-10. Логов работающего контейнера MIDAS не
// отдаёт, поэтому единственный способ увидеть, что происходит внутри, —
// спросить само приложение. Маршрут доступен только сотрудникам MIFCOM:
// шлюз не пускает сюда никого без входа через Entra.
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const PROBE_COOKIE = 'tlo_probe';

function describeDatabaseUrl(raw: string | undefined) {
  if (!raw) return { present: false };
  try {
    const u = new URL(raw);
    return {
      present: true,
      protocol: u.protocol.replace(':', ''),
      host: u.hostname,
      port: u.port || '5432',
      database: u.pathname.replace(/^\//, ''),
      user: u.username || null,
      // Пароль не печатаем — только факт, что он есть.
      hasPassword: u.password.length > 0,
    };
  } catch {
    return { present: true, parseError: 'DATABASE_URL не разбирается как URL' };
  }
}

async function probe(label: string, ssl: false | { rejectUnauthorized: boolean }) {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) return { mode: label, attempted: false, ok: false, error: 'DATABASE_URL отсутствует' };

  const started = Date.now();
  const client = new Client({ connectionString, ssl, connectionTimeoutMillis: 5000 });
  try {
    await client.connect();
    const { rows } = await client.query(
      'select version() as version, current_database() as database, current_user as "user", now() as now'
    );
    return { mode: label, attempted: true, ok: true, ms: Date.now() - started, ...rows[0] };
  } catch (e) {
    return {
      mode: label,
      attempted: true,
      ok: false,
      ms: Date.now() - started,
      error: e instanceof Error ? e.message : String(e),
    };
  } finally {
    await client.end().catch(() => {});
  }
}

export async function GET() {
  const h = await headers();

  // Заголовки личности от шлюза MIDAS.
  const identity: Record<string, string | null> = {};
  for (const name of [
    'x-auth-request-email',
    'x-auth-request-user',
    'x-auth-request-preferred-username',
    'x-auth-request-display-name',
  ]) {
    identity[name] = h.get(name);
  }

  // Куки: шлюз обязан снимать Cookie с запроса и Set-Cookie с ответа.
  // Ставим пробную куку и смотрим, вернётся ли она при следующем заходе.
  const cookieHeader = h.get('cookie');
  const cookies = {
    requestHeaderPresent: cookieHeader !== null,
    probeCookieEchoed: cookieHeader?.includes(PROBE_COOKIE + '=') ?? false,
    note: 'probeCookieEchoed=true при повторном заходе означает, что Set-Cookie дошёл до браузера',
  };

  const body = {
    service: 'tl-organizer',
    stage: 'этап 0 — каркас и диагностика',
    now: new Date().toISOString(),
    node: process.version,
    env: {
      NODE_ENV: process.env.NODE_ENV ?? null,
      PORT: process.env.PORT ?? null,
      HOSTNAME: process.env.HOSTNAME ?? null,
      DATABASE_URL: describeDatabaseUrl(process.env.DATABASE_URL),
      PGHOST: process.env.PGHOST ?? null,
      PGPORT: process.env.PGPORT ?? null,
      PGDATABASE: process.env.PGDATABASE ?? null,
      PGUSER: process.env.PGUSER ?? null,
      PGPASSWORD: process.env.PGPASSWORD ? 'задан (не показывается)' : null,
    },
    database: {
      ssl: await probe('ssl, rejectUnauthorized: false', { rejectUnauthorized: false }),
      plain: await probe('без ssl', false),
    },
    identity,
    cookies,
    forwarding: {
      host: h.get('host'),
      'x-forwarded-proto': h.get('x-forwarded-proto'),
      'x-forwarded-for': h.get('x-forwarded-for') ? 'присутствует (не показывается)' : null,
    },
  };

  const res = NextResponse.json(body, { status: 200 });
  res.cookies.set(PROBE_COOKIE, '1', { httpOnly: true, sameSite: 'lax', path: '/' });
  return res;
}
