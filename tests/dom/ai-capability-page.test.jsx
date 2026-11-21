import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { MemoryRouter, useLocation } from 'react-router';
import { createTheme, ThemeProvider } from '@mui/material/styles';
import AiCapabilityPage from '../../ui/src/components/pages/AiCapabilityPage.jsx';

// The actual AI page, marketing catalog adapter, normalizer, catalog view,
// metadata and navigation helpers execute. Only the large snapshot is replaced
// by the explicit fixture boundary, and final document loads are recorded.
const documentLoads = vi.hoisted(() => []);
vi.mock('../../ui/src/application/routing/appHandoff.js', async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    redirectBrowser: vi.fn((destination, options = {}) => actual.redirectBrowser(destination, {
      ...options,
      location: {
        href: window.location.href, origin: window.location.origin,
        pathname: window.location.pathname, search: window.location.search, hash: window.location.hash,
        assign: (value) => documentLoads.push({ method: 'assign', value }),
        replace: (value) => documentLoads.push({ method: 'replace', value }),
      },
    })),
  };
});
const theme = createTheme();
function CurrentRoute() {
  const location = useLocation();
  return <output data-testid="ai-current-route">{location.pathname}</output>;
}
function mount() {
  return render(<ThemeProvider theme={theme}><MemoryRouter initialEntries={['/ai']}>
    <AiCapabilityPage /><CurrentRoute />
  </MemoryRouter></ThemeProvider>);
}
function clearMetadata() {
  document.title = '';
  document.head.querySelectorAll(
    'meta[name="description"],meta[name="keywords"],meta[property^="og:"],meta[name^="twitter:"],link[rel="canonical"],script[data-seo-jsonld="true"]',
  ).forEach((element) => element.remove());
}
function publicEntry() {
  window.__MARTY_RUNTIME_CONFIG__ = {
    hosting: { canonicalOrigin: 'https://identity.example.test', publicEntryOrigins: ['https://192.0.2.10'] },
  };
}
beforeEach(() => {
  window.history.replaceState(null, '', '/ai');
  clearMetadata();
  delete window.__MARTY_RUNTIME_CONFIG__;
  documentLoads.length = 0;
  vi.clearAllMocks();
});
afterEach(() => { cleanup(); clearMetadata(); delete window.__MARTY_RUNTIME_CONFIG__; });

