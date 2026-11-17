import { spawnSync } from 'node:child_process';
import { existsSync, lstatSync } from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const uiRoot = fileURLToPath(new URL('../', import.meta.url));
const repositoryRoot = path.resolve(uiRoot, '..');
const require = createRequire(path.join(repositoryRoot, 'package.json'));
const args = process.argv.slice(2);
if (args.length !== 1 || args[0] !== 'website') throw new Error('Expected the website surface only');
if (process.env.MARTY_UI_SURFACE && process.env.MARTY_UI_SURFACE !== 'website') {
  throw new Error('This repository only builds the website surface');
}
if (process.env.VITE_UI_VARIANT === 'selfhost') throw new Error('Production surfaces cannot use the customer variant');
const sourceSha = process.env.MARTY_WEBSITE_SOURCE_SHA;
if (!(sourceSha?.length === 40 && /^[a-f0-9]{40}$/.test(sourceSha))
    && !(sourceSha === 'development' && process.env.MARTY_WEBSITE_ALLOW_DEVELOPMENT === 'true')) {
  throw new Error('An exact MARTY_WEBSITE_SOURCE_SHA or explicit development build is required');
}

function requiredFile(filename, label) {
  if (!existsSync(filename) || !lstatSync(filename).isFile() || lstatSync(filename).isSymbolicLink()) {
    throw new Error(`Website build prerequisite missing: ${label}`);
  }
  return filename;
}
function packageBinary(modulePath, label) {
  try { return requiredFile(require.resolve(modulePath), label); }
  catch { throw new Error(`Website build prerequisite missing: ${label}`); }
}

// All prerequisites are checked before generation or build output is written.
// The complete production configuration and TypeScript package remain required;
// this runner never silently skips their stages in a partial extraction.
const generator = requiredFile(path.join(uiRoot, 'scripts/generate-demo-manifest-module.mjs'), 'demo generator');
requiredFile(path.join(uiRoot, 'tsconfig.build.json'), 'tsconfig.build.json');
const configNames = ['vite.config.ts', 'vite.config.mts', 'vite.config.js', 'vite.config.mjs'];
const configs = configNames.filter((name) => existsSync(path.join(uiRoot, name)));
if (configs.length !== 1) throw new Error('Website build requires exactly one Vite configuration');
const config = requiredFile(path.join(uiRoot, configs[0]), configs[0]);
const tsc = packageBinary('typescript/bin/tsc', 'TypeScript');
const vitePackage = packageBinary('vite/package.json', 'Vite');
const vite = requiredFile(path.join(path.dirname(vitePackage), 'bin/vite.js'), 'Vite CLI');
const env = { ...process.env, MARTY_UI_SURFACE: 'website', MARTY_WEBSITE_SOURCE_SHA: sourceSha };

function run(script, arguments_) {
  const result = spawnSync(process.execPath, [script, ...arguments_], { cwd: uiRoot, env, stdio: 'inherit', shell: false });
  if (result.error) throw result.error;
  if (result.status !== 0) process.exit(result.status ?? 1);
}

run(generator, ['--check']);
run(tsc, ['-p', 'tsconfig.build.json']);
run(vite, ['build', '--config', config]);
