import { FOCUS_AREAS, DRILLS, focusLabel } from "./drills.js";
import { validateSession, sortSessions, summarize, formatMinutes } from "./stats.js";
import { loadSessions, saveSessions, newId, exportSessions, readImportFile } from "./storage.js";
import { fetchSessions, uploadSessions, removeSession, getSyncCode, setSyncCode, ApiError } from "./api.js";

const FOCUS_IDS = FOCUS_AREAS.map((f) => f.id);

// Offline-first: new sessions go into `pending` (saved on this device), then upload to the server.
let cloud = []; // sessions confirmed by the server
let pending = loadSessions(); // sessions saved on this device, not yet uploaded
let status = "connecting"; // "connecting" | "synced" | "offline" | "unavailable"
let syncing = null;

const allSessions = () => [...cloud, ...pending];

const $ = (sel) => document.querySelector(sel);
const form = $("#session-form");
const errorsEl = $("#form-errors");

function todayISO() {
  const d = new Date();
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
}

function escapeHtml(str) {
  return str.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
}

function savePending() {
  if (!saveSessions(pending)) alert("Could not save — browser storage may be full or disabled.");
}

// ---------- Sync ----------

/** Load from the server and upload anything saved offline. Safe to call repeatedly. */
function sync() {
  syncing ??= (async () => {
    try {
      if (pending.length) {
        const uploading = pending;
        await uploadSessions(uploading);
        const done = new Set(uploading.map((s) => s.id));
        pending = pending.filter((s) => !done.has(s.id));
        savePending();
      }
      cloud = await fetchSessions();
      status = "synced";
    } catch (err) {
      // ApiError = the server answered with an error (e.g. database not configured); otherwise we're offline.
      status = err instanceof ApiError ? "unavailable" : "offline";
      console.warn("Sync failed:", err.message);
    } finally {
      syncing = null;
      render();
    }
  })();
  return syncing;
}

function renderStatus() {
  const el = $("#sync-status");
  const n = pending.length;
  const unsynced = n ? ` · ${n} session${n === 1 ? "" : "s"} saved on this device` : "";
  const text = {
    connecting: "Connecting…",
    synced: n ? `Syncing${unsynced}` : "Synced to cloud",
    offline: `Offline${unsynced}`,
    unavailable: `Cloud unavailable${unsynced}`,
  }[status];
  el.textContent = text;
  el.dataset.status = status === "synced" && !n ? "ok" : status === "connecting" ? "busy" : "warn";
}

// ---------- Rendering ----------

function renderFocusOptions() {
  const options = FOCUS_AREAS.map((f) => `<option value="${f.id}">${f.label}</option>`).join("");
  $("#focus").innerHTML = `<option value="">Select…</option>${options}`;
  $("#drill-filter").innerHTML = `<option value="">All areas</option>${options}`;
}

function renderDrills() {
  const filter = $("#drill-filter").value;
  const list = DRILLS.filter((d) => !filter || d.focus === filter);
  $("#drill-list").innerHTML = list
    .map(
      (d) => `
      <li class="card drill">
        <div class="drill-head">
          <h3>${d.name}</h3>
          <span class="tag">${focusLabel(d.focus)}</span>
        </div>
        <p>${d.description}</p>
        <div class="drill-foot">
          <span class="muted">~${d.minutes} min</span>
          <button type="button" class="btn small" data-drill="${d.id}">Log this drill</button>
        </div>
      </li>`
    )
    .join("");
}

function renderStats() {
  const s = summarize(allSessions());
  $("#stat-sessions").textContent = s.sessionCount;
  $("#stat-time").textContent = formatMinutes(s.totalMinutes);
  $("#stat-rating").textContent = s.sessionCount ? `${s.avgRating} / 5` : "–";
  $("#stat-streak").textContent = `${s.streak} day${s.streak === 1 ? "" : "s"}`;

  const max = Math.max(1, ...Object.values(s.minutesByFocus));
  $("#focus-breakdown").innerHTML = FOCUS_AREAS.filter((f) => s.minutesByFocus[f.id])
    .map((f) => {
      const mins = s.minutesByFocus[f.id];
      return `
        <li>
          <span class="bar-label">${f.label}</span>
          <span class="bar-track"><span class="bar-fill" style="width:${(mins / max) * 100}%"></span></span>
          <span class="bar-value">${formatMinutes(mins)}</span>
        </li>`;
    })
    .join("") || `<li class="muted">Log a session to see your breakdown.</li>`;
}

