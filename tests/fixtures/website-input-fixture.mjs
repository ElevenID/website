import { mkdtemp, mkdir, readFile, writeFile, copyFile, symlink, chmod, rm } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const repositoryRoot = fileURLToPath(new URL('../../', import.meta.url));
export const inputSourceSha = 'c'.repeat(40);
const require = createRequire(import.meta.url);

export async function writeInput(root, relative, content) {
  const filename = path.join(root, relative);
  await mkdir(path.dirname(filename), { recursive: true });
  await writeFile(filename, typeof content === 'string' ? content : `${JSON.stringify(content, null, 2)}\n`);
  return filename;
}

export async function inputFixture(t) {
  const root = await mkdtemp(path.join(tmpdir(), 'website inputs '));
  t.after(() => rm(root, { recursive: true, force: true }));
  for (const relative of ['ui/scripts/generate-demo-manifest-module.mjs', 'ui/scripts/generated-text.mjs',
    'ui/src/generated/demoWalletSchema.generated.json']) {
    await mkdir(path.dirname(path.join(root, relative)), { recursive: true });
    await copyFile(path.join(repositoryRoot, relative), path.join(root, relative));
  }
  await writeInput(root, 'package.json', { private: true, type: 'module' });
  const index = {
    schema_version: 2, latest_approved_stack_version: null, latest_available_stack_version: '2026.08.0',
    releases: [
      { stack_version: '2026.08.0', mip_version: '0.5.0', publication_state: 'DRAFT', coverage_state: 'PARTIAL' },
      { stack_version: '2026.07.0', mip_version: '0.3.1', publication_state: 'DRAFT', coverage_state: 'PARTIAL' },
    ],
  };
  await writeInput(root, 'ui/public/demos/manifests/index.json', index);
  for (const release of index.releases) {
    await writeInput(root, `ui/public/demos/manifests/${release.stack_version}.json`, {
      ...release, title: 'Synthetic release — not production evidence', scenarios: [{ title: 'A < B & C', result: 'NOT_RUN' }],
    });
  }
  return { root, index, ui: path.join(root, 'ui'),
    module: path.join(root, 'ui/src/generated/demoManifests.generated.js'),
    schema: path.join(root, 'ui/src/generated/demoWalletSchema.generated.json') };
}

export function generator(fixture, args = []) {
  return spawnSync(process.execPath, [path.join(fixture.ui, 'scripts/generate-demo-manifest-module.mjs'), ...args],
    { encoding: 'utf8', timeout: 15_000, maxBuffer: 64 * 1024 });
}

export async function sourceSchema(fixture) {
  const projected = JSON.parse(await readFile(fixture.schema, 'utf8'));
  const { $defs, ...items } = projected;
  await writeInput(fixture.root, 'deploy-config/schemas/stack-demo-manifest.schema.json', {
    $defs: { stringList: $defs.stringList, scenario: { properties: { wallets: { items } } } },
  });
  return projected;
}

export async function buildFixture(t, { pruningBoundary = true } = {}) {
  const fixture = await inputFixture(t);
  const built = generator(fixture);
  if (built.status !== 0) throw new Error(built.stderr);
  await copyFile(path.join(repositoryRoot, 'ui/scripts/build-web-surface.mjs'), path.join(fixture.ui, 'scripts/build-web-surface.mjs'));
  // Source preservation imports this application-only module at evaluation time.
  // The named boundary makes that original script runnable for comparison; the
  // website adaptation must also work when the boundary is entirely absent.
  if (pruningBoundary) await writeInput(fixture.root, 'ui/scripts/prune-selfhost-dist.mjs',
    'export function pruneSelfhostDist() { throw new Error("application pruning must not execute"); }\n');
  await writeInput(fixture.root, 'ui/tsconfig.build.json', { compilerOptions: { noEmit: true }, include: ['main.js'] });
  await writeInput(fixture.root, 'ui/main.js',
    'import { DEMO_INDEX, DEMO_MANIFESTS } from "./src/generated/demoManifests.generated.js"; console.log(DEMO_INDEX, DEMO_MANIFESTS);\n');
  await writeInput(fixture.root, 'ui/index.html', '<!doctype html><title>Build input fixture</title><script type="module" src="/main.js"></script>');
  const contract = new URL('../../ui/scripts/web-surface-build-contract.mjs', import.meta.url).href;
  await writeInput(fixture.root, 'ui/vite.config.mjs', `import { appendFileSync } from 'node:fs';
import { webSurfaceBuildContractPlugin } from ${JSON.stringify(contract)};
export default { publicDir: false, logLevel: 'silent', plugins: [
 { name: 'fixture-build-observer', buildStart() { appendFileSync(process.env.FIXTURE_TRACE, 'vite\\n');
   if (process.env.FIXTURE_VITE_FAIL) throw new Error('fixture Vite failure'); } },
 webSurfaceBuildContractPlugin({ sourceSha: process.env.MARTY_WEBSITE_SOURCE_SHA, surface: process.env.MARTY_UI_SURFACE })
], build: { outDir: 'dist-website', emptyOutDir: true, minify: false, reportCompressedSize: false } };\n`);
  const tsc = await writeInput(fixture.root, 'node_modules/typescript/bin/tsc', `#!/usr/bin/env node
const fs = require('node:fs');
fs.appendFileSync(process.env.FIXTURE_TRACE, JSON.stringify({ stage: 'typecheck', args: process.argv.slice(2),
 cwd: process.cwd(), surface: process.env.MARTY_UI_SURFACE, source: process.env.MARTY_WEBSITE_SOURCE_SHA }) + '\\n');
process.exit(Number(process.env.FIXTURE_TSC_STATUS || 0));\n`);
  await writeInput(fixture.root, 'node_modules/typescript/package.json', { name: 'typescript', type: 'commonjs' });
  await chmod(tsc, 0o755);
  const vite = path.dirname(require.resolve('vite/package.json'));
  await symlink(vite, path.join(fixture.root, 'node_modules/vite'), 'dir');
  await mkdir(path.join(fixture.ui, 'node_modules/.bin'), { recursive: true });
  await symlink(tsc, path.join(fixture.ui, 'node_modules/.bin/tsc'));
  await symlink(path.join(vite, 'bin/vite.js'), path.join(fixture.ui, 'node_modules/.bin/vite'));
  fixture.trace = path.join(fixture.root, 'stages.log');
  return fixture;
}

export function builder(fixture, { args = ['website'], env = {} } = {}) {
  return spawnSync(process.execPath, [path.join(fixture.ui, 'scripts/build-web-surface.mjs'), ...args], {
    cwd: fixture.root, encoding: 'utf8', timeout: 30_000, maxBuffer: 64 * 1024,
    env: { ...process.env, MARTY_UI_SURFACE: '', VITE_UI_VARIANT: '', MARTY_WEBSITE_SOURCE_SHA: inputSourceSha,
      MARTY_WEBSITE_ALLOW_DEVELOPMENT: '', FIXTURE_TRACE: fixture.trace, FIXTURE_TSC_STATUS: '', FIXTURE_VITE_FAIL: '', ...env },
  });
}
