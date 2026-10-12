import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const source = fs.readFileSync(new URL('../sheets-admin/Code.js', import.meta.url), 'utf8');
const manifest = JSON.parse(fs.readFileSync(new URL('../sheets-admin/appsscript.json', import.meta.url), 'utf8'));
assert.equal(manifest.webapp.access, 'MYSELF', 'la aplicación web queda limitada a la cuenta que la despliega');
assert.equal(manifest.webapp.executeAs, 'USER_DEPLOYING', 'las funciones se ejecutan con la cuenta administradora');
assert(manifest.oauthScopes.includes('https://www.googleapis.com/auth/spreadsheets'), 'el manifiesto declara el acceso necesario para openById desde web app');
assert(!manifest.oauthScopes.includes('https://www.googleapis.com/auth/spreadsheets.currentonly'), 'no presupone una hoja activa al ejecutarse como aplicación web');
const context = { console };
vm.createContext(context);
vm.runInContext(source, context);
const headers = Array.from(vm.runInContext('REVIEW_HEADERS', context));
const publicHeaders = Array.from(vm.runInContext('PUBLIC_HEADERS', context));
const records = [
  makeRow({ id: '17', nombres: 'Prueba', apellidos: 'Pendiente', estado: 'Pendiente', departamento: 'LIMA', provincia: 'LIMA', distrito: 'MIRAFLORES', categoria: 'Diseñadores gráficos', correo: 'privado@example.test', whatsapp_interno: '51900000017' }),
  makeRow({ id: '18', nombres: 'Prueba', apellidos: 'Activo', estado: 'Activo', departamento: 'LIMA', provincia: 'LIMA', distrito: 'SAN ISIDRO', categoria: 'Anfitrionas', es_verificado: true, correo: 'activo@example.test', portafolio_url: 'https://example.pe/Portfolio', instagram_usuario: 'prueba.inst', linkedin_usuario: 'prueba-li', behance_usuario: 'prueba-be', productos_servicios: 'Diseño editorial', nivel_experiencia: 'Experto', nivel_precio: 'Premium' }),
];
const publicRows = [publicHeaders, publicHeaders.map((header) => header === 'id' ? '17' : header === 'nombres' ? 'Prueba' : '')];
const writes = [];

function makeRow(overrides) {
  return headers.map((header) => {
    const value = overrides[header];
    return value === undefined ? '' : value;
  });
}

function fakeSheet(name, data) {
  return {
    getLastRow() { return data.length; },
    getRange(row, column, rowCount = 1, columnCount = 1) {
      return {
        getDisplayValues() {
          return data.slice(row - 1, row - 1 + rowCount).map((values) => values.slice(column - 1, column - 1 + columnCount).map(format));
        },
        setValue(value) {
          data[row - 1][column - 1] = value;
          writes.push({ sheet: name, row, column, value });
        },
      };
    },
  };
}

function format(value) {
  if (value === true) return 'TRUE';
  if (value === false) return 'FALSE';
  return String(value ?? '');
}

const sheets = {
  perfiles: fakeSheet('perfiles', [headers, ...records]),
  publico: fakeSheet('publico', publicRows),
};
context.SpreadsheetApp = {
  openById: (id) => {
    assert.equal(id, '1HUWM3j-RvhrBJlufeUwycP04ZKHZANEuOwVTHNps754');
    return { getSheetByName: (name) => sheets[name] || null };
  },
  flush() {},
};
context.LockService = {
  getScriptLock: () => ({ waitLock() {}, releaseLock() {} }),
};

const pending = context.getReviewQueue();
assert.equal(pending.length, 1);
assert.equal(pending[0].id, '17');
assert.equal('correo' in pending[0], false, 'la cola no expone contactos privados');
assert.equal(context.getReviewQueue('Activo')[0].id, '18');
assert.equal(context.getReviewQueue('Todos').length, 2);
assert.throws(() => context.getReviewQueue('Cualquier estado'), /filtro de estado no es válido/);

