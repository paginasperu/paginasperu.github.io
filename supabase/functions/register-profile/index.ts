import { createClient } from "npm:@supabase/supabase-js@2.117.3";

const projectUrl = Deno.env.get("SUPABASE_URL")!;
const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const admin = createClient(projectUrl, serviceRoleKey, { auth: { persistSession: false, autoRefreshToken: false } });
const allowedOrigins = new Set([
  "https://www.oficial.pe",
  "https://oficial.pe",
  "http://127.0.0.1:8000",
  "http://localhost:8000",
  "http://127.0.0.1:8123",
  "http://localhost:8123",
]);
const categories = new Set(["Diseñadores gráficos", "Volanteras", "Anfitrionas"]);
const genders = new Set(["Mujer", "Hombre"]);
const experiences = new Set(["Principiante", "Intermedio", "Experto"]);
const prices = new Set(["Económico", "Estándar", "Premium"]);

function response(request: Request, body: Record<string, unknown>, status = 200) {
  const origin = request.headers.get("origin") || "";
  const headers = new Headers({ "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store", "Vary": "Origin" });
  if (allowedOrigins.has(origin)) {
    headers.set("Access-Control-Allow-Origin", origin);
    headers.set("Access-Control-Allow-Headers", "authorization, x-client-info, apikey, content-type");
    headers.set("Access-Control-Allow-Methods", "POST, OPTIONS");
  }
  return new Response(JSON.stringify(body), { status, headers });
}

