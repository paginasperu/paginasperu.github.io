import { attachFieldValidation } from './form-validation.js?v=20261011-2';
import { prepareLocationOptions, searchLocations } from './location-picker.js';

const SITE_CONFIG = {
  appsScriptEndpoint: "https://script.google.com/macros/s/AKfycbyFHXYtrjWYk3QDHj-SoV-lquJI9VQ0dbOSVfA7fJlFIHJGLK8ZXAJ_MlOHkwooYgrFxw/exec",
  cloudinary: {
    // Valores públicos del preset unsigned. Nunca incluir aquí API Secret.
    cloudName: "dahrgg4v5",
    unsignedUploadPreset: "directorio",
  },
};

const form = document.querySelector("#registro");
const fieldValidation = attachFieldValidation(form);
const message = document.querySelector("#mensaje");
const submitButton = document.querySelector("#enviar");
const privacyDialog = document.querySelector("#privacy-dialog");
const privacyDialogContent = document.querySelector("#privacy-dialog-content");
const birthDateInput = form.elements.namedItem("fecha_nacimiento");
const locationInput = document.querySelector("#ubicacion");
const locationList = document.querySelector("#ubicacion-listbox");
const locationStatus = document.querySelector("#ubicacion-status");
const locationUrl = new URL("../data/distritos.csv", import.meta.url);
let locationOptions = [];
let visibleLocations = [];
let selectedLocation = null;
let activeLocationIndex = -1;
const MAX_SOURCE_IMAGE_BYTES = 1024 * 1024;
const MAX_PROCESSING_WIDTH = 1200;
const MAX_PROCESSING_HEIGHT = 1500;
const JPEG_QUALITY = 0.86;
const cropStates = new Map();
const uploadedImages = new Map();
let startedAt = Date.now();
let pendingSubmission = null;
birthDateInput.max = new Date().toISOString().slice(0, 10);

let privacyPolicyLoaded = false;
document.querySelector("[data-privacy-dialog-open]")?.addEventListener("click", async (event) => {
  event.preventDefault();
  if (!privacyDialog || typeof privacyDialog.showModal !== "function") {
    window.location.href = "./privacidad";
    return;
  }

  if (!privacyPolicyLoaded) {
    privacyDialogContent.setAttribute("aria-busy", "true");
    try {
      const response = await fetch(new URL("../privacidad.html?v=20261011-2", import.meta.url));
      if (!response.ok) throw new Error("No se pudo cargar la política.");
      const policyDocument = new DOMParser().parseFromString(await response.text(), "text/html");
      const source = policyDocument.querySelector(".privacy-document");
      if (!source) throw new Error("No se encontró el contenido de la política.");
      const article = document.createElement("article");
      article.className = "privacy-document";
      article.append(...Array.from(source.children, (section) => document.importNode(section, true)));
      privacyDialogContent.replaceChildren(article);
      privacyPolicyLoaded = true;
    } catch {
      const fallback = document.createElement("p");
      fallback.setAttribute("role", "status");
      fallback.append("No pudimos cargar la política aquí. Puedes ");
      const link = document.createElement("a");
      link.href = "./privacidad";
      link.textContent = "leerla en su página";
      fallback.append(link, ".");
      privacyDialogContent.replaceChildren(fallback);
    } finally {
      privacyDialogContent.setAttribute("aria-busy", "false");
    }
  }

  privacyDialog.showModal();
});

privacyDialog?.querySelectorAll("[data-privacy-dialog-close]").forEach((button) => {
  button.addEventListener("click", () => privacyDialog.close());
});
privacyDialog?.addEventListener("click", (event) => {
  if (event.target === privacyDialog) privacyDialog.close();
});

function newSubmissionId() {
  const bytes = crypto.getRandomValues(new Uint8Array(24));
  return Array.from(bytes, byte => byte.toString(16).padStart(2, "0")).join("");
}

function imageFingerprint(input) {
  const file = input.files?.[0];
  const crop = cropStates.get(input.name);
  return file ? JSON.stringify([file.name, file.size, file.lastModified, crop?.zoom, crop?.x, crop?.y]) : "";
}

