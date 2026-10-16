# Golf Practice App

A lightweight web app for planning, logging, and tracking golf practice sessions.
Built with plain HTML, CSS, and JavaScript (ES modules) — no build step and no dependencies.

## Features

- **Log sessions** — record date, focus area (driving, irons, short game, putting, etc.),
  duration, balls hit, a 1–5 quality rating, and notes.
- **Drill library** — a starter set of drills per focus area; pick one to pre-fill a session.
- **Stats** — total sessions, total practice time, average rating, current day streak,
  and a breakdown of minutes by focus area.
- **Local storage** — your data stays in your browser (`localStorage`). Export/import as JSON
  to back it up or move it between devices.

## Getting started

ES modules need to be served over HTTP (opening `index.html` directly via `file://` won't load them).
From this folder, run any static server, for example:

```bash
npx serve .
# or
python3 -m http.server 8000
```

Then open the printed URL (e.g. http://localhost:8000).

## Running tests

The core logic (stats, streaks, validation) lives in `js/stats.js` and is tested with Node's
built-in test runner (Node 18+):

```bash
npm test
```

## Project structure

```
golf-practice-app/
├── index.html        # App shell and markup
├── css/styles.css    # Styles
├── js/
│   ├── app.js        # UI wiring and rendering
│   ├── storage.js    # localStorage persistence, import/export
│   ├── drills.js     # Focus areas and drill library
│   └── stats.js      # Pure functions: validation, totals, streaks
└── tests/
    └── stats.test.js # Unit tests for stats.js
```

## Ideas for next steps

- Goals (e.g. "practice putting 3x per week") with progress tracking
- Charts of rating and time over weeks
- Per-drill scoring (e.g. putts made out of 10 from 6 ft)
- Installable PWA with offline support
