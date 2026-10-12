import assert from "node:assert/strict";
import { fetchPublicProfiles } from "./supabase-public-api.js";
import { SUPABASE_PUBLISHABLE_KEY, SUPABASE_URL } from "./supabase-config.js";

let request;
const profile = {
  id: 7,
  nombres: "Ana",
  apellidos: "Pública",
  estado: "Activo",
  categoria: "Anfitrionas",
  correo: "privado@example.test",
  whatsapp_interno: "51911111111",
};
const result = await fetchPublicProfiles(async (url, options) => {
  request = { url: new URL(url), options };
  return { ok: true, async json() { return [profile]; } };
});

assert.equal(request.url.origin, SUPABASE_URL);
assert.equal(request.url.pathname, "/rest/v1/directory_public_profiles");
assert.equal(request.url.searchParams.get("select"), "*");
assert.equal(request.url.searchParams.get("order"), "id.asc");
assert.equal(request.options.cache, "no-store", "las lecturas posteriores a la caché local consultan Supabase sin reutilizar una respuesta HTTP vieja");
assert.equal(request.options.headers.apikey, SUPABASE_PUBLISHABLE_KEY);
assert.equal(request.options.headers.Authorization, `Bearer ${SUPABASE_PUBLISHABLE_KEY}`);
assert.equal(result[0].id, 7);
assert.equal(result[0].categoria, "Anfitrionas");
assert.equal(Object.hasOwn(result[0], "correo"), false, "el mapeador no filtra datos internos al navegador");

await assert.rejects(
  () => fetchPublicProfiles(async () => ({ ok: false, status: 403, async json() { return { message: "forbidden" }; } })),
  /HTTP 403|forbidden/,
);
await assert.rejects(
  () => fetchPublicProfiles(async () => ({ ok: true, async json() { return { rows: [] }; } })),
  /respuesta inválida/,
);
console.log("Lectura pública REST: vista segura, orden, clave publishable, mapeo privado y errores comprobados.");
