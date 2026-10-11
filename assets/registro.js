const SITE_CONFIG = {
  appsScriptEndpoint: "https://script.google.com/macros/s/AKfycbyFHXYtrjWYk3QDHj-SoV-lquJI9VQ0dbOSVfA7fJlFIHJGLK8ZXAJ_MlOHkwooYgrFxw/exec",
  cloudinary: {
    // Valores públicos del preset unsigned. Nunca incluir aquí API Secret.
    cloudName: "dahrgg4v5",
    unsignedUploadPreset: "directorio",
  },
};

const form = document.querySelector("#registro");
const message = document.querySelector("#mensaje");
const submitButton = document.querySelector("#enviar");
const departmentSelect = document.querySelector("#departamento");
const provinceSelect = document.querySelector("#provincia");
const districtSelect = document.querySelector("#distrito");
const locationUrl = new URL("../data/distritos.csv", import.meta.url);
const locationRows = [];
const MAX_SOURCE_IMAGE_BYTES = 1024 * 1024;
const MAX_PROCESSING_WIDTH = 1200;
const MAX_PROCESSING_HEIGHT = 1500;
const JPEG_QUALITY = 0.86;
const cropStates = new Map();

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

function setOptions(select, values, prompt) {
  select.replaceChildren(new Option(prompt, ""), ...values.map((value) => new Option(value, value)));
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
  locationRows.push(...rows);
  setOptions(departmentSelect, [...new Set(rows.map((row) => row.departamento))].sort(), "Selecciona departamento");
}

departmentSelect.addEventListener("change", () => {
  const provinces = locationRows.filter((row) => row.departamento === departmentSelect.value).map((row) => row.provincia);
  setOptions(provinceSelect, [...new Set(provinces)].sort(), "Selecciona provincia");
  provinceSelect.disabled = !departmentSelect.value;
  setOptions(districtSelect, [], "Selecciona distrito");
  districtSelect.disabled = true;
});

