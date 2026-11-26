import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen, within } from '@testing-library/react';
import { createTheme, ThemeProvider } from '@mui/material/styles';
import AiCapabilityPage from '../../ui/src/components/pages/AiCapabilityPage.jsx';

// The actual agent page, metadata, public-entry helper and support view execute.
// Only the retained historical catalog is replaced by the small catalog fixture.
const mount = () => render(<ThemeProvider theme={createTheme()}><AiCapabilityPage /></ThemeProvider>);
function clearMetadata() {
  document.title = '';
  document.head.querySelectorAll(
    'meta[name="description"],meta[name="keywords"],meta[property^="og:"],meta[name^="twitter:"],link[rel="canonical"],script[data-seo-jsonld="true"]',
  ).forEach((element) => element.remove());
}
beforeEach(() => {
  window.history.replaceState(null, '', '/ai');
  clearMetadata(); delete window.__MARTY_RUNTIME_CONFIG__;
});
afterEach(() => { cleanup(); clearMetadata(); delete window.__MARTY_RUNTIME_CONFIG__; });

describe('agent identity and delegation page', () => {
  it('publishes the agent feature identity and canonical metadata', () => {
    mount();
    expect(screen.getByRole('heading', { level: 1, name: 'Agent identity & delegation' })).toBeTruthy();
    expect(document.title).toBe('Agent Identity & Delegation — ElevenID | ElevenID LLC');
    expect(document.head.querySelector('link[rel="canonical"]').getAttribute('href')).toBe('https://elevenidllc.com/ai');
    const schemas = [...document.head.querySelectorAll('script[data-seo-jsonld="true"]')]
      .flatMap((element) => JSON.parse(element.textContent));
    expect(schemas.map((value) => value['@type'])).toEqual(['SoftwareApplication', 'BreadcrumbList']);
    expect(schemas[1].itemListElement.at(-1).item).toBe('https://elevenidllc.com/ai');
  });

  it('separates principal, runtime, subject and grant so enrollment cannot imply authority', () => {
    mount();
    const concepts = screen.getByRole('table', { name: 'Agent identity and authority concepts' });
    for (const name of ['Acting principal', 'Runtime and proof key', 'Represented subject', 'Delegated authority']) {
      expect(within(concepts).getByRole('rowheader', { name: new RegExp(name) })).toBeTruthy();
    }
    expect(screen.getByText(/Enrollment makes the identity eligible for subsequent checks/)).toBeTruthy();
    expect(screen.getByText(/Existing key-bound grants keep their original terms/)).toBeTruthy();
    expect(screen.getByText(/Consent withdrawal and current organization permissions/)).toBeTruthy();
  });

  it('teaches the ordered use and recovery workflow with evidence-only limits', () => {
    mount();
    const steps = screen.getByRole('list');
    expect(within(steps).getAllByRole('listitem')).toHaveLength(5);
    expect(within(steps).getAllByRole('heading').map((heading) => heading.textContent)).toEqual([
      'Approve the exact terms', 'Start one use', 'Prove identity and evaluate current authority',
      'Verify the decision evidence', 'Recover the original result',
    ]);
    for (const command of ['START_USE', 'FINALIZE_USE', 'RECOVER_RESULT']) {
      expect(within(steps).getByText(command).tagName).toBe('CODE');
    }
    expect(screen.getByText(/EVIDENCE_ONLY semantics/)).toBeTruthy();
    expect(screen.getByText(/An uncertain or missing result is not permission to issue a replacement operation/)).toBeTruthy();
    expect(screen.getByText(/single-hop: they do not permit further delegation/)).toBeTruthy();
  });

  it('keeps application execution and identity-provider sign-in responsibilities explicit', () => {
    mount();
    for (const owner of ['Marty / ElevenID', 'Your application and agent runtime', 'Your identity provider']) {
      expect(screen.getByRole('heading', { name: owner })).toBeTruthy();
    }
    expect(screen.getByText(/budgets, reservations, provider calls, duplicate-operation prevention/)).toBeTruthy();
    expect(screen.getByText(/A successful login establishes the signed-in user/)).toBeTruthy();
    expect(screen.getByText(/runtime qualification still NOT_ASSESSED/)).toBeTruthy();
    expect(screen.getByText(/public MIP baseline remains 0.5.0/)).toBeTruthy();
  });

  it('exposes documentation and learning as native links without marketing-host API links', () => {
    mount();
    const docs = screen.getByRole('link', { name: 'API documentation' });
    expect(docs.tagName).toBe('A');
    expect(docs.getAttribute('href')).toBe('/docs');
    expect(docs.tabIndex).toBe(0);
    expect(screen.getByRole('link', { name: 'Marty protocol' }).getAttribute('href')).toBe('/protocol');
    expect(screen.getByRole('link', { name: 'Explore the delegation model' }).getAttribute('href')).toBe('/protocol');
    for (const link of screen.getAllByRole('link')) {
      expect(link.getAttribute('href')).not.toMatch(/^\/(v1\/protocol-support|openapi\.json)$/);
    }
    expect(screen.getByText(/curl -fsS/).textContent).toContain('$MARTY_BASE_URL/v1/protocol-support');
  });

  it('uses the configured public origin for documentation and learning links', () => {
    window.__MARTY_RUNTIME_CONFIG__ = {
      hosting: { canonicalOrigin: 'https://identity.example.test', publicEntryOrigins: ['https://192.0.2.10'] },
    };
    mount();
    expect(screen.getByRole('link', { name: 'API documentation' }).getAttribute('href'))
      .toBe('https://identity.example.test/docs');
    expect(screen.getByRole('link', { name: 'Marty protocol' }).getAttribute('href'))
      .toBe('https://identity.example.test/protocol');
  });

  it('keeps the historical catalog separate from current deployment claims', () => {
    mount();
    expect(screen.getByRole('alert').textContent).toContain('predates the latest agent identity and delegation work');
    expect(screen.getByText('Review historical support snapshot').closest('details').open).toBe(false);
  });

  it('keeps lifecycle cards responsive and long identity concepts horizontally contained', () => {
    const { container } = mount();
    const cards = [...container.querySelectorAll('.MuiGrid-grid-xs-12')];
    expect(cards.length).toBeGreaterThanOrEqual(7);
    expect(container.querySelectorAll('.MuiGrid-grid-sm-6').length).toBeGreaterThanOrEqual(4);
    const table = screen.getByRole('table', { name: 'Agent identity and authority concepts' });
    expect(table.closest('.MuiTableContainer-root')).toBeTruthy();
  });
});
