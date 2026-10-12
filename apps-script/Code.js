/**
 * Directorio Oficial de Publicidad — receptor de altas V1.
 * Mantiene el orden de columnas de la pestaña `perfiles` del documento `directorio`.
 * No devuelve ni expone registros o campos privados desde doGet.
 */
const SPREADSHEET_ID = "1HUWM3j-RvhrBJlufeUwycP04ZKHZANEuOwVTHNps754";
const SHEET_NAME = "perfiles";
const NEXT_ID_PROPERTY = "DIRECTORY_NEXT_PROFILE_ID";
const CLOUDINARY_IMAGE_PREFIX = "https://res.cloudinary.com/dahrgg4v5/image/upload/";
const HEADERS = [
  "id", "nombres", "apellidos", "genero", "fecha_nacimiento", "departamento", "provincia", "distrito",
  "whatsapp_publico", "whatsapp_interno", "correo", "behance_usuario", "instagram_usuario", "linkedin_usuario",
  "categoria", "descripcion_corta", "descripcion_larga", "productos_servicios", "nivel_experiencia", "nivel_precio",
  "foto_perfil", "imagen_portada", "acepta_privacidad", "calificacion_interna", "es_verificado", "es_destacado",
  "posicion", "estado", "notas", "fecha_registro", "portafolio_url",
];
const PUBLIC_FORM_FIELDS = [
  "nombres", "apellidos", "departamento", "provincia", "distrito",
  "whatsapp_publico", "whatsapp_interno", "portafolio_url", "categoria",
  "descripcion_corta", "descripcion_larga", "foto_perfil", "imagen_portada", "acepta_privacidad",
];
const OPTIONS = {
  categoria: ["Diseñadores gráficos", "Anfitrionas", "Volanteras"],
};
const UNIQUE_FIELDS = ["whatsapp_interno"];

function doGet() {
  return jsonOutput_({ ok: true, service: "registro", version: "20261011-form-v1", message: "Servicio de registro disponible." });
}

function doPost(event) {
  const requestId = event && event.parameter && /^[A-Za-z0-9_-]{16,80}$/.test(event.parameter.requestId || "")
    ? event.parameter.requestId
    : "";
  try {
    const payload = parsePayload_(event);
    validateSubmission_(payload);
    const record = validateAndNormalize_(payload);
    const lock = LockService.getScriptLock();
    lock.waitLock(15000);
    try {
      const sheet = getProfilesSheet_();
      validateHeaders_(sheet);
      const properties = PropertiesService.getScriptProperties();
      const now = Date.now();
      const requests = JSON.parse(properties.getProperty("DIRECTORY_REQUESTS") || "{}");
      Object.keys(requests).forEach(function (key) { if (now - requests[key].at > 86400000) delete requests[key]; });
      const fingerprint = digest_(JSON.stringify(Object.assign({}, record, { foto_perfil: null, imagen_portada: null })));
      const previous = requests[payload.submissionId];
      if (previous) {
        if (previous.fingerprint !== fingerprint) throw inputError_("El envío cambió. Revisa los datos y vuelve a enviarlos.");
        const idExists = sheet.getLastRow() > 1 && sheet.getRange(2, 1, sheet.getLastRow() - 1, 1).getValues().some(function (row) { return Number(row[0]) === previous.id; });
        if (idExists) return responseOutput_({ ok: true, message: "Recibimos tu perfil para revisión.", id: previous.id }, requestId, event);
        delete requests[payload.submissionId];
      }
      checkRateLimit_(record.whatsapp_interno);
      assertUnique_(sheet, record);
      if (payload.action === "validate") return responseOutput_({ ok: true, validated: true }, requestId, event);
      record.id = nextId_(sheet);
      record.calificacion_interna = "";
      record.es_verificado = false;
      record.es_destacado = false;
      record.posicion = "";
      record.estado = "Pendiente";
      record.notas = "";
      record.fecha_registro = new Date();
      requests[payload.submissionId] = { at: now, id: record.id, fingerprint: fingerprint };
      if (Object.keys(requests).length > 40) delete requests[Object.keys(requests).sort(function (a, b) { return requests[a].at - requests[b].at; })[0]];
      properties.setProperty("DIRECTORY_REQUESTS", JSON.stringify(requests));
      appendRecord_(sheet, record);
    } finally {
      lock.releaseLock();
    }
    return responseOutput_({ ok: true, message: "Recibimos tu perfil para revisión.", id: record.id }, requestId, event);
  } catch (error) {
    console.error(error && error.stack ? error.stack : error);
    return responseOutput_({ ok: false, retryable: !error.isInput, message: error.isInput ? error.message : "No pudimos confirmar el registro. Conserva tus datos y vuelve a intentarlo." }, requestId, event);
  }
}

function parsePayload_(event) {
  const submittedPayload = event && event.parameter && typeof event.parameter.payload === "string"
    ? event.parameter.payload
    : event && event.postData && event.postData.contents;
  if (!submittedPayload) throw inputError_("No llegaron datos del formulario.");
  if (submittedPayload.length > 16000) throw inputError_("El formulario supera el tamaño permitido.");
  let data;
  try {
    data = JSON.parse(submittedPayload);
  } catch (error) {
    throw inputError_("El formato enviado no es válido.");
  }
  if (!data || typeof data !== "object" || Array.isArray(data)) throw inputError_("El formulario enviado no es válido.");
  return data;
}

