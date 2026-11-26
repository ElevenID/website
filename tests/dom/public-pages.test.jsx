import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter, useLocation } from 'react-router';
import { createTheme, ThemeProvider } from '@mui/material/styles';
import DigitalCredential from '../../ui/src/components/pages/WhatIsDigitalCredentialPage.jsx';
import CredentialVerification from '../../ui/src/components/pages/WhatIsCredentialVerificationPage.jsx';
import MartyProtocol from '../../ui/src/components/pages/WhatIsMartyProtocolPage.jsx';
import OpenBadge from '../../ui/src/components/pages/WhatIsOpenBadgePage.jsx';
import EudiWallet from '../../ui/src/components/pages/EudiWalletVerificationPage.jsx';
import IsoMdoc from '../../ui/src/components/pages/IsoMdocVerificationPage.jsx';
import BadgeIssuance from '../../ui/src/components/pages/OpenBadgesIssuancePage.jsx';
import BadgeVerification from '../../ui/src/components/pages/OpenBadgesVerificationPage.jsx';
import SdJwt from '../../ui/src/components/pages/SdJwtVerificationPage.jsx';
import TrustRegistry from '../../ui/src/components/pages/TrustRegistryPage.jsx';

// Independently authored integration cases. React, MUI, Router, SEO and URL
// helpers execute normally; only the terminal document-loading methods are recorded.
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

const theme = createTheme();
const pages = [
  { Component: DigitalCredential, path: '/what-is-digital-credential', heading: 'What Is a Digital Credential?', title: 'What Is a Digital Credential? — ElevenID', sizes: ['xs-12', 'sm-6', 'md-4', 'md-6'] },
  { Component: CredentialVerification, path: '/what-is-credential-verification', heading: 'What Is Credential Verification?', title: 'What Is Credential Verification? — ElevenID', sizes: ['xs-12', 'sm-6'] },
  { Component: MartyProtocol, path: '/what-is-marty-protocol', heading: 'What Is the Marty Identity Protocol?', title: 'What Is the Marty Identity Protocol? — People and Agents', sizes: ['xs-12', 'sm-6'] },
  { Component: OpenBadge, path: '/what-is-open-badge', heading: 'What Is an Open Badge?', title: 'What Is an Open Badge? — ElevenID', sizes: ['xs-12', 'sm-6'] },
  { Component: EudiWallet, path: '/eudi-wallet-verification', heading: 'EUDI Wallet Verification API', sizes: ['xs-12', 'md-4'] },
  { Component: IsoMdoc, path: '/iso-18013-5-mdoc-verification', heading: 'ISO 18013-5 mDoc Verification API' },
  { Component: BadgeIssuance, path: '/open-badges-issuance', heading: 'Open Badges 3.0 Issuance Infrastructure', title: 'Open Badges 3.0 Issuance API' },
  { Component: BadgeVerification, path: '/open-badges-verification', heading: 'Open Badges 3.0 Verification API', sizes: ['xs-12', 'md-4'] },
  { Component: SdJwt, path: '/sd-jwt-verification', heading: 'SD-JWT Verification API' },
  { Component: TrustRegistry, path: '/trust-registry-infrastructure', heading: 'Trust Registry Infrastructure' },
];
function CurrentRoute() {
  const location = useLocation();
  return <output data-testid="current-route">{location.pathname + location.search + location.hash}</output>;
}
function renderPage(Component, path) {
  window.history.replaceState(null, '', path);
  return render(<ThemeProvider theme={theme}><MemoryRouter initialEntries={[path]}>
    <Component /><CurrentRoute />
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
  delete window.__MARTY_RUNTIME_CONFIG__;
  documentLoads.length = 0;
  vi.clearAllMocks();
});
afterEach(() => {
  cleanup();
  clearMetadata();
  delete window.__MARTY_RUNTIME_CONFIG__;
});

