import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, screen, within } from '@testing-library/react';
import IdentityGuidePage from '../../ui/src/components/IdentityGuidePage.jsx';
import StandardsPage from '../../ui/src/components/StandardsPage.jsx';
import {
  clearEducationMetadata, configureEducationPublicEntry, educationGridItems,
  educationMetadata, mountEducationPage,
} from '../fixtures/education-page-harness.jsx';

// Actual pages, metadata, MUI and navigation helpers execute. Only the large
// marketing inputs and diagram barrel are replaced at named import boundaries.
const documentLoads = vi.hoisted(() => []);
vi.mock('../../ui/src/application/routing/appHandoff.js', async (importOriginal) => {
  const actual = await importOriginal();
  return { ...actual, redirectBrowser: vi.fn((destination, options = {}) => actual.redirectBrowser(destination, {
    ...options, location: {
      href: window.location.href, origin: window.location.origin, pathname: window.location.pathname,
      search: window.location.search, hash: window.location.hash,
      assign: (value) => documentLoads.push({ method: 'assign', value }),
      replace: (value) => documentLoads.push({ method: 'replace', value }),
    },
  })) };
});
beforeEach(() => {
  window.history.replaceState(null, '', '/identity');
  clearEducationMetadata(); delete window.__MARTY_RUNTIME_CONFIG__;
  documentLoads.length = 0; vi.clearAllMocks();
});
afterEach(() => { cleanup(); clearEducationMetadata(); delete window.__MARTY_RUNTIME_CONFIG__; });
const mountIdentity = () => mountEducationPage(IdentityGuidePage, '/identity');
const mountStandards = () => mountEducationPage(StandardsPage, '/standards');
function expectBold(text) {
  for (const node of screen.getAllByText(text)) {
    expect(['700', 'bold']).toContain(getComputedStyle(node).fontWeight);
  }
}

describe('identity guide page composition', () => {
  it('publishes its heading, canonical and article/breadcrumb identities', () => {
    mountIdentity();
    expect(screen.getByRole('heading', { level: 1, name: 'How Digital Identity Works' })).toBeTruthy();
    expect(document.title).toBe('How Digital Identity Works | ElevenID LLC');
    const metadata = educationMetadata();
    expect(metadata.canonical).toBe('https://elevenidllc.com/identity');
    expect(metadata.schema.map((item) => item['@type'])).toEqual(['Article', 'BreadcrumbList']);
    expect(metadata.schema[0].url).toBe(metadata.canonical);
    expect(metadata.schema[1].itemListElement.map((item) => item.item))
      .toEqual(['https://elevenidllc.com', metadata.canonical]);
  });

  it('renders the independent question, primitive and flow inputs as text', () => {
    const view = mountIdentity();
    for (const text of [
      '<em>Fixture definition remains text</em>', 'Fixture problem: isolated credentials',
      'Fixture issuer?', 'Fixture claim?', 'Fixture verifier?', 'Fixture trust rules',
      'Issuer list', 'Trust period', 'Fixture disclosure policy', 'Requested claims',
      'Disclosure purpose', 'Fixture issue', 'Fixture present', 'Fixture check',
    ]) expect(screen.getByText(text)).toBeTruthy();
    expect(view.container.querySelector('em,img,script')).toBeNull();
  });

  it('passes interactive mode to all three declared diagram boundaries', () => {
    mountIdentity();
    const diagrams = screen.getAllByRole('complementary');
    expect(diagrams.map((element) => element.getAttribute('aria-label'))).toEqual([
      'Deferred identity transaction diagram', 'Deferred trust model diagram', 'Deferred credential flow diagram',
    ]);
    expect(diagrams.every((element) => element.getAttribute('data-interactive') === 'true')).toBe(true);
  });

  it('retains the one-column mobile and two/three-column desktop card sizing', () => {
    const items = educationGridItems(mountIdentity().container);
    expect(items).toHaveLength(8);
    expect(items.every((item) => item.classList.contains('MuiGrid-grid-xs-12'))).toBe(true);
    expect(items.filter((item) => item.classList.contains('MuiGrid-grid-md-4'))).toHaveLength(6);
    expect(items.filter((item) => item.classList.contains('MuiGrid-grid-md-6'))).toHaveLength(2);
  });

  it('retains bold title, section and card typography with heading gutters', () => {
    mountIdentity();
    for (const text of [
      'How Digital Identity Works', 'TL;DR: Identity in 60 Seconds', 'Fixture trust and purpose',
      'Why Traditional Identity Systems Fail', 'Fixture issuer?', 'Fixture governed primitives',
      'Fixture trust rules', 'Contains:', 'Fixture credential journeys', 'Real-World Flow Examples',
      'Fixture issue', 'Identity as Infrastructure',
    ]) expectBold(text);
    expect(getComputedStyle(screen.getByRole('heading', { name: 'Fixture governed primitives' })).textAlign).toBe('center');
    expect(getComputedStyle(screen.getByRole('heading', { name: 'Fixture credential journeys' })).textAlign).toBe('center');
    expect(['0.35em', '16.8px']).toContain(getComputedStyle(screen.getByRole('heading', { level: 1 })).marginBottom);
  });

  it('opens the protocol through the website router', async () => {
    mountIdentity();
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Explore the Open Protocol' })); });
    expect(screen.getByTestId('education-current-route').textContent).toBe('/protocol');
    expect(documentLoads).toEqual([]);
  });

  it('hands protocol navigation to configured DNS from a public IP entry', async () => {
    configureEducationPublicEntry(); mountIdentity();
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Explore the Open Protocol' })); });
    expect(documentLoads).toEqual([{ method: 'assign', value: 'https://identity.example.test/protocol' }]);
    expect(screen.getByTestId('education-current-route').textContent).toBe('/identity');
  });
});