const pendingAdmin = context.getAdminRecords({ status: 'Pendiente', category: 'Diseñadores gráficos', search: 'prueba', district: 'MIRAFLORES' });
assert.equal(pendingAdmin.records.length, 1, 'busca y filtra categoría, estado y distrito');
assert.equal(pendingAdmin.records[0].id, '17');
assert.equal('correo' in pendingAdmin.records[0], false, 'la lista del panel no carga contactos privados');
assert.equal('whatsapp_interno' in pendingAdmin.records[0], false, 'la lista del panel no carga WhatsApp privado');
assert.deepEqual(Array.from(pendingAdmin.districts), ['MIRAFLORES', 'SAN ISIDRO']);
assert.equal(pendingAdmin.counts.total, 2);
assert.equal(pendingAdmin.counts.Pendiente, 1);
assert.equal(context.getAdminRecords({ status: 'Activo', verified: true }).records.length, 1);
assert.throws(() => context.getAdminRecords({ status: 'Publicar' }), /filtro de estado no es válido/);
assert.throws(() => context.getAdminRecords({ category: 'Inventada' }), /filtro de categoría no es válido/);

const detail = context.getReviewRecord('17');
assert.equal(detail.whatsapp_interno, '51900000017');
assert.throws(() => context.getReviewRecord('999'), /No se encontró/);
assert.throws(() => context.saveReview({ id: '17', estado: 'Publicar', notas: '' }), /estado válido/);
assert.throws(() => context.saveReview({ id: '17', estado: 'Activo', posicion: '1.5', notas: '' }), /entero positivo/);

context.saveReview({ id: '17', estado: 'Activo', es_verificado: true, es_destacado: false, posicion: '3', notas: '=SUM(1,1)' });
assert.equal(records[0][headers.indexOf('estado')], 'Activo');
assert.equal(records[0][headers.indexOf('es_verificado')], true);
assert.equal(records[0][headers.indexOf('posicion')], 3);
assert.equal(records[0][headers.indexOf('notas')], "'=SUM(1,1)", 'las notas no deben poder escribir fórmulas');
assert.deepEqual(writes.map((write) => write.column).sort((a, b) => a - b), [25, 26, 27, 28, 29]);
assert.equal(records[0][headers.indexOf('whatsapp_interno')], '51900000017', 'el guardado no debe tocar los datos de registro');

const csvData = context.getPublicCsvData();
assert.equal(csvData.length, 3);
assert.deepEqual(Array.from(csvData[0]), publicHeaders);
assert.equal(publicHeaders.includes('correo'), false, 'la descarga se limita a la lista pública');
assert.equal(publicHeaders.includes('portafolio_url'), true, 'la descarga incluye el portafolio genérico');
for (const field of ['instagram_usuario', 'linkedin_usuario', 'behance_usuario']) assert(publicHeaders.includes(field), `${field} es información pública`);
for (const field of ['genero', 'fecha_nacimiento', 'whatsapp_interno', 'correo', 'acepta_privacidad', 'notas']) {
  assert.equal(publicHeaders.includes(field), false, `${field} permanece privado`);
}
for (const field of ['productos_servicios', 'nivel_experiencia', 'nivel_precio']) assert(publicHeaders.includes(field), `${field} forma parte de los datos públicos restaurados`);
const portfolioIndex = publicHeaders.indexOf('portafolio_url');
const activeRow = csvData.find(row => row[publicHeaders.indexOf('id')] === '18');
assert.equal(activeRow[portfolioIndex], 'https://example.pe/Portfolio', 'exporta el portafolio desde la columna conservada');
for (const [field, expected] of Object.entries({ productos_servicios: 'Diseño editorial', nivel_experiencia: 'Experto', nivel_precio: 'Premium' })) {
  assert.equal(activeRow[publicHeaders.indexOf(field)], expected, `exporta ${field} desde la columna de gestión`);
}
for (const [field, expected] of Object.entries({ instagram_usuario: 'prueba.inst', linkedin_usuario: 'prueba-li', behance_usuario: 'prueba-be' })) {
  assert.equal(activeRow[publicHeaders.indexOf(field)], expected, `exporta el usuario público de ${field}`);
}
records[0][headers.indexOf('estado')] = 'Inactivo';
assert.equal(context.getPublicCsvData().length, 2, 'un perfil inactivo debe desaparecer del CSV');
records[0][headers.indexOf('estado')] = 'Pendiente';
assert.equal(context.getPublicCsvData().length, 2, 'un perfil pendiente debe quedar fuera del CSV');

const duplicateRows = [headers, ...records, [...records[0]]];
context.SpreadsheetApp.openById = () => ({ getSheetByName: (name) => name === 'perfiles' ? fakeSheet(name, duplicateRows) : sheets[name] });
assert.throws(() => context.saveReview({ id: '17', estado: 'Activo', notas: '' }), /aparece más de una vez/);

console.log('Panel de revisión: validaciones, aislamiento de campos, actualización y lista pública correctos.');
