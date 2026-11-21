import assert from 'node:assert/strict';
import path from 'node:path';
import { defineConfig } from '@playwright/test';

const origin = process.env.WEBSITE_DEMO_TEST_ORIGIN;
assert.match(origin || '', /^http:\/\/127\.0\.0\.1:[1-9][0-9]*$/, 'Demo browser tests require the owned loopback Nginx origin');
assert.match(process.env.WEBSITE_DEMO_TEST_REVISION || '', /^[a-f0-9]{40}$/, 'Demo browser tests require an exact website revision');
const executablePath = process.env.CHROME_PATH;
assert.ok(executablePath && path.isAbsolute(executablePath), 'CHROME_PATH must identify the installed browser');
const evidence = process.env.WEBSITE_DEMO_BROWSER_OUTPUT_DIR;
assert.ok(evidence && path.isAbsolute(evidence), 'Demo browser evidence needs an owned absolute destination');

export default defineConfig({
  testDir: './browser',
  testMatch: 'demo-platform.spec.mjs',
  timeout: 120_000,
  globalTimeout: 480_000,
  expect: { timeout: 15_000 },
  retries: 0,
  workers: 1,
  fullyParallel: false,
  forbidOnly: true,
  projects: [{ name: 'website-demo' }],
  outputDir: path.join(evidence, 'results'),
  reporter: [['list'], ['json', { outputFile: path.join(evidence, 'report.json') }]],
  use: {
    baseURL: origin,
    browserName: 'chromium',
    headless: true,
    serviceWorkers: 'block',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'off',
    launchOptions: {
      executablePath,
      // Qualify as the supported non-root user. Never fall back to --no-sandbox.
      chromiumSandbox: true,
      args: [
        '--disable-background-networking', '--disable-component-update', '--no-first-run',
        '--host-resolver-rules=MAP * ~NOTFOUND, EXCLUDE 127.0.0.1',
      ],
    },
  },
});