async function discardUnusedImages(usedUrls = []) {
  for (const [key, asset] of uploadedImages) {
    if (usedUrls.includes(asset.url)) continue;
      if (asset.uncertain) continue;
    if (!asset.deleteToken || Date.now() - asset.uploadedAt > 9 * 60000) continue;
    try {
      const body = new FormData();
      body.append("token", asset.deleteToken);
      const response = await fetch(`https://api.cloudinary.com/v1_1/${SITE_CONFIG.cloudinary.cloudName}/delete_by_token`, { method: "POST", body, signal: AbortSignal.timeout(10000) });
      if (response.ok && (await response.json()).result === "ok") uploadedImages.delete(key);
    } catch { /* Se conserva la URL para poder reutilizarla en el siguiente intento. */ }
  }
}

function parseCsv(text) {
  const rows = [];
  let row = [];
  let cell = "";
  let quoted = false;

  for (let index = 0; index < text.length; index += 1) {
    const character = text[index];
    if (character === '"' && quoted && text[index + 1] === '"') {
      cell += '"';
      index += 1;
    } else if (character === '"') {
      quoted = !quoted;
    } else if (character === "," && !quoted) {
      row.push(cell);
      cell = "";
    } else if ((character === "\n" || character === "\r") && !quoted) {
      if (character === "\r" && text[index + 1] === "\n") index += 1;
      row.push(cell);
      if (row.some((value) => value.trim())) rows.push(row);
      row = [];
      cell = "";
    } else {
      cell += character;
    }
  }

  if (cell || row.length) {
    row.push(cell);
    rows.push(row);
  }

  const headers = (rows.shift() || []).map((value, index) =>
    value.trim().replace(index === 0 ? /^\uFEFF/ : /$^/, "").toLowerCase(),
  );
  return rows.map((values) => Object.fromEntries(headers.map((header, index) => [header, (values[index] || "").trim()])));
}

function showMessage(text, state = "success") {
  message.textContent = text;
  message.dataset.state = state;
  message.hidden = false;
}

function clearMessage() {
  message.textContent = "";
  message.hidden = true;
  delete message.dataset.state;
}

function hasUnsubmittedData() {
  for (const control of form.elements) {
    if (!control.name || control.disabled || control.type === "hidden"
        || ["button", "submit", "reset"].includes(control.type)) continue;
    if (control.type === "file") {
      if (control.files?.length) return true;
    } else if (control.type === "checkbox" || control.type === "radio") {
      if (control.checked) return true;
    } else if (control.value.trim()) {
      return true;
    }
  }
  return false;
}

window.addEventListener("beforeunload", (event) => {
  if (!hasUnsubmittedData()) return;
  event.preventDefault();
  event.returnValue = "";
});

function trimTextFields() {
  for (const control of form.querySelectorAll("input:not([type='file']):not([type='checkbox']), textarea")) {
    control.value = control.value.replace(/^[\s\uFEFF]+|[\s\uFEFF]+$/gu, "");
  }
}

async function loadLocations() {
  const response = await fetch(locationUrl);
  if (!response.ok) throw new Error("No se pudo cargar data/distritos.csv.");
  const rows = parseCsv(await response.text()).filter((row) => row.departamento && row.provincia && row.distrito);
  if (!rows.length) throw new Error("El catálogo de ubicaciones está vacío o tiene encabezados distintos.");
  locationOptions = prepareLocationOptions(rows);
  locationStatus.textContent = "";
}

function closeLocationList() {
  locationList.hidden = true;
  locationInput.setAttribute("aria-expanded", "false");
  locationInput.removeAttribute("aria-activedescendant");
  activeLocationIndex = -1;
}

function selectLocation(option) {
  selectedLocation = option;
  locationInput.value = option.label;
  locationInput.dataset.locationSelected = "true";
  locationStatus.textContent = "";
  fieldValidation.setError(locationInput, "");
  closeLocationList();
}

