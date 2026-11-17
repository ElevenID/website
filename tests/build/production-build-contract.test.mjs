import '../../ui/scripts/production-build-contract.test.mjs';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { build } from 'vite';
import { productionBuildContract, productionBuildContractPlugin } from '../../ui/scripts/production-build-contract.mjs';

const sourceSha = 'a'.repeat(40);

async function fixture(t, application) {
  const root = await mkdtemp(path.join(tmpdir(), 'website-commerce-build-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  await mkdir(path.join(root, 'src'));
  await writeFile(path.join(root, 'src/extension.jsx'), 'export const commerceExtensionEnabled = true;\n');
  await writeFile(path.join(root, 'src/website.jsx'), 'export const commerceExtensionEnabled = "fixture-commerce-adapter";\n');
  await writeFile(path.join(root, 'commerce-source.json'), JSON.stringify({
    repository: 'ElevenID/marty-subscriptions', source_sha: sourceSha,
  }));
  const entry = productionBuildContract({
    pages: 'full', surface: 'website', extensionPath: path.join(root, 'src/extension.jsx'), sourceSha,
  });
  await writeFile(path.join(root, 'main.js'), application);
  return { root, entry };
}

async function compile({ root, entry }) {
  return build({
    configFile: false, root, publicDir: false, logLevel: 'silent',
    plugins: [productionBuildContractPlugin(entry)],
    build: {
      outDir: path.join(root, 'dist'), emptyOutDir: true, minify: false,
      sourcemap: false, reportCompressedSize: false,
      rolldownOptions: { input: path.join(root, 'main.js') },
    },
  });
}

for (const [kind, application] of [
  ['static', 'import { commerceExtensionEnabled } from "./src/website.jsx"; console.log(commerceExtensionEnabled);\n'],
  ['lazy', 'import("./src/website.jsx").then(({ commerceExtensionEnabled }) => console.log(commerceExtensionEnabled));\n'],
]) {
  test(`actual Vite ${kind} output retains the exact declared commerce adapter`, async (t) => {
    const context = await fixture(t, application);
    const result = await compile(context);
    const chunks = (Array.isArray(result) ? result : [result]).flatMap((item) => item.output)
      .filter((item) => item.type === 'chunk');
    assert.ok(chunks.some((chunk) => Object.keys(chunk.modules).includes(context.entry)));
    assert.ok(chunks.some((chunk) => chunk.code.includes('fixture-commerce-adapter')));
    for (const chunk of chunks) {
      assert.equal(await readFile(path.join(context.root, 'dist', chunk.fileName), 'utf8'), chunk.code);
    }
  });
}

test('actual Vite output cannot claim a commerce adapter that was never imported', async (t) => {
  const context = await fixture(t, 'console.log("public-fixture-only");\n');
  await assert.rejects(compile(context), /Full production output omitted its commerce extension/);
});
