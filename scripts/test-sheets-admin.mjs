import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const source = fs.readFileSync(new URL('../sheets-admin/Code.js', import.meta.url), 'utf8');
const context = { console };
vm.createContext(context);
vm.runInContext(source, context);
const headers = Array.from(vm.runInContext('REVIEW_HEADERS', context));
const publicHeaders = Array.from(vm.runInContext('PUBLIC_HEADERS', context));
const records = [
  makeRow({ id: '17', nombres: 'Prueba', apellidos: 'Pendiente', estado: 'Pendiente', correo: 'privado@example.test', whatsapp_interno: '51900000017' }),
  makeRow({ id: '18', nombres: 'Prueba', apellidos: 'Activo', estado: 'Activo', correo: 'activo@example.test' }),
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
  getActiveSpreadsheet: () => ({ getSheetByName: (name) => sheets[name] || null }),
  flush() {},
};
context.LockService = {
  getDocumentLock: () => ({ waitLock() {}, releaseLock() {} }),
};

const pending = context.getReviewQueue();
assert.equal(pending.length, 1);
assert.equal(pending[0].id, '17');
assert.equal('correo' in pending[0], false, 'la cola no expone contactos privados');
assert.equal(context.getReviewQueue('Activo')[0].id, '18');
assert.equal(context.getReviewQueue('Todos').length, 2);
assert.throws(() => context.getReviewQueue('Cualquier estado'), /filtro de estado no es válido/);

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
records[0][headers.indexOf('estado')] = 'Inactivo';
assert.equal(context.getPublicCsvData().length, 2, 'un perfil inactivo debe desaparecer del CSV');
records[0][headers.indexOf('estado')] = 'Pendiente';
assert.equal(context.getPublicCsvData().length, 2, 'un perfil pendiente debe quedar fuera del CSV');

const duplicateRows = [headers, ...records, [...records[0]]];
context.SpreadsheetApp.getActiveSpreadsheet = () => ({ getSheetByName: (name) => name === 'perfiles' ? fakeSheet(name, duplicateRows) : sheets[name] });
assert.throws(() => context.saveReview({ id: '17', estado: 'Activo', notas: '' }), /aparece más de una vez/);

console.log('Panel de revisión: validaciones, aislamiento de campos, actualización y lista pública correctos.');