function renderLocationOptions(query) {
  locationList.replaceChildren();
  visibleLocations = [];
  activeLocationIndex = -1;
  locationInput.removeAttribute("aria-activedescendant");

  if (query.trim().length < 2) {
    closeLocationList();
    locationStatus.textContent = query.trim()
      ? "Escribe al menos dos caracteres para buscar."
      : "";
    return;
  }

  const result = searchLocations(locationOptions, query, 25);
  visibleLocations = result.matches;
  if (!result.total) {
    closeLocationList();
      locationStatus.textContent = "No encontramos ese distrito. Prueba con otro nombre de distrito.";
    return;
  }

  result.matches.forEach((option, index) => {
    const item = document.createElement("li");
    item.id = `ubicacion-option-${index}`;
    item.className = "location-option";
    item.setAttribute("role", "option");
    item.setAttribute("aria-selected", "false");
    item.textContent = option.label;
    item.addEventListener("pointerdown", (event) => {
      event.preventDefault();
      selectLocation(option);
    });
    locationList.append(item);
  });

  locationInput.setAttribute("aria-expanded", "true");
  locationList.hidden = false;
  locationStatus.textContent = `${result.total.toLocaleString("es-PE")} resultados${result.total > result.matches.length ? `; mostrando ${result.matches.length}` : ""}. Usa las flechas y Enter para elegir.`;
}

function setActiveLocation(index) {
  if (!visibleLocations.length) return;
  activeLocationIndex = (index + visibleLocations.length) % visibleLocations.length;
  locationList.querySelectorAll('[role="option"]').forEach((item, itemIndex) => {
    const active = itemIndex === activeLocationIndex;
    item.setAttribute("aria-selected", String(active));
    if (active) {
      locationInput.setAttribute("aria-activedescendant", item.id);
      item.scrollIntoView({ block: "nearest" });
    }
  });
}

locationInput.addEventListener("input", () => {
  selectedLocation = null;
  delete locationInput.dataset.locationSelected;
  renderLocationOptions(locationInput.value);
});
locationInput.addEventListener("focus", () => {
  if (!selectedLocation) renderLocationOptions(locationInput.value);
});
locationInput.addEventListener("keydown", (event) => {
  if (event.key === "ArrowDown") {
    event.preventDefault();
    if (locationList.hidden) renderLocationOptions(locationInput.value);
    setActiveLocation(activeLocationIndex + 1);
  } else if (event.key === "ArrowUp" && !locationList.hidden) {
    event.preventDefault();
    setActiveLocation(activeLocationIndex < 0 ? visibleLocations.length - 1 : activeLocationIndex - 1);
  } else if (event.key === "Enter" && !locationList.hidden) {
    const exactMatch = visibleLocations.find((option) => option.label.toLocaleLowerCase("es-PE") === locationInput.value.trim().toLocaleLowerCase("es-PE"));
    const option = visibleLocations[activeLocationIndex] || exactMatch;
    if (option) {
      event.preventDefault();
      selectLocation(option);
    }
  } else if (event.key === "Escape" && !locationList.hidden) {
    event.preventDefault();
    closeLocationList();
  }
});
locationInput.addEventListener("blur", () => {
  if (!selectedLocation) closeLocationList();
});
form.addEventListener("reset", () => {
  selectedLocation = null;
  delete locationInput.dataset.locationSelected;
  closeLocationList();
});

function normalizePhone(input) {
  let digits = input.value.replace(/[\s()+-]/g, "");
  if (/^9\d{8}$/.test(digits)) digits = `51${digits}`;
  input.value = digits;
}

for (const name of ["whatsapp_publico", "whatsapp_interno"]) {
  const input = document.querySelector(`#${name}`);
  input.addEventListener("input", (event) => {
    event.currentTarget.value = event.currentTarget.value.replace(/[^0-9()+\-\s]/g, "");
  });
  input.addEventListener("blur", (event) => normalizePhone(event.currentTarget));
}

for (const name of ["correo", "instagram_usuario", "linkedin_usuario", "behance_usuario"]) {
  document.querySelector(`#${name}`).addEventListener("blur", (event) => {
    event.currentTarget.value = event.currentTarget.value.trim().toLocaleLowerCase("es-PE");
  });
}

