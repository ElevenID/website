import { Suspense } from 'react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useLocation, useNavigate } from 'react-router';
import WebsiteRoutes from '../../ui/src/apps/website/WebsiteRoutes.jsx';
import { renderWebsiteContentRoutes } from '../../ui/src/variants/marketingRoutes.jsx';

// The fixture plugin isolates only deferred page modules. The actual two route
// modules, runtime configuration, React Router, unavailable page and public
// commerce implementation execute here; page content/playback stay out of scope.
function LocationProbe() {
  const location = useLocation();
  const navigate = useNavigate();
  return <>
    <output data-testid="route-location">{location.pathname}{location.search}{location.hash}</output>
    <button onClick={() => navigate(-1)}>History back</button>
  </>;
}

function mountWebsite(path, { entries, runtime } = {}) {
  if (runtime !== undefined) window.__MARTY_RUNTIME_CONFIG__ = runtime;
  return render(
    <MemoryRouter initialEntries={entries || [path]} initialIndex={entries ? entries.length - 1 : 0}>
      <LocationProbe />
      <Suspense fallback={<p>Loading route boundary</p>}>
        <WebsiteRoutes />
      </Suspense>
    </MemoryRouter>,
  );
}

function mountMarketing(path, showDemos) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <LocationProbe />
      <Suspense fallback={<p>Loading route boundary</p>}>
        <Routes>
          {renderWebsiteContentRoutes({ showDemos })}
          <Route path="*" element={<h1>Unmatched marketing route</h1>} />
        </Routes>
      </Suspense>
    </MemoryRouter>,
  );
}

async function expectPage(label) {
  expect(await screen.findByRole('heading', { name: label })).toBeTruthy();
  expect(screen.queryByTestId('web-section-unavailable')).toBeNull();
}

beforeEach(() => { delete window.__MARTY_RUNTIME_CONFIG__; });
afterEach(() => {
  cleanup();
  delete window.__MARTY_RUNTIME_CONFIG__;
});

