// Mitigación local de GHSA-vfj7-8cjw-p6xm para los patrones que procesa clasp.
// No cambia la versión del paquete ni silencia npm audit. Retirar cuando upstream
// publique la corrección y se haya probado la actualización de clasp.
import fs from 'node:fs/promises';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
const require = createRequire(import.meta.url);
const packagePath = require.resolve('braces/package.json');
const manifest = JSON.parse(await fs.readFile(packagePath, 'utf8'));
if (manifest.version !== '3.0.3') throw new Error('Revisar la protección de braces al cambiar su versión.');
const parserPath = join(dirname(packagePath), 'lib/parse.js');
const parser = await fs.readFile(parserPath, 'utf8');
const marker = 'Directory tooling: bound AST depth';
if (!parser.includes(marker)) {
  const target = 'stack.push(block);';
  if (parser.split(target).length !== 3) throw new Error('El parser cambió; revisar antes de aplicar la protección.');
  const guarded = `// ${marker}\n      if (stack.length >= 128) throw new SyntaxError('Brace pattern nesting exceeds 128 levels');\n      stack.push(block);`;
  await fs.writeFile(parserPath, parser.replaceAll(target, guarded));
}
console.log('Herramientas: profundidad de patrones limitada a 128 niveles.');
