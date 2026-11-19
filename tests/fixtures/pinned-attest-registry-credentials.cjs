// Offline compatibility fixture only. Synthetic credentials are supplied by tests.
// These two module function bodies are extracted unchanged from the shipped bundle:
// https://github.com/actions/attest/blob/508db95dd578ae2727ebd6217d5ba78e4fbda05d/dist/index.js
// Required by actions/attest-build-provenance@4d101475d8b20a2381f78447822ac1eab6504dd8.
// Resolved dependency: @sigstore/oci 0.7.1. The credential module retains its license.
// Full upstream license: licenses/sigstore-oci-LICENSE.txt.
// Upstream dist/index.js Git blob: de7bd536a3d24f9562db4507f84abd094ab2cf29
// Module 62691 extracted SHA-256: f6806703d4c32371a70cdda4a8d250888d4ad3e587384b38ca2ed0f3eb83a118
// Module 96666 extracted SHA-256: c558015e396ddc8583cdb6064c9f64585c6e40f294854ead9b2678aae66b0ea2

const modules = {
62691: (function(__unused_webpack_module, exports, __nccwpck_require__) {


var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", ({ value: true }));
exports.fromBasicAuth = exports.toBasicAuth = exports.getRegistryCredentials = void 0;
/*
Copyright 2023 The Sigstore Authors.

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

    http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.
*/
const node_fs_1 = __importDefault(__nccwpck_require__(73024));
const node_os_1 = __importDefault(__nccwpck_require__(48161));
const node_path_1 = __importDefault(__nccwpck_require__(76760));
const name_1 = __nccwpck_require__(96666);
// Well-known aliases for the Docker Hub registry. Docker stores Hub
// credentials under a handful of different keys depending on how the user
// authenticated, so they all need to canonicalize to the same host.
const DOCKER_HUB_ALIASES = new Set([
    'docker.io',
    'index.docker.io',
    'registry-1.docker.io',
]);
// Canonicalizes a registry hostname or a Docker config auth key to a
// comparable host[:port] value by stripping any scheme/path and normalizing
// the well-known Docker Hub aliases.
const canonicalizeRegistry = (value) => {
    // Strip the scheme (e.g. "https://") if present.
    let host = value.replace(/^https?:\/\//, '');
    // Strip any path/query (everything after the first '/').
    host = host.split('/')[0];
    return DOCKER_HUB_ALIASES.has(host) ? 'docker.io' : host;
};
// Returns the credentials for a given registry by reading the Docker config
// file.
const getRegistryCredentials = (imageName) => {
    const { registry } = (0, name_1.parseImageName)(imageName);
    const dockerConfigFile = node_path_1.default.join(node_os_1.default.homedir(), '.docker', 'config.json');
    let content;
    try {
        content = node_fs_1.default.readFileSync(dockerConfigFile, 'utf8');
    }
    catch (err) {
        throw new Error(`No credential file found at ${dockerConfigFile}`, {
            cause: err,
        });
    }
    const dockerConfig = JSON.parse(content);
    // Select the credential whose registry canonicalizes to exactly the target
    // registry. Exact (rather than substring) matching is required to avoid
    // sending credentials configured for one registry to a different registry
    // whose name happens to be a substring of the configured key.
    const target = canonicalizeRegistry(registry);
    const credKey = Object.keys(dockerConfig.auths || {}).find((key) => canonicalizeRegistry(key) === target);
    const creds = credKey ? dockerConfig.auths?.[credKey] : undefined;
    if (!creds) {
        throw new Error(`No credentials found for registry ${registry}`);
    }
    // Extract username/password from auth string
    const { username, password } = (0, exports.fromBasicAuth)(creds.auth);
    // If the identitytoken is present, use it as the password (primarily for ACR)
    const pass = creds.identitytoken ? creds.identitytoken : password;
    return { headers: dockerConfig.HttpHeaders, username, password: pass };
};
exports.getRegistryCredentials = getRegistryCredentials;
// Encode the username and password as base64-encoded basicauth value
const toBasicAuth = (creds) => Buffer.from(`${creds.username}:${creds.password}`).toString('base64');
exports.toBasicAuth = toBasicAuth;
// Decode the base64-encoded basicauth value
const fromBasicAuth = (auth) => {
    // Need to account for the possibility of ':' in the password
    const [username, ...rest] = Buffer.from(auth, 'base64').toString().split(':');
    const password = rest.join(':');
    return { username, password };
};
exports.fromBasicAuth = fromBasicAuth;


}),
96666: ((__unused_webpack_module, exports) => {


Object.defineProperty(exports, "__esModule", ({ value: true }));
exports.parseImageName = void 0;
const expression = (...res) => res.join('');
const group = (...res) => `(?:${expression(...res)})`;
const repeated = (...res) => `${group(expression(...res))}+`;
const optional = (...res) => `${group(expression(...res))}?`;
const capture = (...res) => `(${expression(...res)})`;
const anchored = (...res) => `^${expression(...res)}$`;
// Lower case letters, numbers
const ALPHA_NUMERIC_RE = '[a-z0-9]+';
// Separators allowed to be embedded in name components. This allows one period,
// one or two underscore or multiple dashes.
const SEPARATOR_RE = group('\\.|_|__|-+');
// Registry path component names to start with at least one letter or number,
// with following parts able to be separated by one period, one or two
// underscores or multiple dashes.
const NAME_COMPONENT_RE = expression(ALPHA_NUMERIC_RE, optional(repeated(SEPARATOR_RE, ALPHA_NUMERIC_RE)));
const NAME_RE = expression(NAME_COMPONENT_RE, repeated(optional('\\/', NAME_COMPONENT_RE)));
// Component of the registry domain must be at least one letter or number, with
// following parts able to be separated by a dash.
const DOMAIN_COMPONENT_RE = group('[a-zA-Z0-9]|[a-zA-Z0-9][a-zA-Z0-9-]*[a-zA-Z0-9]');
// Restricts the registry domain to be one or more period separated components
// followed by an optional port.
const DOMAIN_RE = expression(DOMAIN_COMPONENT_RE, optional(repeated('\\.', DOMAIN_COMPONENT_RE)), optional(':[0-9]+'));
// Capture the registry domain and path components of a repository name.
const ANCHORED_NAME_RE = anchored(capture(DOMAIN_RE), '\\/', capture(NAME_RE));
// Parses a fully qualified image name into its registry and path components.
const parseImageName = (image) => {
    const matches = image.match(ANCHORED_NAME_RE);
    if (!matches) {
        throw new Error(`Invalid image name: ${image}`);
    }
    return {
        registry: matches[1],
        path: matches[2],
    };
};
exports.parseImageName = parseImageName;


})
};

const cache = new Map();
function requirePinned(identifier) {
  const builtins = new Map([[73024, 'node:fs'], [48161, 'node:os'], [76760, 'node:path']]);
  if (builtins.has(identifier)) return require(builtins.get(identifier));
  if (cache.has(identifier)) return cache.get(identifier).exports;
  if (!Object.hasOwn(modules, identifier)) throw new Error('Unexpected pinned fixture dependency: ' + identifier);
  const target = { exports: {} };
  cache.set(identifier, target);
  modules[identifier].call(target.exports, target, target.exports, requirePinned);
  return target.exports;
}
module.exports = requirePinned(62691);
