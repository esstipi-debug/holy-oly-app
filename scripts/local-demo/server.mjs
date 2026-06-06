// Holy Oly — servidor estático local de cero dependencias para el demo offline.
// Sirve C:\HolyOlyDemo\app en 127.0.0.1:8765 con fallback SPA (las rutas de React
// funcionan al refrescar). Si el puerto ya está tomado, asume que el demo ya está
// corriendo y sale sin error (el lanzador puede invocarlo siempre).
import { createServer } from "node:http";
import { readFile, stat } from "node:fs/promises";
import { join, normalize, extname, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, "app");
const HOST = "127.0.0.1";
const PORT = 8765;

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".webmanifest": "application/manifest+json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".ico": "image/x-icon",
  ".woff2": "font/woff2",
  ".woff": "font/woff",
  ".ttf": "font/ttf",
  ".txt": "text/plain; charset=utf-8",
  ".map": "application/json; charset=utf-8",
};

async function sendFile(res, filePath, status = 200) {
  const body = await readFile(filePath);
  const ext = extname(filePath).toLowerCase();
  const headers = { "Content-Type": MIME[ext] ?? "application/octet-stream" };
  // index.html nunca se cachea (para que las actualizaciones se vean);
  // los assets llevan hash en el nombre → inmutables.
  if (ext === ".html") headers["Cache-Control"] = "no-store";
  else if (filePath.includes(`${join("app", "assets")}`)) headers["Cache-Control"] = "public, max-age=31536000, immutable";
  res.writeHead(status, headers);
  res.end(body);
}

const server = createServer(async (req, res) => {
  try {
    let pathname = decodeURIComponent(new URL(req.url, `http://${HOST}`).pathname);
    if (pathname === "/") pathname = "/index.html";

    // Anti path-traversal: resolver y exigir que quede dentro de ROOT.
    const candidate = normalize(join(ROOT, pathname));
    if (!candidate.startsWith(ROOT)) {
      res.writeHead(403).end("Forbidden");
      return;
    }

    try {
      const s = await stat(candidate);
      if (s.isFile()) return await sendFile(res, candidate);
    } catch {
      /* no existe → cae al fallback de abajo */
    }

    // Fallback SPA: rutas sin extensión → index.html (React Router las resuelve).
    if (!extname(pathname)) return await sendFile(res, join(ROOT, "index.html"));

    res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" }).end("404");
  } catch (err) {
    res.writeHead(500, { "Content-Type": "text/plain; charset=utf-8" }).end("500");
    console.error(err);
  }
});

server.on("error", (err) => {
  if (err.code === "EADDRINUSE") {
    console.log(`Holy Oly ya está corriendo en http://${HOST}:${PORT}`);
    process.exit(0);
  }
  console.error(err);
  process.exit(1);
});

server.listen(PORT, HOST, () => {
  console.log(`Holy Oly demo en http://${HOST}:${PORT}  (raíz: ${ROOT})`);
});
