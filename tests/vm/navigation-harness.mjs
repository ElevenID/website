import { readFile, stat } from 'node:fs/promises';
import vm from 'node:vm';

// Execute a bounded real source graph; only the JSON module is synthetic.
// This is helper qualification, not a DOM, React or browser navigation test.
const root = new URL('../../', import.meta.url);
const files = {
  appHandoff: 'ui/src/application/routing/appHandoff.js',
  publicEntry: 'ui/src/application/routing/publicEntry.js',
  landingEntry: 'ui/src/application/routing/landingEntry.js',
  webSurface: 'ui/src/application/routing/webSurface.js',
  safeNavigation: 'ui/src/application/routing/safeNavigation.js',
  runtimeConfig: 'ui/src/utils/runtimeConfig.js',
  webSurfaceContract: 'ui/src/application/routing/webSurfaceContract.mjs',
  asciiControls: 'ui/src/utils/hasAsciiControlCharacters.js',
};
async function readBounded(path) {
  const url = new URL(path, root);
  if ((await stat(url)).size > 16384) throw new Error('Source exceeds small-file limit: ' + path);
  return readFile(url, 'utf8');
}
const sources = await Promise.all(Object.entries(files).map(async ([name, path]) => ({
  name, path, identifier: new URL(path, root).href, source: await readBounded(path),
})));
const contractPath = 'contracts/web-surface-routes.json';
const contractIdentifier = new URL(contractPath, root).href;
const contractJSON = JSON.stringify(JSON.parse(await readBounded(contractPath)));

export async function loadNavigation({
  href = 'https://elevenidllc.com/product',
  runtimeConfig,
  env = {},
  withWindow = true,
  locationMethods = ['assign', 'replace'],
} = {}) {
  let current = new URL(href);
  const calls = [];
  const location = {};
  function record(method, destination) {
    calls.push({ method, destination });
    current = new URL(destination, current);
  }
  for (const key of ['origin', 'pathname', 'search', 'hash']) {
    Object.defineProperty(location, key, { enumerable: true, get: () => current[key] });
  }
  Object.defineProperty(location, 'href', {
    enumerable: true, get: () => current.href,
    set: (destination) => record('href', destination),
  });
  for (const method of locationMethods) {
    if (!['assign', 'replace'].includes(method)) throw new Error('Unknown location method');
    location[method] = (destination) => record(method, destination);
  }
  const window = withWindow ? { location, __MARTY_RUNTIME_CONFIG__: runtimeConfig } : undefined;
  const context = vm.createContext({ URL, URLSearchParams, ...(withWindow ? { window } : {}) });
  const buildEnv = { ...env };
  const modules = new Map(sources.map(({ identifier, source }) => [
    identifier, new vm.SourceTextModule(source, {
      context, identifier,
      initializeImportMeta(meta) { meta.env = buildEnv; },
    }),
  ]));
  const contract = vm.runInContext('JSON.parse(' + JSON.stringify(contractJSON) + ')', context);
  modules.set(contractIdentifier, new vm.SyntheticModule(['default'], function () {
    this.setExport('default', contract);
  }, { context, identifier: contractIdentifier }));
  const entry = new vm.SourceTextModule(
    sources.map(({ path }) => 'import ' + JSON.stringify('./' + path) + ';').join('\n'),
    { context, identifier: new URL('__navigation_entry__.js', root).href },
  );
  await entry.link((specifier, referrer) => {
    if (!specifier.startsWith('.')) throw new Error('Unexpected dependency: ' + specifier);
    const target = new URL(specifier, referrer.identifier).href;
    const dependency = modules.get(target) || modules.get(target + '.js') || modules.get(target + '.mjs');
    if (!dependency) throw new Error('Dependency outside navigation slice: ' + specifier);
    return dependency;
  });
  await entry.evaluate();
  return {
    ...Object.fromEntries(sources.map(({ name, identifier }) => [name, modules.get(identifier).namespace])),
    window, location, calls, env: buildEnv,
  };
}