const fail = (message: string, status = 400) => ({ ok: false, message, status });
function clean(value: unknown, max: number): string | null {
  if (value == null) return null;
  if (typeof value !== "string" && typeof value !== "number") return null;
  const text = String(value).trim();
  if (!text) return null;
  if (text.length > max) throw new Error("Uno de los campos supera el tamaño permitido.");
  return text;
}
function normalizePhone(value: string | null): string | null {
  if (!value) return null;
  const digits = value.replace(/\D/g, "");
  if (digits.length < 9 || digits.length > 15) throw new Error("Revisa el número de WhatsApp.");
  return digits;
}
function validateUrl(value: string | null, portfolio = false): string | null {
  if (!value) return null;
  let url: URL;
  try { url = new URL(value); } catch { throw new Error(portfolio ? "El portafolio debe ser una URL válida." : "La dirección de imagen no es válida."); }
  if (url.protocol !== "https:" || url.username || url.password) throw new Error("Solo se aceptan enlaces HTTPS válidos.");
  if (!portfolio && (url.hostname !== "res.cloudinary.com" || !url.pathname.startsWith("/dahrgg4v5/image/upload/"))) throw new Error("La imagen no pertenece al almacenamiento autorizado.");
  if (portfolio) {
    const hosts = new Set(["instagram.com", "www.instagram.com", "tiktok.com", "www.tiktok.com", "linkedin.com", "www.linkedin.com", "lnkd.in", "behance.net", "www.behance.net"]);
    if (!hosts.has(url.hostname.toLowerCase())) throw new Error("Usa un enlace de Instagram, TikTok, LinkedIn o Behance.");
  }
  return url.href;
}
function validateName(value: string, field: string) {
  if (value.length < 2 || value.length > 80 || !/^[\p{L}\p{M} .'-]+$/u.test(value)) throw new Error(`Revisa el campo ${field}.`);
}
async function hash(value: string) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return [...new Uint8Array(digest)].map((item) => item.toString(16).padStart(2, "0")).join("");
}

async function normalizePayload(payload: Record<string, unknown>, finalSubmission: boolean) {
  const record: Record<string, unknown> = {
    nombres: clean(payload.nombres, 80), apellidos: clean(payload.apellidos, 100),
    genero: clean(payload.genero, 20), fecha_nacimiento: clean(payload.fecha_nacimiento, 20),
    departamento: clean(payload.departamento, 40)?.toLocaleUpperCase("es-PE"),
    provincia: clean(payload.provincia, 60)?.toLocaleUpperCase("es-PE"),
    distrito: clean(payload.distrito, 80)?.toLocaleUpperCase("es-PE"),
    whatsapp_publico: normalizePhone(clean(payload.whatsapp_publico, 30)),
    whatsapp_interno: normalizePhone(clean(payload.whatsapp_interno, 30)),
    correo: clean(payload.correo, 254)?.toLocaleLowerCase("es-PE") ?? null,
    behance_usuario: clean(payload.behance_usuario, 50)?.toLocaleLowerCase("es-PE") ?? null,
    instagram_usuario: clean(payload.instagram_usuario, 50)?.toLocaleLowerCase("es-PE") ?? null,
    linkedin_usuario: clean(payload.linkedin_usuario, 50)?.toLocaleLowerCase("es-PE") ?? null,
    categoria: clean(payload.categoria, 60),
    descripcion_corta: clean(payload.descripcion_corta, 150),
    descripcion_larga: clean(payload.descripcion_larga, 1000),
    productos_servicios: clean(payload.productos_servicios, 500),
    nivel_experiencia: clean(payload.nivel_experiencia, 30), nivel_precio: clean(payload.nivel_precio, 30),
    foto_perfil: validateUrl(clean(payload.foto_perfil, 1000)),
    imagen_portada: validateUrl(clean(payload.imagen_portada, 1000)),
    portafolio_url: validateUrl(clean(payload.portafolio_url, 500), true),
    acepta_privacidad: payload.acepta_privacidad === true || payload.acepta_privacidad === "true" || payload.acepta_privacidad === "Sí",
  };
  if (!record.nombres || !record.apellidos || !record.departamento || !record.provincia || !record.distrito || !record.whatsapp_interno || !record.portafolio_url || !record.categoria || !record.descripcion_corta) throw new Error("Completa los campos obligatorios del formulario.");
  validateName(String(record.nombres), "nombres");
  validateName(String(record.apellidos), "apellidos");
  if (!categories.has(String(record.categoria))) throw new Error("Selecciona una categoría válida.");
  if (record.genero && !genders.has(String(record.genero))) throw new Error("Selecciona una opción válida de género.");
  if (record.nivel_experiencia && !experiences.has(String(record.nivel_experiencia))) throw new Error("Selecciona un nivel de experiencia válido.");
  if (record.nivel_precio && !prices.has(String(record.nivel_precio))) throw new Error("Selecciona un nivel de precios válido.");
  if (String(record.descripcion_corta).length < 10) throw new Error("La descripción corta debe tener al menos 10 caracteres.");
  if (!record.acepta_privacidad) throw new Error("Debes aceptar la política de privacidad.");
  if (record.correo && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(record.correo))) throw new Error("Revisa el correo.");
  for (const field of ["instagram_usuario", "linkedin_usuario", "behance_usuario"]) {
    if (record[field] && !/^[\p{L}\p{N}._-]{1,50}$/u.test(String(record[field]))) throw new Error(`Revisa el usuario de ${field.replace("_usuario", "")}.`);
  }
  if (record.fecha_nacimiento && !/^\d{4}-\d{2}-\d{2}$/.test(String(record.fecha_nacimiento))) throw new Error("Revisa la fecha de nacimiento.");
  if (finalSubmission && (!record.foto_perfil || !record.imagen_portada)) throw new Error("Selecciona y carga las dos imágenes obligatorias.");
  const { data: location, error: locationError } = await admin.from("locations").select("ubigeo").eq("departamento", record.departamento).eq("provincia", record.provincia).eq("distrito", record.distrito).maybeSingle();
  if (locationError) throw new Error("No se pudo comprobar la ubicación. Inténtalo de nuevo.");
  if (!location) throw new Error("Selecciona un distrito válido de la lista.");
  record.location_id = location.ubigeo;
  return record;
}

