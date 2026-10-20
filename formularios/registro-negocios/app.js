(() => {
  const ENDPOINT_URL = "https://script.google.com/macros/s/AKfycbw3WlxWu4oDbSNQX4EEQlEiaNduJkaa6lmVk62ESsHIvAYRSkUxfNxjfNs4Drl6w3L89Q/exec";
  const form = document.querySelector("#business-form");
  const button = document.querySelector("#submit-button");
  const status = document.querySelector("#form-status");

  function showStatus(message, state) {
    status.textContent = message;
    status.dataset.state = state;
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
    showStatus("El formulario está en preparación.", "info");
    return;
  }

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    showStatus("", "");
    if (!form.reportValidity()) return;

    setSending(true);
    showStatus("Enviando el registro…", "info");

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
        throw new Error("El servidor rechazó el envío.");
      }
      form.reset();
      showStatus("Registro guardado. Gracias.", "success");
    } catch (error) {
      showStatus(
        error.name === "AbortError"
          ? "El envío tardó demasiado. Revisa la hoja antes de intentarlo de nuevo."
          : "No se pudo completar el envío. Revisa tu conexión e inténtalo de nuevo.",
        "error"
      );
    } finally {
      window.clearTimeout(timeout);
      setSending(false);
    }
  });
})();
