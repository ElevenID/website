import assert from 'node:assert/strict';

export const WEBSITE_PACKAGE_MANAGER = 'bun@1.4.4';

// Bun's text lock uses JSON with trailing commas. Strip only those commas,
// preserving quoted URLs and integrity strings; never evaluate lockfile code.
export function parseBunLock(source) {
  let quoted = false;
  let escaped = false;
  let json = '';
  for (let index = 0; index < source.length; index += 1) {
    const character = source[index];
    if (quoted) {
      if (escaped) escaped = false;
      else if (character === '\\') escaped = true;
      else if (character === '"') quoted = false;
    } else if (character === '"') quoted = true;
    else if (character === ',' && /^[\s]*[}\]]/.test(source.slice(index + 1))) continue;
    json += character;
  }
  return JSON.parse(json);
}

export function verifyPackageManager({ manifest, npmLock, bunLock }) {
  assert.equal(manifest.packageManager, WEBSITE_PACKAGE_MANAGER, 'Website package manager must remain pinned');
  assert.equal(manifest.engines?.node, '>=24 <25', 'Website scripts retain the Node 24 runtime');
  assert.equal(npmLock.lockfileVersion, 3, 'The npm compatibility lock must be version 3');
  assert.equal(bunLock.lockfileVersion, 2, 'The Bun lock must be version 2');
  assert.equal(bunLock.configVersion, 0, 'Unsupported Bun lock configuration');
  assert.deepEqual(Object.keys(bunLock.workspaces), [''], 'Unexpected website workspace');
  for (const field of ['dependencies', 'devDependencies', 'optionalDependencies', 'peerDependencies']) {
    assert.deepEqual(npmLock.packages[''][field] || {}, manifest[field] || {}, 'npm manifest drift: ' + field);
    assert.deepEqual(bunLock.workspaces[''][field] || {}, manifest[field] || {}, 'Bun manifest drift: ' + field);
  }
  const reference = Object.entries(npmLock.packages).filter(([location]) => location).map(([location, entry]) => {
    assert.ok(location.startsWith('node_modules/'), 'Unexpected npm package location');
    assert.match(entry.integrity || '', /^sha512-/, 'Every package needs its original SHA-512 integrity');
    const name = location.split('node_modules/').at(-1);
    return { name, version: entry.version, resolved: entry.resolved, integrity: entry.integrity };
  });
  const identity = ({ name, version, resolved, integrity }) => JSON.stringify([name, version, resolved, integrity]);
  const expected = new Set(reference.map(identity));
  const actual = new Set();
  const roots = new Set(Object.keys({ ...manifest.dependencies, ...manifest.devDependencies }));
  for (const [selector, record] of Object.entries(bunLock.packages)) {
    assert.ok(Array.isArray(record), 'Invalid Bun record: ' + selector);
    const matching = reference.filter((entry) => record.at(-1) === entry.integrity
      && (record[0] === `${entry.name}@${entry.version}` || record[0] === `${entry.name}@${entry.resolved}`));
    assert.ok(matching.length > 0, 'Bun package changed version, source or integrity: ' + selector);
    if (roots.has(selector)) {
      const selected = npmLock.packages['node_modules/' + selector];
      assert.ok(selected && matching.some((entry) => entry.name === selector
        && entry.version === selected.version && entry.resolved === selected.resolved
        && entry.integrity === selected.integrity), 'Bun changed a declared root resolution: ' + selector);
    }
    if (typeof record[1] === 'string' && record[1]) {
      assert.ok(matching.some((entry) => record[1] === entry.resolved), 'Bun package source changed: ' + selector);
    }
    for (const entry of matching) actual.add(identity(entry));
  }
  for (const name of roots) assert.ok(Object.hasOwn(bunLock.packages, name), 'Bun omitted declared root: ' + name);
  assert.deepEqual([...actual].sort(), [...expected].sort(), 'Bun migration changed the locked package identities');
  return { package_manager: WEBSITE_PACKAGE_MANAGER, node_major: 24, package_identities: expected.size,
    bun_records: Object.keys(bunLock.packages).length, npm_records: reference.length };
}
