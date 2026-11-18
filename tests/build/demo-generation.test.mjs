import assert from 'node:assert/strict';
import { readFile, writeFile, rm, symlink, readdir, mkdir } from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import test from 'node:test';
import { inputFixture, writeInput, generator, sourceSchema } from '../fixtures/website-input-fixture.mjs';

const success = (result) => assert.equal(result.status, 0, result.stderr);
const failure = (result, pattern) => {
  assert.notEqual(result.status, 0, result.stdout);
  assert.match(result.stderr, pattern);
};

test('demo generator preserves release states and complete JSON data through module execution', async (t) => {
  const fixture = await inputFixture(t);
  const relative = 'ui/public/demos/manifests/2026.08.0.json';
  const original = JSON.parse(await readFile(path.join(fixture.root, relative), 'utf8'));
  original.data = JSON.parse('{"__proto__":{"retained":true},"constructor":"text","line":"a\\nb"}');
  await writeInput(fixture.root, relative, original);
  const schemaBefore = await readFile(fixture.schema, 'utf8');
  success(generator(fixture));
  const result = await import(pathToFileURL(fixture.module).href);
  assert.deepEqual(result.DEMO_INDEX, fixture.index);
  assert.deepEqual(result.DEMO_MANIFESTS['2026.08.0'], original);
  assert.equal(Object.getPrototypeOf(result.DEMO_MANIFESTS['2026.08.0'].data), Object.prototype);
  assert.equal(result.DEMO_INDEX.releases[0].publication_state, 'DRAFT');
  assert.equal(result.DEMO_INDEX.releases[0].coverage_state, 'PARTIAL');
  assert.equal(await readFile(fixture.schema, 'utf8'), schemaBefore);
});

test('demo --check accepts normalized newlines and never rewrites matching generated files', async (t) => {
  const fixture = await inputFixture(t);
  success(generator(fixture));
  const content = (await readFile(fixture.module, 'utf8')).replaceAll('\n', '\r\n');
  await writeFile(fixture.module, content);
  success(generator(fixture, ['--check']));
  assert.equal(await readFile(fixture.module, 'utf8'), content);
});

test('demo --check rejects stale output without rewriting it', async (t) => {
  const fixture = await inputFixture(t);
  await writeFile(fixture.module, '// retained stale artifact\n');
  failure(generator(fixture, ['--check']), /stale/i);
  assert.equal(await readFile(fixture.module, 'utf8'), '// retained stale artifact\n');
});

test('demo schema source projection is checked independently from its generated module', async (t) => {
  const fixture = await inputFixture(t);
  const expected = await sourceSchema(fixture);
  success(generator(fixture));
  assert.deepEqual(JSON.parse(await readFile(fixture.schema, 'utf8')), expected);
  await writeFile(fixture.schema, '{}\n');
  failure(generator(fixture, ['--check']), /stale/i);
  assert.equal(await readFile(fixture.schema, 'utf8'), '{}\n');
});

test('demo committed schema fallback must be a usable wallet projection', async (t) => {
  const fixture = await inputFixture(t);
  await writeFile(fixture.schema, '{}\n');
  await writeFile(fixture.module, '// previous\n');
  failure(generator(fixture), /wallet schema.*invalid/i);
  assert.equal(await readFile(fixture.module, 'utf8'), '// previous\n');
});

test('demo source schema shape fails before generating any artifacts', async (t) => {
  const fixture = await inputFixture(t);
  const before = await readFile(fixture.schema, 'utf8');
  await writeInput(fixture.root, 'deploy-config/schemas/stack-demo-manifest.schema.json', { $defs: { stringList: {} } });
  failure(generator(fixture), /schema source|undefined/);
  assert.equal(await readFile(fixture.schema, 'utf8'), before);
  await assert.rejects(readFile(fixture.module), { code: 'ENOENT' });
});

test('demo mismatch validation completes before either generated artifact is replaced', async (t) => {
  const fixture = await inputFixture(t);
  await sourceSchema(fixture);
  await writeFile(fixture.schema, '{"retained":"schema"}\n');
  await writeFile(fixture.module, '// previous module\n');
  await writeInput(fixture.root, 'ui/public/demos/manifests/2026.07.0.json', { stack_version: '2026.07.0', mip_version: 'mismatch' });
  failure(generator(fixture), /index mismatch/i);
  assert.equal(await readFile(fixture.schema, 'utf8'), '{"retained":"schema"}\n');
  assert.equal(await readFile(fixture.module, 'utf8'), '// previous module\n');
});

