import assert from "node:assert/strict";
import { SUPABASE_PUBLISHABLE_KEY, SUPABASE_URL, supabaseReady } from "./supabase-config.js";

assert(supabaseReady, "Falta configurar Supabase en scripts/supabase-config.js");
const pages = ["/", "/registro", "/contacto", "/privacidad", "/admin/"];
for (const path of pages) {
  const url = new URL(path, "https://www.oficial.pe");
  const start = performance.now();
  const response = await fetch(url, { redirect: "follow", signal: AbortSignal.timeout(30000) });
  assert(response.ok, `${url}: HTTP ${response.status}`);
  const html = await response.text();
  assert(html.length > 100, `${url}: respuesta vacía`);
  console.log(`${url}: HTTP ${response.status}, ${(performance.now() - start).toFixed(0)} ms`);
}

const headers = { apikey: SUPABASE_PUBLISHABLE_KEY, Authorization: `Bearer ${SUPABASE_PUBLISHABLE_KEY}` };
const profilesUrl = new URL("/rest/v1/directory_public_profiles?select=id&order=id.asc", SUPABASE_URL);
const profilesResponse = await fetch(profilesUrl, { headers, signal: AbortSignal.timeout(30000) });
assert(profilesResponse.ok, `Vista pública de Supabase: HTTP ${profilesResponse.status}`);
const profiles = await profilesResponse.json();
assert(Array.isArray(profiles), "Supabase debe responder una lista de perfiles públicos");
console.log(`Supabase: ${profiles.length} perfiles visibles desde la vista pública`);

const preflight = await fetch(new URL("/functions/v1/register-profile", SUPABASE_URL), {
  method: "OPTIONS",
  headers: { Origin: "https://www.oficial.pe", "Access-Control-Request-Method": "POST", "Access-Control-Request-Headers": "authorization, apikey, content-type" },
  signal: AbortSignal.timeout(30000),
});
assert(preflight.ok, `Preflight del registro: HTTP ${preflight.status}`);
assert.equal(preflight.headers.get("access-control-allow-origin"), "https://www.oficial.pe");
console.log("Supabase Edge Function: preflight CORS aprobado para www.oficial.pe");
