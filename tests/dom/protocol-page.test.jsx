import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, screen, within } from '@testing-library/react';
import ProtocolPage from '../../ui/src/components/ProtocolPage.jsx';
import { GUIDE_ARTICLES_BY_CHAPTER, resetEducationBlogFixture } from '../fixtures/education-blog-data.mjs';
import {
  clearEducationMetadata, configureEducationPublicEntry, educationGridItems, educationI18n,
  educationMetadata, mountEducationPage,
} from '../fixtures/education-page-harness.jsx';

// Actual page, i18n, MUI, router, metadata and public-entry helpers execute.
// Small marketing/blog inputs and a named map marker are the only content
// boundaries; this does not qualify the real blog package or diagrams.
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
const mount = () => mountEducationPage(ProtocolPage, '/protocol');
const chapter = (name) => screen.getByRole('heading', { name }).closest('.MuiCard-root');
beforeEach(async () => {
  window.history.replaceState(null, '', '/protocol');
  clearEducationMetadata(); delete window.__MARTY_RUNTIME_CONFIG__;
  documentLoads.length = 0; vi.clearAllMocks(); resetEducationBlogFixture();
  await educationI18n.changeLanguage('en');
});
afterEach(() => { cleanup(); clearEducationMetadata(); delete window.__MARTY_RUNTIME_CONFIG__; });

