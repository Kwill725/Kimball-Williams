// GET /api/health -> { ok: true } when the database is reachable.
import { ConfigError, ensureSchema } from "./_lib/db.js";
import { json } from "./_lib/http.js";

export async function GET() {
  try {
    await ensureSchema();
    return json({ ok: true });
  } catch (err) {
    if (!(err instanceof ConfigError)) console.error(err);
    return json({ ok: false, error: err instanceof ConfigError ? err.message : "Database unavailable." }, 503);
  }
}
