# Extraction regression audit and repairs

Source reviewed: website `bc769d8` (current main at audit start), compared with
the retained source and ownership contracts in `ElevenID/marty-ui` at
`5c47d23ee335caf4f98e2b6f0a5479be736359e3`. This is a source and local-runtime
audit. The accepted publication and composition in [migration-status.md](migration-status.md)
retain their original identities; this work does not qualify new production traffic.

## Confirmed regressions

| Finding | Reproduction and impact | Repair |
| --- | --- | --- |
| The extracted website defaulted to npm and omitted the accepted Bun toolchain | All three website install workflows and current development instructions selected npm; no Bun lock or package-manager declaration existed. | Pin `bun@1.4.4`, migrate the existing npm lock without dependency upgrades, use frozen hoisted Bun installs, and keep Node 24 for build and test execution. |
| Website development returned HTML for executable scripts and JSON resources | A real Vite HTTP server returned `200 text/html` for `/_website/runtime-config.js`, namespaced `startup.js`, branding configuration and marketing translations. The asset plugin only emitted build files while `publicDir` was disabled. | Add a development asset handler using production's URL mapping and manifest rewriting, real asset content types, and explicit 404s for missing or unowned assets. Add `bun run dev`. |
| The extracted Vite configuration dropped public-origin/HMR wiring | The reviewed `devServerOrigin` helper was copied but never called by the standalone Vite config; a configured HTTPS development edge and nonstandard port were lost. | Connect the existing helper and test exact host, CORS origin, WebSocket protocol and client port. |

The npm reference lock remains byte-for-byte unchanged. The Bun lock preserves
all 226 distinct package name/version/source/integrity identities. Its 227 records
and npm's 228 records reflect hoisting/deduplication; no dependency version was
upgraded. An executable verification gate checks the manifest and both lockfiles
before workflow installation and again when generating a release plan.

## Release compatibility

New production output uses the explicit Bun v3 build-plan, receipt and image
schemas. Its plan identifies `bun@1.4.4`, selects `bun.lock`, and hashes both the
Bun install lock and npm reference lock. The paired `marty-ui` consumer validates
that closed v3 shape. The original v2 schema, synthetic fixture and canonical
digest remain unchanged and valid. A v2 envelope cannot silently claim Bun or
wrap a v3 plan. Original extraction receipts remain unchanged; batch 26 records
the later adaptations.

The new source needs a separately selected publication and consumer qualification
before release use. No workflow dispatch, image publication, signing, deployment
or source deletion is part of this audit.

## Coverage and remaining qualification

The audit compared the route/ownership contract, website entry and CTA handoff,
safe navigation and query/fragment preservation, all extracted source modules,
blog/demo routing, the retired demo boundary, metadata and canonical aliases,
public assets, six-language resources, branding, and build/CI input paths.
Accepted website adaptations and immutable blog v0.1.9 remain in place.

Local checks include a frozen Bun installation, complete lock identity comparison,
the website contract/DOM/build suites, real Vite development HTTP checks,
TypeScript/Vite output and public asset verification. Chromium rendering was attempted, but this executor denies the Unix socket required by Chromium before browser startup (`socket() EPERM`). It produced no rendered-page or prerender qualification result.
The baseline DOM suite passed 351 tests before the repairs; no page component
or route ownership changed in these repairs. Separate cross-language tests cover
retained v2 and new v3 website receipts and rejection of mixed schemas or changed
package-manager identity.

The public prerender plan still covers 259 routes and 251 unique canonical targets, including 200 blog routes, 20 demo routes and eight author routes; retired demo permalinks remain excluded.

Docker/Nginx container tests, Chromium prerender and real application/OIDC host qualification remain
environment-dependent gates. Local static/browser checks do not replace the
selected image's signed producer evidence or actual host promotion/rollback.

## Recorded local results

Code checkpoint: `fd9adabac4dc03e35ef0c0fb3f0c468430a17d37`, using Bun 1.4.4
and Node 24.22.3. The production-mode build identified that exact clean commit.

| Check | Result |
| --- | --- |
| Frozen Bun installation and complete npm-reference identity comparison | Passed; 226 unique identities unchanged |
| Website contracts | 85 passed |
| React/DOM suites | 351 passed across 25 files |
| Build, publication-boundary, asset, route, development HTTP and metadata suites | 381 passed |
| Development TypeScript/Vite build and emitted-bundle smoke | Passed; 66 JavaScript chunks |
| Selected extraction public assets | 46 passed, zero failures |
| Production-mode TypeScript/Vite build | Passed |
| Paired `marty-ui` website release, producer-policy and provenance tests | 192 passed |
| Chromium real-page/prerender execution | Blocked before page startup by executor Unix-socket restrictions |
| Docker/Nginx image execution | Not run; Docker unavailable |

All 817 website tests passed with zero failures or skipped cases. The separate
browser/container qualification gates above were not included in that test count.
No hosted Actions run was started and no remote state was changed.

A subsequent independent review strengthened root resolution checks: keeping the
same package identity set is insufficient if `react` and `react-dom` records can
be swapped. Each declared Bun root now binds to that root's npm reference
version/source/integrity. The 55 focused package-manager and v2/v3 release
contract tests pass, including this swap rejection. The final contract suite has
one additional case; the 817-test full-suite record above identifies the earlier
code checkpoint explicitly.