for (const input of form.querySelectorAll("input[type='file']")) {
  const preview = form.querySelector(`[data-crop-for="${input.name}"]`);
  const canvas = form.querySelector(`[data-preview-for="${input.name}"]`);
  const zoomControl = form.querySelector(`[data-zoom-for="${input.name}"]`);
  const output = form.querySelector(`[data-file-for="${input.name}"]`);
  const targetDimensions = input.name === "foto_perfil" ? [150, 150] : [540, 720];
  canvas.tabIndex = 0;
  canvas.addEventListener("keydown", event => {
    const direction = { ArrowLeft: [-.03, 0], ArrowRight: [.03, 0], ArrowUp: [0, -.03], ArrowDown: [0, .03] }[event.key];
    const state = cropStates.get(input.name);
    if (!direction || !state) return;
    event.preventDefault();
    state.x = Math.max(0, Math.min(1, state.x + direction[0]));
    state.y = Math.max(0, Math.min(1, state.y + direction[1]));
    renderCropPreview(state, canvas);
  });

  input.addEventListener("change", async () => {
    input.setCustomValidity("");
    fieldValidation.setError(input, "");
    clearCropState(input);
    const file = input.files?.[0];
    if (!file) return;
    const fieldName = imageFieldName(input);
    try {
      validateImageFile(file, fieldName);
      const objectUrl = URL.createObjectURL(file);
      let image;
      try {
        image = await decodeImage(objectUrl, fieldName);
      } catch (error) {
        URL.revokeObjectURL(objectUrl);
        throw error;
      }
      const state = { file, image, objectUrl, zoom: 1, x: 0.5, y: 0.5, dimensions: targetDimensions };
      cropStates.set(input.name, state);
      canvas.width = 360;
      canvas.height = Math.round(360 * targetDimensions[1] / targetDimensions[0]);
      preview.hidden = false;
      output.textContent = "Ajusta el encuadre antes de enviar";
      renderCropPreview(state, canvas);
    } catch (error) {
      output.textContent = error.message;
      input.setCustomValidity(error.message);
      fieldValidation.setError(input, error.message);
    }
  });

  zoomControl.addEventListener("input", () => {
    const state = cropStates.get(input.name);
    if (!state) return;
    state.zoom = Number(zoomControl.value);
    renderCropPreview(state, canvas);
  });

  let dragStart;
  canvas.addEventListener("pointerdown", (event) => {
    const state = cropStates.get(input.name);
    if (!state) return;
    dragStart = { clientX: event.clientX, clientY: event.clientY, x: state.x, y: state.y };
    canvas.setPointerCapture(event.pointerId);
  });
  canvas.addEventListener("pointermove", (event) => {
    const state = cropStates.get(input.name);
    if (!state || !dragStart) return;
    const rect = canvas.getBoundingClientRect();
    const crop = getCropRect(state.image.naturalWidth, state.image.naturalHeight, targetDimensions, state.zoom, 0.5, 0.5);
    const movableX = state.image.naturalWidth - crop.width;
    const movableY = state.image.naturalHeight - crop.height;
    state.x = movableX ? Math.max(0, Math.min(1, dragStart.x - (event.clientX - dragStart.clientX) * crop.width / rect.width / movableX)) : 0.5;
    state.y = movableY ? Math.max(0, Math.min(1, dragStart.y - (event.clientY - dragStart.clientY) * crop.height / rect.height / movableY)) : 0.5;
    renderCropPreview(state, canvas);
  });
  canvas.addEventListener("pointerup", () => { dragStart = null; });
  canvas.addEventListener("pointercancel", () => { dragStart = null; });
}

function clearCropState(input) {
  input.setCustomValidity("");
  const state = cropStates.get(input.name);
  if (state?.objectUrl) URL.revokeObjectURL(state.objectUrl);
  cropStates.delete(input.name);
  const preview = form.querySelector(`[data-crop-for="${input.name}"]`);
  if (preview) preview.hidden = true;
  const zoomControl = form.querySelector(`[data-zoom-for="${input.name}"]`);
  if (zoomControl) zoomControl.value = "1";
  const output = form.querySelector(`[data-file-for="${input.name}"]`);
  if (output) output.textContent = "";
}

function validateImageFile(file, fieldName) {
  if (file.size > MAX_SOURCE_IMAGE_BYTES) throw new Error(`${fieldName}: el archivo original no puede superar 1 MB.`);
}

function decodeImage(objectUrl, fieldName) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => image.naturalWidth && image.naturalHeight
      ? resolve(image)
      : reject(new Error(`${fieldName}: la imagen no tiene dimensiones válidas.`));
    image.onerror = () => reject(new Error(`${fieldName}: no se pudo leer la imagen.`));
    image.src = objectUrl;
  });
}

