// Complete source-bound asset acceptance gate. Does not fetch from marty-ui.
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { existsSync, lstatSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
const root = fileURLToPath(new URL('../', import.meta.url));
const inventory = JSON.parse(readFileSync(new URL('../docs/input-inventory/asset-inventory.json', import.meta.url), 'utf8'));
const source = inventory.files.filter((entry) => inventory.categories[entry.category]?.disposition !== 'exclude');
assert.equal(source.length, 46, 'The audited selected website resource set must stay explicit');
const errors = [];
for (const entry of source) {
  const p = fileURLToPath(new URL('../ui/public/' + entry.path, import.meta.url));
  if (!p.startsWith(root + 'ui/public/')) { errors.push('Invalid path: ' + entry.path); continue; }
  if (!existsSync(p) || !lstatSync(p).isFile() || lstatSync(p).isSymbolicLink()) {
    errors.push('Missing or nonregular: ' + entry.path);
    continue;
  }
  const bytes = readFileSync(p);
  const hash = createHash('sha1').update('blob ' + bytes.length + String.fromCharCode(0)).update(bytes).digest('hex');
  const expected = entry.path === 'locales/en/marketing.json'
    ? 'abd0a07db30845792adebff0d281241ebfcd666a' : entry.blob_sha;
  if (hash !== expected || bytes.length !== entry.size_bytes &&
    entry.path !== 'locales/en/marketing.json') errors.push('Source identity mismatch: ' + entry.path);
}
console.log(JSON.stringify({ selected: source.length, passed: source.length - errors.length,
  failed: errors.length, errors }));
if (errors.length) process.exitCode = 1;
