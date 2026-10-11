import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { createHash } from 'node:crypto';

const properties = new Map();
const cache = new Map();
const rows = [];
const context = {
  console: { error() {} },
  PropertiesService: { getScriptProperties: () => ({ getProperty: key => properties.get(key), setProperty: (key, value) => properties.set(key, value) }) },
  CacheService: { getScriptCache: () => ({ get: key => cache.get(key), put: (key, value) => cache.set(key, value) }) },
  LockService: { getScriptLock: () => ({ waitLock() {}, releaseLock() {} }) },
  Utilities: { DigestAlgorithm: { SHA_256: 'sha256' }, computeDigest: (_, value) => [...createHash('sha256').update(value).digest()], formatDate: () => '2026-10-11' },
  ContentService: { MimeType: { JSON: 'json' }, createTextOutput: text => ({ text, setMimeType() { return this; } }) },
  HtmlService: { XFrameOptionsMode: { ALLOWALL: 'all' }, createHtmlOutput: text => ({ text, setXFrameOptionsMode() { return this; } }) },
};
vm.createContext(context);
vm.runInContext(fs.readFileSync(new URL('../apps-script/Locations.js', import.meta.url), 'utf8'), context);
vm.runInContext(fs.readFileSync(new URL('../apps-script/Code.js', import.meta.url), 'utf8'), context);
const headers = Array.from(vm.runInContext('HEADERS', context));
rows.push(headers);
const sheet = {
  getLastRow: () => rows.length,
  getRange: (row, col, height = 1, width = 1) => ({
    getDisplayValues: () => rows.slice(row - 1, row - 1 + height).map(values => values.slice(col - 1, col - 1 + width).map(value => String(value ?? ''))),
    getValues: () => rows.slice(row - 1, row - 1 + height).map(values => values.slice(col - 1, col - 1 + width)),
    setValues: values => { rows[row - 1] = values[0]; },
  }),
  appendRow: values => rows.push(values),
};
context.SpreadsheetApp = { openById: () => ({ getSheetByName: () => sheet }) };
const payload = {
  nombres: 'Prueba', apellidos: 'Registro', genero: 'Mujer', fecha_nacimiento: '1995-01-01',
  departamento: 'LIMA', provincia: 'LIMA', distrito: 'MIRAFLORES', whatsapp_interno: '51900000123', correo: 'prueba@example.test',
  categoria: 'Diseñadores gráficos', descripcion_corta: 'Descripción de prueba válida', productos_servicios: 'Diseño',
  nivel_experiencia: 'Intermedio', nivel_precio: 'Estándar', acepta_privacidad: true,
  submissionId: '0123456789abcdef0123456789abcdef', startedAt: Date.now() - 10000, website: '',
};
const submit = data => JSON.parse(context.doPost({ parameter: { payload: JSON.stringify(data) } }).text);
assert.equal(submit({ ...payload, website: 'spam' }).ok, false);
assert.equal(submit({ ...payload, startedAt: Date.now() + 1000 }).ok, false);
assert.equal(submit({ ...payload, provincia: 'CHICLAYO' }).ok, false);
assert.equal(submit({ ...payload, action: 'validate' }).validated, true);
assert.equal(rows.length, 1, 'la validación previa no escribe registros');
const first = submit({ ...payload, estado: 'Activo', es_verificado: true });
assert.equal(first.ok, true);
assert.equal(rows[1][headers.indexOf('estado')], 'Pendiente');
assert.equal(rows[1][headers.indexOf('es_verificado')], false);
assert.equal(submit(payload).id, first.id, 'reintentar el mismo envío devuelve su ID');
assert.equal(rows.length, 2, 'un reintento no crea una segunda fila');
assert.equal(submit({ ...payload, action: 'validate' }).ok, true, 'se puede prevalidar un reintento confirmado');
assert.equal(submit({ ...payload, submissionId: 'other123456789abcdef0123456789abcdef' }).ok, false, 'no admite un contacto duplicado');
assert.equal(submit({ ...payload, nombres: 'Cambio' }).ok, false, 'un ID de envío no se puede reutilizar para otros datos');
const interrupted = { ...payload, correo: 'interrumpido@example.test', whatsapp_interno: '51900000456', submissionId: 'interrupted0123456789abcdef0123456789' };
sheet.appendRow = values => { rows.push(values); throw new Error('Respuesta perdida después de guardar'); };
assert.equal(submit(interrupted).retryable, true);
const countAfterInterruption = rows.length;
sheet.appendRow = values => rows.push(values);
assert.equal(submit(interrupted).ok, true, 'recupera un guardado cuya respuesta se perdió');
assert.equal(rows.length, countAfterInterruption, 'la recuperación tampoco duplica filas');
const placeholder = headers.map(header => ['es_verificado', 'es_destacado'].includes(header) ? false : '');
rows.push(placeholder);
const rowBeforePrepared = rows.length;
const prepared = submit({ ...payload, correo: 'preparado@example.test', whatsapp_interno: '51900000789', submissionId: 'prepared0123456789abcdef0123456789' });
assert.equal(prepared.ok, true);
assert.equal(rows.length, rowBeforePrepared, 'utiliza la fila vacía preparada con casillas');
assert.equal(rows.at(-1)[0], prepared.id);
cache.clear();
for (let i = 0; i < 8; i++) context.checkRateLimit_('limite@example.test');
assert.throws(() => context.checkRateLimit_('limite@example.test'), /demasiados intentos/);
assert.throws(() => context.parsePayload_({ parameter: { payload: 'x'.repeat(16001) } }), /tamaño/);
assert.equal(context.responseOutput_({ ok: true }, '0123456789abcdef', { parameter: { clientOrigin: 'https://attacker.test' } }).text.includes('"https://oficial.pe"'), true);
assert.equal(context.responseOutput_({ ok: true }, '0123456789abcdef', {}).text.includes(', "*"'), false);
console.log('Registro: spam básico, ubicaciones, privacidad, duplicados, reintentos y origen correctos.');
