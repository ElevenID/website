import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { getWebSurface } from '../ui/scripts/web-surface-contract.mjs';
import { agentWebsiteAdaptation, assertAgentWebsiteAdaptation, gitBlob } from './fixtures/website-agent-adaptation.mjs';

const read = (path) => JSON.parse(readFileSync(new URL('../' + path, import.meta.url), 'utf8'));
const sourcePaths = [
  'ui/src/components/IdentityGuidePage.jsx', 'ui/src/components/LandingPageContent.jsx',
  'ui/src/components/ProductPage.jsx', 'ui/src/components/ProtocolPage.jsx',
  'ui/src/components/pages/AiCapabilityPage.jsx', 'ui/src/components/pages/MarketingProtocolSupportCatalog.jsx',
  'ui/src/components/pages/ProtocolSupportCatalogView.jsx', 'ui/src/components/pages/PublicIAPages.jsx',
  'ui/src/components/pages/WhatIsMartyProtocolPage.jsx', 'ui/src/components/seo/structuredData.js',
  'ui/src/data/marketingContent.js', 'ui/src/variants/publicConfig.public.js',
];
const expectedPaths = [
  ...sourcePaths,
  'ui/public/llms.txt',
  ...['de', 'en', 'es', 'fr', 'ja', 'nl'].flatMap((locale) =>
    ['common', 'marketing'].map((namespace) => `ui/public/locales/${locale}/${namespace}.json`)),
].sort();

function priorIdentities() {
  const identities = new Map();
  for (const filename of ['extraction-provenance.json', 'extraction-provenance-batch-11.json', 'extraction-provenance-batch-12.json']) {
    const record = read('contracts/' + filename);
    for (const entry of record.files) identities.set(entry.target_path, {
      originalBlob: entry.git_blob_sha1, previousBlob: entry.git_blob_sha1,
    });
    for (const entry of record.adapted_files) identities.set(entry.target_path, {
      originalBlob: entry.source_git_blob_sha1, previousBlob: entry.target_git_blob_sha1,
    });
  }
  // These first extraction adaptations recorded original identity only. Pin
  // their observed website baseline blobs instead of altering those receipts.
  for (const [path, previousBlob] of [
    ['ui/src/components/seo/structuredData.js', '74cfb9482929033db066b07b9381c35d24410fe3'],
    ['ui/src/components/pages/WhatIsMartyProtocolPage.jsx', 'c816d15d9857183e5841c92d8188ba8754fd3762'],
    ['ui/src/components/pages/ProtocolSupportCatalogView.jsx', '36692856176a7d109f71fc107866827209729022'],
  ]) identities.get(path).previousBlob = previousBlob;
  for (const entry of read('contracts/extraction-provenance-batch-13.json').source_paths) {
    identities.set(entry.path, { originalBlob: entry.original_sha, previousBlob: entry.selected_sha });
  }
  for (const entry of read('contracts/website-pages-application-handoff-adaptation.json').adapted_files) {
    identities.set(entry.path, { originalBlob: entry.source_original_blob, previousBlob: entry.current_blob });
  }
  for (const entry of read('docs/input-inventory/asset-inventory.json').files) {
    identities.set('ui/public/' + entry.path, { originalBlob: entry.blob_sha, previousBlob: entry.blob_sha });
  }
  for (const entry of read('docs/input-inventory/source-reconciliation.json').public_changes) {
    assert.equal(identities.get(entry.path).originalBlob, entry.source_blob_sha);
    identities.get(entry.path).previousBlob = entry.current_blob_sha;
  }
  return identities;
}

test('agent education changes extend exact extraction history for the reviewed website files', () => {
  const record = agentWebsiteAdaptation;
  assert.equal(record.schema_version, 1);
  assert.equal(record.purpose, 'post-extraction-adaptation-record');
  assert.equal(record.source_repository, 'ElevenID/marty-ui');
  assert.equal(record.immutable_source_commit, 'df6ec6c4bfee803d89c54e9333297f29f378cee3');
  assert.equal(record.extends, 'contracts/website-pages-application-handoff-adaptation.json');
  assert.equal(record.previous_website_source, '329e10fb50d91a9edc97378cc5899eceee1d59b2');
  assert.deepEqual(record.adapted_files.map((entry) => entry.path).sort(), expectedPaths);
  const prior = priorIdentities();
  const runtimeSummary = read('contracts/extraction-provenance-batch-16-runtime.json').files
    .find((entry) => entry.path === 'ui/public/llms.txt');
  assert.equal(prior.get(runtimeSummary.path).originalBlob, runtimeSummary.sha);
  for (const path of expectedPaths) {
    assert.ok(prior.has(path), path);
    assert.equal(assertAgentWebsiteAdaptation(path, prior.get(path)), true, path);
  }
});

test('the historical product support catalog remains byte-for-byte unchanged', () => {
  const bytes = readFileSync(new URL('../contracts/protocol-support-catalog.json', import.meta.url));
  assert.equal(gitBlob(bytes), '4bd05ca7b2f5be09bea9489aee8c2bba2c65c734');
});

test('the machine-readable summary uses owned learning routes and deployment-relative API discovery', () => {
  const summary = readFileSync(new URL('../ui/public/llms.txt', import.meta.url), 'utf8');
  for (const match of summary.matchAll(/https:\/\/elevenidllc\.com(\/[^\s]*)?/g)) {
    const path = match[1] || '/';
    assert.equal(getWebSurface(path), path === '/docs' ? 'application' : 'website', path);
  }
  for (const term of ['Agent Identity and Delegation', 'DelegationGrant', 'START_USE', 'FINALIZE_USE', 'RECOVER_RESULT', 'EVIDENCE_ONLY', 'NOT_ASSESSED', 'MARTY_BASE_URL']) {
    assert.ok(summary.includes(term), term);
  }
  assert.match(summary, /\/v1\/protocol-support/);
  assert.match(summary, /\/openapi\.json/);
  assert.doesNotMatch(summary, /https:\/\/elevenidllc\.com\/(?:openapi\.|v1\/)/);
  assert.doesNotMatch(summary, /Standards Supported|what-is-verifiable-identity/);
  const legacyManifest = readFileSync(new URL('../ui/public/.well-known/ai-plugin.json', import.meta.url));
  assert.equal(gitBlob(legacyManifest), 'b2dfb31f023e360f05a9ae204f3c5503eec03ac5');
});
