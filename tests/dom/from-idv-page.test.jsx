import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter, useLocation } from 'react-router';
import { createTheme, ThemeProvider } from '@mui/material/styles';
import FromIDVPage from '../../ui/src/components/FromIDVPage.jsx';
import { BrandingContext, BrandingProvider } from '../../ui/src/contexts/BrandingContext.jsx';

// Real page, branding, metadata, routing and URL helpers. Only document loading
// and the branding fetch boundary are recorded; no external document is loaded.
const documentLoads = vi.hoisted(() => []);
vi.mock('../../ui/src/application/routing/appHandoff.js', async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    redirectBrowser: vi.fn((destination, options = {}) => actual.redirectBrowser(destination, {
      ...options,
      location: {
        href: window.location.href,
        origin: window.location.origin,
        pathname: window.location.pathname,
        search: window.location.search,
        hash: window.location.hash,
        assign: (value) => documentLoads.push({ method: 'assign', value }),
        replace: (value) => documentLoads.push({ method: 'replace', value }),
      },
    })),
  };
});

const path = '/why-verifiable-identity';
const canonical = 'https://elevenidllc.com' + path;
const theme = createTheme();
function CurrentRoute() {
  const location = useLocation();
  return <output data-testid="page-route">{location.pathname + location.search + location.hash}</output>;
}
function mount({ remoteBranding = false } = {}) {
  const page = <><FromIDVPage /><CurrentRoute /></>;
  return render(<ThemeProvider theme={theme}><MemoryRouter initialEntries={[path]}>
    {remoteBranding ? <BrandingProvider>{page}</BrandingProvider> : (
      <BrandingContext.Provider value={{ branding: { appName: 'Example University' }, isLoading: false }}>
        {page}
      </BrandingContext.Provider>
    )}
  </MemoryRouter></ThemeProvider>);
}
function clearMetadata() {
  document.title = '';
  document.head.querySelectorAll(
    'meta[name="description"],meta[name="keywords"],meta[property^="og:"],meta[name^="twitter:"],link[rel="canonical"],script[data-seo-jsonld="true"]',
  ).forEach((element) => element.remove());
}
beforeEach(() => {
  clearMetadata();
  window.history.replaceState(null, '', path);
  delete window.__MARTY_RUNTIME_CONFIG__;
  documentLoads.length = 0;
  vi.clearAllMocks();
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => ({}) }));
});
afterEach(() => {
  cleanup();
  clearMetadata();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  delete window.__MARTY_RUNTIME_CONFIG__;
});

describe('verifiable identity workflow page', () => {
  it('renders its canonical article and breadcrumb metadata with one main heading', () => {
    mount();
    expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1);
    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe('Plan a Verifiable Identity Workflow');
    expect(document.title).toBe('Why Verifiable Identity | ElevenID LLC');
    expect(document.head.querySelector('link[rel="canonical"]').getAttribute('href')).toBe(canonical);
    expect(document.head.querySelector('meta[name="description"]').content).toContain('customer-operated Marty workflow');
    expect(document.head.querySelector('meta[property="og:url"]').content).toBe(canonical);
    const scripts = document.head.querySelectorAll('script[data-seo-jsonld="true"]');
    expect(scripts).toHaveLength(1);
    const [article, breadcrumbs] = JSON.parse(scripts[0].textContent);
    expect(article).toMatchObject({
      '@type': 'Article', headline: 'Why Verifiable Identity', url: canonical,
      mainEntityOfPage: { '@type': 'WebPage', '@id': canonical },
    });
    expect(breadcrumbs).toMatchObject({
      '@type': 'BreadcrumbList',
      itemListElement: [
        { position: 1, name: 'Home', item: 'https://elevenidllc.com' },
        { position: 2, name: 'Why Verifiable Identity', item: canonical },
      ],
    });
    expect(fetch).not.toHaveBeenCalled();
    expect(documentLoads).toEqual([]);
  });

  it('keeps workflow evidence, operator responsibility and commercial limits visible', () => {
    const { container } = mount();
    const text = container.textContent.replace(/\s+/g, ' ');
    expect(text).toContain('A passing check in one category does not prove the others.');
    expect(text).toContain('Production operation belongs to your organization or selected partner.');
    expect(text).toContain('The software offer does not include managed production or guaranteed technical support.');
    expect(text).toContain('a result in one does not qualify the others.');
    expect(text).toContain('Price, included scope, component rights, and delivery terms require an agreed offer.');
    expect(screen.getByRole('heading', { name: 'Evaluate Marty by Example University' })).toBeTruthy();
  });

  it.each([
    ['Explore Developer Docs', '/developers'],
    ['View Verification API', '/verifiable-credential-api'],
  ])('routes %s within the website', async (label, destination) => {
    mount();
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: label })); });
    expect(screen.getByTestId('page-route').textContent).toBe(destination);
    expect(documentLoads).toEqual([]);
  });

  it('hands application-owned API Docs to the receiving document', async () => {
    mount();
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'API Docs' })); });
    expect(documentLoads).toEqual([{ method: 'assign', value: '/docs' }]);
    expect(screen.getByTestId('page-route').textContent).toBe(path);
  });

  it('loads deployment branding without replacing public page metadata or sending credentials', async () => {
    let finishFetch;
    fetch.mockImplementationOnce(() => new Promise((resolve) => { finishFetch = resolve; }));
    window.__MARTY_RUNTIME_CONFIG__ = { hosting: {
      canonicalOrigin: 'https://elevenidllc.com',
      publicEntryOrigins: [window.location.origin],
    } };
    mount({ remoteBranding: true });
    expect(screen.getByRole('heading', { name: 'Evaluate Marty by ElevenID LLC' })).toBeTruthy();
    await act(async () => {
      finishFetch({ ok: true, json: async () => ({ appName: 'Regional University' }) });
    });
    expect(screen.getByRole('heading', { name: 'Evaluate Marty by Regional University' })).toBeTruthy();
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(fetch).toHaveBeenCalledWith(
      '/_website/0123456789abcdef0123456789abcdef01234567/config.json',
      { credentials: 'omit' },
    );
    expect(document.title).toBe('Why Verifiable Identity | ElevenID LLC');
    expect(document.head.querySelector('link[rel="canonical"]').getAttribute('href')).toBe(canonical);
    expect(screen.getByTestId('page-route').textContent).toBe(path);
    expect(documentLoads).toEqual([]);
  });
});