function getCropRect(sourceWidth, sourceHeight, targetDimensions, zoom, x, y) {
  const targetRatio = targetDimensions[0] / targetDimensions[1];
  let width = sourceWidth;
  let height = sourceHeight;
  if (sourceWidth / sourceHeight > targetRatio) width = sourceHeight * targetRatio;
  else height = sourceWidth / targetRatio;
  width /= zoom;
  height /= zoom;
  return { x: (sourceWidth - width) * x, y: (sourceHeight - height) * y, width, height };
}

function renderCropPreview(state, canvas) {
  const context = canvas.getContext("2d");
  const crop = getCropRect(state.image.naturalWidth, state.image.naturalHeight, state.dimensions, state.zoom, state.x, state.y);
  context.clearRect(0, 0, canvas.width, canvas.height);
  context.drawImage(state.image, crop.x, crop.y, crop.width, crop.height, 0, 0, canvas.width, canvas.height);
}

function imageFieldName(input) {
  const heading = input.labels?.[0]?.querySelector(":scope > span")?.textContent || "imagen";
  return heading.replace(/\s*\*\s*/g, "").trim();
}

function cleanFormValues() {
  const payload = {};
  const fields = [
    "nombres", "apellidos", "genero", "fecha_nacimiento", "whatsapp_publico", "whatsapp_interno",
    "correo", "instagram_usuario", "linkedin_usuario", "behance_usuario", "portafolio_url",
    "categoria", "descripcion_corta", "descripcion_larga", "productos_servicios", "nivel_experiencia", "nivel_precio",
  ];
  for (const name of fields) {
    const value = form.elements.namedItem(name).value.trim();
    payload[name] = value || null;
  }
  payload.departamento = selectedLocation?.departamento || null;
  payload.provincia = selectedLocation?.provincia || null;
  payload.distrito = selectedLocation?.distrito || null;
  for (const name of ["correo", "instagram_usuario", "linkedin_usuario", "behance_usuario"]) {
    if (payload[name]) payload[name] = payload[name].toLocaleLowerCase("es-PE");
  }
  for (const name of ["whatsapp_publico", "whatsapp_interno"]) {
    if (payload[name]) payload[name] = payload[name].replace(/[\s()+-]/g, "");
    if (payload[name] && /^9\d{8}$/.test(payload[name])) payload[name] = `51${payload[name]}`;
  }
  payload.acepta_privacidad = form.acepta_privacidad.checked;
  return payload;
}

async function processImage(input, expectedDimensions, outputFilename) {
  const file = input.files[0];
  const fieldName = imageFieldName(input);
  if (!file) throw new Error(`Selecciona ${fieldName === "Foto de perfil" ? "una foto de perfil" : "una imagen de portada"}.`);
  validateImageFile(file, fieldName);

  const signature = new Uint8Array(await file.slice(0, 12).arrayBuffer());
  const isJpeg = signature[0] === 0xff && signature[1] === 0xd8 && signature[2] === 0xff;
  const isPng = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a].every((byte, index) => signature[index] === byte);
  const isWebp = String.fromCharCode(...signature.slice(0, 4)) === "RIFF"
    && String.fromCharCode(...signature.slice(8, 12)) === "WEBP";
  if (!isJpeg && !isPng && !isWebp) throw new Error(`${fieldName}: elige una imagen JPG, PNG o WebP válida.`);

  let state = cropStates.get(input.name);
  if (!state || state.file !== file) {
    const objectUrl = URL.createObjectURL(file);
    try {
      state = { file, image: await decodeImage(objectUrl, fieldName), zoom: 1, x: 0.5, y: 0.5, dimensions: expectedDimensions };
    } finally {
      URL.revokeObjectURL(objectUrl);
    }
  }
  const processingScale = Math.min(1, MAX_PROCESSING_WIDTH / state.image.naturalWidth, MAX_PROCESSING_HEIGHT / state.image.naturalHeight);
  const sourceWidth = Math.max(1, Math.round(state.image.naturalWidth * processingScale));
  const sourceHeight = Math.max(1, Math.round(state.image.naturalHeight * processingScale));
  const crop = getCropRect(sourceWidth, sourceHeight, expectedDimensions, state.zoom, state.x, state.y);

  const outputCanvas = document.createElement("canvas");
  outputCanvas.width = expectedDimensions[0];
  outputCanvas.height = expectedDimensions[1];
  const outputContext = outputCanvas.getContext("2d");
  if (!outputContext) throw new Error("Este navegador no pudo convertir la imagen.");
  outputContext.drawImage(state.image, crop.x / processingScale, crop.y / processingScale, crop.width / processingScale, crop.height / processingScale, 0, 0, outputCanvas.width, outputCanvas.height);
  const jpegBlob = await new Promise((resolve) => outputCanvas.toBlob(resolve, "image/jpeg", JPEG_QUALITY));
  outputCanvas.width = 0;
  outputCanvas.height = 0;
  if (!jpegBlob || jpegBlob.type !== "image/jpeg") throw new Error(`${fieldName}: no se pudo convertir a JPG.`);
  return new File([jpegBlob], outputFilename, { type: "image/jpeg", lastModified: Date.now() });
}