function validateAndNormalize_(payload) {
  const record = {};
  PUBLIC_FORM_FIELDS.forEach(function (field) {
    record[field] = Object.prototype.hasOwnProperty.call(payload, field) ? payload[field] : null;
  });

  ["nombres", "apellidos", "departamento", "provincia", "distrito", "whatsapp_publico", "whatsapp_interno",
    "portafolio_url", "categoria", "descripcion_corta", "descripcion_larga", "foto_perfil", "imagen_portada"].forEach(function (field) {
    record[field] = cleanText_(record[field]);
  });

  record.whatsapp_publico = normalizePhone_(record.whatsapp_publico);
  record.whatsapp_interno = normalizePhone_(record.whatsapp_interno);
  record.acepta_privacidad = record.acepta_privacidad === true || record.acepta_privacidad === "Sí" || record.acepta_privacidad === "true";

  const required = ["nombres", "apellidos", "departamento", "provincia", "distrito",
    "whatsapp_interno", "portafolio_url", "categoria", "descripcion_corta"];
  if (payload.action !== "validate") required.push("foto_perfil", "imagen_portada");
  required.forEach(function (field) {
    if (record[field] === null || record[field] === "") throw inputError_("Completa el campo obligatorio: " + field + ".");
  });
  if (!record.acepta_privacidad) throw inputError_("Debes aceptar la política de privacidad para enviar el registro.");

  validateName_("nombres", record.nombres);
  validateName_("apellidos", record.apellidos);
  validateLocation_("departamento", record.departamento, 3, 13, /^[\p{L}\p{M} ]+$/u);
  validateLocation_("provincia", record.provincia, 3, 25, /^[\p{L}\p{M} ]+$/u);
  validateLocation_("distrito", record.distrito, 3, 36, /^[\p{L}\p{M} _()\-]+$/u);
  if (!VALID_LOCATIONS.has([record.departamento, record.provincia, record.distrito].join("|"))) {
    throw inputError_("Selecciona una combinación válida de departamento, provincia y distrito.");
  }
  validatePhone_("whatsapp_publico", record.whatsapp_publico, false);
  validatePhone_("whatsapp_interno", record.whatsapp_interno, true);
  validateChoice_("categoria", record.categoria);
  validateTextLength_("descripcion_corta", record.descripcion_corta, 10, 150, true);
  validateTextLength_("descripcion_larga", record.descripcion_larga, 1, 1000, false);
  validateImageUrl_("foto_perfil", record.foto_perfil);
  validateImageUrl_("imagen_portada", record.imagen_portada);
  validatePortfolioUrl_(record.portafolio_url);
  return record;
}

function cleanText_(value) {
  if (value === null || value === undefined) return null;
  if (typeof value !== "string" && typeof value !== "number") throw inputError_("El formato de un campo no es válido.");
  const text = String(value).normalize("NFC").replace(/^[\s\uFEFF]+|[\s\uFEFF]+$/gu, "");
  return text === "" ? null : text;
}

function normalizePhone_(value) {
  if (value === null) return null;
  let phone = value.replace(/[\s()+-]/g, "");
  if (/^9\d{8}$/.test(phone)) phone = "51" + phone;
  return phone;
}

