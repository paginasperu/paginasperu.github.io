import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const braces = require('braces');
const micromatch = require('micromatch');
for (const pattern of ['{'.repeat(3000) + 'a' + '}'.repeat(3000), '('.repeat(3000) + 'a' + ')'.repeat(3000)]) {
  assert.throws(() => braces.parse(pattern), error => error instanceof SyntaxError && /128 levels/.test(error.message));
}
assert.throws(() => braces('{'.repeat(3000) + 'a' + '}'.repeat(3000)), /128 levels/);
assert.deepEqual(braces.expand('file-{a,b}.js'), ['file-a.js', 'file-b.js']);
assert.deepEqual(micromatch.not(['Code.js', 'Locations.js', 'appsscript.json', 'ReviewSidebar.html'], ['**/*.html'], {dot:true}), ['Code.js', 'Locations.js', 'appsscript.json']);
console.log('Herramientas: anidamiento malicioso rechazado y patrones normales conservados.');
