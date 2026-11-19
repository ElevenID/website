// Pure validation of the actual registry manifest and Docker inspection records.
// The caller must obtain these records from the registry / trusted Docker daemon
// and complete a pull by the returned digest reference before final verification.
// These checks do not publish an image or authenticate a release/signature.
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { STANDALONE_IMAGE } from './standalone-release-contract.mjs';

const DIGEST = /^sha256:[a-f0-9]{64}$/;
const MAX_MANIFEST_BYTES = 1024 * 1024;
const MAX_CONFIG_BYTES = 4 * 1024 * 1024;
const MAX_IMAGE_BYTES = 1024 * 1024 * 1024;
const MAX_LAYERS = 128;
const OCI_MANIFEST = 'application/vnd.oci.image.manifest.v1+json';
const DOCKER_MANIFEST = 'application/vnd.docker.distribution.manifest.v2+json';
const IMAGE_TYPES = new Map([
  [OCI_MANIFEST, {
    config: 'application/vnd.oci.image.config.v1+json',
    layers: new Set(['application/vnd.oci.image.layer.v1.tar',
      'application/vnd.oci.image.layer.v1.tar+gzip', 'application/vnd.oci.image.layer.v1.tar+zstd']),
  }],
  [DOCKER_MANIFEST, {
    config: 'application/vnd.docker.container.image.v1+json',
    layers: new Set(['application/vnd.docker.image.rootfs.diff.tar.gzip']),
  }],
]);

function plainObject(value, label) {
  assert.ok(value && typeof value === 'object' && !Array.isArray(value)
    && [Object.prototype, null].includes(Object.getPrototypeOf(value)), label + ' must be a JSON object');
}
function fields(value, required, optional, label) {
  plainObject(value, label);
  const allowed = new Set([...required, ...optional]);
  assert.ok(required.every((key) => Object.hasOwn(value, key)), label + ' is missing required fields');
  assert.ok(Object.keys(value).every((key) => allowed.has(key)), label + ' has unsupported fields');
}
function digest(value, label) {
  assert.equal(typeof value, 'string', label + ' requires a SHA-256 digest');
  assert.equal(value.length, 71, label + ' requires a SHA-256 digest');
  assert.match(value, DIGEST, label + ' requires a SHA-256 digest');
}
function positiveSize(value, maximum, label) {
  assert.ok(Number.isSafeInteger(value) && value > 0 && value <= maximum, label + ' exceeds size bounds');
}

// Docker's inspection shape can evolve, so bound all JSON data but only admit
// the identity fields used below. Descriptors and manifests have closed shapes.
function boundedJson(value, label, maximum = 4 * 1024 * 1024) {
  const seen = new Set();
  let bytes = 0;
  let nodes = 0;
  function visit(item, depth) {
    assert.ok(depth <= 20 && ++nodes <= 20000, label + ' exceeds metadata bounds');
    if (typeof item === 'string') {
      assert.ok(item.length <= 65536, label + ' exceeds string bounds');
      bytes += Buffer.byteLength(item, 'utf8');
    } else if (item === null || typeof item === 'boolean') bytes += 5;
    else if (typeof item === 'number') {
      assert.ok(Number.isFinite(item), label + ' must contain finite JSON numbers');
      bytes += 24;
    } else {
      assert.ok(item && typeof item === 'object', label + ' must contain JSON data');
      assert.ok(!seen.has(item), label + ' must not contain cyclic or aliased data');
      seen.add(item);
      if (Array.isArray(item)) {
        assert.ok(item.length <= 1024, label + ' exceeds array bounds');
        for (let index = 0; index < item.length; index++) {
          const property = Object.getOwnPropertyDescriptor(item, String(index));
          assert.ok(property && Object.hasOwn(property, 'value'), label + ' requires ordinary JSON array entries');
          visit(property.value, depth + 1);
        }
        assert.equal(Reflect.ownKeys(item).length, item.length + 1, label + ' has unsupported array properties');
      } else {
        plainObject(item, label);
        const keys = Reflect.ownKeys(item);
        assert.ok(keys.length <= 256, label + ' exceeds object bounds');
        for (const key of keys) {
          assert.ok(typeof key === 'string' && key.length <= 512, label + ' has an invalid JSON key');
          bytes += Buffer.byteLength(key, 'utf8') + 4;
          const property = Object.getOwnPropertyDescriptor(item, key);
          assert.ok(property.enumerable && Object.hasOwn(property, 'value'), label + ' requires ordinary JSON properties');
          visit(property.value, depth + 1);
        }
      }
      bytes += 2;
    }
    assert.ok(bytes <= maximum, label + ' exceeds byte bounds');
  }
  visit(value, 0);
}

