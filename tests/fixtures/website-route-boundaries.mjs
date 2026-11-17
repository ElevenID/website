import { fileURLToPath } from 'node:url';

const websiteRoutes = fileURLToPath(new URL('../../ui/src/apps/website/WebsiteRoutes.jsx', import.meta.url));
const marketingRoutes = fileURLToPath(new URL('../../ui/src/variants/marketingRoutes.jsx', import.meta.url));
const commerceFacade = fileURLToPath(new URL('../../ui/src/extensions/commerce/website.js', import.meta.url));
const publicCommerceStub = fileURLToPath(new URL('../../ui/src/extensions/commerce/publicStub.jsx', import.meta.url));
const websitePublicConfig = fileURLToPath(new URL('../../ui/src/variants/publicConfig.website.js', import.meta.url));
const namespace = '\0website-route-boundary:';
const jsxRuntimes = ['react/jsx-runtime', 'react/jsx-dev-runtime'];
const marketingPassthrough = new Set(['react', 'react-router', ...jsxRuntimes]);
const websitePassthrough = new Set([
  'react-router', ...jsxRuntimes, '@ui-public-config', websitePublicConfig,
  '../../components/WebSectionUnavailable', '../../variants/marketingRoutes',
  '../../extensions/commerce/website', '../../utils/runtimeConfig',
  '../../application/routing/useSurfaceNavigate',
]);

// Only the two real route modules receive these explicit page boundaries. Other
// DOM suites still load their actual page components. No page content, diagram,
// production catalog, manifest or blog package is read by this routing fixture.
const pageModules = new Map([
  ['../components/ProductPage', ['ProductPage']],
  ['../components/StandardsPage', ['StandardsPage']],
  ['../components/ProtocolPage', ['ProtocolPage']],
  ['../components/IdentityGuidePage', ['IdentityGuidePage']],
  ['../components/FromIDVPage', ['FromIDVPage']],
  ['../components/pages/VerifiableCredentialApiPage', ['VerifiableCredentialApiPage']],
  ['../components/pages/EudiWalletVerificationPage', ['EudiWalletVerificationPage']],
  ['../components/pages/IsoMdocVerificationPage', ['IsoMdocVerificationPage']],
  ['../components/pages/SdJwtVerificationPage', ['SdJwtVerificationPage']],
  ['../components/pages/OpenBadgesVerificationPage', ['OpenBadgesVerificationPage']],
  ['../components/pages/OpenBadgesIssuancePage', ['OpenBadgesIssuancePage']],
  ['../components/pages/TrustRegistryPage', ['TrustRegistryPage']],
  ['../components/pages/AiCapabilityPage', ['AiCapabilityPage']],
  ['../components/pages/WhatIsCredentialVerificationPage', ['WhatIsCredentialVerificationPage']],
  ['../components/pages/WhatIsOpenBadgePage', ['WhatIsOpenBadgePage']],
  ['../components/pages/WhatIsDigitalCredentialPage', ['WhatIsDigitalCredentialPage']],
  ['../components/pages/WhatIsMartyProtocolPage', ['WhatIsMartyProtocolPage']],
  ['@elevenid/marty-blog/blog-page', ['BlogPage']],
  ['@elevenid/marty-blog/blog-post-page', ['BlogPostPage']],
  ['@elevenid/marty-blog/authors-page', ['AuthorsPage']],
  ['@elevenid/marty-blog/author-page', ['AuthorPage']],
  ['@elevenid/marty-blog/foundations-page', ['FoundationsPage']],
  ['../components/pages/PublicIAPages', {
    SolutionsPage: 'SolutionsPage', DevelopersPage: 'DevelopersPage',
    ArchitecturePage: 'ArchitecturePage', SecurityPage: 'SecurityPage', ResourcesPage: 'ResourcesPage',
  }],
  ['../components/pages/LegalPages', {
    PrivacyPolicyPage: 'PrivacyPolicyPage', TermsOfServicePage: 'TermsOfServicePage',
  }],
  ['../components/pages/DemoPages', {
    DemoCatalogPage: 'DemoCatalogPage', DemoReleasePage: 'DemoReleasePage',
    DemoScenarioPage: 'DemoScenarioPage', DemoLatestScenarioRedirect: 'DemoLatestScenarioRedirect',
  }],
]);

function exportLabels(value) {
  return Array.isArray(value) ? { default: value[0] } : value;
}

export function websiteRouteBoundaryPlugin() {
  // Vite may reuse a transformed importer across plugin instances. Known virtual
  // modules must therefore load without a preceding resolveId call in this run.
  const modules = new Map([
    [namespace + encodeURIComponent('../../components/LandingPageContent'), { default: 'LandingPageContent' }],
    ...Array.from(pageModules, ([source, labels]) => [namespace + encodeURIComponent(source), exportLabels(labels)]),
  ]);
  return {
    name: 'website-routing-fixture-boundaries',
    enforce: 'pre',
    resolveId(source, importer) {
      const parent = importer?.split('?')[0];
      if (parent === websiteRoutes && source === '../../components/LandingPageContent') {
        return namespace + encodeURIComponent(source);
      } else if (parent === marketingRoutes && pageModules.has(source)) {
        return namespace + encodeURIComponent(source);
      } else if (parent === commerceFacade && source === '@marty/commerce-extension') {
        // Use the real checked-in public implementation, only at this facade.
        return publicCommerceStub;
      } else if ((parent === marketingRoutes && !marketingPassthrough.has(source))
        || (parent === websiteRoutes && !websitePassthrough.has(source))) {
        throw new Error(`Unlisted deferred route boundary: ${source}`);
      } else {
        return null;
      }
    },
    load(id) {
      if (!id.startsWith(namespace)) return null;
      const labels = modules.get(id);
      if (!labels) throw new Error(`Unknown routing fixture module: ${id}`);
      const exports = Object.entries(labels).map(([name, label]) => {
        const declaration = name === 'default' ? 'export default function' : `export function ${name}`;
        return `${declaration}() { return createElement('section', null, createElement('h1', { 'data-testid': 'route-page-boundary' }, ${JSON.stringify(label)}), createElement('output', { 'data-testid': 'route-params' }, JSON.stringify(useParams()))); }`;
      });
      return `import { createElement } from 'react';\nimport { useParams } from 'react-router';\n${exports.join('\n')}\n`;
    },
  };
}
