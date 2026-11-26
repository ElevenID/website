import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { I18nextProvider } from 'react-i18next';
import WebsiteApp from '../../ui/src/apps/website/WebsiteApp.jsx';
import i18n from '../../ui/src/i18n/index.js';
import { trackPageView } from '../../ui/src/utils/analytics.js';

const routeFixture = vi.hoisted(() => ({ fail: false }));

// Exercise the real shell, router, branding, chrome and surface boundary. The
// route component is the sole page boundary: its deferred pages are not loaded.
vi.mock('../../ui/src/apps/website/WebsiteRoutes.jsx', async () => {
  const { useLocation } = await import('react-router');
  return { default: function RouteBoundary() {
    const location = useLocation();
    if (routeFixture.fail) throw new Error('Fixture route failed');
    return <main data-testid="website-route-boundary">{location.pathname}{location.search}</main>;
  } };
});

// Translation initialization and analytics have separate runtime suites. Keep
// real translations/hooks here, with local resources and no outbound telemetry.
vi.mock('../../ui/src/i18n/index.js', async () => {
  const { createInstance } = await import('i18next');
  const instance = createInstance();
  await instance.init({
    lng: 'en', fallbackLng: 'en', ns: ['common', 'marketing'], defaultNS: 'common',
    resources: { en: { common: {}, marketing: {} } }, interpolation: { escapeValue: false },
  });
  return { default: instance };
});
vi.mock('../../ui/src/utils/analytics.js', () => ({
  initAnalytics: vi.fn(), trackPageView: vi.fn(), trackWebVitals: vi.fn(),
}));

const originalTitle = document.title;
function mountWebsite() {
  return render(<I18nextProvider i18n={i18n}><WebsiteApp /></I18nextProvider>);
}
async function renderWebsite(path = '/product', runtime) {
  window.history.replaceState(null, '', path);
  if (runtime) window.__MARTY_RUNTIME_CONFIG__ = runtime;
  mountWebsite();
  await within(screen.getByRole('banner')).findByText('Fixture Identity');
}
function cta() {
  // The CTA is responsive; jsdom does not evaluate desktop media queries.
  return screen.getByText('Start Verifying').closest('a');
}

beforeEach(async () => {
  routeFixture.fail = false;
  vi.clearAllMocks();
  delete window.__MARTY_RUNTIME_CONFIG__;
  window.history.replaceState(null, '', '/product');
  document.title = 'Fixture website';
  await i18n.changeLanguage('en');
  vi.stubGlobal('fetch', vi.fn(async () => ({
    ok: true, json: async () => ({
      appName: 'Fixture Identity', primaryColor: '#123456', secondaryColor: '#654321',
    }),
  })));
  // Park rendering frames; readiness itself is covered by its lifecycle suite.
  vi.stubGlobal('requestAnimationFrame', vi.fn(() => 1));
  vi.stubGlobal('cancelAnimationFrame', vi.fn());
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  delete window.__MARTY_RUNTIME_CONFIG__;
  window.history.replaceState(null, '', '/');
  document.title = originalTitle;
});

