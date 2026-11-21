import { readFileSync } from 'node:fs';
import { test, expect } from '@playwright/test';
import { platformDemoScenarios, RETIRED_DEMO_SLUGS } from '../../ui/src/services/platformDemoScenarios.js';

const origin = process.env.WEBSITE_DEMO_TEST_ORIGIN;
const revision = process.env.WEBSITE_DEMO_TEST_REVISION;
const assetBase = `/_website/${revision}`;
const source = (name) => JSON.parse(readFileSync(new URL('../../ui/public/demos/manifests/' + name, import.meta.url), 'utf8'));
const sourceIndex = source('index.json');
const viewports = [
  { name: 'mobile-320', width: 320, height: 700 },
  { name: 'mobile-390', width: 390, height: 844 },
  { name: 'tablet-768', width: 768, height: 900 },
  { name: 'desktop-1440', width: 1440, height: 1000 },
];
const fontStylesheets = new Set([
  'https://fonts.googleapis.com/css?family=Roboto%3A300%2C400%2C500%2C700&display=swap',
  'https://fonts.googleapis.com/icon?family=Material+Icons',
]);

async function jsonResource(request, route) {
  const response = await request.get(route, { maxRedirects: 0 });
  expect(response.status(), route).toBe(200);
  expect(response.headers()['content-type'], route).toContain('application/json');
  expect(response.headers()['x-marty-website-revision'], route).toBe(revision);
  return response.json();
}
async function loadDemoIndex(request) {
  const marker = await jsonResource(request, '/marty-website-release.json');
  expect(marker.source_sha).toBe(revision);
  expect(marker.revision).toBe(revision);
  expect(marker.audience).toBe('production');
  expect(marker.repository).toBe('ElevenID/website');
  const index = await jsonResource(request, assetBase + '/demos/manifests/index.json');
  expect(index).toEqual(sourceIndex);
  return index;
}
async function loadDemoManifest(request, release) {
  expect(release.stack_version).toMatch(/^\d{4}\.\d{2}\.\d+$/);
  expect(release.manifest_url).toBe(`/demos/manifests/${release.stack_version}.json`);
  const manifest = await jsonResource(request, assetBase + release.manifest_url);
  expect(manifest).toEqual(source(release.stack_version + '.json'));
  return manifest;
}
function literalPattern(value) { return new RegExp(value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')); }

async function observeBrowser(page, { consent = false } = {}) {
  const telemetry = { failures: [], pageErrors: [], consoleErrors: [], external: [], youtube: [], fontFixtures: [] };
  await page.context().route('**/*', async (route) => {
    const url = new URL(route.request().url());
    if (url.origin === origin) { await route.continue(); return; }
    const normalizedStylesheet = url.origin + url.pathname + '?' + url.searchParams.toString();
    if (!url.username && !url.password && !url.hash && fontStylesheets.has(normalizedStylesheet)) {
      telemetry.fontFixtures.push(url.href);
      // The reviewed HTML requests these two remote stylesheets. Keep the test
      // offline and qualify fallback-font layout, not Google Fonts delivery.
      await route.fulfill({ status: 200, contentType: 'text/css', body: '/* local fallback-font qualification fixture */' });
      return;
    }
    if (consent && url.origin === 'https://www.youtube-nocookie.com' && /^\/embed\/[A-Za-z0-9_-]{11}$/.test(url.pathname)) {
      telemetry.youtube.push(url.href);
      // A local response proves consent and iframe navigation, not remote playback.
      await route.fulfill({ status: 200, contentType: 'text/html', body: '<!doctype html><title>Local privacy-player response</title>' });
      return;
    }
    telemetry.external.push(url.href);
    await route.abort('blockedbyclient');
  });
  page.on('pageerror', (error) => telemetry.pageErrors.push(error.message));
  page.on('console', (message) => { if (message.type() === 'error') telemetry.consoleErrors.push(message.text()); });
  page.on('response', (response) => {
    const url = new URL(response.url());
    if (url.origin === origin && response.status() >= 400) telemetry.failures.push(`${response.status()} ${url.pathname}`);
  });
  page.on('requestfailed', (request) => {
    if (new URL(request.url()).origin === origin) telemetry.failures.push(`${request.failure()?.errorText || 'failed'} ${request.url()}`);
  });
  return telemetry;
}
function assertNoBrowserErrors(telemetry) {
  expect(telemetry.pageErrors).toEqual([]);
  expect(telemetry.consoleErrors).toEqual([]);
  expect(telemetry.failures).toEqual([]);
  expect(telemetry.external).toEqual([]);
}
async function assertStablePage(page, telemetry) {
  await expect(page.locator('[data-demo-render-state="settled"]')).toBeVisible();
  await expect(page.locator('html')).toHaveClass(/app-ready/);
  await page.evaluate(async () => {
    for (const image of document.images) {
      image.scrollIntoView({ block: 'center' });
      await new Promise((resolve) => requestAnimationFrame(resolve));
    }
    window.scrollTo(0, 0);
  });
  await expect.poll(() => page.evaluate(() => [...document.images].every((image) => image.complete && image.naturalWidth > 0))).toBe(true);
  const metrics = await page.evaluate(() => ({
    width: document.documentElement.scrollWidth, viewport: innerWidth,
    shell: getComputedStyle(document.querySelector('.app-loading-shell')).display,
    sources: [...document.images].map((image) => image.currentSrc),
  }));
  expect(metrics.width).toBeLessThanOrEqual(metrics.viewport);
  expect(metrics.shell).toBe('none');
  for (const source of metrics.sources) {
    expect(new URL(source).origin).toBe(origin);
    expect(new URL(source).pathname.startsWith(assetBase + '/')).toBe(true);
  }
  assertNoBrowserErrors(telemetry);
}

for (const viewport of viewports) {
  test(`${viewport.name} renders catalog and scenario without overflow or first-paint failure`, async ({ page }) => {
    const index = await loadDemoIndex(page.request);
    const selected = index.latest_approved_stack_version || index.latest_available_stack_version;
    const release = index.releases.find(({ stack_version }) => stack_version === selected);
    expect(release).toBeTruthy();
    const manifest = await loadDemoManifest(page.request, release);
    const active = platformDemoScenarios(manifest.scenarios);
    const scenario = active.find(({ state, youtube_id }) => state === 'PUBLIC' && youtube_id) || active[0];
    expect(scenario).toBeTruthy();
    await page.setViewportSize({ width: viewport.width, height: viewport.height });
    await page.addInitScript(() => {
      window.__elevenIdFirstPaint = [];
      const sample = () => {
        const root = document.querySelector('#root');
        const shell = document.querySelector('.app-loading-shell');
        if (root && shell) window.__elevenIdFirstPaint.push({
          ready: document.documentElement.classList.contains('app-ready'),
          rootVisibility: getComputedStyle(root).visibility, shellDisplay: getComputedStyle(shell).display,
        });
        if (performance.now() < 1800) requestAnimationFrame(sample);
      };
      requestAnimationFrame(sample);
    });
    const telemetry = await observeBrowser(page);
    const response = await page.goto('/demos', { waitUntil: 'domcontentloaded' });
    expect(response.status()).toBe(200);
    await expect(page.getByRole('heading', { level: 1, name: manifest.release_name })).toBeVisible();
    await expect(page.getByText('ElevenID LLC Credential Platform', { exact: true })).toBeVisible();
    await expect(page.getByText(`Version v${manifest.stack_version}`, { exact: true })).toBeVisible();
    await expect(page.getByText(`Implements MIP ${manifest.mip_version}`)).toBeVisible();
    await expect(page.getByRole('combobox', { name: 'Platform version' })).toContainText(`v${manifest.stack_version}`);
    await expect(page.getByText(/vendor approval is not a publication requirement/i)).toBeVisible();
    await expect(page.getByRole('link', { name: 'request review or removal' })).toHaveAttribute('href', /sales@elevenidllc\.com/);
    if (manifest.publication_state === 'DRAFT') await expect(page.getByText(/publication preview/)).toBeVisible();
    for (const slug of RETIRED_DEMO_SLUGS) await expect(page.locator(`a[href$="/${slug}"]`)).toHaveCount(0);
    await assertStablePage(page, telemetry);
    const samples = await page.evaluate(() => window.__elevenIdFirstPaint);
    expect(samples.length).toBeGreaterThan(0);
    expect(samples.filter((sample) => !sample.ready).every((sample) => sample.rootVisibility === 'hidden' && sample.shellDisplay !== 'none')).toBe(true);
    await page.screenshot({ path: test.info().outputPath(`${viewport.name}-catalog.png`), fullPage: true });
    await page.getByRole('link', { name: literalPattern(scenario.title) }).click();
    await expect(page.getByRole('heading', { level: 1, name: scenario.title })).toBeVisible();
    await expect(page.getByTestId('demo-video-player')).toBeVisible();
    await expect(page.locator('iframe[src*="youtube"]')).toHaveCount(0);
    await expect(page.getByRole('heading', { level: 2, name: 'Transcript' })).toBeVisible();
    await assertStablePage(page, telemetry);
    await page.screenshot({ path: test.info().outputPath(`${viewport.name}-scenario.png`), fullPage: true });
  });
}

test('every retained scenario has a canonical detail and valid poster while retired routes return Gone', async ({ page }) => {
  const telemetry = await observeBrowser(page);
  const index = await loadDemoIndex(page.request);
  for (const release of index.releases) {
    const manifest = await loadDemoManifest(page.request, release);
    const active = platformDemoScenarios(manifest.scenarios);
    for (const scenario of active) {
      const route = `/demos/${manifest.stack_version}/${scenario.slug}`;
      expect((await page.goto(route)).status()).toBe(200);
      await expect(page.getByRole('heading', { level: 1, name: scenario.title })).toBeVisible();
      await expect(page.locator('link[rel="canonical"]')).toHaveAttribute('href', `https://elevenidllc.com${route}`);
      await expect(page.getByTestId('demo-video-player').locator('img')).toHaveAttribute('src', assetBase + scenario.poster.src);
      await assertStablePage(page, telemetry);
    }
    // Expected410 responses are checked outside page telemetry, never excused
    // as failures from active pages or resources.
    for (const scenario of manifest.scenarios.filter((entry) => !active.includes(entry))) {
      for (const version of [manifest.stack_version, 'latest']) {
        const response = await page.request.get(`/demos/${version}/${scenario.slug}`, { maxRedirects: 0 });
        expect(response.status()).toBe(410);
        const body = await response.text();
        expect(body).not.toContain('youtube-nocookie.com');
        expect(body).not.toContain('data-testid="demo-video-player"');
        expect(body).not.toContain('<iframe');
      }
    }
  }
  assertNoBrowserErrors(telemetry);
});

test('historical public videos wait for consent and use a local privacy-enhanced player response', async ({ page }) => {
  const index = await loadDemoIndex(page.request);
  const telemetry = await observeBrowser(page, { consent: true });
  let checked = 0;
  for (const release of index.releases) {
    const manifest = await loadDemoManifest(page.request, release);
    for (const scenario of platformDemoScenarios(manifest.scenarios).filter(({ state, youtube_id }) => state === 'PUBLIC' && youtube_id)) {
      const before = telemetry.youtube.length;
      await page.goto(`/demos/${manifest.stack_version}/${scenario.slug}`);
      const loadButton = page.getByRole('button', { name: `Load ${scenario.title} from YouTube` });
      await expect(loadButton).toBeVisible();
      await expect(page.locator('iframe[src*="youtube"]')).toHaveCount(0);
      expect(telemetry.youtube.length).toBe(before);
      await loadButton.click();
      const player = page.getByTitle(`${scenario.title} video`);
      await expect(player).toHaveAttribute('src', new RegExp(`^https://www\\.youtube-nocookie\\.com/embed/${scenario.youtube_id}\\?`));
      await expect(player).toHaveAttribute('src', /cc_load_policy=1/);
      await expect.poll(() => telemetry.youtube.length).toBeGreaterThan(before);
      await expect(player.contentFrame().locator('title')).toHaveText('Local privacy-player response');
      const chapter = scenario.chapters.find(({ start_seconds }) => start_seconds > 0);
      if (chapter) {
        await page.getByRole('button', { name: literalPattern(chapter.title) }).click();
        await expect(player).toHaveAttribute('src', new RegExp(`(?:\\?|&)start=${chapter.start_seconds}(?:&|$)`));
        await expect(player.contentFrame().locator('title')).toHaveText('Local privacy-player response');
      }
      checked++;
    }
  }
  expect(checked).toBeGreaterThan(0);
  assertNoBrowserErrors(telemetry);
});
