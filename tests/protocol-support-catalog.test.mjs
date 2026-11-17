import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  normalizeProtocolSupportCatalog, PROTOCOL_SUPPORT_LEVELS, PROTOCOL_SUPPORT_PATH,
} from '../ui/src/application/protocolSupportCatalog.js';

const revision = '0123456789abcdef0123456789abcdef01234567';
const levels = ['implemented', 'derived', 'partial', 'unsupported'];
function entity(level = 'implemented') {
  const unsupported = level === 'unsupported';
  return {
    id: 'fixture-' + level, display_name: 'Fixture ' + level, kind: 'protocol',
    support_level: level, qualification: unsupported ? 'not_applicable' : 'focused_source',
    owner_service: unsupported ? null : 'fixture-verifier',
    api_paths: unsupported ? [] : ['/v1/fixture'],
    ui_paths: unsupported ? [] : ['/fixture'],
    schema_refs: unsupported ? [] : ['#/components/schemas/Fixture'],
    limitations: ['Synthetic catalog for the extracted normalizer contract.'],
  };
}
function catalog() {
  return {
    schema_version: 1, catalog_revision: '2026-01-15', protocol_revision: revision,
    discovery_path: '/v1/protocol-support',
    support_levels: Object.fromEntries(levels.map((level) => [level, level + ' description'])),
    qualification_levels: {
      focused_source: 'Focused source review', implementation_present: 'Implementation present',
      not_applicable: 'Not applicable',
    },
    entities: levels.map(entity),
  };
}

test('normalizes all four support levels without changing catalog claims or input', () => {
  assert.equal(PROTOCOL_SUPPORT_PATH, '/v1/protocol-support');
  assert.deepEqual(PROTOCOL_SUPPORT_LEVELS, levels);
  const input = catalog();
  const original = structuredClone(input);
  const result = normalizeProtocolSupportCatalog(input);
  assert.deepEqual(result, original);
  assert.deepEqual(input, original);
  assert.deepEqual(result.entities.map((item) => item.support_level), levels);
});

test('rejects incompatible or malformed catalog envelopes', () => {
  const cases = [
    [null, /response must be an object/],
    [[], /response must be an object/],
    [{ ...catalog(), schema_version: 2 }, /version or discovery path/],
    [{ ...catalog(), discovery_path: '/v2/protocol-support' }, /version or discovery path/],
    [{ ...catalog(), protocol_revision: 'not-a-revision' }, /revision is invalid/],
    [{ ...catalog(), support_levels: [] }, /support levels must be an object/],
    [{ ...catalog(), qualification_levels: null }, /qualification levels must be an object/],
    [{ ...catalog(), entities: {} }, /entities must be an array/],
  ];
  for (const [input, message] of cases) {
    assert.throws(() => normalizeProtocolSupportCatalog(input), message);
  }
});

test('rejects a JSON array that coerces to a valid revision string', () => {
  assert.throws(() => normalizeProtocolSupportCatalog({
    ...catalog(), protocol_revision: [revision],
  }), /revision is invalid/);
});

test('rejects duplicate, unclassified, or malformed entity claims', () => {
  const base = entity();
  const cases = [
    [[base, { ...base }], /entity IDs must be present and unique/],
    [[{ ...base, display_name: ' ' }], /display name must be a non-empty string/],
    [[{ ...base, support_level: 'certified' }], /level is invalid/],
    [[{ ...base, qualification: 'certified' }], /qualification is invalid/],
    [[{ ...base, api_paths: [42] }], /API paths must be a string array/],
    [[{ ...base, limitations: 'none' }], /limitations must be a string array/],
  ];
  for (const [entities, message] of cases) {
    assert.throws(() => normalizeProtocolSupportCatalog({ ...catalog(), entities }), message);
  }
});

test('unsupported entities cannot advertise a service or product surfaces', () => {
  const unsupported = entity('unsupported');
  for (const extra of [
    { owner_service: 'fixture-verifier' }, { api_paths: ['/v1/fixture'] },
    { ui_paths: ['/fixture'] }, { schema_refs: ['#/components/schemas/Fixture'] },
    { limitations: [] },
  ]) {
    assert.throws(() => normalizeProtocolSupportCatalog({
      ...catalog(), entities: [{ ...unsupported, ...extra }],
    }), /cannot advertise product surfaces/);
  }
});