describe('website composition chrome with the deferred route boundary isolated', () => {
  it('preserves the reconciled verification CTA, sign-in return and branding', async () => {
    await renderWebsite();
    expect(document.querySelector('[data-website-error-boundary]')).toBeNull();
    expect(cta()).not.toBeNull();
    expect(cta().getAttribute('href')).toBe('/verify');
    const login = within(screen.getByRole('banner')).getByRole('link', { name: 'Login' });
    expect(login.getAttribute('href')).toBe('/login?next=%2Fconsole');
    expect(login.getAttribute('aria-disabled')).not.toBe('true');
    expect(screen.getByRole('tab', { name: 'Product' }).getAttribute('aria-selected')).toBe('true');
    expect(screen.queryByRole('tab', { name: 'Pricing' })).toBeNull();
  });

  it('uses the real browser router and updates tab selection for local navigation', async () => {
    await renderWebsite();
    fireEvent.click(screen.getByRole('tab', { name: 'Resources' }));
    await waitFor(() => expect(screen.getByTestId('website-route-boundary').textContent).toBe('/resources'));
    expect(window.location.pathname).toBe('/resources');
    expect(screen.getByRole('tab', { name: 'Resources' }).getAttribute('aria-selected')).toBe('true');
    expect(screen.getByRole('tab', { name: 'Product' }).getAttribute('aria-selected')).toBe('false');
    expect(trackPageView).toHaveBeenCalledWith('/resources', expect.any(String));
  });

  it('canonicalizes entry-alias links and selects the public-only sign-in return', async () => {
    await renderWebsite('/product', {
      web: { enabled_sections: ['public'] },
      hosting: {
        canonicalOrigin: 'https://elevenidllc.com', publicEntryOrigins: [window.location.origin],
      },
    });
    expect(cta().getAttribute('href')).toBe('https://elevenidllc.com/verify');
    expect(within(screen.getByRole('banner')).getByRole('link', { name: 'Login' }).getAttribute('href'))
      .toBe('https://elevenidllc.com/login?next=%2Forganizations');
    expect(screen.getByRole('tab', { name: 'Resources' }).getAttribute('href'))
      .toBe('https://elevenidllc.com/resources');
  });

  it('makes agent learning discoverable in its own navigation tab', async () => {
    await renderWebsite();
    const agents = screen.getByRole('tab', { name: 'Agents' });
    expect(agents.getAttribute('href')).toBe('/ai');
    fireEvent.click(agents);
    await waitFor(() => expect(screen.getByTestId('website-route-boundary').textContent).toBe('/ai'));
    expect(agents.getAttribute('aria-selected')).toBe('true');
    expect(screen.getByRole('tab', { name: 'Product' }).getAttribute('aria-selected')).toBe('false');
  });

  it('keeps the Agents tab selected on the supported trailing-slash route', async () => {
    await renderWebsite('/ai/');
    expect(screen.getByTestId('website-route-boundary').textContent).toBe('/ai/');
    expect(screen.getByRole('tab', { name: 'Agents' }).getAttribute('aria-selected')).toBe('true');
    expect(screen.getByRole('tab', { name: 'Product' }).getAttribute('aria-selected')).toBe('false');
  });

  it('selects the configured resource tab for a nested public route', async () => {
    await renderWebsite('/blog/foundations?view=latest');
    expect(screen.getByRole('tab', { name: 'Resources' }).getAttribute('aria-selected')).toBe('true');
    expect(screen.getByTestId('website-route-boundary').textContent).toBe('/blog/foundations?view=latest');
  });

  it('offers the existing reload fallback when the route boundary fails', async () => {
    routeFixture.fail = true;
    vi.spyOn(console, 'error').mockImplementation(() => {});
    mountWebsite();
    const heading = await screen.findByRole('heading', { name: 'This page could not be loaded.' });
    expect(heading.closest('[data-website-error-boundary]')?.getAttribute('data-website-error-boundary')).toBe('true');
    expect(screen.getByRole('link', { name: 'Reload website' }).getAttribute('href')).toBe('/');
  });

  it('marks a caught render failure after startup even when valid route metadata survives', async () => {
    await renderWebsite();
    const canonical = document.createElement('link');
    canonical.rel = 'canonical';
    canonical.href = 'https://elevenidllc.com/resources';
    document.head.appendChild(canonical);
    document.documentElement.classList.add('app-ready');
    vi.spyOn(console, 'error').mockImplementation(() => {});
    try {
      routeFixture.fail = true;
      fireEvent.click(screen.getByRole('tab', { name: 'Resources' }));
      const heading = await screen.findByRole('heading', { name: 'This page could not be loaded.' });
      expect(window.location.pathname).toBe('/resources');
      expect(document.documentElement.classList.contains('app-ready')).toBe(true);
      expect(document.querySelector('[data-app-loading]')).toBeNull();
      expect(canonical.href).toBe('https://elevenidllc.com/resources');
      expect(heading.closest('[data-website-error-boundary="true"]')).not.toBeNull();
      expect(screen.queryByTestId('website-route-boundary')).toBeNull();
      expect(screen.getByRole('link', { name: 'Reload website' }).getAttribute('href')).toBe('/');
    } finally {
      canonical.remove();
      document.documentElement.classList.remove('app-ready');
    }
  });
});
