/**
 * Directorio Oficial de Publicidad — receptor de altas V1.
 * Mantiene el orden de columnas de la pestaña `perfiles` del documento `directorio`.
 * No devuelve ni expone registros o campos privados desde doGet.
 */
const SPREADSHEET_ID = "1HUWM3j-RvhrBJlufeUwycP04ZKHZANEuOwVTHNps754";
const SHEET_NAME = "perfiles";
const TIME_ZONE = "America/Lima";
const NEXT_ID_PROPERTY = "DIRECTORY_NEXT_PROFILE_ID";
const CLOUDINARY_IMAGE_PREFIX = "https://res.cloudinary.com/dahrgg4v5/image/upload/";
const HEADERS = [
  "id", "nombres", "apellidos", "genero", "fecha_nacimiento", "departamento", "provincia", "distrito",
  "whatsapp_publico", "whatsapp_interno", "correo", "behance_usuario", "instagram_usuario", "linkedin_usuario",
  "categoria", "descripcion_corta", "descripcion_larga", "productos_servicios", "nivel_experiencia", "nivel_precio",
  "foto_perfil", "imagen_portada", "acepta_privacidad", "calificacion_interna", "es_verificado", "es_destacado",
  "posicion", "estado", "notas", "fecha_registro", "canva_url",
];
const PUBLIC_FORM_FIELDS = [
  "nombres", "apellidos", "genero", "fecha_nacimiento", "departamento", "provincia", "distrito",
  "whatsapp_publico", "whatsapp_interno", "correo", "behance_usuario", "instagram_usuario", "linkedin_usuario",
  "categoria", "descripcion_corta", "descripcion_larga", "productos_servicios", "nivel_experiencia", "nivel_precio",
  "foto_perfil", "imagen_portada", "acepta_privacidad", "canva_url",
];
const OPTIONS = {
  genero: ["Mujer", "Hombre"],
  categoria: ["Diseñadores gráficos", "Anfitrionas", "Volanteras"],
  nivel_experiencia: ["Principiante", "Intermedio", "Experto"],
  nivel_precio: ["Económico", "Estándar", "Premium"],
};
const UNIQUE_FIELDS = ["whatsapp_publico", "whatsapp_interno", "correo", "behance_usuario", "instagram_usuario", "linkedin_usuario"];

function doGet() {
  return jsonOutput_({ ok: true, service: "registro", message: "Servicio de registro disponible." });
}

function doPost(event) {
  const requestId = event && event.parameter && /^[A-Za-z0-9_-]{16,80}$/.test(event.parameter.requestId || "")
    ? event.parameter.requestId
    : "";
  try {
    const payload = parsePayload_(event);
    const record = validateAndNormalize_(payload);
    const lock = LockService.getScriptLock();
    lock.waitLock(15000);
    try {
      const sheet = getProfilesSheet_();
      validateHeaders_(sheet);
      assertUnique_(sheet, record);
      record.id = nextId_(sheet);
      record.calificacion_interna = "";
      record.es_verificado = false;
      record.es_destacado = false;
      record.posicion = "";
      record.estado = "Pendiente";
      record.notas = "";
      record.fecha_registro = new Date();
      appendRecord_(sheet, record);
    } finally {
      lock.releaseLock();
    }
    return responseOutput_({ ok: true, message: "Recibimos tu perfil para revisión.", id: record.id }, requestId);
  } catch (error) {
    console.error(error && error.stack ? error.stack : error);
    return responseOutput_({ ok: false, message: error.message || "No se pudo guardar el registro." }, requestId);
  }
}

function parsePayload_(event) {
  const submittedPayload = event && event.parameter && typeof event.parameter.payload === "string"
    ? event.parameter.payload
    : event && event.postData && event.postData.contents;
  if (!submittedPayload) throw new Error("No llegaron datos del formulario.");
  let data;
  try {
    data = JSON.parse(submittedPayload);
  } catch (error) {
    throw new Error("El formato enviado no es válido.");
  }
  if (!data || typeof data !== "object" || Array.isArray(data)) throw new Error("El formulario enviado no es válido.");
  return data;
}

