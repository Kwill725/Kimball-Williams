import { test } from "node:test";
import assert from "node:assert/strict";
import { validateSession, sortSessions, currentStreak, summarize, formatMinutes } from "../js/stats.js";

const FOCUS = ["driving", "putting"];

test("validateSession accepts valid input and normalizes types", () => {
  const { session, errors } = validateSession(
    { date: "2026-10-15", focus: "putting", minutes: "30", balls: "", rating: "4", notes: "  good  " },
    FOCUS
  );
  assert.equal(errors, undefined);
  assert.deepEqual(session, {
    date: "2026-10-15", focus: "putting", minutes: 30, balls: 0, rating: 4, notes: "good", drillId: null,
  });
});

test("validateSession reports each invalid field", () => {
  const { errors } = validateSession(
    { date: "nope", focus: "bowling", minutes: "0", balls: "-1", rating: "9" },
    FOCUS
  );
  assert.equal(errors.length, 5);
});

test("sortSessions orders newest first", () => {
  const sorted = sortSessions([
    { date: "2026-10-01", createdAt: 1 },
    { date: "2026-10-03", createdAt: 2 },
    { date: "2026-10-03", createdAt: 5 },
  ]);
  assert.deepEqual(sorted.map((s) => s.createdAt), [5, 2, 1]);
});

test("currentStreak counts consecutive days ending today", () => {
  const today = new Date(2026, 9, 16);
  const sessions = ["2026-10-16", "2026-10-15", "2026-10-14", "2026-10-12"].map((date) => ({ date }));
  assert.equal(currentStreak(sessions, today), 3);
});

test("currentStreak stays alive if last practice was yesterday", () => {
  const today = new Date(2026, 9, 16);
  assert.equal(currentStreak([{ date: "2026-10-15" }, { date: "2026-10-14" }], today), 2);
});

test("currentStreak is 0 after a missed day", () => {
  const today = new Date(2026, 9, 16);
  assert.equal(currentStreak([{ date: "2026-10-13" }], today), 0);
  assert.equal(currentStreak([], today), 0);
});

test("summarize aggregates totals", () => {
  const today = new Date(2026, 9, 16);
  const s = summarize(
    [
      { date: "2026-10-16", focus: "putting", minutes: 30, balls: 0, rating: 4 },
      { date: "2026-10-15", focus: "driving", minutes: 45, balls: 80, rating: 3 },
      { date: "2026-10-15", focus: "putting", minutes: 15, balls: 0, rating: 5 },
    ],
    today
  );
  assert.equal(s.sessionCount, 3);
  assert.equal(s.totalMinutes, 90);
  assert.equal(s.totalBalls, 80);
  assert.equal(s.avgRating, 4);
  assert.equal(s.streak, 2);
  assert.deepEqual(s.minutesByFocus, { putting: 45, driving: 45 });
});

test("summarize handles no sessions", () => {
  const s = summarize([]);
  assert.equal(s.sessionCount, 0);
  assert.equal(s.avgRating, 0);
});

test("formatMinutes", () => {
  assert.equal(formatMinutes(45), "45m");
  assert.equal(formatMinutes(60), "1h");
  assert.equal(formatMinutes(90), "1h 30m");
});