describe('standards page composition', () => {
  it('publishes its page identity without retaining the previous article schema', () => {
    const previous = mountIdentity(); previous.unmount();
    mountStandards();
    expect(screen.getByRole('heading', { level: 1, name: 'Standards & Interoperability' })).toBeTruthy();
    expect(document.title).toBe('Identity Standards & Interoperability | ElevenID LLC');
    expect(educationMetadata()).toEqual({ canonical: 'https://elevenidllc.com/standards', schema: [] });
  });

  it('retains the source qualification limits on compatibility and certification', () => {
    mountStandards();
    expect(screen.getByText(/A shared standard name alone does not demonstrate that two systems interoperate/)).toBeTruthy();
    expect(screen.getByText(/not certification, regulatory approval, or an assurance/)).toBeTruthy();
    expect(screen.getByText(/Review the selected release, profile, and executed evidence/)).toBeTruthy();
    expect(screen.getByText(/Its mappings have their own status and do not certify a product or deployment/)).toBeTruthy();
  });

  it('renders standards within their own layer and preserves supplied text', () => {
    const view = mountStandards();
    for (const name of ['Portability', 'Trust', 'Longevity', 'Interoperability']) {
      expect(screen.getByRole('heading', { name })).toBeTruthy();
    }
    const formats = screen.getByRole('heading', { name: 'Fixture formats' }).closest('.MuiCard-root');
    expect(within(formats).getByText('Fixture format A')).toBeTruthy();
    expect(within(formats).getByText('<strong>Fixture markup stays text</strong>')).toBeTruthy();
    expect(within(formats).queryByText('Fixture exchange profile')).toBeNull();
    expect(view.container.querySelector('img,script')).toBeNull();
  });

  it('passes interactive mode to the declared standards diagram boundary', () => {
    mountStandards();
    expect(screen.getByRole('complementary', { name: 'Deferred standards stack diagram' })
      .getAttribute('data-interactive')).toBe('true');
  });

  it('retains four-column benefit cards and two-column standards layers', () => {
    const items = educationGridItems(mountStandards().container);
    expect(items).toHaveLength(6);
    expect(items.every((item) => item.classList.contains('MuiGrid-grid-xs-12'))).toBe(true);
    expect(items.filter((item) => item.classList.contains('MuiGrid-grid-sm-6'))).toHaveLength(4);
    expect(items.filter((item) => item.classList.contains('MuiGrid-grid-md-3'))).toHaveLength(4);
    expect(items.filter((item) => item.classList.contains('MuiGrid-grid-md-6'))).toHaveLength(2);
  });

  it('retains bold section, standard and benefit labels with the installed Typography', () => {
    mountStandards();
    for (const text of [
      'Standards & Interoperability', 'Why Standards Matter for Your Organization',
      'Fixture standards are configured and versioned', 'Portability', 'Standards in Detail',
      'Fixture formats', 'Fixture format A', 'Standards-First Architecture',
    ]) expectBold(text);
    expect(getComputedStyle(screen.getByRole('heading', { name: 'Fixture standards are configured and versioned' })).textAlign).toBe('center');
    expect(getComputedStyle(screen.getByRole('heading', { name: 'Standards in Detail' })).textAlign).toBe('center');
    expect(['0.35em', '16.8px']).toContain(getComputedStyle(screen.getByRole('heading', { level: 1 })).marginBottom);
  });

  it.each([
    ['Explore the Protocol', '/protocol'], ['See How Standards Are Governed', '/identity'],
  ])('%s follows its website route', async (name, path) => {
    mountStandards();
    await act(async () => { fireEvent.click(screen.getByRole('button', { name })); });
    expect(screen.getByTestId('education-current-route').textContent).toBe(path);
    expect(documentLoads).toEqual([]);
  });

  it.each([
    ['Explore the Protocol', '/protocol'], ['See How Standards Are Governed', '/identity'],
  ])('%s uses configured DNS from a public IP entry', async (name, path) => {
    configureEducationPublicEntry(); mountStandards();
    await act(async () => { fireEvent.click(screen.getByRole('button', { name })); });
    expect(documentLoads).toEqual([{ method: 'assign', value: 'https://identity.example.test' + path }]);
    expect(screen.getByTestId('education-current-route').textContent).toBe('/standards');
  });
});
