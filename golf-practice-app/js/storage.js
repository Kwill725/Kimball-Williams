// Persistence for practice sessions using localStorage.

const STORAGE_KEY = "golf-practice-app:sessions:v1";

export function loadSessions() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function saveSessions(sessions) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(sessions));
    return true;
  } catch {
    return false;
  }
}

export function newId() {
  return crypto.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

/** Trigger a download of all sessions as a JSON file. */
export function exportSessions(sessions) {
  const blob = new Blob([JSON.stringify(sessions, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `golf-practice-${new Date().toISOString().slice(0, 10)}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

/** Read a user-selected JSON file and return its sessions array. */
export async function readImportFile(file) {
  const data = JSON.parse(await file.text());
  if (!Array.isArray(data)) throw new Error("File must contain a list of sessions.");
  return data;
}
