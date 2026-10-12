import assert from 'node:assert/strict';
import fs from 'node:fs';
import { normalizeLocationSearch, prepareLocationOptions, searchLocations } from './location-picker.js';

const rows = fs.readFileSync(new URL('../data/distritos.csv', import.meta.url), 'utf8').trim().split(/\r?\n/).slice(1).map(line => {
  const [distrito, provincia, departamento] = line.split(',');
  return { distrito, provincia, departamento };
});
const options = prepareLocationOptions(rows);
assert.equal(options.length, 1891, 'el selector ofrece todos los distritos del catálogo');
assert.equal(normalizeLocationSearch('VÍCTOR LARCO HERRERA'), 'victor larco herrera');

const districtSearch = searchLocations(options, 'miraflores lima');
assert(districtSearch.total >= 1);
assert(districtSearch.matches.some((option) => option.label === 'MIRAFLORES — LIMA — LIMA'));

const provinceSearch = searchLocations(options, 'CHICLAYO');
assert(provinceSearch.total > 1, 'permite encontrar distritos escribiendo la provincia');
assert(provinceSearch.matches.every((option) => option.provincia === 'CHICLAYO'));

const departmentSearch = searchLocations(options, 'la libertad');
assert(departmentSearch.total > 1, 'permite encontrar distritos escribiendo el departamento');
assert(departmentSearch.matches.every((option) => option.departamento === 'LA LIBERTAD'));

const boundedSearch = searchLocations(options, 'lima', 7);
assert.equal(boundedSearch.matches.length, 7, 'limita las opciones mostradas para mantener el menú manejable');
assert(boundedSearch.total > boundedSearch.matches.length);
assert.equal(searchLocations(options, 'ubicacion inexistente').total, 0);

console.log(`Ubicación: ${options.length} combinaciones completas; búsqueda por distrito, provincia y departamento validada.`);
