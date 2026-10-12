import fs from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const privateExport = path.join(root, "supabase", "private-profiles.export.json");
const categories = new Set(["Diseñadores gráficos", "Volanteras", "Anfitrionas"]);
const statuses = new Set(["Pendiente", "Activo", "Rechazado", "Inactivo"]);

function splitCsvLine(line) {
  const cells = [];
  let cell = "";
  let quoted = false;
  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    if (quoted && char === '"' && line[index + 1] === '"') { cell += '"'; index += 1; }
    else if (char === '"') quoted = !quoted;
    else if (char === "," && !quoted) { cells.push(cell); cell = ""; }
    else cell += char;
  }
  if (quoted) throw new Error("El catálogo de distritos tiene comillas inválidas.");
  cells.push(cell);
  return cells;
}

function parseCsv(text) {
  const lines = text.replace(/^\uFEFF/, "").split(/\r?\n/).filter(Boolean);
  const headers = splitCsvLine(lines.shift()).map((item) => item.trim());
  return lines.map((line) => Object.fromEntries(splitCsvLine(line).map((value, index) => [headers[index], value.trim()])));
}

function sheetSerialToDate(value) {
  if (value === "" || value == null) return null;
  if (typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
  const serial = Number(value);
  if (!Number.isFinite(serial) || serial < 1) throw new Error("La exportación contiene una fecha inválida.");
  return new Date(Date.UTC(1899, 11, 30) + Math.round(serial * 86400000)).toISOString();
}

function nullable(value) { return value === "" || value == null ? null : value; }
function bool(value) { return value === true || /^(true|1|yes|sí|si)$/i.test(String(value)); }
function locationKey(row) {
  return [row.departamento, row.provincia, row.distrito].map((value) => String(value || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim().toLocaleUpperCase("es-PE")).join("|");
}

async function prepare() {
  const [exportText, locationsText, demoText] = await Promise.all([
    fs.readFile(privateExport, "utf8"),
    fs.readFile(path.join(root, "supabase", "seed", "locations.csv"), "utf8"),
    fs.readFile(path.join(root, "supabase", "migration-demo-ids.json"), "utf8"),
  ]);
  const source = JSON.parse(exportText);
  if (!Array.isArray(source.records) || !source.records.length) throw new Error("La exportación privada no contiene perfiles.");
  const demoIds = new Set(JSON.parse(demoText).ids.map(Number));
  const locations = parseCsv(locationsText).map((row) => ({
    departamento: row.departamento.toLocaleUpperCase("es-PE"),
    provincia: row.provincia.toLocaleUpperCase("es-PE"),
    distrito: row.distrito.toLocaleUpperCase("es-PE"),
    ubigeo: row.ubigeo || null,
  }));
  const locationIds = new Map(locations.map((row) => [locationKey(row), row.ubigeo]));
  const ids = new Set();
  const phones = new Set();
  const profiles = source.records.map((row) => {
    const id = Number(row.id);
    if (!Number.isInteger(id) || id < 1 || ids.has(id)) throw new Error("Los IDs exportados deben ser enteros positivos y únicos.");
    ids.add(id);
    const profile = {
      id,
      nombres: String(row.nombres || "").trim(),
      apellidos: String(row.apellidos || "").trim(),
      genero: nullable(row.genero),
      fecha_nacimiento: sheetSerialToDate(row.fecha_nacimiento)?.slice(0, 10) ?? null,
      departamento: String(row.departamento || "").trim().toLocaleUpperCase("es-PE"),
      provincia: String(row.provincia || "").trim().toLocaleUpperCase("es-PE"),
      distrito: String(row.distrito || "").trim().toLocaleUpperCase("es-PE"),
      whatsapp_publico: nullable(row.whatsapp_publico)?.toString().replace(/\D/g, "") || null,
      whatsapp_interno: nullable(row.whatsapp_interno)?.toString().replace(/\D/g, "") || null,
      correo: nullable(row.correo)?.toString().trim().toLocaleLowerCase("es-PE") || null,
      behance_usuario: nullable(row.behance_usuario), instagram_usuario: nullable(row.instagram_usuario), linkedin_usuario: nullable(row.linkedin_usuario),
      categoria: String(row.categoria || "").trim(),
      descripcion_corta: String(row.descripcion_corta || "").trim(), descripcion_larga: nullable(row.descripcion_larga),
      productos_servicios: nullable(row.productos_servicios), nivel_experiencia: nullable(row.nivel_experiencia), nivel_precio: nullable(row.nivel_precio),
      foto_perfil: nullable(row.foto_perfil), imagen_portada: nullable(row.imagen_portada), acepta_privacidad: bool(row.acepta_privacidad),
      calificacion_interna: nullable(row.calificacion_interna) === null ? null : Number(row.calificacion_interna),
      es_verificado: bool(row.es_verificado), es_destacado: bool(row.es_destacado),
      posicion: nullable(row.posicion) === null ? null : Number(row.posicion),
      estado: String(row.estado || "Pendiente").trim(), notas: String(row.notas || ""),
      fecha_registro: sheetSerialToDate(row.fecha_registro), portafolio_url: nullable(row.portafolio_url),
      es_demo: demoIds.has(id) || String(row.notas || "").toLocaleUpperCase("es-PE").includes("DEMO"),
      submission_id: null, submission_fingerprint: null,
    };
    if (!profile.nombres || !profile.apellidos || !categories.has(profile.categoria) || !statuses.has(profile.estado)) throw new Error(`El perfil ID ${id} tiene campos principales no válidos; no se importó nada.`);
    const key = locationKey(profile);
    const canonicalKey = key === "LIMA|LIMA|SURCO" ? "LIMA|LIMA|SANTIAGO DE SURCO" : key;
    profile.location_id = locationIds.get(canonicalKey);
    if (!profile.location_id) throw new Error(`La ubicación del perfil ID ${id} no existe en supabase/seed/locations.csv; no se importó nada.`);
    if (profile.whatsapp_interno) {
      if (phones.has(profile.whatsapp_interno)) throw new Error("La hoja contiene WhatsApp internos duplicados; revisa duplicados antes de importar.");
      phones.add(profile.whatsapp_interno);
    }
    return profile;
  });
  return { locations, profiles };
}

function readEnv() {
  const values = {};
  for (const line of (process.env.SUPABASE_MIGRATION_ENV || "").split(/\r?\n/)) {
    const match = line.match(/^\s*(SUPABASE_URL|SUPABASE_SERVICE_ROLE_KEY)\s*=\s*(.*?)\s*$/);
    if (match) values[match[1]] = match[2].replace(/^['"]|['"]$/g, "");
  }
  return { url: process.env.SUPABASE_URL || values.SUPABASE_URL, key: process.env.SUPABASE_SERVICE_ROLE_KEY || values.SUPABASE_SERVICE_ROLE_KEY };
}

async function postRows(url, key, table, rows, conflict = "") {
  for (let start = 0; start < rows.length; start += 400) {
    const batch = rows.slice(start, start + 400);
    const endpoint = new URL(`/rest/v1/${table}`, url);
    if (conflict) endpoint.searchParams.set("on_conflict", conflict);
    const response = await fetch(endpoint, {
      method: "POST",
      headers: { apikey: key, Authorization: `Bearer ${key}`, "Content-Type": "application/json", Prefer: "resolution=merge-duplicates,return=minimal" },
      body: JSON.stringify(batch), signal: AbortSignal.timeout(30000),
    });
    if (!response.ok) throw new Error(`Supabase rechazó la importación de ${table} (HTTP ${response.status}). No se muestra el contenido privado de la respuesta.`);
  }
}

const prepared = await prepare();
const emitArgument = process.argv.find((argument) => argument.startsWith("--emit-batch="));
if (emitArgument) {
  const match = emitArgument.match(/^--emit-batch=(locations|profiles):(\d+):(\d+)$/);
  if (!match) throw new Error("Usa --emit-batch=locations:0:400 o --emit-batch=profiles:0:100.");
  const [, kind, startText, sizeText] = match;
  const start = Number(startText);
  const size = Number(sizeText);
  if (size < 1 || size > 500) throw new Error("El tamaño de lote debe estar entre 1 y 500.");
  process.stdout.write(JSON.stringify(prepared[kind].slice(start, start + size)));
  process.exit(0);
}
const summary = prepared.profiles.reduce((counts, row) => { counts[row.estado] = (counts[row.estado] || 0) + 1; return counts; }, {});
console.log(`Validación local: ${prepared.profiles.length} perfiles, ${prepared.locations.length} ubicaciones.`);
console.log(`Estados: ${Object.entries(summary).map(([status, count]) => `${status} ${count}`).join(" · ")}.`);
console.log("La verificación no imprime nombres, teléfonos, correos ni notas privadas.");

if (!process.argv.includes("--apply")) {
  console.log("Modo seguro: no se escribió en Supabase. Revisa la hoja y ejecuta con --apply solo después de confirmar el proyecto de destino.");
} else {
  const { url, key } = readEnv();
  if (!url || !key) throw new Error("Faltan SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY en el entorno local.");
  const base = new URL(url);
  if (base.protocol !== "https:" || !base.hostname.endsWith(".supabase.co")) throw new Error("La URL debe ser el proyecto oficial de Supabase por HTTPS.");
  const headers = { apikey: key, Authorization: `Bearer ${key}` };
  const countResponse = await fetch(new URL("/rest/v1/profiles?select=id&limit=1", url), { headers, signal: AbortSignal.timeout(15000) });
  if (!countResponse.ok) throw new Error(`No se pudo comprobar la tabla de destino (HTTP ${countResponse.status}).`);
  const existing = await countResponse.json();
  if (Array.isArray(existing) && existing.length) throw new Error("La tabla profiles ya contiene filas. Se detuvo para no sobrescribir ni mezclar datos.");
  await postRows(url, key, "locations", prepared.locations, "departamento,provincia,distrito");
  await postRows(url, key, "profiles", prepared.profiles);
  console.log("Importación terminada. Comprueba los conteos, IDs y registros antes del corte.");
}
