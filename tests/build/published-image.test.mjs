import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import test from 'node:test';
import { validatePublishedManifest, verifyPublishedImage } from '../../scripts/lib/published-image.mjs';

const IMAGE = 'ghcr.io/elevenid/website';
const LOCAL_ID = 'sha256:' + 'a'.repeat(64);
const DIFF_IDS = ['sha256:' + 'b'.repeat(64), 'sha256:' + 'c'.repeat(64)];
const OCI = 'application/vnd.oci.image.manifest.v1+json';
const DOCKER = 'application/vnd.docker.distribution.manifest.v2+json';
const hash = (bytes) => 'sha256:' + createHash('sha256').update(bytes).digest('hex');

// These are synthetic protocol fixtures, never registry/publication evidence.
// Compressed blob digests, uncompressed DiffIDs, and config ID intentionally differ.
function fixture(mediaType = OCI) {
  const manifest = {
    schemaVersion: 2, mediaType,
    config: { mediaType: mediaType === OCI ? 'application/vnd.oci.image.config.v1+json'
      : 'application/vnd.docker.container.image.v1+json', digest: LOCAL_ID, size: 1234 },
    layers: ['d', 'e'].map((character) => ({
      mediaType: mediaType === OCI ? 'application/vnd.oci.image.layer.v1.tar+gzip'
        : 'application/vnd.docker.image.rootfs.diff.tar.gzip',
      digest: 'sha256:' + character.repeat(64), size: 2048,
    })),
  };
  return fromManifest(manifest);
}
function fromManifest(manifest) {
  return fromBytes(Buffer.from(JSON.stringify(manifest, null, 2) + '\n'), manifest.mediaType);
}
function fromBytes(manifestBytes, mediaType = OCI) {
  const descriptor = { mediaType, digest: hash(manifestBytes), size: manifestBytes.length };
  const qualifiedInspection = [{ Id: LOCAL_ID, Os: 'linux', Architecture: 'amd64',
    RootFS: { Type: 'layers', Layers: [...DIFF_IDS] }, RepoDigests: [],
    Config: { ExposedPorts: { '80/tcp': {} }, Labels: { 'org.opencontainers.image.source': 'https://github.com/ElevenID/website' } },
  }];
  const pulledInspection = structuredClone(qualifiedInspection);
  pulledInspection[0].RepoDigests = [IMAGE + '@' + descriptor.digest];
  return { descriptor, manifestBytes, qualifiedImageId: LOCAL_ID, qualifiedInspection, pulledInspection };
}
function changedManifest(mutate, mediaType = OCI) {
  const manifest = JSON.parse(fixture(mediaType).manifestBytes);
  mutate(manifest);
  return fromManifest(manifest);
}

for (const mediaType of [OCI, DOCKER]) {
  test('binds raw ' + mediaType + ' manifest to the qualified and pulled image', () => {
    const input = fixture(mediaType);
    const expected = { registryManifestDigest: hash(input.manifestBytes), imageReference: IMAGE + '@' + hash(input.manifestBytes) };
    assert.notEqual(expected.registryManifestDigest, LOCAL_ID);
    assert.deepEqual(validatePublishedManifest(input), expected);
    assert.deepEqual(verifyPublishedImage(input), expected);
    assert.deepEqual(input.pulledInspection[0].RootFS.Layers, DIFF_IDS);
    assert.deepEqual(Object.keys(verifyPublishedImage(input)).sort(), ['imageReference', 'registryManifestDigest']);
  });
}

test('uses original manifest bytes rather than a parsed or canonical representation', () => {
  const original = fixture();
  const reserialized = Buffer.from(JSON.stringify(JSON.parse(original.manifestBytes)));
  assert.notEqual(hash(reserialized), original.descriptor.digest);
  const mismatched = { ...original, manifestBytes: reserialized,
    descriptor: { ...original.descriptor, size: reserialized.length } };
  assert.throws(() => validatePublishedManifest(mismatched), /digest differs from its raw bytes/);
  const actual = fromBytes(reserialized);
  assert.equal(verifyPublishedImage(actual).registryManifestDigest, hash(reserialized));
});

test('detects byte tampering even when the supplied size still matches', () => {
  const input = fixture();
  const tampered = Buffer.from(input.manifestBytes.toString().replace('2048', '2049'));
  assert.equal(tampered.length, input.descriptor.size);
  assert.throws(() => verifyPublishedImage({ ...input, manifestBytes: tampered }), /digest differs from its raw bytes/);
});

