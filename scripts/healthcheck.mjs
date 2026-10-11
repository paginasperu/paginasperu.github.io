import assert from 'node:assert/strict';
const urls = ['https://oficial.pe/', 'https://oficial.pe/registro', 'https://oficial.pe/contacto', 'https://oficial.pe/privacidad', 'https://oficial.pe/data/perfiles.csv'];
for (const url of urls) {
  const start = performance.now();
  const response = await fetch(url, { signal: AbortSignal.timeout(30000) });
  assert(response.ok, `${url}: HTTP ${response.status}`);
  const text = await response.text();
  assert(text.length > 100, `${url}: respuesta vacía`);
  console.log(`${url}: HTTP ${response.status}, ${(performance.now() - start).toFixed(0)} ms, ${Buffer.byteLength(text)} bytes`);
}
const source = await (await import('node:fs/promises')).readFile(new URL('./registro.js', import.meta.url), 'utf8');
const endpoint = source.match(/appsScriptEndpoint: "([^"]+)"/)[1];
const service = await (await fetch(endpoint, { signal: AbortSignal.timeout(30000) })).json();
assert(service.ok && service.service === 'registro');
console.log(`Registro: ${service.version || 'sin versión'}`);
