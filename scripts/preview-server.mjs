import { createServer } from "node:http";
import { createReadStream, existsSync, statSync } from "node:fs";
import { extname, join, normalize, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = resolve(fileURLToPath(new URL("..", import.meta.url)));
const port = Number(process.env.PORT || 8000);
const contentTypes = {
  ".css": "text/css; charset=utf-8",
  ".csv": "text/csv; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".svg": "image/svg+xml",
};

function resolveRequestPath(requestUrl) {
  let pathname;
  try {
    pathname = decodeURIComponent(new URL(requestUrl, "http://localhost").pathname);
  } catch {
    return null;
  }

  const relativePath = normalize(pathname.replace(/^[/\\]+/, ""));
  if (pathname === "/") return join(projectRoot, "index.html");
  const filePath = resolve(projectRoot, relativePath);
  if (filePath !== projectRoot && !filePath.startsWith(`${projectRoot}${sep}`)) return null;

  if (existsSync(filePath) && statSync(filePath).isFile()) return filePath;

  // GitHub Pages serves these extensionless URLs through its root-level 404 page.
  const cleanPage = resolve(projectRoot, `${relativePath}.html`);
  if (
    ["contacto", "privacidad", "registro"].includes(relativePath) &&
    existsSync(cleanPage)
  ) {
    return cleanPage;
  }

  return join(projectRoot, "404.html");
}

const server = createServer((request, response) => {
  const filePath = resolveRequestPath(request.url || "/");
  if (!filePath) {
    response.writeHead(400).end("Solicitud no válida");
    return;
  }

  if (!existsSync(filePath)) {
    response.writeHead(404).end("No se encontró 404.html");
    return;
  }

  response.setHeader("Content-Type", contentTypes[extname(filePath)] || "application/octet-stream");
  response.setHeader("Cache-Control", "no-store");
  createReadStream(filePath).pipe(response);
});

server.listen(port, "127.0.0.1", () => {
  console.log(`Vista previa local: http://127.0.0.1:${port}`);
  console.log("Detén el servidor con Ctrl+C.");
});
