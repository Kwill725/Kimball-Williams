import { createHash } from "node:crypto";
import { ConfigError, ensureSchema } from "./db.js";

// Sync codes are random secrets generated in the browser. We only store their hash.
const TOKEN_RE = /^[A-Za-z0-9_-]{32,128}$/;
export const ID_RE = /^[A-Za-z0-9_-]{1,64}$/;

export function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json", "cache-control": "no-store" },
  });
}

export const error = (status, message) => json({ error: message }, status);

/** Returns the player's storage key (sha256 of their sync code), or null if the header is missing/invalid. */
export function playerKey(request) {
  const match = /^Bearer (.+)$/.exec(request.headers.get("authorization") ?? "");
  if (!match || !TOKEN_RE.test(match[1])) return null;
  return createHash("sha256").update(match[1]).digest("hex");
}

/** Wrap a route: require a sync code, make sure the schema exists, and map failures to JSON errors. */
export function withPlayer(fn) {
  return async (request) => {
    const key = playerKey(request);
    if (!key) return error(401, "Missing or invalid sync code.");
    try {
      await ensureSchema();
      return await fn(request, key);
    } catch (err) {
      if (err instanceof ConfigError) return error(503, err.message);
      console.error(err);
      return error(500, "Something went wrong.");
    }
  };
}
