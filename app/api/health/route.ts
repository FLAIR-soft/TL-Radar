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

// Этап 8. Два неизвестных о платформе, которые решают, как делать
// планировщик и уведомления:
//
//   1. Живёт ли контейнер между заходами. Если да — таймер внутри процесса
//      надёжнее ленивого пересчёта при первом визите.
//   2. Выпускает ли MIDAS контейнер в интернет. От этого зависит, возможен ли
//      Web Push (уведомления при закрытом приложении): службе доставки нужен
//      исходящий HTTPS.
//
// Время старта процесса фиксируем в модуле: он грузится один раз за жизнь
// контейнера, поэтому растущий uptime между заходами означает, что контейнер
// не перезапускался.
const processStarted = Date.now();

async function outboundProbe(url: string) {
  const started = Date.now();
  try {
    const res = await fetch(url, {
      method: 'HEAD',
      signal: AbortSignal.timeout(4000),
      cache: 'no-store',
    });
    return { url, ok: true, status: res.status, ms: Date.now() - started };
  } catch (e) {
    return { url, ok: false, ms: Date.now() - started, error: e instanceof Error ? e.message : String(e) };
  }
}

async function migrations() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) return { ok: false, error: 'DATABASE_URL отсутствует' };
  const client = new Client({ connectionString, ssl: { rejectUnauthorized: false }, connectionTimeoutMillis: 5000 });
  try {
    await client.connect();
    const { rows } = await client.query(
      "select version, left(checksum, 8) as checksum, applied_at from schema_migrations order by version"
    );
    const tables = await client.query(
      "select count(*)::int as n from information_schema.tables where table_schema = 'public'"
    );
    return { ok: true, applied: rows, tablesInPublic: tables.rows[0].n };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
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
    stage: 'диагностика: этапы 0 и 8',
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
    migrations: await migrations(),
    runtime: {
      uptimeSeconds: Math.round(process.uptime()),
      processStartedAt: new Date(processStarted).toISOString(),
      note: 'растущий uptime между заходами = контейнер живёт постоянно, таймер внутри процесса возможен',
    },
    outbound: {
      probes: await Promise.all([
        // Служба доставки Web Push у Chrome и у Firefox: именно до них нужен
        // доступ, а не до интернета вообще.
        outboundProbe('https://fcm.googleapis.com/'),
        outboundProbe('https://updates.push.services.mozilla.com/'),
        outboundProbe('https://example.com/'),
      ]),
      note: 'ok=true хотя бы у fcm — Web Push при закрытом приложении возможен',
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
