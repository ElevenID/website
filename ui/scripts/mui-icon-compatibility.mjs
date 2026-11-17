import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const defaultNodeModulesRoot = fileURLToPath(new URL('../../node_modules/', import.meta.url));

// Extracted from the source Vite configuration. The pinned blog package still
// imports MUI 5 icon .js paths; MUI 9 publishes these entrypoints as .mjs.
// The destination installs dependencies at the repository root.
export function muiIconMjsCompatibilityPlugin(nodeModulesRoot = defaultNodeModulesRoot) {
  const iconsRoot = path.join(nodeModulesRoot, '@mui', 'icons-material');
  return {
    name: 'mui-icon-mjs-compatibility',
    enforce: 'pre',
    resolveId(source) {
      if (!/^@mui\/icons-material\/.+\.js$/.test(source)) return null;

      const iconName = source.slice('@mui/icons-material/'.length, -'.js'.length);
      const iconPath = path.join(iconsRoot, iconName + '.mjs');
      if (existsSync(iconPath)) return iconPath;

      const renamedIconPath = path.join(
        iconsRoot, iconName.replace(/Outline$/, 'Outlined') + '.mjs',
      );
      return existsSync(renamedIconPath) ? renamedIconPath : null;
    },
  };
}
