import fs from 'node:fs';
import assert from 'node:assert/strict';
import vm from 'node:vm';
const source = fs.readFileSync(new URL('./index.js', import.meta.url), 'utf8');
const parser = source.slice(source.indexOf('function parseCsv('), source.indexOf('function profileSlugFromLocation('));
const context = { demoIds: new Set(), normalizeText: text => text.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase() };
vm.createContext(context);
vm.runInContext(parser, context);
const csv = fs.readFileSync(new URL('../data/perfiles.csv', import.meta.url), 'utf8');
const headers = csv.replace(/^\uFEFF/, '').split(/\r?\n/)[0].replaceAll('"', '').split(',');
assert.equal(headers.length, 22);
for (const field of ['correo', 'whatsapp_interno', 'fecha_nacimiento', 'genero', 'notas', 'estado', 'acepta_privacidad']) assert(!headers.includes(field), `campo privado: ${field}`);
assert.equal(new Set(headers).size, headers.length);
const profiles = context.parseCsv(csv);
assert(profiles.length > 0);
const demo = JSON.parse(fs.readFileSync(new URL('../data/perfiles-demo.json', import.meta.url), 'utf8'));
assert(demo.ids.every(id => Number.isSafeInteger(id) && id > 0));
for (const page of ['index.html', 'registro.html', 'contacto.html', 'privacidad.html']) {
  const html = fs.readFileSync(new URL('../' + page, import.meta.url), 'utf8');
  assert(html.includes('rel="canonical"'), `${page}: canonical ausente`);
}
console.log(`Publicación: ${profiles.length} perfiles, columnas privadas excluidas, IDs y páginas comprobados.`);