for (const [name, mutate, error] of [
  ['descriptor size mismatch', (i) => { i.descriptor.size++; }, /byte size differs/],
  ['descriptor digest mismatch', (i) => { i.descriptor.digest = 'sha256:' + '0'.repeat(64); }, /digest differs/],
  ['local image ID substituted for the registry digest', (i) => { i.descriptor.digest = LOCAL_ID; }, /digest differs/],
  ['string manifest instead of raw bytes', (i) => { i.manifestBytes = i.manifestBytes.toString(); }, /raw bytes/],
  ['empty manifest', (i) => { i.manifestBytes = Buffer.alloc(0); }, /size bounds/],
  ['unbounded manifest', (i) => { i.manifestBytes = Buffer.alloc(1024 * 1024 + 1); }, /size bounds/],
  ['non-SHA256 digest', (i) => { i.descriptor.digest = 'sha512:' + 'a'.repeat(128); }, /SHA-256/],
  ['boolean descriptor size', (i) => { i.descriptor.size = true; }, /size bounds/],
  ['negative descriptor size', (i) => { i.descriptor.size = -1; }, /size bounds/],
  ['fractional descriptor size', (i) => { i.descriptor.size = 10.5; }, /size bounds/],
  ['unbounded descriptor size', (i) => { i.descriptor.size = Number.MAX_SAFE_INTEGER; }, /size bounds/],
  ['descriptor external URL', (i) => { i.descriptor.urls = ['https://example.invalid/manifest']; }, /unsupported fields/],
  ['descriptor embedded content', (i) => { i.descriptor.data = i.manifestBytes.toString('base64'); }, /unsupported fields/],
  ['descriptor artifact identity', (i) => { i.descriptor.artifactType = 'application/example'; }, /unsupported fields/],
  ['descriptor platform substitution', (i) => { i.descriptor.platform = { os: 'linux', architecture: 'arm64' }; }, /amd64/],
  ['descriptor platform features', (i) => { i.descriptor.platform = { os: 'linux', architecture: 'amd64', 'os.features': ['unexpected'] }; }, /unsupported fields/],
  ['descriptor platform variant', (i) => { i.descriptor.platform = { os: 'linux', architecture: 'amd64', variant: 'v3' }; }, /another variant/],
  ['malformed qualification ID', (i) => { i.qualifiedImageId = LOCAL_ID.slice(7); }, /SHA-256/],
  ['qualification ID with trailing newline', (i) => { i.qualifiedImageId += '\n'; }, /SHA-256/],
  ['descriptor unknown field', (i) => { i.descriptor.registry_published = true; }, /unsupported fields/],
]) {
  test('rejects ' + name, () => {
    const input = fixture();
    mutate(input);
    assert.throws(() => verifyPublishedImage(input), error);
  });
}

for (const [name, mutate, error] of [
  ['unsupported schema', (m) => { m.schemaVersion = 1; }, /schema version 2/],
  ['string schema', (m) => { m.schemaVersion = '2'; }, /schema version 2/],
  ['OCI image index', (m) => { m.mediaType = 'application/vnd.oci.image.index.v1+json'; }, /unsupported media type/],
  ['Docker manifest list', (m) => { m.mediaType = 'application/vnd.docker.distribution.manifest.list.v2+json'; }, /unsupported media type/],
  ['hidden index members', (m) => { m.manifests = []; }, /unsupported fields/],
  ['artifact manifest', (m) => { m.artifactType = 'application/example'; }, /unsupported fields/],
  ['empty artifact discriminator', (m) => { m.artifactType = ''; }, /unsupported fields/],
  ['subject-bearing referrer', (m) => { m.subject = { ...m.config }; }, /unsupported fields/],
  ['artifact empty config', (m) => { m.config.mediaType = 'application/vnd.oci.empty.v1+json'; }, /unsupported media type/],
  ['plugin config', (m) => { m.config.mediaType = 'application/vnd.docker.plugin.v1+json'; }, /unsupported media type/],
  ['mixed config format', (m) => { m.config.mediaType = 'application/vnd.docker.container.image.v1+json'; }, /unsupported media type/],
  ['different config identity', (m) => { m.config.digest = 'sha256:' + 'f'.repeat(64); }, /config differs/],
  ['unbounded config', (m) => { m.config.size = 4 * 1024 * 1024 + 1; }, /size bounds/],
  ['external config URL', (m) => { m.config.urls = ['https://example.invalid/config']; }, /unsupported fields/],
  ['missing config digest', (m) => { delete m.config.digest; }, /missing required fields/],
  ['no layers', (m) => { m.layers = []; }, /layer count bounds/],
  ['too many layers', (m) => { m.layers = Array.from({ length: 129 }, () => structuredClone(m.layers[0])); }, /layer count bounds/],
  ['unbounded layer', (m) => { m.layers[0].size = 1024 * 1024 * 1024 + 1; }, /size bounds/],
  ['unbounded total image', (m) => { for (const layer of m.layers) layer.size = 600 * 1024 * 1024; }, /total byte bounds/],
  ['invalid layer digest', (m) => { m.layers[0].digest = 'sha256:untrusted'; }, /SHA-256/],
  ['layer digest with trailing newline', (m) => { m.layers[0].digest += '\n'; }, /SHA-256/],
  ['OCI nondistributable layer', (m) => { m.layers[0].mediaType = 'application/vnd.oci.image.layer.nondistributable.v1.tar+gzip'; }, /unsupported media type/],
  ['Docker foreign layer', (m) => { m.layers[0].mediaType = 'application/vnd.docker.image.rootfs.foreign.diff.tar.gzip'; }, /unsupported media type/],
  ['external layer URL', (m) => { m.layers[0].urls = ['https://example.invalid/layer']; }, /unsupported fields/],
  ['empty external layer URLs', (m) => { m.layers[0].urls = []; }, /unsupported fields/],
  ['embedded layer data', (m) => { m.layers[0].data = 'e30='; }, /unsupported fields/],
  ['null annotations', (m) => { m.annotations = null; }, /JSON object/],
  ['oversized annotation', (m) => { m.annotations = { description: 'x'.repeat(4097) }; }, /annotation bounds/],
]) {
  test('rejects a correctly hashed manifest with ' + name, () => {
    assert.throws(() => verifyPublishedImage(changedManifest(mutate)), error);
  });
}

