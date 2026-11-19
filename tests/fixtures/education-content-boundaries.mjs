import { modulePath } from './module-path.mjs';
import { fileURLToPath } from 'node:url';

const root = new URL('../../', import.meta.url);
const absolute = (path) => modulePath(fileURLToPath(new URL(path, root)));
const component = (name) => absolute(`ui/src/components/${name}.jsx`);
const icon = (name) => `@mui/icons-material/${name}`;
const common = [
  '../application/routing/useSurfaceNavigate', '@mui/material', './seo',
  '../data/marketingContent', './diagrams', 'react/jsx-runtime', 'react/jsx-dev-runtime',
];
const allowed = new Map([
  [component('IdentityGuidePage'), new Set([
    ...common, './seo/structuredData', '@mui/material/Button', icon('ArrowForward'),
  ])],
  [component('StandardsPage'), new Set([
    ...common, ...['PortableWifiOff', 'VerifiedUser', 'TrendingUp', 'IntegrationInstructions', 'ArrowForward', 'GitHub'].map(icon),
  ])],
  [component('ProtocolPage'), new Set([
    ...common, './seo/structuredData', 'react-i18next', '@elevenid/marty-blog',
    '../application/routing/publicEntry',
    ...['GitHub', 'MenuBook', 'ArrowForward', 'CheckCircle', 'Groups', 'Gavel', 'Public', 'Inventory', 'School'].map(icon),
  ])],
]);
const fixtures = new Map([
  ['../data/marketingContent', absolute('tests/fixtures/education-marketing-data.mjs')],
  ['./diagrams', absolute('tests/fixtures/education-diagram-boundary.jsx')],
  ['@elevenid/marty-blog', absolute('tests/fixtures/education-blog-data.mjs')],
]);

export function educationContentBoundaryPlugin() {
  return {
    name: 'bounded-education-content-fixtures',
    enforce: 'pre',
    resolveId(source, importer) {
      const imports = allowed.get(modulePath(importer));
      if (!imports) return null;
      if (!imports.has(source)) throw new Error(`Unlisted education page boundary: ${source}`);
      return fixtures.get(source) ?? null;
    },
  };
}
