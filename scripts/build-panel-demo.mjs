import fs from 'node:fs';

// The demo uses the real interface with an in-memory service. It cannot edit Sheets.
const source = fs.readFileSync(new URL('../sheets-admin/ReviewSidebar.html', import.meta.url), 'utf8');
const mock = `<script>
const demoRecords = [1, 2].map(id => ({ id: String(id), nombres: 'Prueba de revisión', apellidos: String(id), estado: 'Pendiente', categoria: 'Diseñadores gráficos', descripcion_corta: 'Ficha de prueba local; no pertenece a la base de datos.', es_verificado: 'FALSE', es_destacado: 'FALSE', posicion: '', notas: '' }));
function demoRunner(success, failure) {
  return {
    withSuccessHandler(fn) { return demoRunner(fn, failure); },
    withFailureHandler(fn) { return demoRunner(success, fn); },
    getReviewQueue(filter) { queueMicrotask(() => success(demoRecords.filter(r => filter === 'Todos' || r.estado === filter).map(r => ({id:r.id, name:r.nombres+' '+r.apellidos, category:r.categoria})))); },
    getReviewRecord(id) { queueMicrotask(() => success({...demoRecords.find(r => r.id === id)})); },
    saveReview(update) { const r = demoRecords.find(r => r.id === update.id); Object.assign(r, update, {es_verificado: update.es_verificado ? 'TRUE':'FALSE', es_destacado: update.es_destacado ? 'TRUE':'FALSE'}); queueMicrotask(() => success({ok:true})); },
    getPublicCsvData() { queueMicrotask(() => success([['id','nombres'], ...demoRecords.filter(r => r.estado === 'Activo').map(r => [r.id,r.nombres])])); }
  };
}
const google = {script:{run:demoRunner()}};
</script>`;
const demo = source.replace('<head>', '<head><meta name="robots" content="noindex,nofollow"><title>Demo del panel</title>')
  .replace('<body>', '<body><p style="padding:12px;background:#fff4ce;color:#654900">Prueba local: los cambios se guardan solo en memoria. No modifica Google Sheets.</p>')
  .replace('  <script>', mock + '\n  <script>');
fs.writeFileSync(new URL('../sandbox/panel.html', import.meta.url), demo);
console.log('Demo del panel actualizada desde ReviewSidebar.html.');