test('descriptor and manifest media types must agree independently of their valid hash', () => {
  const input = fixture();
  input.descriptor.mediaType = DOCKER;
  assert.throws(() => validatePublishedManifest(input), /media type differs/);
});

test('admits bounded annotations, registry platform metadata, and OCI distributable compression formats', () => {
  const input = changedManifest((manifest) => {
    manifest.annotations = { 'org.opencontainers.image.description': 'Synthetic fixture with Unicode: café' };
    manifest.config.annotations = { 'example.invalid/purpose': 'test' };
    manifest.layers[0].mediaType = 'application/vnd.oci.image.layer.v1.tar';
    manifest.layers[1].mediaType = 'application/vnd.oci.image.layer.v1.tar+zstd';
  });
  input.descriptor.platform = { os: 'linux', architecture: 'amd64', variant: '' };
  input.descriptor.annotations = { 'example.invalid/purpose': 'test' };
  input.pulledInspection[0].RepoDigests.unshift('ghcr.io/elevenid/another-name@sha256:' + 'f'.repeat(64));
  assert.equal(verifyPublishedImage(input).registryManifestDigest, hash(input.manifestBytes));
});

test('rejects duplicate or escaped duplicate JSON keys instead of trusting parser precedence', () => {
  const input = fixture();
  for (const replacement of [
    '"schemaVersion": 1, "schemaVersion": 2',
    '"schemaVersion": 1, "schema\\u0056ersion": 2',
  ]) {
    const bytes = Buffer.from(input.manifestBytes.toString().replace('"schemaVersion": 2', replacement));
    assert.throws(() => validatePublishedManifest(fromBytes(bytes)), /duplicate JSON keys/);
  }
  const configDuplicate = Buffer.from(input.manifestBytes.toString().replace('"config": {',
    '"config": { "digest": "sha256:' + 'f'.repeat(64) + '",'));
  assert.throws(() => validatePublishedManifest(fromBytes(configDuplicate)), /duplicate JSON keys/);
});

test('rejects invalid UTF-8, BOMs, malformed JSON, and excessive JSON nesting even when correctly hashed', () => {
  const valid = fixture().manifestBytes;
  const invalidUtf8 = Buffer.concat([valid.subarray(0, valid.length - 2), Buffer.from(',"annotations":{"x":"'),
    Buffer.from([0xc0, 0xaf]), Buffer.from('"}}')]);
  assert.throws(() => validatePublishedManifest(fromBytes(invalidUtf8)), /encoded data|encoding/i);
  assert.throws(() => validatePublishedManifest(fromBytes(Buffer.concat([Buffer.from([0xef, 0xbb, 0xbf]), valid]))), SyntaxError);
  assert.throws(() => validatePublishedManifest(fromBytes(Buffer.from('{broken'))), SyntaxError);
  const nested = Buffer.from('['.repeat(21) + 'null' + ']'.repeat(21));
  assert.throws(() => validatePublishedManifest(fromBytes(nested)), /nesting bounds/);
});

