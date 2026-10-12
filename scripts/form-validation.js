export function fieldError(control, today = new Date()) {
  if (control.disabled || !control.name || control.name === 'website') return '';
  const value = String(control.value || '').trim();
  if (control.required && (control.type === 'checkbox' ? !control.checked : !value)) return control.type === 'checkbox' ? 'Acepta la política de privacidad para continuar.' : control.tagName === 'SELECT' ? 'Selecciona una opción.' : 'Completa este campo.';
  if (!value) return '';
  if (control.type === 'file') return control.validationMessage || '';
  if (control.minLength > 0 && value.length < control.minLength) return `Escribe al menos ${control.minLength} caracteres.`;
  if (control.maxLength > 0 && value.length > control.maxLength) return `Usa como máximo ${control.maxLength} caracteres.`;
  if (['nombres', 'apellidos'].includes(control.name) && !/^[\p{L}\p{M} '\-]+$/u.test(value)) return 'Usa letras, espacios, guiones o apóstrofos.';
  if (control.name === 'ubicacion' && control.dataset?.locationSelected !== 'true') return 'Selecciona una ubicación completa de la lista.';
  if (control.name.startsWith('whatsapp_')) {
    let phone = value.replace(/[\s()+-]/g, '');
    if (/^9\d{8}$/.test(phone)) phone = '51' + phone;
    if (!/^519\d{8}$/.test(phone)) return 'Ingresa un celular peruano de 9 dígitos, con o sin +51.';
  }
  if (control.name === 'portafolio_url') {
    try {
      const url = new URL(value);
      if (url.protocol !== 'https:' || !url.hostname.includes('.') || url.username || url.password) return 'Ingresa una URL pública HTTPS válida.';
    } catch {
      return 'Ingresa una URL pública HTTPS válida.';
    }
  }
  if (control.validity?.typeMismatch) return 'Ingresa un enlace válido.';
  if (control.validity?.patternMismatch) return 'Revisa el formato de este campo.';
  if (control.validity?.badInput) return 'Ingresa un valor válido.';
  return '';
}

export function attachFieldValidation(form) {
  let submitted = false;
  const controls = [...form.elements].filter(el => el.name && el.id && el.name !== 'website');
  function setError(control, text) {
    let error = document.getElementById(`${control.id}-error`);
    if (!error && text) {
      error = document.createElement('small');
      error.id = `${control.id}-error`;
      error.className = 'field-error';
      (control.closest('.register-field, .register-consent') || control.parentElement).append(error);
      control.setAttribute('aria-describedby', [control.getAttribute('aria-describedby'), error.id].filter(Boolean).join(' '));
    }
    if (error) { error.textContent = text; error.hidden = !text; }
    if (text) control.setAttribute('aria-invalid', 'true');
    else control.removeAttribute('aria-invalid');
    return !text;
  }
  for (const control of controls) {
    control.addEventListener('blur', () => { if (submitted || control.value) setError(control, fieldError(control)); });
    for (const event of ['input', 'change']) control.addEventListener(event, () => {
      if (submitted || control.hasAttribute('aria-invalid')) setError(control, fieldError(control));
    });
  }
  return {
    setError,
    validate() {
      submitted = true;
      const invalid = controls.filter(control => !setError(control, fieldError(control)));
      invalid[0]?.focus();
      return invalid.length === 0;
    },
    reset() { submitted = false; controls.forEach(control => setError(control, '')); },
  };
}
