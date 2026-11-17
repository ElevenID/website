import assert from 'node:assert/strict';
import { readFile, writeFile, rm, readdir } from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';
import { buildFixture, builder, inputSourceSha } from '../fixtures/website-input-fixture.mjs';

async function trace(fixture) {
  try { return (await readFile(fixture.trace, 'utf8')).trim().split('\n'); }
  catch (error) { if (error.code === 'ENOENT') return []; throw error; }
}
const failure = (result, pattern) => { assert.notEqual(result.status, 0); assert.match(result.stderr, pattern); };

test('website runner checks generated inputs, invokes typecheck, and runs real Vite from a checkout with spaces', async (t) => {
  const fixture = await buildFixture(t);
  const before = await readFile(fixture.module, 'utf8');
  const result = builder(fixture);
  assert.equal(result.status, 0, result.stderr);
  const stages = await trace(fixture);
  assert.deepEqual(JSON.parse(stages[0]), { stage: 'typecheck', args: ['-p', 'tsconfig.build.json'],
    cwd: fixture.ui, surface: 'website', source: inputSourceSha });
  assert.deepEqual(stages.slice(1), ['vite']);
  const output = path.join(fixture.ui, 'dist-website');
  const metadata = JSON.parse(await readFile(path.join(output, 'marty-website-release.json'), 'utf8'));
  assert.equal(metadata.repository, 'ElevenID/website');
  assert.equal(metadata.source_sha, inputSourceSha);
  assert.equal(metadata.revision, inputSourceSha);
  assert.equal(metadata.production_pages, 'public');
  const chunks = await readdir(path.join(output, 'assets'));
  const javascript = (await Promise.all(chunks.filter((name) => name.endsWith('.js')).map((name) => readFile(path.join(output, 'assets', name), 'utf8')))).join('\n');
  assert.match(javascript, /DRAFT/);
  assert.match(javascript, /PARTIAL/);
  assert.match(javascript, /Synthetic release/);
  assert.equal(await readFile(fixture.module, 'utf8'), before);
});

test('website runner propagates the typecheck exit code and stops before Vite', async (t) => {
  const fixture = await buildFixture(t);
  const result = builder(fixture, { env: { FIXTURE_TSC_STATUS: '23' } });
  assert.equal(result.status, 23, result.stderr);
  assert.equal((await trace(fixture)).length, 1);
  await assert.rejects(readFile(path.join(fixture.ui, 'dist-website/index.html')), { code: 'ENOENT' });
});

test('website runner refuses stale generated artifacts before typecheck or build', async (t) => {
  const fixture = await buildFixture(t);
  await writeFile(fixture.module, '// stale committed artifact\n');
  failure(builder(fixture), /stale/i);
  assert.deepEqual(await trace(fixture), []);
  assert.equal(await readFile(fixture.module, 'utf8'), '// stale committed artifact\n');
});

test('website runner checks missing typechecker before any generator output', async (t) => {
  const fixture = await buildFixture(t);
  await rm(path.join(fixture.root, 'node_modules/typescript'), { recursive: true });
  await writeFile(fixture.module, '// keep this\n');
  failure(builder(fixture), /prerequisite missing: TypeScript/);
  assert.equal(await readFile(fixture.module, 'utf8'), '// keep this\n');
  assert.deepEqual(await trace(fixture), []);
});

test('website runner requires one complete Vite configuration before generation', async (t) => {
  const fixture = await buildFixture(t);
  await rm(path.join(fixture.ui, 'vite.config.mjs'));
  await writeFile(fixture.module, '// keep this\n');
  failure(builder(fixture), /exactly one Vite configuration/);
  assert.equal(await readFile(fixture.module, 'utf8'), '// keep this\n');
  assert.deepEqual(await trace(fixture), []);
});

test('website runner rejects omitted or arbitrary production source identities before stages run', async (t) => {
  const fixture = await buildFixture(t);
  for (const source of ['', 'unknown', 'short', 'A'.repeat(40), `${inputSourceSha}\n`, 'development']) {
    failure(builder(fixture, { env: { MARTY_WEBSITE_SOURCE_SHA: source } }), /exact.*SOURCE_SHA|explicit development/i);
    assert.deepEqual(await trace(fixture), []);
  }
});

test('website runner allows explicitly named development output without a production claim', async (t) => {
  const fixture = await buildFixture(t);
  const result = builder(fixture, { env: { MARTY_WEBSITE_SOURCE_SHA: 'development', MARTY_WEBSITE_ALLOW_DEVELOPMENT: 'true' } });
  assert.equal(result.status, 0, result.stderr);
  const metadata = JSON.parse(await readFile(path.join(fixture.ui, 'dist-website/marty-website-release.json'), 'utf8'));
  assert.equal(metadata.audience, 'development');
  assert.equal(metadata.source_sha, 'development');
  assert.equal(metadata.revision, 'development');
});

test('website runner rejects application, combined and additional surface arguments before stages run', async (t) => {
  const fixture = await buildFixture(t);
  for (const args of [[], ['application'], ['combined'], ['website', '--unknown']]) {
    failure(builder(fixture, { args }), /website surface only/i);
    assert.deepEqual(await trace(fixture), []);
  }
});

test('website runner rejects customer builds before generating artifacts', async (t) => {
  const fixture = await buildFixture(t);
  failure(builder(fixture, { env: { VITE_UI_VARIANT: 'selfhost' } }), /customer variant/);
  assert.deepEqual(await trace(fixture), []);
});

test('website runner does not override a conflicting inherited surface silently', async (t) => {
  const fixture = await buildFixture(t);
  failure(builder(fixture, { env: { MARTY_UI_SURFACE: 'application' } }), /only builds the website/);
  assert.deepEqual(await trace(fixture), []);
});

test('website runner has no application pruning dependency in its executed graph', async (t) => {
  const fixture = await buildFixture(t, { pruningBoundary: false });
  const result = builder(fixture);
  assert.equal(result.status, 0, result.stderr);
  assert.deepEqual((await trace(fixture)).slice(1), ['vite']);
});

test('website runner propagates actual Vite errors after successful earlier stages', async (t) => {
  const fixture = await buildFixture(t);
  const result = builder(fixture, { env: { FIXTURE_VITE_FAIL: 'yes' } });
  failure(result, /fixture Vite failure/);
  assert.equal(result.status, 1);
  assert.deepEqual((await trace(fixture)).slice(1), ['vite']);
  await assert.rejects(readFile(path.join(fixture.ui, 'dist-website/marty-website-release.json')), { code: 'ENOENT' });
});
