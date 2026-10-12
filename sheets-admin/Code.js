/**
 * Ficha privada de revisión para la hoja "directorio".
 * Este proyecto está vinculado a la hoja y no es el endpoint público del formulario.
 */
const REVIEW_SHEET_NAME = "perfiles";
const PUBLIC_SHEET_NAME = "publico";
const REVIEW_SPREADSHEET_ID = "1HUWM3j-RvhrBJlufeUwycP04ZKHZANEuOwVTHNps754";
const REVIEW_HEADERS = [
  "id", "nombres", "apellidos", "genero", "fecha_nacimiento", "departamento", "provincia", "distrito",
  "whatsapp_publico", "whatsapp_interno", "correo", "behance_usuario", "instagram_usuario", "linkedin_usuario",
  "categoria", "descripcion_corta", "descripcion_larga", "productos_servicios", "nivel_experiencia", "nivel_precio",
  "foto_perfil", "imagen_portada", "acepta_privacidad", "calificacion_interna", "es_verificado", "es_destacado",
  "posicion", "estado", "notas", "fecha_registro", "portafolio_url",
];
const PUBLIC_HEADERS = [
  "id", "nombres", "apellidos", "departamento", "provincia", "distrito", "whatsapp_publico", "portafolio_url",
  "instagram_usuario", "linkedin_usuario", "behance_usuario",
  "categoria", "descripcion_corta", "descripcion_larga", "productos_servicios", "nivel_experiencia", "nivel_precio",
  "foto_perfil", "imagen_portada", "es_verificado", "es_destacado", "posicion",
];
const REVIEW_STATUSES = ["Pendiente", "Activo", "Rechazado", "Inactivo"];

function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu("Gestión de perfiles")
    .addItem("Abrir ficha de revisión", "showReviewSidebar")
    .addToUi();
}

function doGet() {
  return HtmlService.createTemplateFromFile("Admin")
    .evaluate()
    .setTitle("Gestión de perfiles · Oficial");
}

function include(filename) {
  return HtmlService.createHtmlOutputFromFile(filename).getContent();
}

/** Admin list API: minimal fields only; private data is returned by getReviewRecord after selection. */
function getAdminRecords(filters) {
  const query = filters && typeof filters === "object" ? filters : {};
  const statusFilter = String(query.status || "Todos");
  const categoryFilter = String(query.category || "Todas");
  const districtFilter = String(query.district || "Todos");
  if (statusFilter !== "Todos" && REVIEW_STATUSES.indexOf(statusFilter) === -1) throw new Error("El filtro de estado no es válido.");
  const categories = ["Diseñadores gráficos", "Volanteras", "Anfitrionas"];
  if (categoryFilter !== "Todas" && categories.indexOf(categoryFilter) === -1) throw new Error("El filtro de categoría no es válido.");
  const search = String(query.search || "").trim().slice(0, 100).toLocaleLowerCase("es-PE");
  const sheet = getSheetWithHeaders_(REVIEW_SHEET_NAME, REVIEW_HEADERS);
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return { records: [], districts: [], counts: emptyAdminCounts_() };
  const rows = sheet.getRange(2, 1, lastRow - 1, REVIEW_HEADERS.length).getDisplayValues();
  const col = function (field) { return REVIEW_HEADERS.indexOf(field); };
  const seen = new Set();
  const records = rows.filter(function (row) { return row[col("id")] !== ""; }).map(function (row) {
    const id = row[col("id")];
    if (!/^[1-9]\d*$/.test(id) || seen.has(id)) throw new Error("Hay un ID inválido o duplicado; no se puede abrir la gestión.");
    seen.add(id);
    return {
      id: id,
      name: [row[col("nombres")], row[col("apellidos")]].filter(Boolean).join(" "),
      category: row[col("categoria")],
      district: row[col("distrito")],
      province: row[col("provincia")],
      department: row[col("departamento")],
      status: row[col("estado")],
      verified: row[col("es_verificado")] === "TRUE",
      featured: row[col("es_destacado")] === "TRUE",
      photo: row[col("foto_perfil")],
      date: row[col("fecha_registro")],
    };
  });
  const counts = emptyAdminCounts_();
  records.forEach(function (record) { if (Object.prototype.hasOwnProperty.call(counts, record.status)) counts[record.status]++; counts.total++; });
  const districts = Array.from(new Set(records.map(function (record) { return record.district; }).filter(Boolean))).sort();
  const visible = records.filter(function (record) {
    if (statusFilter !== "Todos" && record.status !== statusFilter) return false;
    if (categoryFilter !== "Todas" && record.category !== categoryFilter) return false;
    if (districtFilter !== "Todos" && record.district !== districtFilter) return false;
    if (query.verified === true && !record.verified) return false;
    if (query.featured === true && !record.featured) return false;
    if (search && ![record.id, record.name, record.category, record.district, record.province, record.department].join(" ").toLocaleLowerCase("es-PE").includes(search)) return false;
    return true;
  });
  return { records: visible, districts: districts, counts: counts };
}

function emptyAdminCounts_() { return { total: 0, Pendiente: 0, Activo: 0, Rechazado: 0, Inactivo: 0 }; }

function showReviewSidebar() {
  const html = HtmlService.createHtmlOutputFromFile("ReviewSidebar")
    .setTitle("Revisión de perfiles");
  SpreadsheetApp.getUi().showSidebar(html);
}

