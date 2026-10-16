// Local dev server: serves the static site and runs api/ handlers the way Vercel does.
// Usage: npm run dev   (reads DATABASE_URL from .env if present)
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { extname, join, normalize } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const ROOT = fileURLToPath(new URL("..", import.meta.url));
const PORT = Number(process.env.PORT) || 3000;

const ROUTES = [
  [/^\/api\/health$/, "api/health.js"],
  [/^\/api\/sessions$/, "api/sessions.js"],
  [/^\/api\/sessions\/[^/]+$/, "api/sessions/[id].js"],
];

const TYPES = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css",
  ".js": "text/javascript",
  ".json": "application/json",
  ".svg": "image/svg+xml",
  ".png": "image/png",
};

async function handleApi(req, res, url, file) {
  const mod = await import(pathToFileURL(join(ROOT, file)));
  const handler = mod[req.method];
  if (!handler) {
    res.writeHead(405, { "content-type": "application/json" }).end(JSON.stringify({ error: "Method not allowed." }));
    return;
  }
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  const body = chunks.length ? Buffer.concat(chunks) : undefined;
  const request = new Request(url, { method: req.method, headers: req.headers, body });
  const response = await handler(request);
  res.writeHead(response.status, Object.fromEntries(response.headers));
  res.end(Buffer.from(await response.arrayBuffer()));
}

async function handleStatic(res, pathname) {
  const rel = normalize(pathname === "/" ? "/index.html" : pathname).replace(/^(\.\.[/\\])+/, "");
  // Never serve dotfiles (.env), dependencies, or server-only folders.
  if (/(^|[/\\])(\.|node_modules|scripts|tests)/.test(rel)) {
    res.writeHead(404).end("Not found");
    return;
  }
  try {
    const data = await readFile(join(ROOT, rel));
    res.writeHead(200, { "content-type": TYPES[extname(rel)] ?? "application/octet-stream" }).end(data);
  } catch {
    res.writeHead(404).end("Not found");
  }
}

createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);
  try {
    const route = ROUTES.find(([re]) => re.test(url.pathname));
    if (route) await handleApi(req, res, url, route[1]);
    else if (url.pathname.startsWith("/api/")) res.writeHead(404).end("Not found");
    else await handleStatic(res, url.pathname);
  } catch (err) {
    console.error(err);
    if (!res.headersSent) res.writeHead(500);
    res.end();
  }
}).listen(PORT, () => console.log(`Golf Practice running at http://localhost:${PORT}`));