function validateAndNormalize_(payload) {
  const record = {};
  PUBLIC_FORM_FIELDS.forEach(function (field) {
    record[field] = Object.prototype.hasOwnProperty.call(payload, field) ? payload[field] : null;
  });

  ["nombres", "apellidos", "departamento", "provincia", "distrito", "whatsapp_publico", "whatsapp_interno", "correo",
    "behance_usuario", "instagram_usuario", "linkedin_usuario", "categoria", "descripcion_corta", "descripcion_larga",
    "productos_servicios", "nivel_experiencia", "nivel_precio", "foto_perfil", "imagen_portada", "canva_url"].forEach(function (field) {
    record[field] = cleanText_(record[field]);
  });

  record.correo = lower_(record.correo);
  record.behance_usuario = lower_(record.behance_usuario);
  record.instagram_usuario = lower_(record.instagram_usuario);
  record.linkedin_usuario = lower_(record.linkedin_usuario);
  record.whatsapp_publico = normalizePhone_(record.whatsapp_publico);
  record.whatsapp_interno = normalizePhone_(record.whatsapp_interno);
  record.acepta_privacidad = record.acepta_privacidad === true || record.acepta_privacidad === "Sí" || record.acepta_privacidad === "true";

  const required = ["nombres", "apellidos", "genero", "fecha_nacimiento", "departamento", "provincia", "distrito",
    "whatsapp_interno", "correo", "categoria", "descripcion_corta", "productos_servicios", "nivel_experiencia",
    "nivel_precio", "foto_perfil", "imagen_portada"];
  required.forEach(function (field) {
    if (record[field] === null || record[field] === "") throw new Error("Completa el campo obligatorio: " + field + ".");
  });
  if (!record.acepta_privacidad) throw new Error("Debes aceptar la política de privacidad para enviar el registro.");

  validateName_("nombres", record.nombres);
  validateName_("apellidos", record.apellidos);
  validateChoice_("genero", record.genero);
  validateBirthDate_(record.fecha_nacimiento);
  validateLocation_("departamento", record.departamento, 3, 13, /^[\p{L}\p{M} ]+$/u);
  validateLocation_("provincia", record.provincia, 3, 25, /^[\p{L}\p{M} ]+$/u);
  validateLocation_("distrito", record.distrito, 3, 36, /^[\p{L}\p{M} _()\-]+$/u);
  validatePhone_("whatsapp_publico", record.whatsapp_publico, false);
  validatePhone_("whatsapp_interno", record.whatsapp_interno, true);
  if (record.correo !== null && (record.correo.length < 3 || record.correo.length > 50 || !/^[^\s@]{1,}@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$/.test(record.correo))) throw new Error("Ingresa un correo de 3 a 50 caracteres.");
  validateChoice_("categoria", record.categoria);
  validateUsername_("behance_usuario", record.behance_usuario);
  validateUsername_("instagram_usuario", record.instagram_usuario);
  validateUsername_("linkedin_usuario", record.linkedin_usuario);
  validateTextLength_("descripcion_corta", record.descripcion_corta, 10, 150, true);
  validateTextLength_("descripcion_larga", record.descripcion_larga, 1, 1000, false);
  validateTextLength_("productos_servicios", record.productos_servicios, 1, 500, true);
  validateChoice_("nivel_experiencia", record.nivel_experiencia);
  validateChoice_("nivel_precio", record.nivel_precio);
  validateImageUrl_("foto_perfil", record.foto_perfil);
  validateImageUrl_("imagen_portada", record.imagen_portada);
  validateCanvaUrl_(record.canva_url);
  return record;
}

function cleanText_(value) {
  if (value === null || value === undefined) return null;
  if (typeof value !== "string" && typeof value !== "number") throw new Error("El formato de un campo no es válido.");
  const text = String(value).normalize("NFC").replace(/^[\s\uFEFF]+|[\s\uFEFF]+$/gu, "");
  return text === "" ? null : text;
}

function lower_(value) {
  return value === null ? null : value.toLocaleLowerCase("es-PE");
}

function normalizePhone_(value) {
  if (value === null) return null;
  let phone = value.replace(/[\s()+-]/g, "");
  if (/^9\d{8}$/.test(phone)) phone = "51" + phone;
  return phone;
}

function validateName_(field, value) {
  if (value.length < 2 || value.length > 150 || !/^[\p{L}\p{M} '-]+$/u.test(value)) {
    throw new Error(field + ": usa solo letras, espacios, guiones y apóstrofos (2 a 150 caracteres).");
  }
}

function validateLocation_(field, value, min, max, pattern) {
  if (value !== value.toLocaleUpperCase("es-PE") || value.length < min || value.length > max || !pattern.test(value)) {
    throw new Error(field + ": revisa el formato y la longitud permitidos.");
  }
}

function validatePhone_(field, value, required) {
  if (value === null && !required) return;
  if (value === null || !/^519\d{8}$/.test(value)) throw new Error(field + ": usa un número peruano de 11 dígitos que empiece por 519.");
}

function validateUsername_(field, value) {
  if (value === null) return;
  if (value.length < 3 || value.length > 50 || !/^[a-z0-9._-]+$/.test(value)) {
    throw new Error(field + ": usa 3 a 50 letras, números, puntos, guiones o guiones bajos.");
  }
}

function validateTextLength_(field, value, min, max, required) {
  if (value === null && !required) return;
  if (value === null || value.length < min || value.length > max) {
    throw new Error(field + ": debe tener entre " + min + " y " + max + " caracteres.");
  }
}

function validateChoice_(field, value) {
  if (!OPTIONS[field] || OPTIONS[field].indexOf(value) === -1) throw new Error("Selecciona una opción válida para " + field + ".");
}

function validateBirthDate_(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) throw new Error("La fecha de nacimiento no es válida.");
  const parts = value.split("-").map(Number);
  const birthDate = new Date(Date.UTC(parts[0], parts[1] - 1, parts[2]));
  const normalized = birthDate.getUTCFullYear() + "-" + String(birthDate.getUTCMonth() + 1).padStart(2, "0") + "-" + String(birthDate.getUTCDate()).padStart(2, "0");
  if (Number.isNaN(birthDate.getTime()) || normalized !== value) throw new Error("La fecha de nacimiento no es válida.");
  const todayText = Utilities.formatDate(new Date(), TIME_ZONE, "yyyy-MM-dd");
  const todayParts = todayText.split("-").map(Number);
  const beforeBirthday = todayParts[1] < parts[1] || (todayParts[1] === parts[1] && todayParts[2] < parts[2]);
  const age = todayParts[0] - parts[0] - (beforeBirthday ? 1 : 0);
  if (age < 18 || age > 50) throw new Error("La edad debe estar entre 18 y 50 años.");
}