function getReviewQueue(statusFilter) {
  const filter = String(statusFilter || "Pendiente");
  if (filter !== "Todos" && REVIEW_STATUSES.indexOf(filter) === -1) throw new Error("El filtro de estado no es válido.");
  const sheet = getSheetWithHeaders_(REVIEW_SHEET_NAME, REVIEW_HEADERS);
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return [];
  const values = sheet.getRange(2, 1, lastRow - 1, REVIEW_HEADERS.length).getDisplayValues();
  const idCol = REVIEW_HEADERS.indexOf("id");
  const statusCol = REVIEW_HEADERS.indexOf("estado");
  const firstCol = REVIEW_HEADERS.indexOf("nombres");
  const lastCol = REVIEW_HEADERS.indexOf("apellidos");
  const categoryCol = REVIEW_HEADERS.indexOf("categoria");
  const dateCol = REVIEW_HEADERS.indexOf("fecha_registro");
  return values.filter(function (row) { return row[idCol] !== "" && (filter === "Todos" || row[statusCol] === filter); })
    .map(function (row) {
      return {
        id: row[idCol],
        name: [row[firstCol], row[lastCol]].filter(Boolean).join(" "),
        category: row[categoryCol],
        date: row[dateCol],
      };
    });
}

function getReviewRecord(id) {
  const sheet = getSheetWithHeaders_(REVIEW_SHEET_NAME, REVIEW_HEADERS);
  const rowNumber = findUniqueRecordRow_(sheet, id);
  const row = sheet.getRange(rowNumber, 1, 1, REVIEW_HEADERS.length).getDisplayValues()[0];
  const record = {};
  REVIEW_HEADERS.forEach(function (header, index) { record[header] = row[index]; });
  return record;
}

function saveReview(update) {
  if (!update || typeof update !== "object") throw new Error("No se recibieron cambios válidos.");
  const id = String(update.id || "").trim();
  if (!/^\d+$/.test(id)) throw new Error("El identificador del perfil no es válido.");
  if (REVIEW_STATUSES.indexOf(update.estado) === -1) throw new Error("Selecciona un estado válido.");
  const position = String(update.posicion == null ? "" : update.posicion).trim();
  if (position && (!/^\d+$/.test(position) || Number(position) < 1 || Number(position) > 1000000)) {
    throw new Error("La posición debe ser un entero positivo.");
  }
  const notes = String(update.notas == null ? "" : update.notas);
  if (notes.length > 2000) throw new Error("Las notas no pueden superar 2000 caracteres.");
  // ScriptLock also works when this bound project runs as a web app without an active document.
  const lock = LockService.getScriptLock();
  lock.waitLock(15000);
  try {
    const sheet = getSheetWithHeaders_(REVIEW_SHEET_NAME, REVIEW_HEADERS);
    const rowNumber = findUniqueRecordRow_(sheet, id);
    setSafeCell_(sheet.getRange(rowNumber, REVIEW_HEADERS.indexOf("es_verificado") + 1), update.es_verificado === true);
    setSafeCell_(sheet.getRange(rowNumber, REVIEW_HEADERS.indexOf("es_destacado") + 1), update.es_destacado === true);
    setSafeCell_(sheet.getRange(rowNumber, REVIEW_HEADERS.indexOf("posicion") + 1), position ? Number(position) : "");
    setSafeCell_(sheet.getRange(rowNumber, REVIEW_HEADERS.indexOf("estado") + 1), update.estado);
    setSafeCell_(sheet.getRange(rowNumber, REVIEW_HEADERS.indexOf("notas") + 1), notes);
    SpreadsheetApp.flush();
    return { ok: true, id: id, estado: update.estado };
  } finally {
    lock.releaseLock();
  }
}

function getPublicCsvData() {
  const sheet = getSheetWithHeaders_(REVIEW_SHEET_NAME, REVIEW_HEADERS);
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return [PUBLIC_HEADERS];
  const values = sheet.getRange(2, 1, lastRow - 1, REVIEW_HEADERS.length).getDisplayValues();
  const seen = new Set();
  const active = values.filter(function (row) { return row[REVIEW_HEADERS.indexOf("estado")] === "Activo"; });
  return [PUBLIC_HEADERS].concat(active.map(function (row) {
    if (!/^[1-9]\d*$/.test(row[0]) || seen.has(row[0])) throw new Error("Hay un ID inválido o duplicado; se canceló la exportación.");
    seen.add(row[0]);
    return PUBLIC_HEADERS.map(function (header) { return row[REVIEW_HEADERS.indexOf(header)]; });
  }));
}

function getSheetWithHeaders_(name, headers) {
  // A bound script has no active spreadsheet context when executed as a web app.
  const sheet = SpreadsheetApp.openById(REVIEW_SPREADSHEET_ID).getSheetByName(name);
  if (!sheet) throw new Error("No se encontró la pestaña " + name + ".");
  const actual = sheet.getRange(1, 1, 1, headers.length).getDisplayValues()[0];
  if (headers.some(function (header, index) { return actual[index] !== header; })) {
    throw new Error("Los encabezados de " + name + " cambiaron; se canceló la operación para proteger los datos.");
  }
  return sheet;
}

function findUniqueRecordRow_(sheet, id) {
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) throw new Error("No se encontró el perfil " + id + ".");
  const matches = sheet.getRange(2, 1, lastRow - 1, 1).getDisplayValues()
    .map(function (row, index) { return row[0] === id ? index + 2 : 0; })
    .filter(Boolean);
  if (matches.length !== 1) throw new Error(matches.length ? "El ID aparece más de una vez; no se guardaron cambios." : "No se encontró el perfil " + id + ".");
  return matches[0];
}

function setSafeCell_(cell, value) {
  if (typeof value === "string" && /^[=+@-]/.test(value)) value = "'" + value;
  cell.setValue(value);
}
