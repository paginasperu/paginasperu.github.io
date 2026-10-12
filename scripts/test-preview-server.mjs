import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { once } from "node:events";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("..", import.meta.url));
const serverPath = fileURLToPath(new URL("./preview-server.mjs", import.meta.url));
const server = spawn(process.execPath, [serverPath], {
  cwd: root,
  env: { ...process.env, PORT: "0" },
  stdio: ["ignore", "pipe", "pipe"],
});

let output = "";
let errors = "";
server.stdout.setEncoding("utf8");
server.stderr.setEncoding("utf8");
server.stdout.on("data", chunk => { output += chunk; });
server.stderr.on("data", chunk => { errors += chunk; });

try {
  const baseUrl = await new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error(`El servidor no inició. ${errors}`)), 5000);
    const checkOutput = () => {
      const match = output.match(/Vista previa local: (http:\/\/127\.0\.0\.1:\d+)/);
      if (!match) return;
      clearTimeout(timeout);
      resolve(match[1]);
    };
    server.stdout.on("data", checkOutput);
    server.once("error", error => {
      clearTimeout(timeout);
      reject(error);
    });
    server.once("exit", code => {
      clearTimeout(timeout);
      reject(new Error(`El servidor terminó antes de iniciar (${code}). ${errors}`));
    });
    checkOutput();
  });

  for (const route of ["/admin", "/admin/", "/admin/index.html"]) {
    const response = await fetch(new URL(route, baseUrl));
    const html = await response.text();
    assert.equal(response.status, 200, `${route} debe servir el panel de acceso`);
    assert.match(html, /script\.google\.com\/macros\/s\//, `${route} debe apuntar al panel privado`);
    assert.match(html, /noindex,nofollow/, `${route} no debe indexarse`);
  }

  const privateSource = await fetch(new URL("/sheets-admin/AdminClient.html", baseUrl));
  assert.equal(privateSource.status, 404, "El servidor de vista previa no debe exponer las fuentes privadas");
  console.log("Vista previa: rutas /admin, /admin/ y acceso a fuentes privadas comprobados.");
} finally {
  server.kill();
  await once(server, "exit").catch(() => {});
}
