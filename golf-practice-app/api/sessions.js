// GET  /api/sessions  -> { sessions: [...] }
// POST /api/sessions  body: session or [sessions]  -> 201 { sessions: [inserted], skipped }
import { FOCUS_AREAS } from "../js/drills.js";
import { validateSession } from "../js/stats.js";
import { listSessions, insertSessions } from "./_lib/db.js";
import { json, error, withPlayer, ID_RE } from "./_lib/http.js";

const FOCUS_IDS = FOCUS_AREAS.map((f) => f.id);
const MAX_BATCH = 1000;

export const GET = withPlayer(async (_request, key) => {
  return json({ sessions: await listSessions(key) });
});

export const POST = withPlayer(async (request, key) => {
  let body;
  try {
    body = await request.json();
  } catch {
    return error(400, "Body must be JSON.");
  }
  const items = Array.isArray(body) ? body : [body];
  if (!items.length || items.length > MAX_BATCH) return error(400, `Send 1–${MAX_BATCH} sessions.`);

  const valid = [];
  for (const [i, raw] of items.entries()) {
    if (!raw || typeof raw !== "object") return error(400, `Session ${i + 1}: must be an object.`);
    const { session, errors } = validateSession(raw, FOCUS_IDS);
    if (errors) return error(400, `Session ${i + 1}: ${errors.join(" ")}`);
    const id = raw.id ?? crypto.randomUUID();
    if (typeof id !== "string" || !ID_RE.test(id)) return error(400, `Session ${i + 1}: invalid id.`);
    const createdAt = Number.isFinite(raw.createdAt) && raw.createdAt > 0 ? raw.createdAt : Date.now();
    valid.push({ ...session, id, createdAt });
  }

  const inserted = await insertSessions(key, valid);
  return json({ sessions: inserted, skipped: valid.length - inserted.length }, 201);
});
