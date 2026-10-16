import { FOCUS_AREAS, DRILLS, focusLabel } from "./drills.js";
import { validateSession, sortSessions, summarize, formatMinutes } from "./stats.js";
import { loadSessions, saveSessions, newId, exportSessions, readImportFile } from "./storage.js";

const FOCUS_IDS = FOCUS_AREAS.map((f) => f.id);
let sessions = loadSessions();

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

function persist() {
  if (!saveSessions(sessions)) alert("Could not save — browser storage may be full or disabled.");
  render();
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
  const s = summarize(sessions);
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
  const list = sortSessions(sessions);
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
  sessions.push({ ...session, id: newId(), createdAt: Date.now() });
  persist();
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

$("#history-list").addEventListener("click", (e) => {
  const id = e.target.dataset.delete;
  if (!id || !confirm("Delete this session?")) return;
  sessions = sessions.filter((s) => s.id !== id);
  persist();
});

$("#export-btn").addEventListener("click", () => exportSessions(sessions));

$("#import-input").addEventListener("change", async (e) => {
  const file = e.target.files[0];
  if (!file) return;
  try {
    const imported = await readImportFile(file);
    const valid = imported
      .map((raw) => ({ raw, result: validateSession(raw, FOCUS_IDS) }))
      .filter(({ result }) => result.session)
      .map(({ raw, result }) => ({ ...result.session, id: raw.id || newId(), createdAt: raw.createdAt || Date.now() }));
    const existing = new Set(sessions.map((s) => s.id));
    const added = valid.filter((s) => !existing.has(s.id));
    sessions.push(...added);
    persist();
    alert(`Imported ${added.length} session(s). Skipped ${imported.length - added.length}.`);
  } catch (err) {
    alert(`Import failed: ${err.message}`);
  } finally {
    e.target.value = "";
  }
});

// ---------- Init ----------

renderFocusOptions();
form.elements.date.value = todayISO();
renderDrills();
render();