for (const side of ['qualifiedInspection', 'pulledInspection']) {
  for (const [name, mutate, error] of [
    ['empty inspect response', (i) => { i.length = 0; }, /exactly one/],
    ['ambiguous multiple images', (i) => { i.push(structuredClone(i[0])); }, /exactly one/],
    ['different image ID', (i) => { i[0].Id = 'sha256:' + 'f'.repeat(64); }, /image ID differs/],
    ['wrong OS', (i) => { i[0].Os = 'windows'; }, /Linux/],
    ['wrong architecture', (i) => { i[0].Architecture = 'arm64'; }, /amd64/],
    ['unexpected variant', (i) => { i[0].Variant = 'v3'; }, /platform Variant/],
    ['OS version constraint', (i) => { i[0].OsVersion = 'special'; }, /platform OsVersion/],
    ['wrong RootFS type', (i) => { i[0].RootFS.Type = 'different'; }, /layered RootFS/],
    ['missing RootFS layer', (i) => { i[0].RootFS.Layers.pop(); }, /layer count differs/],
    ['malformed RootFS digest', (i) => { i[0].RootFS.Layers[0] = 'layer-id'; }, /SHA-256/],
    ['RootFS digest with trailing newline', (i) => { i[0].RootFS.Layers[0] += '\n'; }, /SHA-256/],
    ['oversized inspection metadata', (i) => { i[0].Config.Labels.payload = 'x'.repeat(65537); }, /string bounds/],
  ]) {
    test(side + ' rejects ' + name, () => {
      const input = fixture();
      mutate(input[side]);
      assert.throws(() => verifyPublishedImage(input), error);
    });
  }
}

test('compares ordered uncompressed RootFS identities without confusing them with compressed registry blob digests', () => {
  for (const replacement of [DIFF_IDS.toReversed(), ['sha256:' + 'f'.repeat(64), DIFF_IDS[1]],
    JSON.parse(fixture().manifestBytes).layers.map((layer) => layer.digest)]) {
    const input = fixture();
    input.pulledInspection[0].RootFS.Layers = replacement;
    assert.throws(() => verifyPublishedImage(input), /RootFS layers differ/);
  }
});

for (const [name, references, error] of [
  ['missing digests', undefined, /bounded repository digests/],
  ['empty digests', [], /bounded repository digests/],
  ['tag-only identification', [IMAGE + ':main'], /malformed repository digest/],
  ['repository digest with trailing newline', (i) => [IMAGE + '@' + i.descriptor.digest + '\n'], /malformed repository digest/],
  ['local config ID in the digest coordinate', [IMAGE + '@' + LOCAL_ID], /exact published repository digest/],
  ['other repository with correct digest', (i) => ['ghcr.io/elevenid/marty-ui-oss/website@' + i.descriptor.digest], /exact published repository digest/],
  ['too many aliases', (i) => Array(129).fill(IMAGE + '@' + i.descriptor.digest), /bounded repository digests/],
]) {
  test('pull verification rejects ' + name, () => {
    const input = fixture();
    if (references === undefined) delete input.pulledInspection[0].RepoDigests;
    else input.pulledInspection[0].RepoDigests = typeof references === 'function' ? references(input) : references;
    assert.throws(() => verifyPublishedImage(input), error);
  });
}

test('does not admit publication flags or manifest validation alone as pull evidence', () => {
  const input = fixture();
  assert.throws(() => verifyPublishedImage({ ...input, pulledInspection: { verified: true } }), /exactly one/);
  const identity = validatePublishedManifest(input);
  assert.throws(() => verifyPublishedImage({ ...input, pulledInspection: identity }), /exactly one/);
  assert.throws(() => verifyPublishedImage({ ...input, qualifiedInspection: input.qualifiedInspection[0] }), /exactly one/);
});

test('bounds aggregate metadata and rejects non-JSON inputs without evaluating accessors', () => {
  const aggregate = fixture();
  aggregate.pulledInspection[0].Config.Labels = Object.fromEntries(Array.from({ length: 65 }, (_, i) => [String(i), 'x'.repeat(65536)]));
  assert.throws(() => verifyPublishedImage(aggregate), /byte bounds/);
  const cyclic = fixture();
  cyclic.descriptor.annotations = { cycle: cyclic.descriptor };
  assert.throws(() => validatePublishedManifest(cyclic), /cyclic or aliased/);
  const accessor = fixture();
  Object.defineProperty(accessor.descriptor, 'size', { enumerable: true, get() { assert.fail('Getter must never execute'); } });
  assert.throws(() => validatePublishedManifest(accessor), /ordinary JSON properties/);
  const inherited = fixture();
  inherited.descriptor = Object.create(inherited.descriptor);
  assert.throws(() => validatePublishedManifest(inherited), /JSON object/);
});
