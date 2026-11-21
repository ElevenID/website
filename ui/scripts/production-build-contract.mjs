import { existsSync, lstatSync, readFileSync } from 'node:fs';
import path from 'node:path';

export const COMMERCE_REPOSITORY = 'ElevenID/marty-subscriptions';

function privateFile(filename, label, maximum = 4 * 1024 * 1024) {
  if (!existsSync(filename)) throw new Error(label + ' is missing');
  let current = path.parse(filename).root;
  for (const segment of filename.slice(current.length).split(path.sep)) {
    current = path.join(current, segment);
    if (lstatSync(current).isSymbolicLink()) throw new Error(label + ' cannot contain symlinks');
  }
  const stat = lstatSync(filename);
  if (!stat.isFile() || stat.size <= 0 || stat.size > maximum) throw new Error(label + ' must be a bounded regular file');
  return filename;
}

export function productionBuildContract({ pages = 'public', selfhost = false, surface = 'combined', extensionPath, sourceSha }) {
  if (!['combined', 'website', 'application'].includes(surface)) throw new Error('Unknown UI surface');
  if (!['public', 'full'].includes(pages)) throw new Error('Unknown production page set');
  if (pages === 'public') {
    if (extensionPath || sourceSha) throw new Error('Commerce inputs require the full production page set');
    return null;
  }
  if (selfhost) throw new Error('Customer UI cannot include the production commerce extension');
  if (typeof extensionPath !== 'string' || !path.isAbsolute(extensionPath)
    || typeof sourceSha !== 'string' || sourceSha.length !== 40 || !/^[0-9a-f]{40}$/.test(sourceSha)) {
    throw new Error('Full production pages require the exact private commerce source');
  }
  const entry = path.resolve(extensionPath);
  if (!entry.replace(/\\/g, '/').endsWith('/src/extension.jsx')) {
    throw new Error('Full production commerce entrypoint is missing');
  }
  privateFile(entry, 'Full production commerce entrypoint');
  const metadataPath = path.resolve(path.dirname(entry), '..', 'commerce-source.json');
  const metadata = JSON.parse(readFileSync(privateFile(metadataPath, 'Full production commerce source identity', 65536), 'utf8'));
  if (Object.keys(metadata).sort().join(',') !== 'repository,source_sha'
    || metadata.repository !== COMMERCE_REPOSITORY || metadata.source_sha !== sourceSha) {
    throw new Error('Full production commerce source identity differs');
  }
  const surfaceEntry = surface === 'combined' ? entry : path.join(path.dirname(entry), `${surface}.jsx`);
  return privateFile(surfaceEntry, `Private ${surface} commerce adapter`);
}

export function productionBuildContractPlugin(entry) {
  return {
    name: 'production-commerce-build-contract',
    generateBundle(_options, bundle) {
      const present = Object.values(bundle).some((output) => output.type === 'chunk'
        && Object.keys(output.modules).some((id) => id.replace(/\\/g, '/').split('?', 1)[0] === entry.replace(/\\/g, '/')));
      if (!present) throw new Error('Full production output omitted its commerce extension');
    },
  };
}