describe('public page integration', () => {
  it('teaches five core primitives while keeping delegation a supporting abstraction', () => {
    renderPage(MartyProtocol, '/what-is-marty-protocol');
    for (const name of ['Trust Profile', 'Credential Template', 'Presentation Policy', 'Deployment Profile', 'Flow']) {
      expect(screen.getByRole('heading', { level: 3, name })).toBeTruthy();
    }
    expect(screen.queryByRole('heading', { name: 'Compliance Profile' })).toBeNull();
    expect(screen.queryByRole('heading', { name: 'DelegationGrant' })).toBeNull();
    expect(screen.getByText(/None adds a sixth core primitive/)).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Agent identity and integration' }).getAttribute('href')).toBe('/ai');
  });
  it.each(pages)('renders $path with its heading and canonical metadata', ({ Component, path, heading, title }) => {
    renderPage(Component, path);
    expect(screen.getByRole('heading', { level: 1, name: heading })).toBeTruthy();
    expect(document.title).toBe((title || heading) + ' | ElevenID LLC');
    expect(document.head.querySelector('link[rel="canonical"]').getAttribute('href')).toBe('https://elevenidllc.com' + path);
    expect(document.head.querySelector('meta[name="description"]').getAttribute('content').length).toBeGreaterThan(0);
    const jsonld = document.head.querySelectorAll('script[data-seo-jsonld="true"]');
    expect(jsonld).toHaveLength(1);
    expect(JSON.parse(jsonld[0].textContent)).toBeTruthy();
    expect(screen.getByTestId('current-route').textContent).toBe(path);
    expect(documentLoads).toEqual([]);
  });

  // MUI 9 derives these sizing classes from its effective size prop.
  // This checks real DOM sizing output, not jsdom pixel layout.
  it.each(pages.filter((page) => page.sizes))('$path retains its responsive grid sizing', ({ Component, path, sizes }) => {
    const view = renderPage(Component, path);
    const items = [...view.container.querySelectorAll('.MuiGrid-root:not(.MuiGrid-container)')];
    expect(items.length).toBeGreaterThan(0);
    expect(items.every((item) => item.classList.contains('MuiGrid-grid-xs-12'))).toBe(true);
    for (const size of sizes) {
      expect(view.container.querySelectorAll('.MuiGrid-grid-' + size).length).toBeGreaterThan(0);
    }
  });

  it('hands badge setup to the authenticated console document with prerequisites visible', async () => {
    renderPage(BadgeIssuance, '/open-badges-issuance');
    const guidance = screen.getByRole('alert').textContent;
    expect(guidance).toContain('Sign in to an organization');
    expect(guidance).toContain('synthetic learner data');
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Set up a badge workflow' })); });
    expect(documentLoads).toEqual([{ method: 'assign', value: '/console/org/templates/credentials/new' }]);
    expect(screen.getByTestId('current-route').textContent).toBe('/open-badges-issuance');
  });

  it('keeps navigation between the two badge pages within the website router', async () => {
    renderPage(BadgeVerification, '/open-badges-verification');
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Open Badges Issuance' })); });
    expect(screen.getByTestId('current-route').textContent).toBe('/open-badges-issuance');
    expect(documentLoads).toEqual([]);
  });

  it('hands application-owned API docs to a separate document', async () => {
    renderPage(SdJwt, '/sd-jwt-verification');
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'View API Docs' })); });
    expect(documentLoads).toEqual([{ method: 'assign', value: '/docs' }]);
    expect(screen.getByTestId('current-route').textContent).toBe('/sd-jwt-verification');
  });

  it.each(pages.filter((page) => [EudiWallet, IsoMdoc].includes(page.Component)))(
    '$path keeps commercial-scope controls withheld by the website configuration',
    ({ Component, path }) => {
      renderPage(Component, path);
      expect(screen.queryByRole('button', { name: 'Review Commercial Scope' })).toBeNull();
    },
  );
});
