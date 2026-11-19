// Read-only contract operations. Publication and signing are separate commands.
import assert from 'node:assert/strict';
import { lstatSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  canonicalReleaseJson, standalonePlanFromQualification, validateStandaloneRelease,
} from './lib/standalone-release-contract.mjs';

const args = process.argv.slice(2);
if (args.length === 1 && args[0] === 'plan') {
  const plan = standalonePlanFromQualification({
    root: fileURLToPath(new URL('../', import.meta.url)),
    sourceSha: process.env.MARTY_WEBSITE_SOURCE_SHA,
  });
  process.stdout.write(canonicalReleaseJson(plan));
} else {
  assert.ok(args.length === 3 && args[0] === 'validate' && args[1] === '--receipt',
    'Usage: website-release-contract.mjs plan | validate --receipt ABSOLUTE_PATH');
  const filename = args[2];
  assert.ok(path.isAbsolute(filename), 'Receipt path must be absolute');
  let current = path.parse(filename).root;
  for (const segment of filename.slice(current.length).split(path.sep)) {
    current = path.join(current, segment);
    assert.ok(!lstatSync(current).isSymbolicLink(), 'Receipt path cannot contain symlinks');
  }
  const stat = lstatSync(filename);
  assert.ok(stat.isFile() && stat.size > 0 && stat.size <= 1024 * 1024,
    'Receipt must be a bounded regular file');
  const raw = readFileSync(filename);
  assert.equal(raw.length, stat.size, 'Receipt changed while reading');
  const receipt = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(raw));
  validateStandaloneRelease(receipt);
  // The Python proof helper separately rejects duplicate JSON fields and binds
  // these exact subject bytes to the original signatures and producer attempt.
  process.stdout.write('Standalone website release contract is valid.\n');
}