function validateImageUrl_(field, value) {
  let imageUrl;
  try {
    imageUrl = new URL(value);
  } catch (error) {
    throw new Error(field + ": debe ser una URL válida de Cloudinary.");
  }
  if (value.length > 1000 || imageUrl.protocol !== "https:" || imageUrl.origin !== "https://res.cloudinary.com" || !imageUrl.href.startsWith(CLOUDINARY_IMAGE_PREFIX)) {
    throw new Error(field + ": debe ser una URL HTTPS de Cloudinary.");
  }
}

function validateCanvaUrl_(value) {
  if (value === null) return;
  let url;
  try {
    url = new URL(value);
  } catch (error) {
    throw new Error("El enlace de Canva debe ser una URL válida.");
  }
  if (value.length > 500 || url.protocol !== "https:" || !["canva.com", "www.canva.com"].includes(url.hostname) || !url.pathname.startsWith("/")) {
    throw new Error("El enlace debe ser HTTPS y pertenecer a canva.com.");
  }
}

function getProfilesSheet_() {
  const sheet = SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName(SHEET_NAME);
  if (!sheet) throw new Error("No se encontró la pestaña de perfiles.");
  return sheet;
}

function validateHeaders_(sheet) {
  const actual = sheet.getRange(1, 1, 1, HEADERS.length).getDisplayValues()[0];
  if (HEADERS.some(function (header, index) { return actual[index] !== header; })) {
    throw new Error("Los encabezados de la pestaña perfiles no coinciden con el esquema aprobado.");
  }
}

function assertUnique_(sheet, record) {
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return;
  const data = sheet.getRange(2, 1, lastRow - 1, HEADERS.length).getDisplayValues();
  UNIQUE_FIELDS.forEach(function (field) {
    const incoming = record[field];
    if (!incoming) return;
    const column = HEADERS.indexOf(field);
    const duplicate = data.some(function (row) {
      const stored = String(row[column] || "").trim().toLocaleLowerCase("es-PE");
      return stored !== "" && stored === incoming.toLocaleLowerCase("es-PE");
    });
    if (duplicate) throw new Error("Ya existe un perfil con el dato indicado en " + field + ".");
  });
}

function nextId_(sheet) {
  const lastRow = sheet.getLastRow();
  const ids = lastRow < 2
    ? []
    : sheet.getRange(2, 1, lastRow - 1, 1).getValues().flat().map(Number).filter(function (id) {
      return Number.isSafeInteger(id) && id > 0;
    });
  const storedNextId = Number(PropertiesService.getScriptProperties().getProperty(NEXT_ID_PROPERTY));
  const nextId = Math.max(
    Number.isSafeInteger(storedNextId) && storedNextId > 0 ? storedNextId : 1,
    (ids.length ? Math.max.apply(null, ids) : 0) + 1,
  );
  if (!Number.isSafeInteger(nextId) || nextId >= Number.MAX_SAFE_INTEGER) {
    throw new Error("No se pudo reservar un identificador válido para el perfil.");
  }
  PropertiesService.getScriptProperties().setProperty(NEXT_ID_PROPERTY, String(nextId + 1));
  return nextId;
}

function appendRecord_(sheet, record) {
  const values = HEADERS.map(function (header) {
    const value = Object.prototype.hasOwnProperty.call(record, header) ? record[header] : "";
    if (typeof value === "string" && /^[=+@-]/.test(value)) return "'" + value;
    return value === null ? "" : value;
  });
  sheet.appendRow(values);
}

function jsonOutput_(data) {
  return ContentService.createTextOutput(JSON.stringify(data)).setMimeType(ContentService.MimeType.JSON);
}

function responseOutput_(data, requestId) {
  if (!requestId) return jsonOutput_(data);
  const message = JSON.stringify({ type: "registro-response", requestId: requestId, response: data }).replace(/</g, "\\u003c");
  const html = "<!doctype html><html lang=\"es\"><head><meta charset=\"utf-8\"></head><body><script>window.top.postMessage(" + message + ", \"*\");</script></body></html>";
  return HtmlService.createHtmlOutput(html).setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}
