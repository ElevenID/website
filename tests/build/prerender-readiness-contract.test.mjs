import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

const source = readFileSync(new URL('../../scripts/prerender-website.mjs', import.meta.url), 'utf8');

test('production prerender accepts explicit app-ready fallback without weakening the readiness contract', () => {
  assert.match(source, /data-website-render-source/);
  assert.match(source, /app-ready-fallback/);
  assert.match(source, /data-app-loading/);
  assert.match(source, /#root h1/);
  assert.match(source, /readinessCounts/);
  assert.match(source, /}, 25000\\);/);
  assert.match(source, /--run-all-compositor-stages-before-draw/);
  assert.match(source, /--virtual-time-budget=45000/);
  assert.match(source, /htmlElement\.removeAttribute\('data-website-render-source'\)/);
  assert.doesNotMatch(source, /readiness !== 'true'.*app-rendered was not observed/s);
});
