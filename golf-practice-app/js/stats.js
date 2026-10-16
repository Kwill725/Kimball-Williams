// Pure functions for validating sessions and computing practice stats.
// Kept free of DOM/storage access so they can be unit tested in Node.

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const DRILL_ID_RE = /^[a-z0-9-]{1,64}$/;
export const MAX_NOTES = 2000;

/**
 * Validate and normalize raw form input into a session object.
 * Returns { session } on success or { errors } on failure.
 */
export function validateSession(input, validFocusIds) {
  const errors = [];
  const date = String(input.date ?? "").trim();
  const focus = String(input.focus ?? "").trim();
  const minutes = Number(input.minutes);
  const balls = input.balls === "" || input.balls == null ? 0 : Number(input.balls);
  const rating = Number(input.rating);
  const notes = String(input.notes ?? "").trim();

  if (!DATE_RE.test(date) || Number.isNaN(Date.parse(date))) errors.push("Enter a valid date.");
  if (!validFocusIds.includes(focus)) errors.push("Choose a focus area.");
  if (!Number.isInteger(minutes) || minutes < 1 || minutes > 600) errors.push("Duration must be 1–600 minutes.");
  if (!Number.isInteger(balls) || balls < 0 || balls > 2000) errors.push("Balls hit must be 0–2000.");
  if (!Number.isInteger(rating) || rating < 1 || rating > 5) errors.push("Rating must be 1–5.");
  if (notes.length > MAX_NOTES) errors.push(`Notes must be ${MAX_NOTES} characters or fewer.`);

  if (errors.length) return { errors };
  const drillId = typeof input.drillId === "string" && DRILL_ID_RE.test(input.drillId) ? input.drillId : null;
  return {
    session: { date, focus, minutes, balls, rating, notes, drillId },
  };
}

/** Sort sessions newest first (by date, then creation time). */
export function sortSessions(sessions) {
  return [...sessions].sort(
    (a, b) => b.date.localeCompare(a.date) || (b.createdAt ?? 0) - (a.createdAt ?? 0)
  );
}

/** Number of consecutive days with practice, ending today or yesterday. */
export function currentStreak(sessions, today = new Date()) {
  const days = new Set(sessions.map((s) => s.date));
  const cursor = new Date(Date.UTC(today.getFullYear(), today.getMonth(), today.getDate()));
  const key = (d) => d.toISOString().slice(0, 10);

  // A streak is still alive if you practiced yesterday but not yet today.
  if (!days.has(key(cursor))) cursor.setUTCDate(cursor.getUTCDate() - 1);

  let streak = 0;
  while (days.has(key(cursor))) {
    streak++;
    cursor.setUTCDate(cursor.getUTCDate() - 1);
  }
  return streak;
}

/** Aggregate totals across all sessions. */
export function summarize(sessions, today = new Date()) {
  const totalMinutes = sessions.reduce((sum, s) => sum + s.minutes, 0);
  const totalBalls = sessions.reduce((sum, s) => sum + (s.balls || 0), 0);
  const avgRating = sessions.length
    ? Math.round((sessions.reduce((sum, s) => sum + s.rating, 0) / sessions.length) * 10) / 10
    : 0;

  const minutesByFocus = {};
  for (const s of sessions) {
    minutesByFocus[s.focus] = (minutesByFocus[s.focus] || 0) + s.minutes;
  }

  return {
    sessionCount: sessions.length,
    totalMinutes,
    totalBalls,
    avgRating,
    streak: currentStreak(sessions, today),
    minutesByFocus,
  };
}

/** Format minutes as e.g. "1h 30m" or "45m". */
export function formatMinutes(total) {
  const h = Math.floor(total / 60);
  const m = total % 60;
  if (!h) return `${m}m`;
  return m ? `${h}h ${m}m` : `${h}h`;
}
