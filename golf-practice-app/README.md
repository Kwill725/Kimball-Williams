# Golf Practice App

A web app for planning, logging, and tracking golf practice sessions.
The frontend is plain HTML, CSS, and JavaScript (no build step). The backend is a small set of
Vercel serverless functions backed by Postgres.

## Features

- **Log sessions**: date, focus area (driving, irons, short game, putting, etc.), duration,
  balls hit, a 1–5 rating, and notes.
- **Drill library**: a starter set of drills per focus area. Pick one to fill in the session form.
- **Stats**: total sessions, total practice time, average rating, current day streak,
  and minutes by focus area.
- **Cloud sync**: sessions are saved to the database, so they're available on any device.
- **Works offline**: if the server can't be reached, new sessions are saved on the device
  (marked "Not synced") and upload automatically once you're back online.
- **Export/import** all sessions as JSON.

### How accounts work

There's no sign-up. The first time you open the app, your browser creates a random, private
**sync code**. All your sessions are stored under that code (the server only keeps a hash of it).
To use the same log on another device, open **Sync across devices** → **Show my sync code**, copy it,
then choose **Use a code from another device** on the other device. Anyone with the code can see
and edit that log, so keep it private.

## Deploying to Vercel

1. **Import the repo** at [vercel.com/new](https://vercel.com/new) and pick this GitHub repository.
2. In **Configure Project**, set **Root Directory** to `golf-practice-app`. Leave the framework preset
   as **Other** with no build command.
3. Click **Deploy**. The site will load, but it will show "Cloud unavailable" until a database is connected.
4. **Add a database**: in the project, open **Storage** → **Create Database** → **Neon (Postgres)**,
   and connect it to the project. This sets `DATABASE_URL` (or `POSTGRES_URL`) for you.
5. **Redeploy** (Deployments → ⋯ → Redeploy) so the functions pick up the new environment variable.

The database table is created automatically on the first request. Check that everything is connected
by visiting `https://<your-site>.vercel.app/api/health`. It should return `{"ok":true}`.

Every push to the connected branch then deploys automatically (other branches get preview URLs).

## Running locally

Requires Node 22+ and a Postgres database (a local one, or a free Neon database).

```bash
cd golf-practice-app
npm install
cp .env.example .env      # then set DATABASE_URL in .env
npm run dev               # http://localhost:3000
```

`npm run dev` runs a small local server (`scripts/dev-server.js`) that serves the site and runs the
`api/` functions the same way Vercel does. `npx vercel dev` also works if you've linked the project
with the Vercel CLI.

## Tests

```bash
npm test
```

- `tests/stats.test.js`: unit tests for validation, streaks, and stats.
- `tests/api.test.js`: API tests against a real database. They're skipped when `DATABASE_URL` isn't set.
  Test data is deleted afterwards.

## API

All `/api/sessions` requests need the header `Authorization: Bearer <sync code>`.

| Method | Path                 | Description |
| ------ | -------------------- | ----------- |
| GET    | `/api/health`        | `{ ok: true }` if the database is reachable |
| GET    | `/api/sessions`      | List your sessions, newest first |
| POST   | `/api/sessions`      | Create one session, or upload an array of up to 1000. Sessions whose `id` already exists are skipped, so retrying is safe |
| DELETE | `/api/sessions/:id`  | Delete a session |

A session looks like:

```json
{ "id": "…", "date": "2026-10-16", "focus": "putting", "minutes": 30, "balls": 0,
  "rating": 4, "notes": "", "drillId": "circle-drill", "createdAt": 1760600000000 }
```

## Project structure

```
golf-practice-app/
├── index.html            # App shell and markup
├── css/styles.css
├── js/                   # Frontend (also shared with the API)
│   ├── app.js            # UI, rendering, offline-first sync
│   ├── api.js            # API client and sync code
│   ├── storage.js        # On-device storage, JSON export/import
│   ├── drills.js         # Focus areas and drill library
│   └── stats.js          # Validation and stats (used by both browser and server)
├── api/                  # Vercel serverless functions
│   ├── health.js
│   ├── sessions.js       # GET, POST /api/sessions
│   ├── sessions/[id].js  # DELETE /api/sessions/:id
│   └── _lib/             # Shared server code (not routes): db.js, http.js
├── scripts/dev-server.js # Local dev server
├── tests/
└── vercel.json
```

## Ideas for next steps

- Real accounts (e.g. sign in with Google or email) instead of sync codes
- Rate limiting on the API
- Goals (e.g. "practice putting 3x per week") with progress tracking
- Charts of rating and time over weeks
- Installable PWA so the app also opens with no connection
