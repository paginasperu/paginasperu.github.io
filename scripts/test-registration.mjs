import assert from "node:assert/strict";
import fs from "node:fs";

const edge = fs.readFileSync(new URL("../supabase/functions/register-profile/index.ts", import.meta.url), "utf8");
const schema = fs.readFileSync(new URL("../supabase/schema.sql", import.meta.url), "utf8");
const form = fs.readFileSync(new URL("./registro.js", import.meta.url), "utf8");
assert.match(edge, /SUPABASE_SERVICE_ROLE_KEY/, "la clave de servidor se usa solo en la Edge Function");
assert.match(edge, /estado:\s*"Pendiente"/, "los envíos no se publican automáticamente");
assert.match(edge, /submission_id:\s*submissionId/, "los reintentos conservan idempotencia");
assert.match(edge, /register-rate|registration_rate_limits/, "el backend aplica límites de envío");
assert.match(edge, /validateUrl\(clean\(payload\.portafolio_url[^\n]+true\)/, "se valida el dominio del enlace público");
assert.match(edge, /finalSubmission\s*&&\s*\(!record\.foto_perfil\s*\|\|\s*!record\.imagen_portada\)/, "el backend exige ambas imágenes al enviar");
assert.match(edge, /record\.whatsapp_interno/, "se conserva el contacto privado para detectar duplicados");
assert.match(schema, /registration_rate_limits/, "el esquema contiene el almacenamiento de control de abuso");
assert.match(form, /from\("locations"\)/, "el selector carga ubicaciones desde Supabase");
assert.match(form, /functions\.invoke\("register-profile"/, "el formulario usa el backend Supabase");
assert.doesNotMatch(form, /data\/distritos\.csv|appsScriptEndpoint|script\.google\.com/i, "el formulario no depende de Sheets ni Apps Script");
console.log("Registro Supabase: endpoint, validación, envío pendiente, idempotencia, ubicación y controles verificados.");
