# Demo local

`/sandbox/index.html` refleja la portada actual y carga su HTML, JavaScript y CSS de producción para evitar que la propuesta quede desactualizada. La demo está marcada `noindex`, usa el CSV público y enlaza al formulario real. Abrirla con `npm run preview`.

`/sandbox/panel.html` prueba aprobar/rechazar, notas y avance con datos ficticios en memoria; no escribe en Sheets. Regenerarla después de cambiar el panel real con `npm run demo:panel`.