import assert from "node:assert/strict";
import fs from "node:fs";

const read = (path) => fs.readFileSync(new URL(path, import.meta.url), "utf8");
const schema = read("../supabase/schema.sql");
const edge = read("../supabase/functions/register-profile/index.ts");
const index = read("./index.js");
const registration = read("./registro.js");
const admin = read("./admin.js");
const html = read("../admin/index.html");
const config = read("./supabase-config.js");

assert.match(schema, /with \(security_invoker\s*=\s*true\)/i, "la vista pública respeta permisos y RLS del usuario que consulta");
assert.match(schema, /where estado\s*=\s*'Activo'/i, "la vista pública excluye los perfiles no activos");
assert.match(schema, /grant select \([^;]+\) on public\.profiles to anon;/is, "el rol anónimo solo recibe lectura de columnas permitidas");
assert.doesNotMatch(schema, /grant\s+(?:all|select\s*,\s*insert|insert)[^;]*public\.profiles[^;]*to\s+anon/i, "el rol anónimo no puede editar perfiles");
assert.match(schema, /create policy "Admins can manage profiles"[\s\S]+?auth\.uid\(\)[\s\S]+?admin_users/i, "las escrituras requieren membresía de administrador autenticado");
assert.match(schema, /create table if not exists public\.admin_users/i, "la lista de administradores no se deriva de una clave del frontend");
assert.match(index, /from\("directory_public_profiles"\)/, "la web pública consume solo la vista filtrada");
assert.match(registration, /functions\.invoke\("register-profile"/, "el formulario usa la función de registro de Supabase");
assert.doesNotMatch(registration, /script\.google\.com\/macros|appsScriptEndpoint/i, "el nuevo formulario no depende de Apps Script");
assert.match(edge, /SUPABASE_SERVICE_ROLE_KEY/, "la credencial de servicio solo aparece en backend");
assert.doesNotMatch(html + admin + config, /(?:SUPABASE_SERVICE_ROLE_KEY\s*=\s*["'][^"']+|sb_secret_[A-Za-z0-9_-]{10,})/i, "el frontend y el panel no contienen una clave de servidor");
assert.match(admin, /signInWithPassword/, "el panel usa Supabase Auth para iniciar sesión");
assert.match(admin, /from\("admin_users"\)/, "el panel exige una cuenta autorizada");
assert.match(registration, /from\("locations"\)/, "el formulario lee el catálogo desde Supabase");
assert.doesNotMatch(index + registration + admin + html, /appsScriptEndpoint|script\.google\.com|Google Sheets/i, "la aplicación activa no tiene dependencias de Apps Script o Sheets");
assert.match(index, /mapPublicProfile/, "el directorio transforma los datos de la vista de Supabase");
console.log("Arquitectura Supabase: lectura pública permitida, datos privados aislados, Auth y registro de servidor comprobados.");
