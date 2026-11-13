import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

test('confirmação aguarda deploy pendente além de 35s e só publica a origem depois de live', async () => {
  const root = await mkdtemp(path.join(tmpdir(), 'lojas-render-pending-'));
  try {
    const output = path.join(root, 'output');
    const preload = `
      let clock = 1700000000000, calls = 0;
      Date.now = () => clock;
      globalThis.setTimeout = (fn, ms) => { clock += ms; queueMicrotask(fn); return { unref() {} }; };
      globalThis.fetch = async url => {
        if (String(url).includes('/deploys/')) return Response.json({status: ++calls < 23 ? 'update_in_progress' : 'live', commit: {id: '${'a'.repeat(40)}'}});
        return Response.json({serviceDetails: {url: 'https://lojas-fixture.onrender.com'}});
      };
    `;
    const result = spawnSync(process.execPath, ['--import', 'data:text/javascript;base64,' + Buffer.from(preload).toString('base64'), 'deploy/render/release.mjs', 'verify'], {
      encoding: 'utf8', timeout: 10_000,
      env: { ...process.env, GITHUB_SHA: 'a'.repeat(40), RENDER_SERVICE_ID: 'srv-fixture', RENDER_DEPLOY_ID: 'dep-fixture', RENDER_API_KEY: 'token-render-sintetico', GITHUB_OUTPUT: output },
    });
    assert.equal(result.status, 0, result.stderr);
    assert.equal(await readFile(output, 'utf8'), 'origin=https://lojas-fixture.onrender.com\n');
    assert.match(result.stdout, /"status":"live"/);
  } finally { await rm(root, { recursive: true, force: true }); }
});
