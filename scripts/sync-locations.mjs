import fs from 'node:fs';
const csv = fs.readFileSync(new URL('../data/distritos.csv', import.meta.url), 'utf8').trim().split(/\r?\n/);
const headers = csv.shift().split(',');
const keys = csv.map(line => {
  const cells = line.split(',');
  return ['departamento', 'provincia', 'distrito'].map(name => cells[headers.indexOf(name)].trim()).join('|');
});
fs.writeFileSync(new URL('../apps-script/Locations.js', import.meta.url), '// Generado por npm run sync:locations desde data/distritos.csv.\nconst VALID_LOCATIONS = new Set(' + JSON.stringify([...new Set(keys)].sort(), null, 2) + ');\n');
console.log(`Catálogo del servidor: ${keys.length} ubicaciones.`);