test('demo duplicate version identities are rejected', async (t) => {
  const fixture = await inputFixture(t);
  fixture.index.releases.push(fixture.index.releases[0]);
  await writeInput(fixture.root, 'ui/public/demos/manifests/index.json', fixture.index);
  failure(generator(fixture), /duplicate/i);
});

test('demo version identities cannot read outside the manifest directory', async (t) => {
  const fixture = await inputFixture(t);
  await writeInput(fixture.root, 'ui/public/demos/outside.json', {
    ...fixture.index.releases[0], stack_version: '../outside', title: 'Outside the manifest directory',
  });
  for (const version of ['../outside', '/outside', '..\\outside', '%2e%2e%2foutside', '', 'a\nname', 'trailing\n']) {
    fixture.index.releases[0].stack_version = version;
    await writeInput(fixture.root, 'ui/public/demos/manifests/index.json', fixture.index);
    failure(generator(fixture), /invalid release identity/i);
  }
  await assert.rejects(readFile(fixture.module), { code: 'ENOENT' });
});

test('demo latest pointers must name a listed release', async (t) => {
  const fixture = await inputFixture(t);
  fixture.index.latest_approved_stack_version = '2099.1.0';
  await writeInput(fixture.root, 'ui/public/demos/manifests/index.json', fixture.index);
  failure(generator(fixture), /does not name a listed release/i);
});

test('demo missing release cannot partially update the wallet schema', async (t) => {
  const fixture = await inputFixture(t);
  await sourceSchema(fixture);
  await writeFile(fixture.schema, '{"retained":true}\n');
  await rm(path.join(fixture.ui, 'public/demos/manifests/2026.07.0.json'));
  failure(generator(fixture), /ENOENT/);
  assert.equal(await readFile(fixture.schema, 'utf8'), '{"retained":true}\n');
});

test('demo release symlinks are rejected even when their content is valid', async (t) => {
  const fixture = await inputFixture(t);
  const filename = path.join(fixture.ui, 'public/demos/manifests/2026.07.0.json');
  const original = await readFile(filename, 'utf8');
  const outside = await writeInput(fixture.root, 'external-release.json', original);
  await rm(filename);
  await symlink(outside, filename);
  failure(generator(fixture), /symlink/i);
  assert.equal(await readFile(outside, 'utf8'), original);
});

test('demo output symlinks cannot redirect generation to another file', async (t) => {
  const fixture = await inputFixture(t);
  const outside = await writeInput(fixture.root, 'external.js', '// untouched\n');
  await symlink(outside, fixture.module);
  failure(generator(fixture), /symlink/i);
  assert.equal(await readFile(outside, 'utf8'), '// untouched\n');
});

test('demo generation rejects an empty release set and unknown arguments', async (t) => {
  const fixture = await inputFixture(t);
  failure(generator(fixture, ['--unknown']), /usage/i);
  fixture.index.releases = [];
  await writeInput(fixture.root, 'ui/public/demos/manifests/index.json', fixture.index);
  failure(generator(fixture), /must contain releases/i);
});

test('demo successful replacement leaves no temporary files in its generated directory', async (t) => {
  const fixture = await inputFixture(t);
  await sourceSchema(fixture);
  success(generator(fixture));
  success(generator(fixture));
  assert.deepEqual((await readdir(path.dirname(fixture.module))).sort(), ['demoManifests.generated.js', 'demoWalletSchema.generated.json']);
});

test('demo non-file output is rejected before replacing the other generated artifact', async (t) => {
  const fixture = await inputFixture(t);
  await sourceSchema(fixture);
  await writeFile(fixture.schema, '{"retained":true}\n');
  await mkdir(fixture.module);
  failure(generator(fixture), /target must be a regular file/i);
  assert.equal(await readFile(fixture.schema, 'utf8'), '{"retained":true}\n');
  assert.deepEqual(await readdir(fixture.module), []);
});

test('committed generated demo exports preserve the exact source catalog and every release manifest', async () => {
  const generated = await import('../../ui/src/generated/demoManifests.generated.js');
  const sourceIndex = JSON.parse(await readFile(new URL('../../ui/public/demos/manifests/index.json', import.meta.url), 'utf8'));
  assert.deepEqual(generated.DEMO_INDEX, sourceIndex);
  assert.deepEqual(Object.keys(generated.DEMO_MANIFESTS).sort(), sourceIndex.releases.map((entry) => entry.stack_version).sort());
  for (const release of sourceIndex.releases) {
    const source = JSON.parse(await readFile(new URL('../../ui/public/demos/manifests/' + release.stack_version + '.json', import.meta.url), 'utf8'));
    assert.deepEqual(generated.DEMO_MANIFESTS[release.stack_version], source);
  }
});