describe('AI capability page composition', () => {
  it('retains bold headings and card labels with the installed Typography', () => {
    mount();
    for (const name of [
      'Identity Infrastructure for AI Systems', 'What API Consumers Can Do',
      'Credential Verification', 'Credential Issuance', 'Trust Policy Evaluation', 'Credential Schema Lookup',
      'Integration Interfaces', 'Support Catalog', 'REST API', 'OpenAPI Spec',
      'Protocol Consumer Support', 'Discover Before Integrating', 'AI Use Cases', 'Build from the Gateway Contract',
    ]) {
      expect(['700', 'bold']).toContain(getComputedStyle(screen.getByRole('heading', { name })).fontWeight);
    }
    for (const name of ['Gate integrations by support level', 'Generate HTTP clients', 'Build tenant workflows', 'Explain product limits']) {
      expect(['700', 'bold']).toContain(getComputedStyle(screen.getByText(name)).fontWeight);
    }
    expect(['0.35em', '16.8px']).toContain(getComputedStyle(screen.getByRole('heading', { level: 1 })).marginBottom);
  });

  it('publishes its page identity and both structured metadata objects', () => {
    mount();
    expect(screen.getByRole('heading', { level: 1, name: 'Identity Infrastructure for AI Systems' })).toBeTruthy();
    expect(document.title).toBe('AI-Accessible Identity Infrastructure — ElevenID | ElevenID LLC');
    expect(document.head.querySelector('link[rel="canonical"]').getAttribute('href')).toBe('https://elevenidllc.com/ai');
    const types = [...document.head.querySelectorAll('script[data-seo-jsonld="true"]')]
      .flatMap((element) => JSON.parse(element.textContent)).map((value) => value['@type']);
    expect(types).toEqual(expect.arrayContaining(['SoftwareApplication', 'BreadcrumbList']));
    expect(documentLoads).toEqual([]);
  });

  it('keeps the snapshot warning, separate support states and fixture limitations visible', () => {
    mount();
    expect(screen.getByRole('alert').textContent).toContain("Check your deployment's live catalog before integrating.");
    for (const label of ['Implemented', 'Derived', 'Partial', 'Unsupported']) {
      expect(screen.getByText(label + ': 1')).toBeTruthy();
    }
    const unsupported = screen.getByRole('heading', { level: 4, name: 'Fixture unsupported capability' }).closest('.MuiCard-root');
    expect(within(unsupported).getByText('No product surface is represented.')).toBeTruthy();
    expect(within(unsupported).queryByText(/^API:/)).toBeNull();
    expect(screen.getByText('Incomplete fixture only.')).toBeTruthy();
  });

  it('exposes every interface card as a keyboard-reachable link', () => {
    mount();
    for (const [name, path] of [['Support Catalog', '/v1/protocol-support'], ['REST API', '/docs'], ['OpenAPI Spec', '/openapi.json']]) {
      const link = screen.getAllByRole('link', { name: new RegExp('^' + name) })[0];
      expect(link.tagName).toBe('A');
      expect(link.getAttribute('href')).toBe(path);
      expect(link.tabIndex).toBe(0);
    }
  });

  it('does not advertise unsupported CLI or universal agent capabilities', () => {
    mount();
    for (const unsupported of [
      '@elevenid/marty-cli', 'marty verify start', 'marty creds issue',
      'All commands support', 'primary interface for AI agents',
    ]) expect(document.body.textContent).not.toContain(unsupported);
  });

  it('uses safe separate-tab links for machine-readable interfaces and the catalog source', () => {
    mount();
    const links = [
      ...screen.getAllByRole('link', { name: /^Support Catalog/ }),
      ...screen.getAllByRole('link', { name: /^OpenAPI Spec/ }),
      screen.getByRole('link', { name: 'machine-readable catalog' }),
    ];
    expect(links).toHaveLength(4);
    for (const link of links) {
      expect(link.getAttribute('target')).toBe('_blank');
      expect(link.getAttribute('rel').split(/\s+/)).toEqual(expect.arrayContaining(['noopener', 'noreferrer']));
    }
    expect(screen.getByRole('link', { name: /^REST API/ }).getAttribute('target')).toBeNull();
  });

  it('directs every interface and catalog source to configured DNS from a public IP entry', () => {
    publicEntry();
    mount();
    for (const link of [
      ...screen.getAllByRole('link', { name: /^(Support Catalog|REST API|OpenAPI Spec)/ }),
      screen.getByRole('link', { name: 'machine-readable catalog' }),
    ]) {
      expect(link.getAttribute('href')).toMatch(/^https:\/\/identity\.example\.test\/(v1\/protocol-support|docs|openapi\.json)$/);
    }
  });

  it('hands the documentation CTA to an application document without changing the website route', async () => {
    mount();
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'API Documentation' })); });
    expect(documentLoads).toEqual([{ method: 'assign', value: '/docs' }]);
    expect(screen.getByTestId('ai-current-route').textContent).toBe('/ai');
  });

  it('uses the configured DNS document for documentation from a public IP entry', async () => {
    publicEntry();
    mount();
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'API Documentation' })); });
    expect(documentLoads).toEqual([{ method: 'assign', value: 'https://identity.example.test/docs' }]);
    expect(screen.getByTestId('ai-current-route').textContent).toBe('/ai');
  });

  it('retains responsive capability and interface card widths with the installed Grid', () => {
    const view = mount();
    const items = [...view.container.querySelectorAll('.MuiGrid-root:not(.MuiGrid-container)')];
    expect(items.length).toBeGreaterThan(0);
    expect(items.every((item) => item.classList.contains('MuiGrid-grid-xs-12'))).toBe(true);
    for (const size of ['sm-6', 'sm-4']) {
      expect(view.container.querySelectorAll('.MuiGrid-grid-' + size).length).toBeGreaterThan(0);
    }
  });
});
