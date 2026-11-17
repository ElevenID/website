import { fileURLToPath } from 'node:url';

const root = new URL('../../', import.meta.url);
const absolute = (path) => fileURLToPath(new URL(path, root));
const marketingData = absolute('tests/fixtures/marketing-section-data.mjs');
const catalogData = absolute('tests/fixtures/marketing-support-catalog.json');
const diagram = absolute('tests/fixtures/marketing-diagram-boundary.jsx');
const component = (name) => absolute(`ui/src/components/${name}.jsx`);
const mui = '@mui/material';
const icon = (name) => `@mui/icons-material/${name}`;
const runtime = ['react/jsx-runtime', 'react/jsx-dev-runtime'];
const landing = ['../../data/marketingContent', './LandingSection', mui, ...runtime];
const publicEntry = '../../application/routing/publicEntry';

// Each entry is scoped to an actual, explicitly reviewed small component.
// Neither the diagram barrel nor missing large production data is ever loaded.
const allowed = new Map([
  [component('pages/AiCapabilityPage'), new Set([
    '../../application/routing/useSurfaceNavigate', publicEntry, mui, '../seo', '../seo/structuredData',
    './MarketingProtocolSupportCatalog', ...runtime,
    ...['SmartToy', 'Verified', 'Security', 'IntegrationInstructions', 'Schema', 'Policy'].map(icon),
  ])],
  [component('pages/MarketingProtocolSupportCatalog'), new Set([
    mui, publicEntry, '../../../../contracts/protocol-support-catalog.json',
    '../../application/protocolSupportCatalog', './ProtocolSupportCatalogView', ...runtime,
  ])],
  [component('landing/ProductCapabilitiesSection'), new Set([
    ...landing, publicEntry,
    ...['FlightTakeoff', 'ArrowForward', 'Api', 'PhoneIphone', 'SettingsInputAntenna'].map(icon),
  ])],
  [component('landing/EndUserExperienceSection'), new Set(landing)],
  [component('landing/DeploymentModelsSection'), new Set([
    ...landing, publicEntry, 'react-router', '../diagrams',
    ...['Api', 'Business', 'SettingsInputAntenna', 'CheckCircle', 'ArrowForward'].map(icon),
  ])],
  [component('landing/ProofLabSection'), new Set([
    ...landing, publicEntry, ...['ArrowForward', 'CheckCircle', 'Cancel'].map(icon),
  ])],
]);

export function marketingContentBoundaryPlugin() {
  return {
    name: 'bounded-marketing-content-fixtures',
    enforce: 'pre',
    resolveId(source, importer) {
      const parent = importer?.split('?')[0];
      const imports = allowed.get(parent);
      if (!imports) return null;
      if (!imports.has(source)) throw new Error(`Unlisted marketing component boundary: ${source}`);
      if (source === '../../data/marketingContent') return marketingData;
      if (parent === component('pages/MarketingProtocolSupportCatalog')
        && source === '../../../../contracts/protocol-support-catalog.json') return catalogData;
      if (parent === component('landing/DeploymentModelsSection') && source === '../diagrams') return diagram;
      return null;
    },
  };
}