function renderHistory() {
  const pendingIds = new Set(pending.map((s) => s.id));
  const list = sortSessions(allSessions());
  $("#history-empty").hidden = list.length > 0;
  $("#history-list").innerHTML = list
    .map((s) => {
      const drill = DRILLS.find((d) => d.id === s.drillId);
      return `
      <li class="card session">
        <div class="session-head">
          <strong>${s.date}</strong>
          <span class="tag">${focusLabel(s.focus)}</span>
          <span class="rating" aria-label="Rating ${s.rating} of 5">${"★".repeat(s.rating)}${"☆".repeat(5 - s.rating)}</span>
          ${pendingIds.has(s.id) ? `<span class="tag warn" title="Will upload when you're back online">Not synced</span>` : ""}
        </div>
        <div class="muted">
          ${formatMinutes(s.minutes)}${s.balls ? ` · ${s.balls} balls` : ""}${drill ? ` · ${drill.name}` : ""}
        </div>
        ${s.notes ? `<p>${escapeHtml(s.notes)}</p>` : ""}
        <button type="button" class="btn link danger" data-delete="${s.id}">Delete</button>
      </li>`;
    })
    .join("");
}

function render() {
  renderStatus();
  renderStats();
  renderHistory();
}

// ---------- Events ----------

form.addEventListener("submit", (e) => {
  e.preventDefault();
  const input = Object.fromEntries(new FormData(form));
  const { session, errors } = validateSession(input, FOCUS_IDS);
  if (errors) {
    errorsEl.innerHTML = errors.map((msg) => `<li>${msg}</li>`).join("");
    return;
  }
  errorsEl.innerHTML = "";
  pending.push({ ...session, id: newId(), createdAt: Date.now() });
  savePending();
  render();
  sync();
  form.reset();
  form.elements.date.value = todayISO();
  form.elements.drillId.value = "";
});

$("#drill-filter").addEventListener("change", renderDrills);

$("#drill-list").addEventListener("click", (e) => {
  const id = e.target.dataset.drill;
  if (!id) return;
  const drill = DRILLS.find((d) => d.id === id);
  form.elements.focus.value = drill.focus;
  form.elements.minutes.value = drill.minutes;
  form.elements.drillId.value = drill.id;
  form.elements.notes.value = `Drill: ${drill.name}`;
  form.scrollIntoView({ behavior: "smooth" });
  form.elements.minutes.focus();
});

$("#history-list").addEventListener("click", async (e) => {
  const id = e.target.dataset.delete;
  if (!id || !confirm("Delete this session?")) return;
  if (pending.some((s) => s.id === id)) {
    pending = pending.filter((s) => s.id !== id);
    savePending();
    render();
    return;
  }
  try {
    await removeSession(id);
  } catch (err) {
    if (!(err instanceof ApiError && err.status === 404)) {
      alert(err instanceof ApiError ? `Delete failed: ${err.message}` : "You're offline — try deleting again once you're connected.");
      return;
    }
  }
  cloud = cloud.filter((s) => s.id !== id);
  render();
});

$("#export-btn").addEventListener("click", () => exportSessions(sortSessions(allSessions())));

$("#import-input").addEventListener("change", async (e) => {
  const file = e.target.files[0];
  if (!file) return;
  try {
    const imported = await readImportFile(file);
    const valid = imported
      .map((raw) => ({ raw, result: validateSession(raw, FOCUS_IDS) }))
      .filter(({ result }) => result.session)
      .map(({ raw, result }) => ({
      ...result.session,
      id: typeof raw.id === "string" && /^[A-Za-z0-9_-]{1,64}$/.test(raw.id) ? raw.id : newId(),
      createdAt: Number.isFinite(raw.createdAt) && raw.createdAt > 0 ? raw.createdAt : Date.now(),
    }));
    const existing = new Set(allSessions().map((s) => s.id));
    const added = valid.filter((s) => !existing.has(s.id));
    pending.push(...added);
    savePending();
    render();
    sync();
    alert(`Imported ${added.length} session(s). Skipped ${imported.length - added.length}.`);
  } catch (err) {
    alert(`Import failed: ${err.message}`);
  } finally {
    e.target.value = "";
  }
});

$("#show-code-btn").addEventListener("click", () => {
  const box = $("#sync-code");
  box.hidden = !box.hidden;
  box.value = getSyncCode();
  if (!box.hidden) box.select();
});

$("#use-code-btn").addEventListener("click", async () => {
  const code = prompt("Paste the sync code from your other device:");
  if (code === null) return;
  if (!setSyncCode(code)) {
    alert("That doesn't look like a valid sync code.");
    return;
  }
  await syncing; // let an in-flight sync for the old code finish first
  // Anything saved on this device but not yet uploaded will sync to the new code.
  cloud = [];
  status = "connecting";
  $("#sync-code").hidden = true;
  render();
  sync();
});

window.addEventListener("online", sync);

// ---------- Init ----------

renderFocusOptions();
form.elements.date.value = todayISO();
renderDrills();
render();
sync();
