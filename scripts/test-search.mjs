import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const source = fs.readFileSync(new URL('./index.js', import.meta.url), 'utf8');
const searchFunctions = source.slice(source.indexOf('function normalizeText('), source.indexOf('function fillSelect('));
const parser = source.slice(source.indexOf('function parseCsv('), source.indexOf('function profileSlugFromLocation('));
const context = { demoIds: new Set() };
vm.createContext(context);
vm.runInContext(searchFunctions, context);
vm.runInContext(parser, context);

const csv = fs.readFileSync(new URL('../data/perfiles.csv', import.meta.url), 'utf8');
context.demoIds = new Set(JSON.parse(fs.readFileSync(new URL('../data/perfiles-demo.json', import.meta.url), 'utf8')).ids);
const publishedProfiles = context.parseCsv(csv);
assert(publishedProfiles.some((profile) => context.profileSearchScore(profile, 'b') !== null), 'una letra puede encontrar perfiles');
assert(publishedProfiles.some((profile) => context.profileSearchScore(profile, 'ba') !== null), 'dos letras pueden encontrar coincidencias parciales');

const nameMatch = {
  nameSearchText: context.normalizeText('Barbara Solis'),
  searchText: context.normalizeText('Barbara Solis anfitriona eventos'),
};
const descriptionMatch = {
  nameSearchText: context.normalizeText('Nathalie Miraluz'),
  searchText: context.normalizeText('Nathalie Miraluz anfitriona baile'),
};
assert(context.profileSearchScore(nameMatch, 'b') !== null, 'encuentra una letra dentro del nombre');
assert(context.profileSearchScore(nameMatch, 'ba') !== null, 'encuentra dos letras dentro del nombre');
assert(context.profileSearchScore({ ...nameMatch, searchText: 'barbara solis anfitriona' }, 'zz') === null, 'no inventa resultados sin coincidencia');
assert(context.profileSearchScore({ nameSearchText: 'nathalie miraluz', searchText: 'nathalie miraluz disenadora grafica' }, 'diseñadora') !== null, 'ignora tildes');
assert(context.profileSearchScore({ nameSearchText: 'nathalie miraluz', searchText: 'nathalie miraluz disenadora grafica' }, 'disenadorr') !== null, 'tolera un error tipográfico en términos largos');
assert(context.profileSearchScore(nameMatch, 'barbara eventos') !== null, 'combina términos de nombre y perfil');
assert(
  context.profileSearchScore(nameMatch, 'ba') > context.profileSearchScore(descriptionMatch, 'ba'),
  'prioriza coincidencias del nombre frente a las de la descripción',
);

console.log('Búsqueda: letras y fragmentos cortos, tildes, términos múltiples, errores tipográficos y relevancia comprobados.');
