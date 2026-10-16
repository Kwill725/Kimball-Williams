// Client for the backend API. Each browser has a private "sync code" that identifies its data.

const TOKEN_KEY = "golf-practice-app:sync-code";
const TOKEN_RE = /^[A-Za-z0-9_-]{32,128}$/;

function generateToken() {
  const bytes = crypto.getRandomValues(new Uint8Array(24));
  return btoa(String.fromCharCode(...bytes)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export function getSyncCode() {
  let token = null;
  try {
    token = localStorage.getItem(TOKEN_KEY);
  } catch {}
  if (!token || !TOKEN_RE.test(token)) {
    token = generateToken();
    try {
      localStorage.setItem(TOKEN_KEY, token);
    } catch {}
  }
  return token;
}

/** Switch this browser to another device's sync code. Returns false if the code is malformed. */
export function setSyncCode(code) {
  const trimmed = code.trim();
  if (!TOKEN_RE.test(trimmed)) return false;
  localStorage.setItem(TOKEN_KEY, trimmed);
  return true;
}

export class ApiError extends Error {
  constructor(message, status) {
    super(message);
    this.status = status;
  }
}

async function request(method, path, body) {
  const res = await fetch(`/api${path}`, {
    method,
    headers: {
      authorization: `Bearer ${getSyncCode()}`,
      ...(body !== undefined && { "content-type": "application/json" }),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  if (res.status === 204) return null;
  const data = await res.json().catch(() => null);
  if (!res.ok) throw new ApiError(data?.error ?? `Request failed (${res.status}).`, res.status);
  if (data === null) throw new ApiError("Unexpected response from server.", res.status);
  return data;
}

export async function fetchSessions() {
  return (await request("GET", "/sessions")).sessions;
}

/** Upload one or more sessions. Sessions whose id already exists are skipped. */
export async function uploadSessions(sessions) {
  return request("POST", "/sessions", sessions);
}

export async function removeSession(id) {
  await request("DELETE", `/sessions/${encodeURIComponent(id)}`);
}