function annotations(value, label) {
  plainObject(value, label);
  const entries = Object.entries(value);
  assert.ok(entries.length <= 64, label + ' exceeds annotation count bounds');
  let bytes = 0;
  for (const [key, content] of entries) {
    assert.ok(key.length > 0 && key.length <= 256 && typeof content === 'string', label + ' has an invalid annotation');
    bytes += Buffer.byteLength(key, 'utf8') + Buffer.byteLength(content, 'utf8');
    assert.ok(content.length <= 4096 && bytes <= 16384, label + ' exceeds annotation bounds');
  }
}
function descriptor(value, mediaTypes, maximum, label, optional = []) {
  fields(value, ['mediaType', 'digest', 'size'], ['annotations', ...optional], label);
  assert.ok(mediaTypes.has(value.mediaType), label + ' has an unsupported media type');
  digest(value.digest, label);
  positiveSize(value.size, maximum, label);
  if (Object.hasOwn(value, 'annotations')) annotations(value.annotations, label + ' annotations');
}
function platform(value, label) {
  fields(value, ['os', 'architecture'], ['variant'], label);
  assert.equal(value.os, 'linux', label + ' must target Linux');
  assert.equal(value.architecture, 'amd64', label + ' must target amd64');
  if (Object.hasOwn(value, 'variant')) assert.equal(value.variant, '', label + ' must not select another variant');
}

function parseManifest(bytes) {
  // Reject malformed UTF-8 (including silent replacement) and a BOM. Preserve
  // original bytes for the hash; JSON reserialization is never a digest input.
  const text = new TextDecoder('utf-8', { fatal: true, ignoreBOM: true }).decode(bytes);
  const value = JSON.parse(text);
  const stack = [];
  // JSON.parse has checked syntax. This token walk only rejects duplicate keys
  // (including escaped aliases) and bounds nesting; it is not a second parser.
  for (const match of text.matchAll(/"(?:[^"\\]|\\[\s\S])*"|[{}\[\],:]/g)) {
    const token = match[0];
    const frame = stack.at(-1);
    if (token === '{' || token === '[') {
      assert.ok(stack.length < 20, 'Registry manifest exceeds nesting bounds');
      stack.push({ object: token === '{', key: token === '{', keys: new Set() });
    } else if (token === '}' || token === ']') stack.pop();
    else if (token === ',' && frame?.object) frame.key = true;
    else if (token.startsWith('"') && frame?.object && frame.key) {
      const key = JSON.parse(token);
      assert.ok(!frame.keys.has(key), 'Registry manifest contains duplicate JSON keys');
      frame.keys.add(key);
      frame.key = false;
    }
  }
  boundedJson(value, 'Registry manifest', MAX_MANIFEST_BYTES);
  return value;
}

function manifestBinding({ descriptor: published, manifestBytes, qualifiedImageId }) {
  digest(qualifiedImageId, 'Qualified local image ID');
  boundedJson(published, 'Registry descriptor', 65536);
  descriptor(published, new Set(IMAGE_TYPES.keys()), MAX_MANIFEST_BYTES, 'Registry descriptor', ['platform']);
  if (Object.hasOwn(published, 'platform')) platform(published.platform, 'Registry descriptor platform');
  assert.ok(Buffer.isBuffer(manifestBytes), 'Registry manifest requires raw bytes as a Buffer');
  positiveSize(manifestBytes.length, MAX_MANIFEST_BYTES, 'Registry manifest');
  assert.equal(manifestBytes.length, published.size, 'Registry manifest byte size differs from its descriptor');
  const registryManifestDigest = 'sha256:' + createHash('sha256').update(manifestBytes).digest('hex');
  assert.equal(registryManifestDigest, published.digest, 'Registry manifest digest differs from its raw bytes');
  assert.notEqual(registryManifestDigest, qualifiedImageId, 'Local image ID is not the registry manifest digest');
  const manifest = parseManifest(manifestBytes);
  fields(manifest, ['schemaVersion', 'mediaType', 'config', 'layers'], ['annotations'], 'Registry manifest');
  assert.equal(manifest.schemaVersion, 2, 'Registry manifest requires schema version 2');
  assert.equal(manifest.mediaType, published.mediaType, 'Registry manifest media type differs from its descriptor');
  const types = IMAGE_TYPES.get(manifest.mediaType);
  descriptor(manifest.config, new Set([types.config]), MAX_CONFIG_BYTES, 'Registry image config');
  assert.equal(manifest.config.digest, qualifiedImageId, 'Registry config differs from the qualified local image ID');
  assert.ok(Array.isArray(manifest.layers) && manifest.layers.length > 0 && manifest.layers.length <= MAX_LAYERS,
    'Registry manifest exceeds layer count bounds');
  let totalBytes = manifest.config.size;
  for (const layer of manifest.layers) {
    descriptor(layer, types.layers, MAX_IMAGE_BYTES, 'Registry image layer');
    totalBytes += layer.size;
    assert.ok(totalBytes <= MAX_IMAGE_BYTES, 'Registry image exceeds total byte bounds');
  }
  if (Object.hasOwn(manifest, 'annotations')) annotations(manifest.annotations, 'Registry manifest annotations');
  return { registryManifestDigest, imageReference: STANDALONE_IMAGE + '@' + registryManifestDigest,
    layerCount: manifest.layers.length };
}

