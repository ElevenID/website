import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const supported = ['onCLS', 'onFCP', 'onINP', 'onLCP', 'onTTFB'];
const metrics = vi.hoisted(() => ({ registrations: [], callbacks: new Map() }));
// Derive the registration boundary from the installed package's real export
// shape. No legacy onFID function or additional export is introduced.
vi.mock('web-vitals', async (importOriginal) => {
  const actual = await importOriginal();
  const wrapped = { ...actual };
  for (const name of ['onCLS', 'onFCP', 'onINP', 'onLCP', 'onTTFB']) {
    if (typeof actual[name] === 'function') {
      wrapped[name] = vi.fn((callback) => {
        metrics.registrations.push(name);
        metrics.callbacks.set(name, callback);
      });
    }
  }
  return wrapped;
});
const loadAnalytics = () => import('../../ui/src/utils/analytics.js');
const scriptSelector = 'script[data-marty-ga-id]';

beforeEach(() => {
  vi.resetModules();
  vi.clearAllMocks();
  metrics.registrations.length = 0;
  metrics.callbacks.clear();
  window.history.replaceState(null, '', '/product');
  delete window.__MARTY_RUNTIME_CONFIG__;
  delete window.gtag;
  delete window.dataLayer;
  document.head.querySelectorAll(scriptSelector).forEach((node) => node.remove());
});

afterEach(async () => {
  await vi.dynamicImportSettled();
  document.head.querySelectorAll(scriptSelector).forEach((node) => node.remove());
  delete window.__MARTY_RUNTIME_CONFIG__;
  delete window.gtag;
  delete window.dataLayer;
  vi.unstubAllEnvs();
});

describe('analytics with the installed web-vitals API', () => {
  it('uses the actual current package exports', async () => {
    const actual = await vi.importActual('web-vitals');
    for (const name of supported) expect(actual[name]).toBeTypeOf('function');
    expect(actual).not.toHaveProperty('onFID');
  });

  it('registers every supported metric exactly once', async () => {
    const { trackWebVitals } = await loadAnalytics();
    trackWebVitals();
    await vi.dynamicImportSettled();
    expect([...metrics.registrations].sort()).toEqual(supported);
    trackWebVitals();
    await vi.dynamicImportSettled();
    expect([...metrics.registrations].sort()).toEqual(supported);
  });

  it.each([
    ['onCLS', 'CLS', 0.1234, 123],
    ['onINP', 'INP', 201.6, 202],
  ])('reports %s with the correct metric value and identity', async (registration, name, value, expectedValue) => {
    window.gtag = vi.fn();
    const { trackWebVitals } = await loadAnalytics();
    trackWebVitals();
    await vi.dynamicImportSettled();
    const report = metrics.callbacks.get(registration);
    expect(report).toBeTypeOf('function');
    report({ name, value, id: 'metric-fixture' });
    expect(window.gtag).toHaveBeenCalledWith('event', name, {
      event_category: 'Web Vitals',
      event_label: 'metric-fixture',
      value: expectedValue,
      non_interaction: true,
    });
  });

  it('allows metric callbacks when analytics has not been configured', async () => {
    const { trackWebVitals } = await loadAnalytics();
    trackWebVitals();
    await vi.dynamicImportSettled();
    expect(() => metrics.callbacks.get('onCLS')({ name: 'CLS', value: 0.1, id: 'silent' })).not.toThrow();
    expect(window.gtag).toBeUndefined();
  });

  it('suppresses analytics and vitals on a configured public-entry alias', async () => {
    window.__MARTY_RUNTIME_CONFIG__ = {
      googleAnalyticsMeasurementId: 'G-WEBSITE-TEST',
      hosting: {
        canonicalOrigin: 'https://elevenidllc.com',
        publicEntryOrigins: [window.location.origin],
      },
    };
    window.gtag = vi.fn();
    const analytics = await loadAnalytics();
    analytics.initAnalytics();
    analytics.trackWebVitals();
    analytics.trackPageView('/product', 'Product');
    analytics.trackEvent('test_event');
    await vi.dynamicImportSettled();
    expect(document.head.querySelector(scriptSelector)).toBeNull();
    expect(window.gtag).not.toHaveBeenCalled();
    expect(metrics.registrations).toEqual([]);
  });

  it('initializes one script and retains explicit router page-view reporting', async () => {
    window.__MARTY_RUNTIME_CONFIG__ = { googleAnalyticsMeasurementId: 'G-WEBSITE-TEST' };
    const analytics = await loadAnalytics();
    analytics.initAnalytics();
    analytics.initAnalytics();
    const scripts = document.head.querySelectorAll(scriptSelector);
    expect(scripts).toHaveLength(1);
    expect(scripts[0].src).toBe('https://www.googletagmanager.com/gtag/js?id=G-WEBSITE-TEST');
    expect(scripts[0].async).toBe(true);
    expect(window.dataLayer.map((entry) => Array.from(entry))).toEqual([
      ['js', expect.any(Date)],
      ['config', 'G-WEBSITE-TEST', { send_page_view: false }],
    ]);
    analytics.trackPageView('/product?from=home', 'Product | ElevenID LLC');
    analytics.trackConversion('documentation', { source: 'product' });
    expect(window.dataLayer.slice(2).map((entry) => Array.from(entry))).toEqual([
      ['event', 'page_view', { page_path: '/product?from=home', page_title: 'Product | ElevenID LLC' }],
      ['event', 'conversion', { conversion_type: 'documentation', source: 'product' }],
    ]);
  });

  it('keeps analytics disabled when the runtime setting is empty', async () => {
    vi.stubEnv('VITE_GA_MEASUREMENT_ID', 'G-BUILD-FALLBACK');
    window.__MARTY_RUNTIME_CONFIG__ = { googleAnalyticsMeasurementId: '' };
    const { initAnalytics } = await loadAnalytics();
    initAnalytics();
    expect(document.head.querySelector(scriptSelector)).toBeNull();
    expect(window.gtag).toBeUndefined();
    expect(window.dataLayer).toBeUndefined();
  });
});
