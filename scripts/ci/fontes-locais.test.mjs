import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';

test('catálogo tipográfico compila sem consulta ao Google e mantém ativos licenciados íntegros', async () => {
  const catalogSource = await readFile('src/lib/fontes-loja.ts', 'utf8');
  assert.doesNotMatch(catalogSource, /next\/font\/google/, 'Todas as famílias precisam estar disponíveis no checkout');
  const manifest = JSON.parse(await readFile('src/fonts/fontes-inter-poppins.json', 'utf8'));
  assert.match(manifest.revision, /^[a-f0-9]{40}$/);
  assert.deepEqual([...new Set(manifest.files.map(f => f.family))].sort(), ['Inter', 'Poppins']);
  for (const family of ['Inter', 'Poppins']) {
    assert.deepEqual([...new Set(manifest.files.filter(f => f.family === family).flatMap(f => f.weights))].sort(), [400, 600, 700, 800]);
  }
  for (const file of [...manifest.files, ...manifest.licenses]) {
    assert.match(file.file, /^[a-z0-9A-Z.-]+$/);
    const bytes = await readFile('src/fonts/' + file.file);
    assert.equal(createHash('sha256').update(bytes).digest('hex'), file.sha256);
    if (file.file.endsWith('.woff2')) {
      assert.equal(bytes.toString('ascii', 0, 4), 'wOF2');
      assert.ok(file.codepoints > 200 && file.glyphs > 200);
    } else assert.match(bytes.toString('utf8'), /SIL OPEN FONT LICENSE/);
  }
});
