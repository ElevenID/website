import assert from 'node:assert/strict';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { educationContentBoundaryPlugin } from './fixtures/education-content-boundaries.mjs';

const root = new URL('../', import.meta.url);
const absolute = (path) => fileURLToPath(new URL(path, root));
const page = (name) => absolute(`ui/src/components/${name}.jsx`);
const resolve = educationContentBoundaryPlugin().resolveId;

test('education fixtures are restricted to the three reviewed page importers', () => {
  for (const name of ['IdentityGuidePage', 'ProtocolPage', 'StandardsPage']) {
    assert.equal(resolve('../data/marketingContent', page(name)), absolute('tests/fixtures/education-marketing-data.mjs'));
    assert.equal(resolve('./diagrams', page(name)), absolute('tests/fixtures/education-diagram-boundary.jsx'));
    assert.equal(resolve('@mui/material', page(name)), null);
  }
  assert.equal(resolve('@elevenid/marty-blog', page('ProtocolPage')), absolute('tests/fixtures/education-blog-data.mjs'));
});

test('unexpected production inputs from a reviewed education page fail before loading', () => {
  for (const source of ['../data/marketingContent.js', './diagrams/Unexpected.svg', '@elevenid/another-package']) {
    assert.throws(() => resolve(source, page('ProtocolPage') + '?test'), /Unlisted education page boundary/);
  }
  assert.throws(() => resolve('@elevenid/marty-blog', page('IdentityGuidePage')), /Unlisted education page boundary/);
});

test('education fixture mapping leaves other callers and ordinary runtime imports alone', () => {
  assert.equal(resolve('../data/marketingContent', page('UnreviewedPage')), null);
  assert.equal(resolve('./diagrams', undefined), null);
  assert.equal(resolve('../application/routing/useSurfaceNavigate', page('ProtocolPage')), null);
  assert.equal(resolve('../application/routing/publicEntry', page('ProtocolPage')), null);
});