Deno.serve(async (request: Request) => {
  if (request.method === "OPTIONS") return response(request, {});
  if (request.method !== "POST") return response(request, fail("Método no permitido.", 405), 405);
  const origin = request.headers.get("origin") || "";
  if (origin && !allowedOrigins.has(origin)) return response(request, fail("Origen no autorizado.", 403), 403);
  try {
    const raw = await request.text();
    if (raw.length > 24_000) return response(request, fail("El formulario supera el tamaño permitido.", 413), 413);
    const payload = JSON.parse(raw) as Record<string, unknown>;
    if (!payload || Array.isArray(payload) || typeof payload !== "object") return response(request, fail("Formato de envío no válido."), 400);
    if (typeof payload.website === "string" && payload.website.trim()) return response(request, { ok: true, message: "Solicitud recibida." });
    const startedAt = Number(payload.startedAt);
    if (!Number.isFinite(startedAt) || Date.now() - startedAt < 2500 || startedAt > Date.now() + 30_000) throw new Error("Espera un momento y vuelve a enviar el formulario.");
    const submissionId = String(payload.submissionId || "");
    if (!/^[a-f0-9-]{32,36}$/i.test(submissionId)) throw new Error("Actualiza la página e inténtalo de nuevo.");
    const validateOnly = payload.action === "validate";
    const record = await normalizePayload(payload, !validateOnly);
    if (validateOnly) return response(request, { ok: true, validated: true });

    const fingerprintInput = { ...record, foto_perfil: null, imagen_portada: null };
    const fingerprint = await hash(JSON.stringify(fingerprintInput));
    const { data: existing, error: existingError } = await admin.from("profiles").select("id,submission_fingerprint").eq("submission_id", submissionId).maybeSingle();
    if (existingError) throw new Error("No se pudo confirmar el estado del envío.");
    if (existing) {
      if (existing.submission_fingerprint !== fingerprint) throw new Error("El envío cambió. Revisa los datos y vuelve a enviarlos.");
      return response(request, { ok: true, id: existing.id, message: "Recibimos tu perfil para revisión." });
    }

    const contactHash = await hash(String(record.whatsapp_interno));
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const { count, error: countError } = await admin.from("registration_rate_limits").select("id", { count: "exact", head: true }).eq("contact_hash", contactHash).gte("created_at", since);
    if (countError) throw new Error("No se pudo validar el envío. Inténtalo de nuevo.");
    if ((count || 0) >= 3) throw new Error("Ya recibimos varias solicitudes desde este número. Inténtalo mañana.");

    const { data: duplicate, error: duplicateError } = await admin.from("profiles").select("id").eq("whatsapp_interno", record.whatsapp_interno).maybeSingle();
    if (duplicateError) throw new Error("No se pudo revisar si el perfil ya existe.");
    if (duplicate) throw new Error("Ya existe un registro con este WhatsApp interno. Contáctanos si necesitas actualizarlo.");

    const { error: limitError } = await admin.from("registration_rate_limits").insert({ contact_hash: contactHash });
    if (limitError) throw new Error("No se pudo validar el envío. Inténtalo de nuevo.");
    const insert = { ...record, estado: "Pendiente", es_verificado: false, es_destacado: false, posicion: null, notas: "", submission_id: submissionId, submission_fingerprint: fingerprint };
    const { data, error } = await admin.from("profiles").insert(insert).select("id").single();
    if (error) {
      if (error.code === "23505") throw new Error("Ya existe un registro con este WhatsApp interno.");
      throw new Error("No pudimos guardar el registro. Conserva tus datos y vuelve a intentarlo.");
    }
    return response(request, { ok: true, id: data.id, message: "Recibimos tu perfil para revisión." }, 201);
  } catch (error) {
    const message = error instanceof SyntaxError ? "El formato enviado no es válido." : error instanceof Error ? error.message : "No pudimos confirmar el registro.";
    return response(request, { ok: false, retryable: true, message }, 400);
  }
});
