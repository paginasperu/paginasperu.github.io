(() => {
  const ENDPOINT_URL = "https://script.google.com/macros/s/AKfycbw3WlxWu4oDbSNQX4EEQlEiaNduJkaa6lmVk62ESsHIvAYRSkUxfNxjfNs4Drl6w3L89Q/exec";
  const form = document.querySelector("#business-form");
  const button = document.querySelector("#submit-button");
  const status = document.querySelector("#form-status");
  const locationStatus = document.querySelector("#location-status");
  const locationFields = [form.querySelector("#tipo-lugar"), form.querySelector("#lugar")];
  const repeatFields = [form.querySelector("#piso"), form.querySelector("#seccion"), form.querySelector("#pasillo")];
  const prefilledBadges = repeatFields.map((field) => field.closest(".field").querySelector(".prefilled-badge"));
  const locationStorageKey = "registro-negocios-lugar-v1";
  const locationEditor = document.querySelector("#location-editor");
  const locationSummary = document.querySelector("#location-summary");
  const locationDisplay = document.querySelector("#location-display");
  let activeLocation = null;
  let editingLocation = false;

  try {
    activeLocation = JSON.parse(window.localStorage.getItem(locationStorageKey) || "null");
  } catch {
    // Continue without a remembered location when browser storage is unavailable.
  }

  function renderLocation() {
    const hasLocation = Boolean(activeLocation?.type && activeLocation?.name);
    locationSummary.hidden = !hasLocation;
    document.querySelector("#add-location").hidden = hasLocation;
    locationEditor.hidden = hasLocation || !editingLocation;
    if (hasLocation) {
      locationDisplay.textContent = `${activeLocation.type} ${activeLocation.name}`;
      locationFields[0].value = activeLocation.type;
      locationFields[1].value = activeLocation.name;
    }
  }

  function openLocationEditor() {
    showLocationStatus("", "");
    editingLocation = true;
    locationEditor.hidden = false;
    locationSummary.hidden = true;
    document.querySelector("#add-location").hidden = true;
    locationFields[0].value = activeLocation?.type || "";
    locationFields[1].value = activeLocation?.name || "";
    locationFields[0].focus();
  }

  function saveLocation() {
    const type = locationFields[0].value;
    const name = locationFields[1].value.trim();
    if (!type || !name) {
      showLocationStatus("Selecciona el tipo y escribe el nombre del lugar", "error");
      (type ? locationFields[1] : locationFields[0]).focus();
      return;
    }
    activeLocation = { type, name };
    editingLocation = false;
    try {
      window.localStorage.setItem(locationStorageKey, JSON.stringify(activeLocation));
    } catch {
      // The current page keeps the active location if browser storage is unavailable.
    }
    renderLocation();
    showLocationStatus("Lugar guardado para los siguientes registros", "success");
  }

  document.querySelector("#add-location").addEventListener("click", openLocationEditor);
  document.querySelector("#change-location").addEventListener("click", openLocationEditor);
  document.querySelector("#save-location").addEventListener("click", saveLocation);
  document.querySelector("#cancel-location").addEventListener("click", () => {
    editingLocation = false;
    renderLocation();
  });
  renderLocation();

  repeatFields.forEach((field, index) => {
    field.addEventListener("input", () => {
      prefilledBadges[index].hidden = true;
    });
  });

  function showStatus(message, state) {
    status.textContent = message;
    status.dataset.state = state;
  }

  function showLocationStatus(message, state) {
    locationStatus.textContent = message;
    locationStatus.dataset.state = state;
  }

  function setSending(sending) {
    button.disabled = sending;
    button.querySelector("span").textContent = sending ? "Enviando…" : "Guardar registro";
  }

  function makeSubmissionBody() {
    const body = new URLSearchParams();
    for (const element of form.elements) {
      if (!element.name || element.disabled) continue;
      if ((element.type === "checkbox" || element.type === "radio") && !element.checked) continue;
      const header = element.dataset.sheetHeader || element.name;
      body.append(header, element.value);
    }
    return body;
  }

  const tipo = form.querySelector("#tipo");
  const whatsapp = form.querySelector("#whatsapp");
  const lettersOnly = /[^A-Za-zÁÉÍÓÚÜÑáéíóúüñÀ-ÖØ-öø-ÿ\u0300-\u036f ]/g;

  tipo.addEventListener("input", () => {
    tipo.value = tipo.value.replace(lettersOnly, "");
  });
  whatsapp.addEventListener("input", () => {
    whatsapp.value = whatsapp.value.replace(/\D/g, "").slice(0, 9);
  });

  if (!ENDPOINT_URL || ENDPOINT_URL === "SET_APPS_SCRIPT_WEB_APP_URL") {
    button.disabled = true;
    showStatus("El formulario está en preparación", "info");
    return;
  }

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    showStatus("", "");
    if (!activeLocation?.type || !activeLocation?.name) {
      showLocationStatus("Agrega y guarda el lugar antes de registrar negocios", "error");
      openLocationEditor();
      return;
    }
    if (!form.reportValidity()) return;

    setSending(true);
    showStatus("Enviando el registro…", "info");
    const retainedValues = repeatFields.map((field) => field.value);

    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), 20000);
    try {
      const response = await fetch(ENDPOINT_URL, {
        method: "POST",
        mode: "no-cors",
        body: makeSubmissionBody(),
        signal: controller.signal
      });
      // no-cors returns an opaque response; confirm receipt in the sheet if needed.
      if (response.type !== "opaque" && !response.ok) {
        throw new Error("El servidor rechazó el envío");
      }
      form.reset();
      renderLocation();
      repeatFields.forEach((field, index) => {
        field.value = retainedValues[index];
        prefilledBadges[index].hidden = !retainedValues[index];
      });
      showStatus("Registro guardado, gracias", "success");
    } catch (error) {
      showStatus(
        error.name === "AbortError"
          ? "El envío tardó demasiado; revisa la hoja antes de volver a intentarlo"
          : "No se pudo completar el envío; revisa tu conexión e inténtalo de nuevo",
        "error"
      );
    } finally {
      window.clearTimeout(timeout);
      setSending(false);
    }
  });
})();

