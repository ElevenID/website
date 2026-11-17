import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
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
import PublicFooter from '../../ui/src/components/layouts/PublicFooter.jsx';
import { SectionHeading } from '../../ui/src/components/landing/LandingSection.jsx';

// MUI 9 removed Typography's system-prop expansion. These assertions inspect
// real rendered CSS; no Typography, styling-engine, or DOM methods are mocked.
const theme = createTheme();
const pages = [
  ['/what-is-digital-credential', DigitalCredential],
  ['/what-is-credential-verification', CredentialVerification],
  ['/what-is-marty-protocol', MartyProtocol],
  ['/what-is-open-badge', OpenBadge],
  ['/eudi-wallet-verification', EudiWallet],
  ['/iso-18013-5-mdoc-verification', IsoMdoc],
  ['/open-badges-issuance', BadgeIssuance],
  ['/open-badges-verification', BadgeVerification],
  ['/sd-jwt-verification', SdJwt],
  ['/trust-registry-infrastructure', TrustRegistry],
];

function renderContent(children, pathname = '/product') {
  window.history.replaceState(null, '', pathname);
  return render(<ThemeProvider theme={theme}>
    <MemoryRouter initialEntries={[pathname]}>{children}</MemoryRouter>
  </ThemeProvider>);
}
function computedWeight(element) {
  const value = window.getComputedStyle(element).fontWeight;
  // CSSOM implementations may retain the equivalent font-weight keyword.
  return value === 'bold' ? 700 : value === 'normal' ? 400 : Number(value);
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
});
afterEach(() => {
  cleanup();
  clearMetadata();
  delete window.__MARTY_RUNTIME_CONFIG__;
});

describe('MUI typography compatibility', () => {
  it.each(pages)('%s retains its explicitly bold primary heading', (pathname, Component) => {
    renderContent(<Component />, pathname);
    expect(computedWeight(screen.getByRole('heading', { level: 1 }))).toBe(700);
  });

  it('retains the footer brand label weight', () => {
    renderContent(<PublicFooter />);
    expect(computedWeight(screen.getByText('ElevenID LLC'))).toBe(700);
  });

  it('retains the landing section heading weight', () => {
    renderContent(<SectionHeading>Capabilities</SectionHeading>);
    expect(computedWeight(screen.getByRole('heading', { level: 2, name: 'Capabilities' }))).toBe(800);
  });

  it.each([
    ['/what-is-digital-credential', DigitalCredential, ['electronic equivalent of a physical document']],
    ['/what-is-credential-verification', CredentialVerification, ['act of validating that a digital credential']],
    ['/what-is-marty-protocol', MartyProtocol, ['defines the core building blocks', 'Existing credential standards tell you']],
    ['/what-is-open-badge', OpenBadge, ['packages a claim about an achievement']],
  ])('%s retains the spacing after explanatory paragraphs', (pathname, Component, fragments) => {
    const { container } = renderContent(<Component />, pathname);
    const paragraphs = [...container.querySelectorAll('p')];
    for (const fragment of fragments) {
      const paragraph = paragraphs.find((element) =>
        element.textContent.replace(/\s+/g, ' ').includes(fragment));
      expect(paragraph, fragment).toBeDefined();
      expect(window.getComputedStyle(paragraph).marginBottom).toBe('16px');
    }
  });
});
