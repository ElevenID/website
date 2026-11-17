import assert from 'node:assert/strict';
import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { test } from 'node:test';
import { muiIconMjsCompatibilityPlugin } from '../../ui/scripts/mui-icon-compatibility.mjs';

async function fixture(t, names) {
  const root = await mkdtemp(path.join(tmpdir(), 'elevenid-icon-resolution-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  const iconsRoot = path.join(root, '@mui', 'icons-material');
  await mkdir(iconsRoot, { recursive: true });
  for (const name of names) await writeFile(path.join(iconsRoot, name), 'export default null;\n');
  return { plugin: muiIconMjsCompatibilityPlugin(root), iconsRoot };
}

test('legacy icon imports resolve to existing mjs files before renamed fallbacks', async (t) => {
  const { plugin, iconsRoot } = await fixture(t, ['Verified.mjs', 'ErrorOutline.mjs', 'ErrorOutlined.mjs']);
  assert.equal(plugin.resolveId('@mui/icons-material/Verified.js'), path.join(iconsRoot, 'Verified.mjs'));
  assert.equal(plugin.resolveId('@mui/icons-material/ErrorOutline.js'), path.join(iconsRoot, 'ErrorOutline.mjs'));
});

test('missing Outline icon entries use the existing Outlined replacement', async (t) => {
  const { plugin, iconsRoot } = await fixture(t, ['ErrorOutlined.mjs']);
  assert.equal(plugin.resolveId('@mui/icons-material/ErrorOutline.js'), path.join(iconsRoot, 'ErrorOutlined.mjs'));
  assert.equal(plugin.resolveId('@mui/icons-material/ErrorOutlineRounded.js'), null);
});

test('modern, unrelated and missing imports remain available to the normal resolver', async (t) => {
  const { plugin } = await fixture(t, ['Verified.mjs']);
  for (const source of [
    '@mui/icons-material/Verified', '@mui/icons-material/Verified.mjs',
    '@mui/icons-material-other/Verified.js', '@mui/material/Button.js',
    './Verified.js', '@mui/icons-material/Missing.js',
  ]) assert.equal(plugin.resolveId(source), null, source);
});