/** Derive the exact pull reference from actual registry descriptor/manifest bytes.
 * This checks the manifest only. Do not emit a release until verifyPublishedImage
 * also binds inspection of the qualified local image and the image pulled by digest.
 */
export function validatePublishedManifest(options) {
  const { registryManifestDigest, imageReference } = manifestBinding(options);
  return Object.freeze({ registryManifestDigest, imageReference });
}

function inspectedImage(value, qualifiedImageId, layerCount, label) {
  boundedJson(value, label);
  assert.ok(Array.isArray(value) && value.length === 1, label + ' must contain exactly one inspected image');
  const info = value[0];
  plainObject(info, label);
  digest(info.Id, label + ' image ID');
  assert.equal(info.Id, qualifiedImageId, label + ' image ID differs from qualification');
  assert.equal(info.Os, 'linux', label + ' must target Linux');
  assert.equal(info.Architecture, 'amd64', label + ' must target amd64');
  for (const name of ['Variant', 'OsVersion']) {
    if (Object.hasOwn(info, name)) assert.equal(info[name], '', label + ' has an unsupported platform ' + name);
  }
  fields(info.RootFS, ['Type', 'Layers'], [], label + ' RootFS');
  assert.equal(info.RootFS.Type, 'layers', label + ' requires a layered RootFS');
  assert.ok(Array.isArray(info.RootFS.Layers) && info.RootFS.Layers.length === layerCount,
    label + ' RootFS layer count differs from the registry manifest');
  for (const layer of info.RootFS.Layers) digest(layer, label + ' RootFS layer');
  return info;
}

/** Bind publication to the exact image that completed qualification. The caller
 * must inspect the local ID before publication and pull/inspect imageReference
 * by digest, using the trusted daemon's verification of config and layer bytes.
 * Only registryManifestDigest from this complete result belongs in the release.
 * Local config IDs and uncompressed RootFS IDs are deliberately separate from
 * the registry manifest's digest and compressed layer digests.
 */
export function verifyPublishedImage({ qualifiedInspection, pulledInspection, ...options }) {
  const { registryManifestDigest, imageReference, layerCount } = manifestBinding(options);
  const qualified = inspectedImage(qualifiedInspection, options.qualifiedImageId, layerCount, 'Qualified image inspection');
  const pulled = inspectedImage(pulledInspection, options.qualifiedImageId, layerCount, 'Pulled image inspection');
  assert.deepEqual(pulled.RootFS.Layers, qualified.RootFS.Layers, 'Pulled RootFS layers differ from qualification');
  assert.ok(Array.isArray(pulled.RepoDigests) && pulled.RepoDigests.length > 0 && pulled.RepoDigests.length <= 128,
    'Pulled image requires bounded repository digests');
  for (const reference of pulled.RepoDigests) {
    assert.ok(typeof reference === 'string' && reference.length <= 512
      && reference === reference.trim()
      && /^[a-z0-9][a-z0-9.:/_-]*@sha256:[a-f0-9]{64}$/.test(reference),
    'Pulled image has a malformed repository digest');
  }
  assert.ok(pulled.RepoDigests.includes(imageReference), 'Pulled image does not identify the exact published repository digest');
  return Object.freeze({ registryManifestDigest, imageReference });
}
