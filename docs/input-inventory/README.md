# Website input inventory

This directory records source, asset, build and test evidence for the website extraction.

## Evidence and scope

- Immutable source snapshot: `ElevenID/marty-ui@df6ec6c4bfee803d89c54e9333297f29f378cee3`.
- Historical full source/public comparison: `e10a7f26cda8ac217c7ddefebc709fc246dabaff`, retained in [source drift](source-drift.json).
- [Latest source metadata receipt](source-refresh-batch-10.json): source main advanced to `9ff6e9779a020839ebeafc60095370725e9fb694`; the complete `ui/` and `contracts/` subtrees remain identical to the [batch 8 comparison](source-refresh-batch-8.json). This proves unchanged identities for 77 UI candidates, two contract candidates and the reconciled locale without rereading source bodies.
- [Original public inventory](asset-inventory.json): 83 tracked files, including 46 retained and 37 excluded by the inspected website plugin.
- [Original build/test inventory](build-inventory.json): classification of helpers, configuration, generated inputs, dependency constraints and tests. Later execution evidence is recorded in the batch checkpoints.

The source refresh retains **74 original-pin matches, five reconciled source matches and one reconciled locale match**, with no missing paths or unexpected differences. Root `.github/`, `release/`, `scripts/` and `tests/` changed and are outside that inherited candidate comparison. The public asset corpus has not received a new content audit.

The inventories remain bounded evidence. Vite, DOM and crawler fixtures qualify selected modules and artifact contracts; they do not establish a complete standalone website or production generated-output graph.

## Preserve newer source changes

Five candidate source files and one public translation changed after the original pin. The [reconciliation record](source-reconciliation.json) accounts for source PR #1783: verification calls to action point to application-owned `/verify` and use “Start Verifying” text. All six current blobs remain covered by the latest tree-identity proof. Preserve them at later import; the original audit remains unchanged.

The reviewed CTA deltas add no module-import edges. This limited conclusion does not qualify the complete source/build graph. The application verification page and backend remain outside the website extraction.

## Completed foundations and current validation

| Batch | Scope and executed evidence |
| --- | --- |
| [7](../checkpoints/batch-7-react-integration.md) | Pinned DOM dependencies, React navigation and metadata; 88 passing tests |
| [8](../checkpoints/batch-8-runtime-pages-build.md) | Runtime sources, ten public pages, shared components and Vite fixtures; 178 passing tests |
| [9](../checkpoints/batch-9-demo-catalog-composition.md) | Page/catalog/demo helpers and composition foundations; 272 passing tests |
| [10](../checkpoints/batch-10-crawler-build-routes.md) | Four build/crawler sources and route wiring; source-copy baseline 272 plus standalone production 2 and Python 5 passed; expanded aggregate 353 passed (54 native, 266 DOM, 33 build) |

Batch 10 retains the npm dependency pins and CI workflow, adds a Python standard-library execution requirement, and extends fixture coverage. The fresh npm audit reported zero vulnerabilities. Track the final hosted check and merge on [PR #10](https://github.com/ElevenID/website/pull/10). Its five Python cases run within one of the build records and are reported separately to avoid double counting.

PR #4 preserved the dependency-free `dev-server-origin.mjs` and `generated-text.mjs` helpers and their original tests, 4,806 bytes total. Its [required hosted check](https://github.com/ElevenID/website/actions/runs/43940036162/job/133554816226) passed 19 tests. Later checkpoints supersede that historical validation scope.

## Remaining gates

1. Complete page and data imports behind the website route boundaries, preserving reconciled source/locale identities and later adaptations.
2. Extend the existing dependency/build context to the complete website graph, including the immutable blog pin. Retain the extracted icon resolver and qualified component compatibility changes.
3. Handle deferred larger/generated inputs in bounded work without full content dumps or SVG parsing.
4. Verify actual demo poster references/digests and preserve DRAFT/PARTIAL publication states.
5. Expand asset checks to the production website corpus, including metadata images. Decide whether to adapt or defer the AI-plugin compatibility payload.
6. Qualify generated production crawler output, complete prerender execution and actual Nginx/browser/application handoffs.
7. Bind release provenance and verify rollback before production cutover.

The root route contract does not assign `/.well-known` to the website. A versioned AI-plugin payload does not establish a new root route.
