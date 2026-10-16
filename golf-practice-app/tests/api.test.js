// Integration tests for the API handlers. Needs a real Postgres: set DATABASE_URL (e.g. in .env).
import { test, after } from "node:test";
import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";

const skip = !(process.env.DATABASE_URL || process.env.POSTGRES_URL) && "DATABASE_URL not set";

const sessionsRoute = await import("../api/sessions.js");
const sessionRoute = await import("../api/sessions/[id].js");
const healthRoute = await import("../api/health.js");
const { getSql, closeDb } = await import("../api/_lib/db.js");
const { playerKey } = await import("../api/_lib/http.js");

const newToken = () => randomBytes(24).toString("base64url");
const tokens = [];

function call(handler, method, path, { token, body } = {}) {
  const headers = {};
  if (token) headers.authorization = `Bearer ${token}`;
  if (body !== undefined) headers["content-type"] = "application/json";
  const request = new Request(`http://localhost${path}`, {
    method,
    headers,
    body: body === undefined ? undefined : typeof body === "string" ? body : JSON.stringify(body),
  });
  return handler(request);
}

const sample = (over = {}) => ({ date: "2026-10-15", focus: "putting", minutes: 30, balls: 0, rating: 4, notes: "", ...over });

function player() {
  const token = newToken();
  tokens.push(token);
  return token;
}

after(async () => {
  if (skip) return;
  const keys = tokens.map((t) => playerKey(new Request("http://x", { headers: { authorization: `Bearer ${t}` } })));
  await getSql()`DELETE FROM practice_sessions WHERE player_key IN ${getSql()(keys)}`;
  await closeDb();
});

test("health reports ok", { skip }, async () => {
  const res = await healthRoute.GET(new Request("http://localhost/api/health"));
  assert.equal(res.status, 200);
  assert.deepEqual(await res.json(), { ok: true });
});

test("requests without a valid sync code are rejected", { skip }, async () => {
  assert.equal((await call(sessionsRoute.GET, "GET", "/api/sessions")).status, 401);
  assert.equal((await call(sessionsRoute.GET, "GET", "/api/sessions", { token: "short" })).status, 401);
});

test("create, list, and delete a session", { skip }, async () => {
  const token = player();
  const created = await call(sessionsRoute.POST, "POST", "/api/sessions", { token, body: sample({ notes: "Hi", drillId: "circle-drill" }) });
  assert.equal(created.status, 201);
  const { sessions: [s] } = await created.json();
  assert.equal(s.date, "2026-10-15");
  assert.equal(s.drillId, "circle-drill");
  assert.equal(typeof s.createdAt, "number");

  const list = await (await call(sessionsRoute.GET, "GET", "/api/sessions", { token })).json();
  assert.deepEqual(list.sessions, [s]);

  assert.equal((await call(sessionRoute.DELETE, "DELETE", `/api/sessions/${s.id}`, { token })).status, 204);
  assert.equal((await call(sessionRoute.DELETE, "DELETE", `/api/sessions/${s.id}`, { token })).status, 404);
  assert.deepEqual((await (await call(sessionsRoute.GET, "GET", "/api/sessions", { token })).json()).sessions, []);
});

test("bulk upload is idempotent by id and keeps createdAt", { skip }, async () => {
  const token = player();
  const batch = [sample({ id: "a1", createdAt: 1700000000000 }), sample({ id: "b2", date: "2026-10-16", focus: "driving" })];
  const first = await (await call(sessionsRoute.POST, "POST", "/api/sessions", { token, body: batch })).json();
  assert.equal(first.sessions.length, 2);
  assert.equal(first.sessions.find((s) => s.id === "a1").createdAt, 1700000000000);

  const again = await (await call(sessionsRoute.POST, "POST", "/api/sessions", { token, body: batch })).json();
  assert.deepEqual(again, { sessions: [], skipped: 2 });

  const list = (await (await call(sessionsRoute.GET, "GET", "/api/sessions", { token })).json()).sessions;
  assert.deepEqual(list.map((s) => s.id), ["b2", "a1"]); // newest date first
});

test("players cannot see or delete each other's sessions", { skip }, async () => {
  const alice = player();
  const bob = player();
  await call(sessionsRoute.POST, "POST", "/api/sessions", { token: alice, body: sample({ id: "shared-id" }) });

  assert.deepEqual((await (await call(sessionsRoute.GET, "GET", "/api/sessions", { token: bob })).json()).sessions, []);
  assert.equal((await call(sessionRoute.DELETE, "DELETE", "/api/sessions/shared-id", { token: bob })).status, 404);

  // Same id under a different player is a separate row, not a conflict.
  const res = await (await call(sessionsRoute.POST, "POST", "/api/sessions", { token: bob, body: sample({ id: "shared-id" }) })).json();
  assert.equal(res.sessions.length, 1);
  assert.equal((await (await call(sessionsRoute.GET, "GET", "/api/sessions", { token: alice })).json()).sessions.length, 1);
});

test("invalid input is rejected with a message", { skip }, async () => {
  const token = player();
  const bad = await call(sessionsRoute.POST, "POST", "/api/sessions", { token, body: sample({ minutes: 0 }) });
  assert.equal(bad.status, 400);
  assert.match((await bad.json()).error, /Duration/);

  assert.equal((await call(sessionsRoute.POST, "POST", "/api/sessions", { token, body: "{nope" })).status, 400);
  assert.equal((await call(sessionsRoute.POST, "POST", "/api/sessions", { token, body: [] })).status, 400);
  assert.equal((await call(sessionsRoute.POST, "POST", "/api/sessions", { token, body: sample({ id: "bad id!" }) })).status, 400);
  assert.equal((await call(sessionsRoute.POST, "POST", "/api/sessions", { token, body: sample({ notes: "x".repeat(2001) }) })).status, 400);
  assert.equal((await call(sessionsRoute.POST, "POST", "/api/sessions", { token, body: [null] })).status, 400);
});
