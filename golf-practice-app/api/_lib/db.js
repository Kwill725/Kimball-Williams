// Postgres access. Files under api/_lib are helpers, not routes (Vercel skips "_" paths).
import postgres from "postgres";

let sql;
let schemaReady;

export class ConfigError extends Error {}

export function getSql() {
  if (!sql) {
    const url = process.env.DATABASE_URL || process.env.POSTGRES_URL;
    if (!url) throw new ConfigError("DATABASE_URL is not configured.");
    // Serverless: keep one connection per instance; prepare:false works with poolers (Neon -pooler, PgBouncer).
    sql = postgres(url, { max: 1, idle_timeout: 20, prepare: false });
  }
  return sql;
}

/** Create tables if needed. Cached per function instance, so it runs once per cold start. */
export function ensureSchema() {
  schemaReady ??= (async () => {
    const db = getSql();
    await db`
      CREATE TABLE IF NOT EXISTS practice_sessions (
        player_key  text        NOT NULL,
        id          text        NOT NULL,
        date        date        NOT NULL,
        focus       text        NOT NULL,
        minutes     integer     NOT NULL CHECK (minutes BETWEEN 1 AND 600),
        balls       integer     NOT NULL DEFAULT 0 CHECK (balls BETWEEN 0 AND 2000),
        rating      smallint    NOT NULL CHECK (rating BETWEEN 1 AND 5),
        notes       text        NOT NULL DEFAULT '',
        drill_id    text,
        created_at  timestamptz NOT NULL DEFAULT now(),
        PRIMARY KEY (player_key, id)
      )`;
    await db`
      CREATE INDEX IF NOT EXISTS practice_sessions_player_date_idx
        ON practice_sessions (player_key, date DESC, created_at DESC)`;
  })().catch((err) => {
    schemaReady = undefined; // retry on next request
    throw err;
  });
  return schemaReady;
}

const COLUMNS = (db) => db`
  id, date::text AS date, focus, minutes, balls, rating, notes,
  drill_id AS "drillId", (extract(epoch FROM created_at) * 1000)::bigint AS "createdAt"`;

function toClient(row) {
  return { ...row, createdAt: Number(row.createdAt) };
}

export async function listSessions(playerKey) {
  const db = getSql();
  const rows = await db`
    SELECT ${COLUMNS(db)} FROM practice_sessions
    WHERE player_key = ${playerKey}
    ORDER BY date DESC, created_at DESC
    LIMIT 5000`;
  return rows.map(toClient);
}

/** Insert sessions; ids that already exist for this player are skipped (makes uploads idempotent). */
export async function insertSessions(playerKey, sessions) {
  if (!sessions.length) return [];
  const db = getSql();
  const rows = sessions.map((s) => ({
    player_key: playerKey,
    id: s.id,
    date: s.date,
    focus: s.focus,
    minutes: s.minutes,
    balls: s.balls,
    rating: s.rating,
    notes: s.notes,
    drill_id: s.drillId,
    created_at: new Date(s.createdAt),
  }));
  const inserted = await db`
    INSERT INTO practice_sessions ${db(rows)}
    ON CONFLICT (player_key, id) DO NOTHING
    RETURNING ${COLUMNS(db)}`;
  return inserted.map(toClient);
}

export async function deleteSession(playerKey, id) {
  const db = getSql();
  const result = await db`
    DELETE FROM practice_sessions WHERE player_key = ${playerKey} AND id = ${id}`;
  return result.count > 0;
}

export async function closeDb() {
  if (sql) await sql.end({ timeout: 5 });
  sql = undefined;
  schemaReady = undefined;
}
