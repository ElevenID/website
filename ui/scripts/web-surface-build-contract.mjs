import { WEB_ROUTE_CONTRACT } from './web-surface-contract.mjs';

const isSourceSha = (value) => typeof value === 'string' && /^[a-f0-9]{40}$/.test(value);
const normalizedId = (value) => {
  if (typeof value !== 'string') throw new TypeError('Module identity must be a string');
  return value.replace(/\\/g, '/').split('?', 1)[0];
};

export function websiteBuildRevision({ sourceSha = 'development', commerceSha, pages = 'public', revision } = {}) {
  if (!['public', 'full'].includes(pages)) throw new Error('Unknown production page set');
  if (!isSourceSha(sourceSha) && sourceSha !== 'development') throw new Error('Invalid website public source');
  if (pages === 'full' && (!isSourceSha(sourceSha) || !isSourceSha(commerceSha))) {
    throw new Error('Full website requires exact public and private sources');
  }
  if (pages === 'public' && commerceSha !== undefined) throw new Error('Public website cannot claim private source');
  const expected = sourceSha === 'development' ? 'development'
    : `${sourceSha}${pages === 'full' ? `-${commerceSha}` : ''}`;
  if (revision !== undefined && revision !== expected) throw new Error('Website revision differs from its source inputs');
  return expected;
}

export function websiteReleaseMetadata({ sourceSha = 'development', commerceSha, pages = 'public', revision } = {}) {
  const websiteRevision = websiteBuildRevision({ sourceSha, commerceSha, pages, revision });
  return {
    // Standalone public releases use the new owner contract. The retained full
    // adapter keeps its historical marker and is not admitted by this producer.
    schema: pages === 'public' ? 'marty.website-image/v2' : 'marty.website-image/v1',
    audience: sourceSha === 'development' ? 'development' : 'production',
    surface: 'website', repository: 'ElevenID/website', source_sha: sourceSha,
    revision: websiteRevision, production_pages: pages, route_contract: WEB_ROUTE_CONTRACT,
    commerce_extension: pages === 'full'
      ? { repository: 'ElevenID/marty-subscriptions', source_sha: commerceSha } : null,
  };
}

function privateSourceRoot(commerceEntry) {
  if (commerceEntry === undefined) return null;
  const entry = normalizedId(commerceEntry);
  if (!/^(?:\/|[A-Za-z]:\/)/.test(entry) || !/\/website\.[jt]sx$/.test(entry)
    || /[\x00-\x1f\x7f]/.test(entry) || entry.includes('//')
    || entry.split('/').some((part) => part === '.' || part === '..')) {
    throw new Error('Website commerce entry must be an absolute website module');
  }
  return entry.replace(/\/website\.[jt]sx$/, '/');
}

export function forbiddenWebSurfaceModule(surface, moduleId, commerceEntry) {
  if (surface !== 'website') throw new Error('This repository only builds the website surface');
  const id = normalizedId(moduleId);
  const privateRoot = privateSourceRoot(commerceEntry);
  return /\/@elevenid\/marty-api-core(?:\/|$)/.test(id)
    || /\/src\/apps\/(?:public|console)\//.test(id)
    || /\/src\/(?:bootstrapApp\.[jt]sx?|hooks\/useAuth\.[jt]s|services\/(?:api(?:\.[jt]s|\/)|authApi\.[jt]s))/.test(id)
    || /\/src\/contexts\/(?:Auth|Console|Notification|Payment)Context/.test(id)
    || /\/(?:components\/PricingPage\.[jt]sx?|data\/(?:pricingContent|pricingPageContent|pricingPlans)\.[jt]s)$/.test(id)
    || Boolean(privateRoot && id.startsWith(privateRoot)
      && /^(?:application\/|contexts\/|(?:application|extension)\.[jt]sx|index\.[jt]s|components\/(?:billing\/|PaymentCheckout\.[jt]sx))/.test(id.slice(privateRoot.length)));
}

export function webSurfaceBuildContractPlugin({ surface = 'website', sourceSha = 'development', revision,
  pages = 'public', commerceSha, commerceEntry } = {}) {
  if (surface !== 'website') throw new Error('This repository only builds the website surface');
  const metadata = websiteReleaseMetadata({ sourceSha, commerceSha, pages, revision });
  privateSourceRoot(commerceEntry);
  if (pages === 'public' && commerceEntry !== undefined) throw new Error('Public website cannot configure a private entry');
  if (pages === 'full' && commerceEntry === undefined) throw new Error('Full website requires its commerce entry');
  return {
    name: 'web-surface-build-contract',
    generateBundle(_options, bundle) {
      for (const output of Object.values(bundle)) {
        if (output.type !== 'chunk') continue;
        for (const id of Object.keys(output.modules)) {
          if (forbiddenWebSurfaceModule(surface, id, commerceEntry)) {
            throw new Error(`Website output includes forbidden module: ${id}`);
          }
        }
      }
      this.emitFile({ type: 'asset', fileName: 'marty-website-release.json', source: `${JSON.stringify(metadata)}\n` });
    },
  };
}
