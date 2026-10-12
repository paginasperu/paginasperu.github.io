import assert from 'node:assert/strict';
import fs from 'node:fs';
import { normalizeLocationSearch, prepareLocationOptions, searchLocations } from './location-picker.js';

const rows = fs.readFileSync(new URL('../supabase/seed/locations.csv', import.meta.url), 'utf8').trim().split(/\r?\n/).slice(1).map(line => {
  const [distrito, provincia, departamento] = line.split(',');
  return { distrito, provincia, departamento };
});
const options = prepareLocationOptions(rows);
assert.equal(options.length, 1891, 'el selector ofrece todos los distritos del catálogo');
assert.equal(normalizeLocationSearch('VÍCTOR LARCO HERRERA'), 'victor larco herrera');

const districtSearch = searchLocations(options, 'miraflores');
assert(districtSearch.total >= 1);
assert(districtSearch.matches.some((option) => option.label === 'MIRAFLORES — LIMA — LIMA'));
assert(districtSearch.matches.every((option) => normalizeLocationSearch(option.distrito).includes('miraflores')), 'la búsqueda coincide solo con nombres de distrito');
assert.equal(searchLocations(options, 'miraflores lima').total, 0, 'no combina distrito con provincia ni departamento');

const provinceSearch = searchLocations(options, 'CHICLAYO');
assert(provinceSearch.total >= 1, 'encuentra el distrito Chiclayo por su nombre');
assert(provinceSearch.matches.every((option) => option.distrito === 'CHICLAYO'), 'no devuelve distritos solo porque comparten provincia');

const departmentSearch = searchLocations(options, 'la libertad');
assert(departmentSearch.matches.every((option) => normalizeLocationSearch(option.distrito).includes('la libertad')), 'solo encuentra distritos cuyo nombre contiene la búsqueda, incluso si coincide con un departamento');

const districtTermsSearch = searchLocations(options, 'victor larco');
assert(districtTermsSearch.total >= 1, 'admite nombres de distrito compuestos');
assert(districtTermsSearch.matches.every((option) => normalizeLocationSearch(option.distrito).includes('victor larco')));

const boundedSearch = searchLocations(options, 'lima', 2);
assert.equal(boundedSearch.matches.length, 2, 'limita las opciones mostradas para mantener el menú manejable');
assert(boundedSearch.total > boundedSearch.matches.length);
assert.equal(searchLocations(options, 'ubicacion inexistente').total, 0);

console.log(`Ubicación: ${options.length} combinaciones completas; búsqueda limitada al nombre del distrito validada.`);
