# Batch 7: React navigation and metadata integration

Work is grouped in [website PR #7](https://github.com/ElevenID/website/pull/7), based on accepted main `8ee7c0221ded85faa2f704dae987cd40767f1139`.

## Source extraction

Three files totaling **4,517 bytes** were copied unchanged before adaptation:

| Source path | Bytes | Original Git blob |
| --- | ---: | --- |
| `ui/src/application/routing/useSurfaceNavigate.js` | 1,163 | `4685cd2b9f5ddbf4d48cc1c91166a7da45db7528` |
| `ui/src/apps/shared/WebSurfaceBoundary.jsx` | 1,005 | `ea1f32d7ca2a9ee6721d1c72b8f8430bc42d6ebd` |
| `ui/src/apps/shared/WebSurfaceBoundary.test.tsx` | 2,349 | `5ce3d8cc4a179eef490082b9e050b6c786d65918` |

All three match the immutable source pin `df6ec6c4bfee803d89c54e9333297f29f378cee3` and comparison revision `62b5da9d607b0200b417b4d24f040083886b82de`. The original hook is recoverable in extraction commit `6a92462d3f280ac2fdab01534c0e6e178d953a38`; the boundary and its inherited tests remain verbatim. Provenance now contains 18 verbatim entries and eight adapted entries.

The eight supporting navigation/runtime/control-character helpers, two source SEO files and package/config metadata were also unchanged between source `e10a7f26cda8ac217c7ddefebc709fc246dabaff` and `62b5da9d607b0200b417b4d24f040083886b82de`. The destination's earlier asset, metadata and landing-error corrections remain intact. This selected comparison does not refresh the entire source candidate inventory.

## Reproducible DOM environment

The minimal manifest pins four runtime and six test dependencies. Version choices follow source `ui/package.json` blob `b430e66bd23f5771004372738f47a990855b65cd`; `prop-types` is declared directly because the extracted component imports it. All ten exact versions and their engine/peer metadata were verified against npm from AWS.

The destination lock was generated on AWS using **Node 24.22.1 / npm 11.19.1**, rather than copied from the full application. Its identity is:

- Size: **67,840 bytes**, lock format 3.
- Git blob: `71a800a0160a28634fe5e69903c40e3c0559b3f5`.
- SHA-256: `c0f0205e686f0ba34a783d330b79bc87017c0dc215b09aab21e5faa73caefd16`.
- 127 dependency package entries in the lock; 95 installed packages on this AWS Linux platform.

A clean `npm ci --no-audit --no-fund` and `npm ls --depth=0 --json` both succeeded. A separate `npm audit --json` returned exit 0 with zero vulnerabilities in every reported severity at verification time. The generated lock was transferred as a hash-verified artifact without displaying its contents; the upstream lock and large Vite config were compared only by metadata.

The original native command is preserved as `test:contracts`. `test:dom` uses real React, React Router, Testing Library and jsdom with automatic JSX handling, a fixed versioned asset prefix, a TEST-NET origin and sequential test-file execution. Each suite owns cleanup. Test setup is isolated from the full application's setup, postinstall hooks and overrides. No additional infrastructure was added. Required CI identity, action pins, Node version and permissions are preserved.

## Reproduced defects and corrections

Before correction, the expanded DOM suite reported **36 passed and 3 failed**:

1. With a configured public-entry alias, `useSurfaceNavigate('#details')` caused document navigation instead of a local fragment transition. The hook canonicalized the already-normalized path before the helper's fragment exemption. It now delegates the decision to `shouldBrowserRedirect` with the original destination. Ordinary canonical-origin handoff remains covered.
2. `SEOHead` retained a previous page's keywords when the current page supplied an empty list.
3. The same stale keyword tag survived unmounting and replacing a page with one that omitted keywords. The component now removes that tag when the current keyword list is empty, preserving nonempty updates and other metadata behavior.

The new tests are independently authored. The eight inherited boundary cases are unchanged.

## AWS verification

| Suite | Passing tests | Scope |
| --- | ---: | --- |
| Native contracts/helpers | 49 | Existing route, source identity, assets, metadata, navigation, landing and runtime checks |
| Inherited React boundary | 8 | Cross/same-surface links, targets/downloads and modified clicks |
| Expanded React boundary | 10 | Nested targets, capture handling, cancellation, native forms, explicit surface and unmount |
| React navigation hook | 12 | Router history/state, destination objects, query/hash, unsafe inputs, document methods, aliases and fragments |
| SEO DOM | 9 | Head updates/reuse, versioned/default images, overrides, JSON-LD, keyword clearing and StrictMode |
| **Total** | **88** | **Zero failures, cancellations or skips** |

The source copy passed all 49 native tests. The environment commit passed those plus eight inherited DOM cases. The navigation correction passed 49 native and 30 navigation DOM cases. After the metadata correction, the full aggregate passed all 88 tests. Staged whitespace checks passed for each commit, and published Git trees matched the AWS-tested trees.

Functional commits are `384c959af19fc6773aa965f37a1e5c265e583941` (environment), `2200772357096154e9cceedce122fe691992fc19` (navigation), and `6e16040ebf4abb57f76f91c0ce546c27ae5efa80` (metadata). The complete functional source tree tested on AWS is `eaa950497c0a810638822f14546fa4d5688cdf2e`. The following documentation commit changes no source, dependencies or tests; final head CI and the accepted merge are recorded on PR #7.

## Scope and resume

Tests execute real React/DOM/router behavior and actual URL/handoff helpers. The new navigation harness replaces only the terminal location methods to record assign/replace calls. It does not perform HTTP document loading. SEO tests follow the component's existing single-owner, single-matching-tag model.

The existing AWS instance and six-hour automatic-stop safeguard were retained. No public assets, SVG/binary content or large upstream source files were imported. Full Vite rendering, generated inputs, immutable blog integration, emitted assets, prerender, Nginx/browser handoffs and release production remain pending.

Resume from the short [migration checkpoint](../migration-status.md), extending the remaining website source and build closure in several bounded commits per larger milestone PR.
