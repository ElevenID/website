import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { parseBunLock, verifyPackageManager } from '../scripts/lib/package-manager.mjs';

const read = (name) => readFileSync(new URL('../' + name, import.meta.url), 'utf8');
const inputs = () => ({ manifest: JSON.parse(read('package.json')),
  npmLock: JSON.parse(read('package-lock.json')), bunLock: parseBunLock(read('bun.lock')) });

test('the Bun lock preserves every npm-locked version, source and integrity with Node 24 retained', () => {
  const result = verifyPackageManager(inputs());
  assert.equal(result.package_manager, 'bun@1.4.4');
  assert.equal(result.node_major, 24);
  assert.ok(result.package_identities > 100);
});

test('the lock parser preserves punctuation inside strings and rejects executable text', () => {
  assert.deepEqual(parseBunLock('{"source":"https://example.test/a,}","values":["x,]",],}'),
    { source: 'https://example.test/a,}', values: ['x,]'] });
  assert.throws(() => parseBunLock('{"payload":process.exit(1)}'), SyntaxError);
});

for (const [name, mutate] of [
  ['a changed package manager', (value) => { value.manifest.packageManager = 'npm@11'; }],
  ['a runtime replacement', (value) => { value.manifest.engines.node = '>=22'; }],
  ['a changed direct dependency', (value) => { value.bunLock.workspaces[''].dependencies.react = '19.0.0'; }],
  ['a changed transitive integrity', (value) => { value.bunLock.packages.react[3] = 'sha512-tampered'; }],
  ['a removed package identity', (value) => { delete value.bunLock.packages.react; }],
  ['a changed immutable blog source', (value) => { value.bunLock.packages['@elevenid/marty-blog'][0] = '@elevenid/marty-blog@https://example.test/blog.tgz'; }],
  ['swapped roots with unchanged identity sets', (value) => {
    [value.bunLock.packages.react, value.bunLock.packages['react-dom']]
      = [value.bunLock.packages['react-dom'], value.bunLock.packages.react];
  }],
]) {
  test('package-manager verification rejects ' + name, () => {
    const value = inputs();
    mutate(value);
    assert.throws(() => verifyPackageManager(value));
  });
}
