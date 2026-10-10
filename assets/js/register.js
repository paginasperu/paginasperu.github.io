import SITE_CONFIG from "./config.js?v=20261010-4";

const form = document.querySelector("#registro");
const message = document.querySelector("#mensaje");
const submitButton = document.querySelector("#enviar");
const departmentSelect = document.querySelector("#departamento");
const provinceSelect = document.querySelector("#provincia");
const districtSelect = document.querySelector("#distrito");
const locationUrl = new URL("../../data/districts.csv", import.meta.url);
const locationRows = [];

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

function trimTextFields() {
  for (const control of form.querySelectorAll("input:not([type='file']):not([type='checkbox']), textarea")) {
    control.value = control.value.replace(/^[\s\uFEFF]+|[\s\uFEFF]+$/gu, "");
  }
}

async function loadLocations() {
  const response = await fetch(locationUrl);
  if (!response.ok) throw new Error("No se pudo cargar data/districts.csv.");
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

for (const counter of document.querySelectorAll("[data-counter-for]")) {
  const input = document.getElementById(counter.dataset.counterFor);
  const update = () => { counter.textContent = `${input.value.length}/${input.maxLength}`; };
  input.addEventListener("input", update);
  update();
}

for (const input of form.querySelectorAll("input[type='file']")) {
  input.addEventListener("change", () => {
    const output = document.querySelector(`[data-file-for="${input.name}"]`);
    output.textContent = input.files[0] ? input.files[0].name : "";
  });
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
    "whatsapp_publico", "whatsapp_interno", "correo", "behance_usuario", "instagram_usuario", "linkedin_usuario",
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

async function validateImage(input, expectedDimensions, maxBytes) {
  const file = input.files[0];
  const fieldName = imageFieldName(input);
  if (!file) throw new Error(`Selecciona ${fieldName === "Foto de perfil" ? "una foto de perfil" : "una imagen de portada"}.`);
  const isJpeg = file.type === "image/jpeg" || /\.jpe?g$/i.test(file.name);
  if (!isJpeg) throw new Error(`${fieldName}: el archivo debe ser JPG.`);
  if (file.size > maxBytes) throw new Error(`${fieldName}: el tamaño máximo es ${Math.round(maxBytes / 1024)} KB.`);
  const dimensions = await new Promise((resolve, reject) => {
    const image = new Image();
    const objectUrl = URL.createObjectURL(file);
    image.onload = () => { resolve([image.naturalWidth, image.naturalHeight]); URL.revokeObjectURL(objectUrl); };
    image.onerror = () => { URL.revokeObjectURL(objectUrl); reject(new Error("No se pudo leer uno de los archivos de imagen.")); };
    image.src = objectUrl;
  });
  if (dimensions[0] !== expectedDimensions[0] || dimensions[1] !== expectedDimensions[1]) {
    throw new Error(`${fieldName}: debe medir ${expectedDimensions[0]} × ${expectedDimensions[1]} px.`);
  }
  return file;
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
    const [profilePhoto, coverImage] = await Promise.all([
      validateImage(form.foto_perfil, [150, 150], 250 * 1024),
      validateImage(form.imagen_portada, [540, 720], 500 * 1024),
    ]);

    if (!SITE_CONFIG.cloudinary.cloudName || !SITE_CONFIG.cloudinary.unsignedUploadPreset) {
      showMessage("Falta configurar la subida de imágenes a Cloudinary.", "error");
      return;
    }
    if (!SITE_CONFIG.appsScriptEndpoint) {
      showMessage("El formulario y Cloudinary están listos. Falta publicar Apps Script y pegar aquí su URL de implementación.", "error");
      return;
    }

    submitButton.disabled = true;
    submitButton.textContent = "Enviando…";
    const [photoUrl, coverUrl] = await Promise.all([
      uploadToCloudinary(profilePhoto),
      uploadToCloudinary(coverImage),
    ]);
    const payload = cleanFormValues();
    payload.foto_perfil = photoUrl;
    payload.imagen_portada = coverUrl;
    const result = await sendToAppsScript(payload);
    showMessage(result.message || "Recibimos tu perfil para revisión.");
    form.reset();
    for (const output of form.querySelectorAll("[data-file-for]")) output.textContent = "";
    setOptions(provinceSelect, [], "Selecciona primero un departamento");
    setOptions(districtSelect, [], "Selecciona primero una provincia");
    provinceSelect.disabled = true;
    districtSelect.disabled = true;
    for (const counter of document.querySelectorAll("[data-counter-for]")) {
      document.getElementById(counter.dataset.counterFor).dispatchEvent(new Event("input"));
    }
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
  showMessage(`${error.message} Comprueba que el archivo esté disponible en data/districts.csv.`, "error");
});