function validateName_(field, value) {
  if (value.length < 2 || value.length > 150 || !/^[\p{L}\p{M} '-]+$/u.test(value)) {
    throw inputError_(field + ": usa solo letras, espacios, guiones y apóstrofos (2 a 150 caracteres).");
  }
}

function validateLocation_(field, value, min, max, pattern) {
  if (value !== value.toLocaleUpperCase("es-PE") || value.length < min || value.length > max || !pattern.test(value)) {
    throw inputError_(field + ": revisa el formato y la longitud permitidos.");
  }
}

function validatePhone_(field, value, required) {
  if (value === null && !required) return;
  if (value === null || !/^519\d{8}$/.test(value)) throw inputError_(field + ": usa un número peruano de 11 dígitos que empiece por 519.");
}

function validateTextLength_(field, value, min, max, required) {
  if (value === null && !required) return;
  if (value === null || value.length < min || value.length > max) {
    throw inputError_(field + ": debe tener entre " + min + " y " + max + " caracteres.");
  }
}

function validateChoice_(field, value) {
  if (!OPTIONS[field] || OPTIONS[field].indexOf(value) === -1) throw inputError_("Selecciona una opción válida para " + field + ".");
}

function validateImageUrl_(field, value) {
  if (value === null) return;
  // Apps Script V8 no incluye la API web global URL. Valida el prefijo HTTPS
  // completo y rechaza separadores que podrían alterar la interpretación.
  if (typeof value !== "string" || value.length > 1000
      || value.indexOf(CLOUDINARY_IMAGE_PREFIX) !== 0 || value.length === CLOUDINARY_IMAGE_PREFIX.length
      || /[\s?#\\]/.test(value)) {
    throw inputError_(field + ": debe ser una URL HTTPS de Cloudinary.");
  }
}

function validatePortfolioUrl_(value) {
  if (value === null) return;
  if (typeof value !== "string" || value.length > 500 || /[\s\\\u0000-\u001F\u007F]/.test(value)) {
    throw inputError_("El portafolio debe enlazar a Instagram, TikTok, LinkedIn o Behance.");
  }
  const match = /^https:\/\/([^/?#]+)(?:[/?#][^\s\\]*)?$/i.exec(value);
  if (!match || match[1].indexOf("@") !== -1) {
    throw inputError_("El portafolio debe enlazar a Instagram, TikTok, LinkedIn o Behance.");
  }
  const authority = match[1];
  const portMatch = authority.match(/:(\d+)$/);
  const host = portMatch ? authority.slice(0, -portMatch[0].length) : authority;
  if (portMatch && Number(portMatch[1]) !== 443) {
    throw inputError_("El portafolio debe enlazar a Instagram, TikTok, LinkedIn o Behance.");
  }
  const normalizedHost = host.toLowerCase().replace(/\.$/, "");
  const allowedDomains = ["instagram.com", "tiktok.com", "linkedin.com", "behance.net", "lnkd.in"];
  const allowedHost = allowedDomains.some(function (domain) {
    return normalizedHost === domain || normalizedHost.endsWith("." + domain);
  });
  if (!allowedHost) {
    throw inputError_("El portafolio debe enlazar a Instagram, TikTok, LinkedIn o Behance.");
  }
}

function getProfilesSheet_() {
  const sheet = SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName(SHEET_NAME);
  if (!sheet) throw inputError_("No se encontró la pestaña de perfiles.");
  return sheet;
}

function validateHeaders_(sheet) {
  const actual = sheet.getRange(1, 1, 1, HEADERS.length).getDisplayValues()[0];
  if (HEADERS.some(function (header, index) { return actual[index] !== header; })) {
    throw inputError_("Los encabezados de la pestaña perfiles no coinciden con el esquema aprobado.");
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
    if (duplicate) throw inputError_("Ya existe un perfil con el dato indicado en " + field + ".");
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
    throw inputError_("No se pudo reservar un identificador válido para el perfil.");
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
  const existing = sheet.getLastRow() > 1 ? sheet.getRange(2, 1, sheet.getLastRow() - 1, HEADERS.length).getValues() : [];
  const available = existing.findIndex(function (row) {
    return row.every(function (value, index) {
      return value === "" || value === null || ((HEADERS[index] === "es_verificado" || HEADERS[index] === "es_destacado") && value === false);
    });
  });
  if (available >= 0) sheet.getRange(available + 2, 1, 1, HEADERS.length).setValues([values]);
  else sheet.appendRow(values);
}

function jsonOutput_(data) {
  return ContentService.createTextOutput(JSON.stringify(data)).setMimeType(ContentService.MimeType.JSON);
}

function responseOutput_(data, requestId, event) {
  if (!requestId) return jsonOutput_(data);
  const origin = event && event.parameter && event.parameter.clientOrigin;
  const target = /^(https:\/\/(?:www\.)?oficial\.pe|http:\/\/(?:localhost|127\.0\.0\.1):\d{2,5})$/.test(origin || "") ? origin : "https://oficial.pe";
  const message = JSON.stringify({ type: "registro-response", requestId: requestId, response: data }).replace(/</g, "\\u003c");
  const html = "<!doctype html><html lang=\"es\"><head><meta charset=\"utf-8\"></head><body><script>window.top.postMessage(" + message + ", " + JSON.stringify(target) + ");</script></body></html>";
  return HtmlService.createHtmlOutput(html).setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

function validateSubmission_(payload) {
  const elapsed = Date.now() - Number(payload.startedAt);
  if (payload.website || !Number.isFinite(elapsed) || elapsed < 3000 || elapsed > 86400000) {
    throw inputError_("No se pudo validar el envío. Espera unos segundos o recarga la página.");
  }
  if (!/^[A-Za-z0-9_-]{16,80}$/.test(payload.submissionId || "")) throw inputError_("El identificador del envío no es válido.");
  if (payload.action && payload.action !== "validate") throw inputError_("La acción solicitada no es válida.");
}

function digest_(value) {
  return Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, value).map(function (byte) { return (byte + 256).toString(16).slice(-2); }).join("");
}

function checkRateLimit_(contact) {
  const cache = CacheService.getScriptCache();
  const bucket = Math.floor(Date.now() / 600000);
  const contactKey = "rate:" + bucket + ":" + digest_(contact);
  const globalKey = "rate:" + bucket + ":global";
  const contactCount = Number(cache.get(contactKey) || 0);
  const globalCount = Number(cache.get(globalKey) || 0);
  if (contactCount >= 8 || globalCount >= 100) throw inputError_("Hay demasiados intentos. Vuelve a intentarlo en diez minutos.");
  cache.put(contactKey, String(contactCount + 1), 1200);
  cache.put(globalKey, String(globalCount + 1), 1200);
}

function inputError_(message) { const error = new Error(message); error.isInput = true; return error; }
