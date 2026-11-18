import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import {
  finalizeQualificationEvidence, prepareQualificationEvidence,
} from './lib/qualification-evidence.mjs';

const [operation, ...extra] = process.argv.slice(2);
assert.equal(extra.length, 0, 'Usage: website-qualification.mjs prepare|finalize');
assert.ok(['prepare', 'finalize'].includes(operation), 'Usage: website-qualification.mjs prepare|finalize');
const options = {
  root: fileURLToPath(new URL('../', import.meta.url)),
  sourceSha: process.env.MARTY_WEBSITE_SOURCE_SHA,
};
if (operation === 'prepare') {
  prepareQualificationEvidence(options);
  console.log('Prepared a fresh website qualification evidence directory.');
} else {
  const evidence = finalizeQualificationEvidence(options);
  console.log(JSON.stringify(evidence));
}
