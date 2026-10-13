// Раннер миграций TL-Organizer. Запускается при старте контейнера до сервера:
// если схема не применилась, приложение не должно подняться вовсе — иначе
// получим приложение, которое молча не работает, а логов рантайма MIDAS не даёт.
//
// Обычный CommonJS без сборки: файл копируется в образ как есть.
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { Client } = require('pg');

const DIR = path.join(__dirname, 'migrations');
const LOCK_KEY = 4815162342; // любой постоянный ключ для advisory lock

function log(...a) { console.log('[migrate]', ...a); }

async function main() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    console.error('[migrate] DATABASE_URL не задан — миграции применять некуда');
    process.exit(1);
  }

  const files = fs.readdirSync(DIR).filter((f) => f.endsWith('.sql')).sort();
  log(`найдено файлов: ${files.length}`);

  // Сертификат у базы MIDAS самоподписанный: шифрование нужно, проверка — нет.
  const client = new Client({ connectionString, ssl: { rejectUnauthorized: false } });
  await client.connect();

  try {
    // Два контейнера при одновременном старте не должны применять одно и то же.
    await client.query('select pg_advisory_lock($1)', [LOCK_KEY]);

    await client.query(`
      create table if not exists schema_migrations (
        version    text primary key,
        checksum   text not null,
        applied_at timestamptz not null default now()
      )
    `);

    const { rows } = await client.query('select version, checksum from schema_migrations');
    const applied = new Map(rows.map((r) => [r.version, r.checksum]));

    let count = 0;
    for (const file of files) {
      const sql = fs.readFileSync(path.join(DIR, file), 'utf8');
      const checksum = crypto.createHash('sha256').update(sql).digest('hex').slice(0, 16);

      if (applied.has(file)) {
        // Уже применённый файл изменять нельзя: база и репозиторий разъедутся
        // молча, и это вскроется в самый неудобный момент.
        if (applied.get(file) !== checksum) {
          throw new Error(
            `${file} уже применён, но его содержимое изменилось ` +
            `(было ${applied.get(file)}, стало ${checksum}). ` +
            `Правьте схему новым файлом, а не этим.`
          );
        }
        continue;
      }

      log(`применяю ${file}`);
      await client.query('begin');
      try {
        await client.query(sql);
        await client.query(
          'insert into schema_migrations (version, checksum) values ($1, $2)',
          [file, checksum]
        );
        await client.query('commit');
        count++;
      } catch (e) {
        await client.query('rollback');
        throw new Error(`${file}: ${e.message}`);
      }
    }

    log(count === 0 ? 'нечего применять, схема актуальна' : `применено файлов: ${count}`);
  } finally {
    await client.query('select pg_advisory_unlock($1)', [LOCK_KEY]).catch(() => {});
    await client.end().catch(() => {});
  }
}

main().catch((e) => {
  console.error('[migrate] ОШИБКА:', e.message);
  process.exit(1);
});
