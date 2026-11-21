import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { copyFile, cp, mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const root = fileURLToPath(new URL('../../', import.meta.url));

test('website-owned semantic validation preserves historical evidence and rejects invalid promotion or assets', { timeout: 30_000 }, () => {
  const result = spawnSync('python3', ['-I', '-B', 'tests/fixtures/demo_manifest_validation_test.py'], {
    cwd: root, encoding: 'utf8', timeout: 25_000, maxBuffer: 1024 * 1024,
  });
  assert.equal(result.error, undefined, result.error?.message);
  assert.equal(result.status, 0, result.stdout + result.stderr);
  assert.match(result.stderr, /Ran [1-9][0-9]* tests/);
});

async function catalogFixture(t) {
  const directory = await mkdtemp(path.join(tmpdir(), 'website-demo-gate-'));
  t.after(() => rm(directory, { recursive: true, force: true }));
  for (const name of [
    'package.json', 'scripts/validate_demo_manifests.py', 'scripts/demo_asset_hashes.py',
    'deploy-config/catalog/demo-portfolio-v3.json', 'contracts/demo-portfolio-2026-08-reference.json',
    'ui/scripts/generate-demo-manifest-module.mjs', 'ui/scripts/generated-text.mjs',
    'ui/src/generated/demoManifests.generated.js', 'ui/src/generated/demoWalletSchema.generated.json',
  ]) {
    const target = path.join(directory, name);
    await mkdir(path.dirname(target), { recursive: true });
    await copyFile(path.join(root, name), target);
  }
  for (const name of ['ui/public/demos', 'ui/public/images/demos']) {
    await cp(path.join(root, name), path.join(directory, name), { recursive: true });
  }
  return directory;
}

test('the real Bun prebuild hook rejects stale committed generated data before it can be regenerated', async (t) => {
  const directory = await catalogFixture(t);
  const generated = path.join(directory, 'ui/src/generated/demoManifests.generated.js');
  const stale = '// deliberately stale reviewed-source fixture\n';
  await writeFile(generated, stale);
  const result = spawnSync('bun', ['run', 'prebuild:website'], {
    cwd: directory, encoding: 'utf8', timeout: 20_000, maxBuffer: 128 * 1024,
  });
  assert.equal(result.error, undefined, result.error?.message);
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /Generated demo artifact is stale/);
  assert.equal(await readFile(generated, 'utf8'), stale);
});

test('the real Bun catalog gate checks source poster bytes before generated output', async (t) => {
  const directory = await catalogFixture(t);
  const generated = path.join(directory, 'ui/src/generated/demoManifests.generated.js');
  const before = await readFile(generated);
  await writeFile(path.join(directory, 'ui/public/images/demos/2026.08.0/portfolio-draft.svg'), '<svg>tampered</svg>\n');
  const result = spawnSync('bun', ['run', 'check:demos'], {
    cwd: directory, encoding: 'utf8', timeout: 20_000, maxBuffer: 128 * 1024,
  });
  assert.equal(result.error, undefined, result.error?.message);
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /poster SHA-256 mismatch/);
  assert.deepEqual(await readFile(generated), before);
});

test('retained validator inputs have exact source provenance without rewriting extraction history', async () => {
  const provenance = JSON.parse(await readFile(path.join(root, 'contracts/demo-validation-provenance.json'), 'utf8'));
  assert.equal(provenance.source_repository, 'ElevenID/marty-ui');
  assert.equal(provenance.source_commit, '3cf4a7000b2e1d6b21c819151b0bd2b91269d4d2');
  for (const record of provenance.source_files) {
    const bytes = await readFile(path.join(root, record.path));
    assert.equal(createHash('sha256').update(bytes).digest('hex'), record.current_sha256 ?? record.source_sha256, record.path);
  }
});
