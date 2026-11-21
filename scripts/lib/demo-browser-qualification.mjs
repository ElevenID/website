// Website-only rendering evidence. This cannot approve recordings, authenticate
// product evidence, or establish YouTube playback or a live deployment.
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { lstatSync, mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { websiteBuildRevision, websiteBuildSelection } from '../../ui/scripts/web-surface-build-contract.mjs';

export const DEMO_BROWSER_TEST_TITLES = Object.freeze([
  ...['mobile-320', 'mobile-390', 'tablet-768', 'desktop-1440'].map((viewport) =>
    `${viewport} renders catalog and scenario without overflow or first-paint failure`),
  'every retained scenario has a canonical detail and valid poster while retired routes return Gone',
  'historical public videos wait for consent and use a local privacy-enhanced player response',
]);

export function validateDemoBrowserTemporaryRoot(directory) {
  assert.ok(path.isAbsolute(directory) && Buffer.byteLength(directory, 'utf8') <= 40,
    'Chromium needs a short absolute temporary root for its Unix sockets');
  assert.equal(realpathSync(directory), directory, 'Chromium temporary root cannot contain symlinks');
  assert.ok(lstatSync(directory).isDirectory(), 'Chromium temporary root must be a directory');
  return directory;
}

export function validateDemoBrowserReport(report) {
  assert.ok(report && typeof report === 'object' && !Array.isArray(report), 'Demo browser report is required');
  assert.deepEqual(report.errors || [], [], 'Demo browser execution reported errors');
  assert.equal(report.stats?.expected, 6, 'All six transferred demo browser checks must pass');
  for (const key of ['unexpected', 'flaky', 'skipped']) assert.equal(report.stats?.[key], 0, 'Demo browser checks cannot fail, retry, or skip');
  const tests = [];
  const titles = [];
  function visit(suite) {
    for (const spec of suite.specs || []) {
      assert.equal(spec.file, 'demo-platform.spec.mjs', 'Demo browser evidence came from another test file');
      titles.push(spec.title);
      for (const test of spec.tests || []) tests.push(test);
    }
    for (const child of suite.suites || []) visit(child);
  }
  for (const suite of report.suites || []) visit(suite);
  assert.deepEqual(titles.slice().sort(), [...DEMO_BROWSER_TEST_TITLES].sort(), 'Demo browser behaviors were replaced or duplicated');
  assert.equal(tests.length, 6, 'Demo browser report has an unexpected test count');
  for (const test of tests) {
    assert.equal(test.projectName, 'website-demo', 'Demo browser project identity changed');
    assert.equal(test.projectId, 'website-demo', 'Demo browser project identity changed');
    assert.equal(test.expectedStatus, 'passed', 'Demo browser check cannot be marked as an expected failure');
    assert.equal(test.status, 'expected', 'Demo browser check did not pass normally');
    assert.equal(test.results?.length, 1, 'Demo browser check must execute exactly once');
    assert.equal(test.results[0].status, 'passed', 'Demo browser check did not execute successfully');
    assert.equal(test.results[0].retry, 0, 'Demo browser check was retried');
  }
  return { executed: 6, passed: 6, skipped: 0, retried: 0 };
}

export function demoBrowserBuildSelection(env = process.env) {
  const pages = env.WEBSITE_DEMO_TEST_PAGES || 'public';
  const sourceSha = env.WEBSITE_DEMO_TEST_SOURCE_SHA
    || (pages === 'public' ? env.WEBSITE_DEMO_TEST_REVISION : undefined);
  assert.ok(typeof sourceSha === 'string' && sourceSha.length === 40, 'Demo browser requires an exact website source');
  return websiteBuildSelection({ MARTY_WEBSITE_SOURCE_SHA: sourceSha, MARTY_PRODUCTION_PAGES: pages,
    MARTY_COMMERCE_SOURCE_SHA: env.WEBSITE_DEMO_TEST_COMMERCE_SHA,
    MARTY_WEBSITE_REVISION: env.WEBSITE_DEMO_TEST_REVISION });
}

export function qualifyDemoBrowser({ root, origin, sourceSha, revision, pages = 'public', commerceSha,
  imageId, chrome = process.env.CHROME_PATH }) {
  assert.equal(realpathSync(root), root, 'Demo browser root must be the actual website checkout');
  assert.match(origin || '', /^http:\/\/127\.0\.0\.1:[1-9][0-9]*$/, 'Demo browser may only target the owned loopback container');
  const port = Number(new URL(origin).port);
  assert.ok(port > 0 && port <= 65535, 'Demo browser loopback port is invalid');
  assert.match(sourceSha || '', /^[a-f0-9]{40}$/, 'Demo browser source must be exact');
  assert.equal(revision, websiteBuildRevision({ sourceSha, pages, commerceSha }), 'Demo browser revision must match selected sources');
  assert.match(imageId || '', /^sha256:[a-f0-9]{64}$/, 'Demo browser image must be immutable');
  assert.ok(chrome && path.isAbsolute(chrome), 'An installed CHROME_PATH is required');
  assert.ok(process.getuid?.() !== 0, 'Sandboxed demo browser qualification requires a non-root user');
  const evidenceRoot = path.join(root, '.demo-browser');
  mkdirSync(evidenceRoot, { recursive: true, mode: 0o700 });
  assert.ok(lstatSync(evidenceRoot).isDirectory() && !lstatSync(evidenceRoot).isSymbolicLink(), 'Demo browser output cannot be redirected');
  const directory = mkdtempSync(path.join(evidenceRoot, 'run-'));
  mkdirSync(path.join(directory, 'home'), { mode: 0o700 });
  // Chromium uses Unix-domain sockets inside its profile: keep this owned path
  // short even when the checkout/evidence destination is deeply nested.
  // The supported production qualification host is Linux. An inherited long
  // TMPDIR must not silently defeat Chromium's Unix-domain socket limit.
  const temporary = mkdtempSync(path.join(validateDemoBrowserTemporaryRoot('/tmp'), 'wdb-'));
  const env = {
    PATH: process.env.PATH, HOME: path.join(directory, 'home'), TMPDIR: temporary,
    LANG: 'C.UTF-8', TZ: 'UTC', CI: 'true', CHROME_PATH: chrome,
    PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD: '1',
    WEBSITE_DEMO_TEST_ORIGIN: origin, WEBSITE_DEMO_TEST_REVISION: revision,
    WEBSITE_DEMO_TEST_SOURCE_SHA: sourceSha, WEBSITE_DEMO_TEST_PAGES: pages,
    ...(pages === 'full' ? { WEBSITE_DEMO_TEST_COMMERCE_SHA: commerceSha } : {}),
    WEBSITE_DEMO_BROWSER_OUTPUT_DIR: directory,
  };
  let result;
  try {
    result = spawnSync(process.execPath, [path.join(root, 'node_modules/@playwright/test/cli.js'),
      'test', '--config', path.join(root, 'tests/playwright.demo-platform.config.mjs')], {
      cwd: root, env, encoding: 'utf8', timeout: 500_000, maxBuffer: 4 * 1024 * 1024,
      stdio: ['ignore', 'pipe', 'pipe'],
    });
  } finally { rmSync(temporary, { recursive: true, force: true }); }
  writeFileSync(path.join(directory, 'stdout.log'), result.stdout || '', { flag: 'wx', mode: 0o600 });
  writeFileSync(path.join(directory, 'stderr.log'), result.stderr || '', { flag: 'wx', mode: 0o600 });
  if (result.stdout) process.stdout.write(result.stdout);
  if (result.stderr) process.stderr.write(result.stderr);
  assert.equal(result.error, undefined, result.error?.message);
  assert.equal(result.status, 0, 'Demo browser qualification failed; inspect ' + path.relative(root, directory));
  const bytes = readFileSync(path.join(directory, 'report.json'));
  const counts = validateDemoBrowserReport(JSON.parse(bytes));
  const summary = {
    ...counts, source_sha: sourceSha, revision, local_image_id: imageId,
    ...(pages === 'full' ? { production_pages: 'full',
      commerce_extension: { repository: 'ElevenID/marty-subscriptions', source_sha: commerceSha } } : {}),
    chromium_sandbox: true,
    report: path.relative(root, path.join(directory, 'report.json')).split(path.sep).join('/'),
    report_sha256: 'sha256:' + createHash('sha256').update(bytes).digest('hex'),
    external_network: false, youtube_response: 'local-fixture',
    font_stylesheets: 'two-reviewed-local-empty-css-fixtures', font_layout: 'system-fallback',
    recorded_demo_proof_verified: false, product_evidence_authenticated: false,
    youtube_playback_verified: false, live_deployment_verified: false,
  };
  writeFileSync(path.join(directory, 'summary.json'), JSON.stringify(summary, null, 2) + '\n', { flag: 'wx', mode: 0o600 });
  return summary;
}
