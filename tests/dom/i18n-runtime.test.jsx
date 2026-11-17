import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const assetBase = '/_website/0123456789abcdef0123456789abcdef01234567/';
const requests = [];
let testInstance;
let initialization;
async function initialize() {
  const { default: instance } = await import('../../ui/src/i18n/index.js');
  expect(instance).toBe(testInstance);
  expect(initialization?.then).toBeTypeOf('function');
  await initialization;
  return instance;
}
beforeEach(async () => {
  vi.resetModules();
  initialization = undefined;
  requests.length = 0;
  delete window.__MARTY_RUNTIME_CONFIG__;
  window.history.replaceState(null, '', '/product');
  window.localStorage.clear();
  document.cookie = 'i18nextLng=; Max-Age=0; path=/';
  document.documentElement.lang = 'en';
  vi.stubGlobal('fetch', vi.fn(async (input) => {
    const url = new URL(typeof input === 'string' ? input : input.url, window.location.href);
    requests.push(url.pathname);
    const language = url.pathname.split('/').at(-2);
    return { ok: true, status: 200, text: async () => JSON.stringify({
      home: 'Home ' + language, welcome: 'Hello {{name, uppercase}}',
      lowercase: 'Hello {{name, lowercase}}',
      eventDate: 'Date {{value, date}}',
      passthrough: 'Value {{value, unchanged}}',
    }) };
  }));
  // External packages can retain their singleton across resetModules(). Supply a
  // fresh real instance, then await the actual init promise instead of a flag.
  const actual = await vi.importActual('i18next');
  testInstance = actual.createInstance();
  const init = testInstance.init.bind(testInstance);
  vi.spyOn(testInstance, 'init').mockImplementation((...args) => {
    initialization = init(...args);
    return initialization;
  });
  vi.doMock('i18next', () => ({ ...actual, default: testInstance }));
});
afterEach(() => {
  vi.doUnmock('i18next');
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  delete window.__MARTY_RUNTIME_CONFIG__;
  window.localStorage.clear();
  document.cookie = 'i18nextLng=; Max-Age=0; path=/';
});

describe('website i18n initialization with the actual HTTP backend', () => {
  it('loads only common and marketing resources from the immutable asset base', async () => {
    const instance = await initialize();
    expect(instance.options.ns).toEqual(['common', 'marketing']);
    expect(instance.options.react.useSuspense).toBe(false);
    expect(requests.length).toBeGreaterThan(0);
    expect(requests.every((url) => url.startsWith(assetBase + 'locales/'))).toBe(true);
    expect([...new Set(requests.map((url) => url.split('/').at(-1)))].sort())
      .toEqual(['common.json', 'marketing.json']);
    expect(instance.t('home')).toBe('Home en');
    expect(instance.t('welcome', { name: 'Ada' })).toBe('Hello ADA');
    expect(instance.t('lowercase', { name: 'Ada' })).toBe('Hello ada');
    expect(instance.t('passthrough', { value: 'MiXeD' })).toBe('Value MiXeD');
  });

  it('honors the language query before stored preferences and caches the result', async () => {
    window.history.replaceState(null, '', '/product?lng=fr');
    window.localStorage.setItem('i18nextLng', 'ja');
    document.cookie = 'i18nextLng=de; path=/';
    const instance = await initialize();
    expect(instance.language).toBe('fr');
    expect(instance.t('home')).toBe('Home fr');
    // The existing Date fallback formats in the selected locale even when the
    // format name is not a built-in i18next format. Local noon avoids UTC drift.
    expect(instance.t('eventDate', { value: new Date(2026, 0, 15, 12) }))
      .toBe('Date 15/01/2026');
    expect(window.localStorage.getItem('i18nextLng')).toBe('fr');
  });

  it('does not read or change persistent preferences on public-entry aliases', async () => {
    window.__MARTY_RUNTIME_CONFIG__ = { hosting: {
      canonicalOrigin: 'https://elevenidllc.com', publicEntryOrigins: [window.location.origin],
    } };
    window.localStorage.setItem('i18nextLng', 'ja');
    document.cookie = 'i18nextLng=de; path=/';
    const instance = await initialize();
    expect(instance.language).toBe('en');
    expect(instance.options.detection.order).toEqual(['querystring', 'navigator', 'htmlTag']);
    expect(instance.options.detection.caches).toEqual([]);
    expect(window.localStorage.getItem('i18nextLng')).toBe('ja');
    expect(document.cookie).toContain('i18nextLng=de');
  });

  it('still permits an explicit language query on an entry alias without caching it', async () => {
    window.__MARTY_RUNTIME_CONFIG__ = { hosting: {
      canonicalOrigin: 'https://elevenidllc.com', publicEntryOrigins: [window.location.origin],
    } };
    window.history.replaceState(null, '', '/product?lng=es');
    window.localStorage.setItem('i18nextLng', 'ja');
    const instance = await initialize();
    expect(instance.language).toBe('es');
    expect(instance.t('home')).toBe('Home es');
    expect(window.localStorage.getItem('i18nextLng')).toBe('ja');
  });

  it('falls back to a supported language for an unknown query language', async () => {
    window.history.replaceState(null, '', '/product?lng=zz-ZZ');
    const instance = await initialize();
    expect(instance.language).toBe('en');
    expect(instance.t('home')).toBe('Home en');
    expect(requests.some((url) => url.includes('/zz'))).toBe(false);
  });
});