async function uploadToCloudinary(file) {
  const cloudName = SITE_CONFIG.cloudinary.cloudName;
  const preset = SITE_CONFIG.cloudinary.unsignedUploadPreset;
  const body = new FormData();
  body.append("file", file);
  body.append("upload_preset", preset);
  const response = await fetch(`https://api.cloudinary.com/v1_1/${encodeURIComponent(cloudName)}/image/upload`, { method: "POST", body, signal: AbortSignal.timeout(45000) });
  const result = await response.json();
  if (!response.ok) throw new Error(result.error?.message || "Cloudinary no aceptó la imagen.");
  if (typeof result.secure_url !== "string" || !result.secure_url.startsWith(`https://res.cloudinary.com/${cloudName}/image/upload/`)) {
    throw new Error("Cloudinary no devolvió una URL HTTPS válida para la imagen.");
  }
  return { url: result.secure_url, deleteToken: result.delete_token || null, uploadedAt: Date.now() };
}

async function uploadRequiredImage(input, dimensions, filename) {
  const output = form.querySelector(`[data-file-for="${input.name}"]`);
  if (!input.files || !input.files[0]) throw new Error(`${imageFieldName(input)}: selecciona una imagen antes de enviar.`);
  const key = input.name + imageFingerprint(input);
  if (uploadedImages.has(key)) return { url: uploadedImages.get(key).url, failed: false };

  try {
    if (!SITE_CONFIG.cloudinary.cloudName || !SITE_CONFIG.cloudinary.unsignedUploadPreset) {
      throw new Error("La subida de imágenes no está disponible.");
    }
    output.textContent = "Preparando imagen…";
    const processedFile = await processImage(input, dimensions, filename);
    output.textContent = "Subiendo imagen…";
    const asset = await uploadToCloudinary(processedFile);
    uploadedImages.set(key, asset);
    output.textContent = `Imagen lista: JPG · ${dimensions[0]} × ${dimensions[1]} px`;
    return { url: asset.url, failed: false };
  } catch (cause) {
    const error = new Error(`${imageFieldName(input)}: no se pudo cargar. Revisa la imagen o tu conexión e inténtalo de nuevo.`);
    error.definitive = true;
    output.textContent = error.message;
    fieldValidation.setError(input, error.message);
    throw error;
  }
}

