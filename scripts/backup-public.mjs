import fs from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { resolve } from 'node:path';
const directory = resolve('backups', new Date().toISOString().slice(0, 10), 'publico');
await fs.mkdir(directory, { recursive: true });
const csv = await fs.readFile('data/perfiles.csv', 'utf8');
const urls = [...new Set(csv.match(/https:\/\/res\.cloudinary\.com\/dahrgg4v5\/image\/upload\/[^"\s]+/g) || [])];
const manifest = { createdAt: new Date().toISOString(), assets: [] };
for (let index = 0; index < urls.length; index++) {
  const url = urls[index];
  const response = await fetch(url, { signal: AbortSignal.timeout(30000) });
  if (!response.ok || !response.headers.get('content-type')?.startsWith('image/')) throw new Error(`No se pudo respaldar imagen ${index + 1}: HTTP ${response.status}`);
  const bytes = Buffer.from(await response.arrayBuffer());
  const filename = `${String(index + 1).padStart(3, '0')}-${new URL(url).pathname.split('/').pop()}`;
  await fs.writeFile(resolve(directory, filename), bytes);
  const sha256 = createHash('sha256').update(bytes).digest('hex');
  if (createHash('sha256').update(await fs.readFile(resolve(directory, filename))).digest('hex') !== sha256) throw new Error('El respaldo no coincide con la descarga.');
  manifest.assets.push({ url, filename, bytes: bytes.length, sha256 });
}
await fs.writeFile(resolve(directory, 'manifest.json'), JSON.stringify(manifest, null, 2));
await fs.copyFile('data/perfiles.csv', resolve(directory, 'perfiles.csv'));
await fs.copyFile('data/perfiles-demo.json', resolve(directory, 'perfiles-demo.json'));
console.log(`Respaldo verificado: ${urls.length} imágenes en ${directory}. No incluye datos privados.`);