describe('actual website route composition with explicit deferred-page boundaries', () => {
  it.each([
    ['/', 'LandingPageContent'],
    ['/product', 'ProductPage'],
    ['/solutions', 'SolutionsPage'],
    ['/developers', 'DevelopersPage'],
    ['/architecture', 'ArchitecturePage'],
    ['/security', 'SecurityPage'],
    ['/resources', 'ResourcesPage'],
    ['/standards', 'StandardsPage'],
    ['/protocol', 'ProtocolPage'],
    ['/identity', 'IdentityGuidePage'],
    ['/verifiable-credential-api', 'VerifiableCredentialApiPage'],
    ['/eudi-wallet-verification', 'EudiWalletVerificationPage'],
    ['/iso-18013-5-mdoc-verification', 'IsoMdocVerificationPage'],
    ['/sd-jwt-verification', 'SdJwtVerificationPage'],
    ['/open-badges-verification', 'OpenBadgesVerificationPage'],
    ['/open-badges-issuance', 'OpenBadgesIssuancePage'],
    ['/trust-registry-infrastructure', 'TrustRegistryPage'],
    ['/ai', 'AiCapabilityPage'],
    ['/what-is-credential-verification', 'WhatIsCredentialVerificationPage'],
    ['/what-is-open-badge', 'WhatIsOpenBadgePage'],
    ['/what-is-digital-credential', 'WhatIsDigitalCredentialPage'],
    ['/what-is-marty-protocol', 'WhatIsMartyProtocolPage'],
  ])('selects the intended page module for %s', async (path, label) => {
    mountWebsite(path);
    await expectPage(label);
    expect(screen.getByTestId('route-location').textContent).toBe(path);
  });

  it.each([
    ['/why-verifiable-identity', 'FromIDVPage'],
    ['/from-idv-to-verifiable-identity', 'FromIDVPage'],
    ['/what-is-verifiable-identity', 'FromIDVPage'],
    ['/privacy-policy', 'PrivacyPolicyPage'],
    ['/privacy', 'PrivacyPolicyPage'],
    ['/terms-of-service', 'TermsOfServicePage'],
    ['/terms', 'TermsOfServicePage'],
  ])('retains the existing content alias %s', async (path, label) => {
    mountWebsite(path);
    await expectPage(label);
    expect(screen.getByTestId('route-location').textContent).toBe(path);
  });

  it.each([
    ['/verification?view=legacy#details', '/verifiable-credential-api', 'VerifiableCredentialApiPage'],
    ['/issuance?view=legacy#details', '/open-badges-issuance', 'OpenBadgesIssuancePage'],
  ])('replaces the canonical redirect history entry for %s', async (legacy, canonical, label) => {
    mountWebsite(legacy, { entries: ['/resources', legacy] });
    await expectPage(label);
    // Preserve the source's pathname-only redirect, including its query/hash behavior.
    expect(screen.getByTestId('route-location').textContent).toBe(canonical);
    fireEvent.click(screen.getByRole('button', { name: 'History back' }));
    await expectPage('ResourcesPage');
    expect(screen.getByTestId('route-location').textContent).toBe('/resources');
  });

  it.each([
    ['/blog', 'BlogPage', {}],
    ['/blog/tag/open-badges', 'BlogPage', { tag: 'open-badges' }],
    ['/blog/foundations', 'FoundationsPage', {}],
    ['/blog/release-notes', 'BlogPostPage', { slug: 'release-notes' }],
    ['/authors', 'AuthorsPage', {}],
    ['/authors/fixture-author', 'AuthorPage', { authorId: 'fixture-author' }],
    ['/demos', 'DemoCatalogPage', {}],
    ['/demos/latest/open-badges', 'DemoLatestScenarioRedirect', { scenario: 'open-badges' }],
    ['/demos/v1.2.3/open-badges', 'DemoScenarioPage', { stackVersion: 'v1.2.3', scenario: 'open-badges' }],
    ['/demos/v1.2.3', 'DemoReleasePage', { stackVersion: 'v1.2.3' }],
  ])('selects the correct static or parameterized route for %s', async (path, label, params) => {
    mountWebsite(path);
    await expectPage(label);
    expect(JSON.parse(screen.getByTestId('route-params').textContent)).toEqual(params);
  });

  it.each(['/pricing', '/pricing/checkout', '/not-a-page', '/console', '/login', '/verify'])
    ('does not invent a website page or enable commerce for %s', async (path) => {
      mountWebsite(path);
      expect(await screen.findByTestId('web-section-unavailable')).toBeTruthy();
      expect(screen.queryByTestId('route-page-boundary')).toBeNull();
    });

  it.each([
    { web: { enabled_sections: [] } },
    { web: { enabled_sections: ['console'] } },
    { web: { enabled_sections: ['public', 'public'] } },
    { web: { enabled_sections: ['public', 'unknown'] } },
    { web: { enabled_sections: 'public' } },
    { web: null },
  ])('honors the real disabled or invalid public-section configuration %#', async (runtime) => {
    mountWebsite('/product', { runtime });
    expect(await screen.findByTestId('web-section-unavailable')).toBeTruthy();
    expect(screen.queryByTestId('route-page-boundary')).toBeNull();
  });

  it('keeps a nested marketing route usable with only the public section enabled', async () => {
    mountWebsite('/blog/tag/open-badges?view=latest#articles', {
      runtime: { web: { enabled_sections: ['public'] } },
    });
    await expectPage('BlogPage');
    expect(screen.getByTestId('route-location').textContent)
      .toBe('/blog/tag/open-badges?view=latest#articles');
  });
});

describe('actual marketing route publication switch', () => {
  it.each(['/demos', '/demos/latest/open-badges', '/demos/v1.2.3/open-badges', '/demos/v1.2.3'])
    ('excludes %s when demos are withheld', async (path) => {
      mountMarketing(path, false);
      expect(await screen.findByRole('heading', { name: 'Unmatched marketing route' })).toBeTruthy();
      expect(screen.queryByTestId('route-page-boundary')).toBeNull();
    });

  it('keeps ordinary content routes enabled when demos are withheld', async () => {
    mountMarketing('/resources', false);
    await expectPage('ResourcesPage');
  });
});
