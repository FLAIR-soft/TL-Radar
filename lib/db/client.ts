import { Pool, types, type PoolClient, type QueryResultRow } from 'pg';

// Драйвер pg по умолчанию разбирает даты в объекты Date. Вся логика времени
// (lib/logic/tasks.ts, berlin-time.ts) и компоненты написаны под строки ISO —
// так их отдавал PostgREST. Возвращаем строки, чтобы ядро расчёта времени
// не пришлось трогать вообще: оно и так самое хрупкое место проекта.
types.setTypeParser(1082, (v) => v);                              // date  -> '2026-10-13'
types.setTypeParser(1114, (v) => new Date(v + 'Z').toISOString()); // timestamp
types.setTypeParser(1184, (v) => new Date(v).toISOString());       // timestamptz

// Единственная точка подключения к базе MIDAS.
//
// Строка подключения приходит на рантайме в DATABASE_URL — в образ её класть
// нельзя. Сертификат у базы самоподписанный: шифрование нужно, проверка
// сертификата сломает подключение (проверено на этапе 0).
//
// Пул живёт в globalThis, иначе в режиме разработки каждая перезагрузка модуля
// создаёт новый пул, и соединения к базе копятся до исчерпания лимита.

declare global {
  var __tlOrganizerPool: Pool | undefined;
}

function getPool(): Pool {
  if (!globalThis.__tlOrganizerPool) {
    const connectionString = process.env.DATABASE_URL;
    if (!connectionString) {
      throw new Error('DATABASE_URL не задан — приложению некуда ходить за данными');
    }
    globalThis.__tlOrganizerPool = new Pool({
      connectionString,
      ssl: { rejectUnauthorized: false },
      max: 10,
      idleTimeoutMillis: 30_000,
      connectionTimeoutMillis: 10_000,
    });
  }
  return globalThis.__tlOrganizerPool;
}

/** Все строки результата. */
export async function rows<T extends QueryResultRow = QueryResultRow>(
  text: string,
  params: readonly unknown[] = []
): Promise<T[]> {
  const res = await getPool().query<T>(text, params as unknown[]);
  return res.rows;
}

/** Первая строка или null. */
export async function row<T extends QueryResultRow = QueryResultRow>(
  text: string,
  params: readonly unknown[] = []
): Promise<T | null> {
  const res = await getPool().query<T>(text, params as unknown[]);
  return res.rows[0] ?? null;
}

/** Запрос без результата; возвращает число затронутых строк. */
export async function exec(
  text: string,
  params: readonly unknown[] = []
): Promise<number> {
  const res = await getPool().query(text, params as unknown[]);
  return res.rowCount ?? 0;
}

/**
 * Транзакция. Нужна там, где несколько записей обязаны произойти вместе:
 * смена статуса и закрытие паузы, создание задачи и назначение исполнителей.
 */
export async function tx<T>(fn: (client: PoolClient) => Promise<T>): Promise<T> {
  const client = await getPool().connect();
  try {
    await client.query('begin');
    const result = await fn(client);
    await client.query('commit');
    return result;
  } catch (e) {
    await client.query('rollback').catch(() => {});
    throw e;
  } finally {
    client.release();
  }
}
