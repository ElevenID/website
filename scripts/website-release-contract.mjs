// Planning only. Publication and signing are intentionally separate operations.
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { canonicalReleaseJson, standalonePlanFromQualification } from './lib/standalone-release-contract.mjs';

assert.deepEqual(process.argv.slice(2), ['plan'], 'Usage: website-release-contract.mjs plan');
const plan = standalonePlanFromQualification({
  root: fileURLToPath(new URL('../', import.meta.url)),
  sourceSha: process.env.MARTY_WEBSITE_SOURCE_SHA,
});
process.stdout.write(canonicalReleaseJson(plan));