function sendToAppsScript(payload) {
  const endpoint = SITE_CONFIG.appsScriptEndpoint;
  const requestId = newSubmissionId();

  return new Promise((resolve, reject) => {
    const iframe = document.createElement("iframe");
    iframe.name = `registro-${requestId}`;
    iframe.title = "Respuesta del registro";
    iframe.hidden = true;

    const submission = document.createElement("form");
    submission.method = "POST";
    submission.action = `${endpoint}?requestId=${encodeURIComponent(requestId)}&clientOrigin=${encodeURIComponent(location.origin)}`;
    submission.target = iframe.name;
    submission.hidden = true;

    const payloadInput = document.createElement("input");
    payloadInput.type = "hidden";
    payloadInput.name = "payload";
    payloadInput.value = JSON.stringify(payload);
    submission.append(payloadInput);

    let timeoutId;
    const cleanup = () => {
      window.removeEventListener("message", handleResponse);
      window.clearTimeout(timeoutId);
      iframe.remove();
      submission.remove();
    };

    const handleResponse = (event) => {
      let hostname;
      try { const origin = new URL(event.origin); if (origin.protocol !== "https:") return; hostname = origin.hostname; } catch { return; }
      if (hostname !== "script.googleusercontent.com" && !hostname.endsWith("-script.googleusercontent.com")) return;
      const message = event.data;
      if (!message || message.type !== "registro-response" || message.requestId !== requestId) return;
      cleanup();
      if (message.response?.ok) resolve(message.response);
      else {
        const error = new Error(message.response?.message || "No se pudo guardar el registro.");
        error.definitive = message.response?.retryable === false;
        reject(error);
      }
    };

    window.addEventListener("message", handleResponse);
    timeoutId = window.setTimeout(() => {
      cleanup();
      reject(new Error("No pudimos confirmar el envío. Conservamos tus datos: pulsa Enviar para revisión para reintentarlo."));
    }, 30000);

    document.body.append(iframe, submission);
    submission.submit();
  });
}

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  clearMessage();
  trimTextFields();
  if (!fieldValidation.validate()) return;

  if (!selectedLocation || locationInput.dataset.locationSelected !== "true") {
    fieldValidation.setError(locationInput, "Selecciona una ubicación completa de la lista.");
    locationInput.focus();
    return;
  }

  try {
    if (!SITE_CONFIG.appsScriptEndpoint) {
      showMessage("El formulario y Cloudinary están listos. Falta publicar Apps Script y pegar aquí su URL de implementación.", "error");
      return;
    }

    submitButton.disabled = true;
    form.setAttribute("aria-busy", "true");
    const payload = cleanFormValues();
    const fingerprint = JSON.stringify([payload, imageFingerprint(form.foto_perfil), imageFingerprint(form.imagen_portada)]);
    if (!pendingSubmission || pendingSubmission.fingerprint !== fingerprint) pendingSubmission = { fingerprint, id: newSubmissionId() };
    Object.assign(payload, { submissionId: pendingSubmission.id, startedAt, website: form.elements.website.value });
    submitButton.textContent = "Validando datos…";
    await sendToAppsScript({ ...payload, action: "validate" });
    submitButton.textContent = "Preparando imágenes…";
    const imageResults = await Promise.allSettled([
      uploadRequiredImage(form.foto_perfil, [150, 150], "foto-perfil.jpg"),
      uploadRequiredImage(form.imagen_portada, [540, 720], "imagen-portada.jpg"),
    ]);
    const imageFailure = imageResults.find(result => result.status === "rejected");
    if (imageFailure) throw imageFailure.reason;
    const [profilePhoto, coverImage] = imageResults.map(result => result.value);
    payload.foto_perfil = profilePhoto.url;
    payload.imagen_portada = coverImage.url;
    submitButton.textContent = "Enviando…";
    const result = await sendToAppsScript(payload);
    const confirmation = `Solicitud #${result.id} recibida. Tu perfil está pendiente de revisión; aún no es público.`;
    showMessage(confirmation);
    form.reset();
    fieldValidation.reset();
    message.tabIndex = -1;
    message.focus();
    message.scrollIntoView({ block: "center", behavior: "instant" });
    await discardUnusedImages([payload.foto_perfil, payload.imagen_portada]);
    uploadedImages.clear();
    pendingSubmission = null;
    startedAt = Date.now();
    for (const input of form.querySelectorAll("input[type='file']")) clearCropState(input);
  } catch (error) {
    for (const control of form.elements) {
      if (control.name && control.name !== "website" && error.message?.includes(control.name)) fieldValidation.setError(control, error.message);
    }
    if (pendingSubmission) {
      if (error.definitive && !pendingSubmission.uncertain) await discardUnusedImages();
      else if (!error.definitive) {
        pendingSubmission.uncertain = true;
        for (const asset of uploadedImages.values()) asset.uncertain = true;
      }
    }
    showMessage(error.message || "No se pudo completar el envío.", "error");
  } finally {
    form.removeAttribute("aria-busy");
    submitButton.disabled = false;
    submitButton.textContent = "Enviar para revisión";
  }
});

loadLocations().catch((error) => {
  locationInput.disabled = true;
  locationStatus.textContent = "No se pudo cargar el catálogo de ubicaciones.";
  showMessage(`${error.message} Comprueba que el archivo esté disponible en data/distritos.csv.`, "error");
});