provinceSelect.addEventListener("change", () => {
  const districts = locationRows
    .filter((row) => row.departamento === departmentSelect.value && row.provincia === provinceSelect.value)
    .map((row) => row.distrito);
  setOptions(districtSelect, [...new Set(districts)].sort(), "Selecciona distrito");
  districtSelect.disabled = !provinceSelect.value;
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

for (const name of ["correo", "behance_usuario", "instagram_usuario", "linkedin_usuario"]) {
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

  input.addEventListener("change", async () => {
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

function ageOnDate(dateText) {
  const birthDate = new Date(`${dateText}T00:00:00`);
  if (Number.isNaN(birthDate.getTime())) return null;
  const today = new Date();
  let age = today.getFullYear() - birthDate.getFullYear();
  const beforeBirthday = today.getMonth() < birthDate.getMonth()
    || (today.getMonth() === birthDate.getMonth() && today.getDate() < birthDate.getDate());
  if (beforeBirthday) age -= 1;
  return age;
}

function configureBirthDateLimits() {
  const input = document.querySelector("#fecha_nacimiento");
  const today = new Date();
  const toIso = (date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
  const latest = new Date(today.getFullYear() - 18, today.getMonth(), today.getDate());
  const earliest = new Date(today.getFullYear() - 51, today.getMonth(), today.getDate() + 1);
  input.max = toIso(latest);
  input.min = toIso(earliest);
}

function validateAge() {
  const age = ageOnDate(form.fecha_nacimiento.value);
  if (age === null || age < 18 || age > 50) {
    form.fecha_nacimiento.setCustomValidity("La edad debe estar entre 18 y 50 años.");
    form.fecha_nacimiento.reportValidity();
    form.fecha_nacimiento.setCustomValidity("");
    return false;
  }
  return true;
}

function cleanFormValues() {
  const payload = {};
  const fields = [
    "nombres", "apellidos", "genero", "fecha_nacimiento", "departamento", "provincia", "distrito",
    "whatsapp_publico", "whatsapp_interno", "correo", "behance_usuario", "instagram_usuario", "linkedin_usuario", "canva_url",
    "categoria", "descripcion_corta", "descripcion_larga", "productos_servicios",
    "nivel_experiencia", "nivel_precio",
  ];
  for (const name of fields) {
    const value = form.elements.namedItem(name).value.trim();
    payload[name] = value || null;
  }
  for (const name of ["whatsapp_publico", "whatsapp_interno"]) {
    if (payload[name]) payload[name] = payload[name].replace(/[\s()+-]/g, "");
    if (payload[name] && /^9\d{8}$/.test(payload[name])) payload[name] = `51${payload[name]}`;
  }
  for (const name of ["correo", "behance_usuario", "instagram_usuario", "linkedin_usuario"]) {
    if (payload[name]) payload[name] = payload[name].toLocaleLowerCase("es-PE");
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
  const response = await fetch(`https://api.cloudinary.com/v1_1/${encodeURIComponent(cloudName)}/image/upload`, { method: "POST", body });
  const result = await response.json();
  if (!response.ok) throw new Error(result.error?.message || "Cloudinary no aceptó la imagen.");
  if (typeof result.secure_url !== "string" || !result.secure_url.startsWith(`https://res.cloudinary.com/${cloudName}/image/upload/`)) {
    throw new Error("Cloudinary no devolvió una URL HTTPS válida para la imagen.");
  }
  return result.secure_url;
}

async function uploadOptionalImage(input, dimensions, filename) {
  const output = form.querySelector(`[data-file-for="${input.name}"]`);
  if (!input.files || !input.files[0]) return { url: null, failed: false };

  try {
    if (!SITE_CONFIG.cloudinary.cloudName || !SITE_CONFIG.cloudinary.unsignedUploadPreset) {
      throw new Error("La subida de imágenes no está disponible.");
    }
    output.textContent = "Preparando imagen…";
    const processedFile = await processImage(input, dimensions, filename);
    output.textContent = "Subiendo imagen…";
    const url = await uploadToCloudinary(processedFile);
    output.textContent = `Imagen lista: JPG · ${dimensions[0]} × ${dimensions[1]} px`;
    return { url, failed: false };
  } catch {
    output.textContent = "No se pudo cargar; el perfil continuará sin esta imagen.";
    return { url: null, failed: true };
  }
}

function sendToAppsScript(payload) {
  const endpoint = SITE_CONFIG.appsScriptEndpoint;
  const requestId = globalThis.crypto?.randomUUID
    ? globalThis.crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2)}`;

  return new Promise((resolve, reject) => {
    const iframe = document.createElement("iframe");
    iframe.name = `registro-${requestId}`;
    iframe.title = "Respuesta del registro";
    iframe.hidden = true;

    const submission = document.createElement("form");
    submission.method = "POST";
    submission.action = `${endpoint}?requestId=${encodeURIComponent(requestId)}`;
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
      const message = event.data;
      if (!message || message.type !== "registro-response" || message.requestId !== requestId) return;
      cleanup();
      if (message.response?.ok) resolve(message.response);
      else reject(new Error(message.response?.message || "No se pudo guardar el registro."));
    };

    window.addEventListener("message", handleResponse);
    timeoutId = window.setTimeout(() => {
      cleanup();
      reject(new Error("Apps Script no respondió. Actualiza su implementación y vuelve a intentarlo."));
    }, 30000);

    document.body.append(iframe, submission);
    submission.submit();
  });
}

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  clearMessage();
  trimTextFields();
  if (!form.reportValidity() || !validateAge()) return;

  const isLocationValid = locationRows.some((row) => row.departamento === departmentSelect.value
    && row.provincia === provinceSelect.value && row.distrito === districtSelect.value);
  if (!isLocationValid) {
    showMessage("Selecciona departamento, provincia y distrito de las listas disponibles.", "error");
    return;
  }

  try {
    if (!SITE_CONFIG.appsScriptEndpoint) {
      showMessage("El formulario y Cloudinary están listos. Falta publicar Apps Script y pegar aquí su URL de implementación.", "error");
      return;
    }

    submitButton.disabled = true;
    const payload = cleanFormValues();
    const hasSelectedImages = Boolean(form.foto_perfil.files?.[0] || form.imagen_portada.files?.[0]);
    submitButton.textContent = hasSelectedImages ? "Preparando imágenes…" : "Enviando…";
    const [profilePhoto, coverImage] = await Promise.all([
      uploadOptionalImage(form.foto_perfil, [150, 150], "foto-perfil.jpg"),
      uploadOptionalImage(form.imagen_portada, [540, 720], "imagen-portada.jpg"),
    ]);
    payload.foto_perfil = profilePhoto.url;
    payload.imagen_portada = coverImage.url;
    submitButton.textContent = "Enviando…";
    const result = await sendToAppsScript(payload);
    const failedImages = [
      profilePhoto.failed ? "la foto de perfil" : "",
      coverImage.failed ? "la imagen de portada" : "",
    ].filter(Boolean);
    const confirmation = result.message || "Recibimos tu perfil para revisión.";
    if (failedImages.length === 2) {
      showMessage(`${confirmation} No se pudieron cargar las imágenes; agrégalas antes de publicar el perfil.`, "warning");
    } else if (failedImages.length === 1) {
      showMessage(`${confirmation} No se pudo cargar ${failedImages[0]}; agrégala antes de publicar el perfil.`, "warning");
    } else {
      showMessage(confirmation);
    }
    form.reset();
    for (const input of form.querySelectorAll("input[type='file']")) clearCropState(input);
    setOptions(provinceSelect, [], "Selecciona primero un departamento");
    setOptions(districtSelect, [], "Selecciona primero una provincia");
    provinceSelect.disabled = true;
    districtSelect.disabled = true;
  } catch (error) {
    showMessage(error.message || "No se pudo completar el envío.", "error");
  } finally {
    submitButton.disabled = false;
    submitButton.textContent = "Enviar para revisión";
  }
});

configureBirthDateLimits();
loadLocations().catch((error) => {
  departmentSelect.replaceChildren(new Option("No se pudo cargar", ""));
  showMessage(`${error.message} Comprueba que el archivo esté disponible en data/distritos.csv.`, "error");
});