describe('protocol page composition', () => {
  it('publishes its canonical identity and draft technical article', () => {
    mount();
    expect(screen.getByRole('heading', { level: 1, name: 'Built around an Open Draft Protocol' })).toBeTruthy();
    expect(document.title).toBe('Marty Identity Protocol (MIP) — Open Draft | ElevenID LLC');
    const metadata = educationMetadata();
    expect(metadata.canonical).toBe('https://elevenidllc.com/protocol');
    expect(metadata.schema).toHaveLength(1);
    expect(metadata.schema[0]['@type']).toBe('TechArticle');
    expect(metadata.schema[0].url).toBe(metadata.canonical);
    expect(metadata.schema[0].headline).toContain('open draft protocol');
  });

  it('uses actual translation resources while retaining fallback content', async () => {
    await educationI18n.changeLanguage('fixture');
    mount();
    expect(screen.getByRole('heading', { level: 1, name: 'Translated fixture protocol' })).toBeTruthy();
    expect(screen.getAllByRole('link', { name: 'Translated fixture repository' })).toHaveLength(2);
    expect(screen.getByRole('heading', { name: 'Open Governance' })).toBeTruthy();
  });

  it('retains draft status, version, source limits and independently supplied mappings', () => {
    mount();
    for (const text of [
      'Open Draft Protocol', 'v0.0.0-fixture — Draft fixture', 'Fixture license',
      'A bounded protocol content fixture.', 'Draft mapping; no certification.',
      'Profile-specific fixture coverage.', 'Fixture governance is independently reviewed.',
    ]) expect(screen.getByText(text)).toBeTruthy();
    expect(screen.getByText('Review the exact release and profile. Protocol mappings do not certify a product or deployment.')).toBeTruthy();
  });

  it('keeps repository and specification links separate and safe for a new tab', () => {
    mount();
    for (const [name, destination] of [
      ['View on GitHub', 'https://github.com/example/fixture-protocol'],
      ['Read the Specification', 'https://github.com/example/fixture-protocol/blob/main/SPECIFICATION.md'],
    ]) {
      const links = screen.getAllByRole('link', { name });
      expect(links).toHaveLength(2);
      for (const link of links) {
        expect(link.getAttribute('href')).toBe(destination);
        expect(link.getAttribute('target')).toBe('_blank');
        expect(link.getAttribute('rel').split(/\s+/)).toEqual(expect.arrayContaining(['noopener', 'noreferrer']));
      }
    }
  });

  it('renders a frozen imported article catalogue without writing to it', () => {
    resetEducationBlogFixture({ frozen: true });
    mount();
    expect(within(chapter('Fixture foundations')).getByText('6 articles')).toBeTruthy();
    expect(GUIDE_ARTICLES_BY_CHAPTER[1].map((article) => article.order)).toEqual([3, 1, 6, 2, 5, 4]);
  });

  it('sorts the visible copy without changing the shared catalogue order or reference', () => {
    const original = GUIDE_ARTICLES_BY_CHAPTER[1];
    const before = original.map((article) => article.slug);
    mount();
    expect(GUIDE_ARTICLES_BY_CHAPTER[1]).toBe(original);
    expect(original.map((article) => article.slug)).toEqual(before);
  });

  it('shows the first four articles by order and reports the remaining count', () => {
    mount();
    const card = within(chapter('Fixture foundations'));
    expect(card.getAllByText(/^Fixture lesson \d+$/).map((node) => node.textContent))
      .toEqual(['Fixture lesson 1', 'Fixture lesson 2', 'Fixture lesson 3', 'Fixture lesson 4']);
    expect(card.queryByText('Fixture lesson 5')).toBeNull();
    expect(card.queryByText('Fixture lesson 6')).toBeNull();
    expect(card.getByText('+2 more')).toBeTruthy();
    expect(card.getByText('6 articles')).toBeTruthy();
  });

  it('exposes every listed article as a keyboard-reachable native link', () => {
    mount();
    const articles = screen.getAllByRole('link', { name: /^Fixture (lesson|advanced lesson)/ });
    expect(articles).toHaveLength(5);
    for (const link of articles) {
      expect(link.tagName).toBe('A'); expect(link.tabIndex).toBe(0);
      expect(link.getAttribute('href')).toMatch(/^\/blog\/fixture-(lesson-[1-4]|advanced)$/);
      expect(link.querySelector('a,button,[role="button"]')).toBeNull();
    }
  });

  it('navigates an article through the actual website router', async () => {
    mount();
    await act(async () => { fireEvent.click(screen.getByRole('link', { name: 'Fixture lesson 2' })); });
    expect(screen.getByTestId('education-current-route').textContent).toBe('/blog/fixture-lesson-2');
    expect(documentLoads).toEqual([]);
  });

  it('preserves native modifier and non-primary link activation', () => {
    mount();
    const link = screen.getByRole('link', { name: 'Fixture lesson 2' });
    for (const options of [{ ctrlKey: true }, { metaKey: true }, { shiftKey: true }, { altKey: true }, { button: 1 }]) {
      let intercepted;
      // Observe after React has handled the click, then suppress the jsdom
      // document load. The page must leave native alternate activation intact.
      document.addEventListener('click', (event) => {
        intercepted = event.defaultPrevented;
        event.preventDefault();
      }, { once: true });
      fireEvent.click(link, options);
      expect(intercepted).toBe(false);
      expect(screen.getByTestId('education-current-route').textContent).toBe('/protocol');
      expect(documentLoads).toEqual([]);
    }
  });

  it('leaves an already cancelled article activation untouched', async () => {
    mount();
    const article = screen.getByText('Fixture lesson 2');
    article.addEventListener('click', (event) => event.preventDefault(), { once: true });
    await act(async () => { fireEvent.click(article); });
    expect(screen.getByTestId('education-current-route').textContent).toBe('/protocol');
    expect(documentLoads).toEqual([]);
  });

  it('preserves surface handoff when an unexpected article slug resolves to the application', async () => {
    GUIDE_ARTICLES_BY_CHAPTER[4] = [{ order: 1, slug: '../verify', title: 'Fixture application destination' }];
    mount();
    await act(async () => { fireEvent.click(screen.getByText('Fixture application destination')); });
    expect(documentLoads).toEqual([{ method: 'assign', value: '/verify' }]);
    expect(screen.getByTestId('education-current-route').textContent).toBe('/protocol');
  });

  it('starts a populated chapter at its first ordered article', async () => {
    mount();
    await act(async () => { fireEvent.click(within(chapter('Fixture foundations')).getByRole('button', { name: 'Start chapter' })); });
    expect(screen.getByTestId('education-current-route').textContent).toBe('/blog/fixture-lesson-1');
  });

  it.each(['Fixture empty chapter', 'Fixture unindexed chapter'])('%s has no active navigation without an article', async (name) => {
    mount();
    const card = within(chapter(name));
    const start = card.getByRole('button', { name: 'Start chapter' });
    expect(start.disabled).toBe(true);
    expect(card.getByText('0 articles')).toBeTruthy();
    expect(card.queryByRole('link')).toBeNull();
    await act(async () => { fireEvent.click(start); });
    expect(screen.getByTestId('education-current-route').textContent).toBe('/protocol');
    expect(documentLoads).toEqual([]);
  });

  it('uses configured DNS destinations for every article from a public IP entry', () => {
    configureEducationPublicEntry(); mount();
    for (const link of screen.getAllByRole('link', { name: /^Fixture (lesson|advanced lesson)/ })) {
      expect(link.getAttribute('href')).toMatch(/^https:\/\/identity\.example\.test\/blog\/fixture-/);
    }
    expect(screen.getAllByRole('link', { name: 'View on GitHub' })[0].getAttribute('href'))
      .toBe('https://github.com/example/fixture-protocol');
  });

  it('delegates ordinary article activation to the configured DNS document', async () => {
    configureEducationPublicEntry(); mount();
    await act(async () => { fireEvent.click(screen.getByText('Fixture lesson 2')); });
    expect(documentLoads).toEqual([{ method: 'assign', value: 'https://identity.example.test/blog/fixture-lesson-2' }]);
    expect(screen.getByTestId('education-current-route').textContent).toBe('/protocol');
  });

  it.each([
    ['See our standards implementation', '/standards'], ['How Digital Identity Works', '/identity'],
  ])('%s retains its website destination', async (name, path) => {
    mount();
    await act(async () => { fireEvent.click(screen.getByRole('button', { name })); });
    expect(screen.getByTestId('education-current-route').textContent).toBe(path);
    expect(documentLoads).toEqual([]);
  });

  it('hands the chapter start to configured DNS from a public IP entry', async () => {
    configureEducationPublicEntry(); mount();
    await act(async () => { fireEvent.click(within(chapter('Fixture foundations')).getByRole('button', { name: 'Start chapter' })); });
    expect(documentLoads).toEqual([{ method: 'assign', value: 'https://identity.example.test/blog/fixture-lesson-1' }]);
    expect(screen.getByTestId('education-current-route').textContent).toBe('/protocol');
  });

  it('reports article counts without inventing learner progress', () => {
    mount();
    expect(screen.queryByRole('progressbar')).toBeNull();
    expect(within(chapter('Fixture foundations')).getByText('6 articles')).toBeTruthy();
    expect(within(chapter('Fixture advanced chapter')).getByText('1 article')).toBeTruthy();
  });

  it('retains responsive chapter, mapping and governance card widths', () => {
    const items = educationGridItems(mount().container);
    expect(items).toHaveLength(10);
    expect(items.every((item) => item.classList.contains('MuiGrid-grid-xs-12'))).toBe(true);
    expect(items.every((item) => item.classList.contains('MuiGrid-grid-sm-6'))).toBe(true);
    expect(items.filter((item) => item.classList.contains('MuiGrid-grid-md-4'))).toHaveLength(4);
  });

  it('retains heading, thesis, chapter and mapping font weights with their gutters', () => {
    mount();
    for (const name of [
      'Built around an Open Draft Protocol', 'Protocol Architecture', 'Learn the Protocol',
      'Standards Alignment', 'Open Governance', 'Get Involved',
    ]) expect(getComputedStyle(screen.getByRole('heading', { name })).fontWeight).toBe('800');
    expect(getComputedStyle(screen.getByText('“Fixture policy is reviewed before use.”')).fontWeight).toBe('600');
    for (const name of ['Fixture foundations', 'Fixture mapping A']) {
      expect(['700', 'bold']).toContain(getComputedStyle(screen.getByRole('heading', { name })).fontWeight);
    }
    expect(getComputedStyle(screen.getByRole('heading', { name: 'Protocol Architecture' })).textAlign).toBe('center');
    expect(getComputedStyle(screen.getByRole('heading', { name: 'Standards Alignment' })).textAlign).toBe('center');
    const heroStyle = getComputedStyle(screen.getByRole('heading', { level: 1 }));
    if (heroStyle.marginBottom.endsWith('em')) {
      expect(parseFloat(heroStyle.marginBottom)).toBeCloseTo(0.35, 5);
    } else {
      expect(heroStyle.marginBottom).toMatch(/px$/);
      expect(heroStyle.fontSize).toMatch(/px$/);
      expect(parseFloat(heroStyle.marginBottom)).toBeCloseTo(0.35 * parseFloat(heroStyle.fontSize), 5);
    }
  });

  it('retains the explicitly deferred interactive protocol map position', () => {
    mount();
    expect(screen.getByRole('heading', { name: 'Protocol Architecture' })).toBeTruthy();
    expect(screen.getByRole('complementary', { name: 'Deferred protocol map' })).toBeTruthy();
  });
});
