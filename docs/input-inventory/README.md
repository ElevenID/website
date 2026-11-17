# Website input inventory

This directory records source, asset, build and test evidence for the website extraction.

## Evidence and scope

- Immutable source snapshot: `ElevenID/marty-ui@df6ec6c4bfee803d89c54e9333297f29f378cee3`.
- Historical full source/public comparison: `e10a7f26cda8ac217c7ddefebc709fc246dabaff`, retained in [source drift](source-drift.json).
- [Latest source metadata receipt](source-refresh-batch-11.json): source main remains `9ff6e9779a020839ebeafc60095370725e9fb694`. The full `ui/` and `contracts/` tree identities remain unchanged from [batch 10](source-refresh-batch-10.json), preserving 77 UI candidates, two contract candidates and the reconciled locale without rereading large source bodies.
- [Original public inventory](asset-inventory.json): 83 tracked files, including 46 retained and 37 excluded by the inspected website plugin.
- [Original build/test inventory](build-inventory.json): classification of helpers, configuration, generated inputs, dependency constraints and tests. Later execution evidence is recorded in the batch checkpoints.
- [Batch 11 provenance shard](../../contracts/extraction-provenance-batch-11.json): 12 selected source imports totaling 60,382 bytes, with original identities and separate adaptation records: one verbatim header and 11 adapted files. The earlier 67 targets remain unchanged. It extends [earlier provenance](../../contracts/extraction-provenance.json).

The source refresh retains **74 original-pin matches, five reconciled source matches and one reconciled locale match**, with no missing paths or unexpected differences. Earlier changes to root `.github/`, `release/`, `scripts/` and `tests/` remain outside that candidate comparison. The public asset corpus has not received a new content audit.

The inventories remain bounded evidence. Vite, DOM, crawler and server fixtures qualify selected modules and artifact contracts; they do not establish a complete standalone production website.

## Preserve newer source changes

Five candidate source files and one public translation changed after the original pin. The [reconciliation record](source-reconciliation.json) accounts for source PR #1783: verification calls to action point to application-owned `/verify` and use “Start Verifying” text. All six current blobs remain covered by the latest tree-identity proof. Preserve them at later import; the original audit remains unchanged.

The reviewed CTA deltas add no module-import edges. This limited conclusion does not qualify the complete source/build graph. The application verification page and backend remain outside the website extraction.

## Completed foundations and current validation

| Batch | Scope and executed evidence |
| --- | --- |
| [7](../checkpoints/batch-7-react-integration.md) | Pinned DOM dependencies, React navigation and metadata; 88 passing tests |
| [8](../checkpoints/batch-8-runtime-pages-build.md) | Runtime sources, ten public pages, shared components and Vite fixtures; 178 passing tests |
| [9](../checkpoints/batch-9-demo-catalog-composition.md) | Page/catalog/demo helpers and composition foundations; 272 passing tests |
| [10](../checkpoints/batch-10-crawler-build-routes.md) | Build/crawler sources and route wiring; 353 aggregate records passed (54 native, 266 DOM, 33 build) |
| [11](../checkpoints/batch-11-sections-release-routing.md) | Six runtime and six build/server sources; source checkpoint 355 passed; corrected aggregate 436 passed (56 native, 304 DOM, 76 build); 20 separate Nginx HTTP cases passed in 0.72 seconds |

Batch 11 adds 38 component cases. The expanded original-source component baseline passed 22 and failed 16; the adaptations correct effective Grid/typography styles, keyboard link/control semantics, selected-state exposure and canonical public-entry destinations. The 76 passing build records include 43 new cases for website identity, actual Vite composition and distribution checks. The separate HTTP suite passed all 20 cases against the digest-pinned official Nginx image. Fresh dependency audit: zero vulnerabilities at every severity (exit 0). Track final hosted checks and merge on [PR #11](https://github.com/ElevenID/website/pull/11). Five Python cases run inside one build wrapper and are reported separately without adding them again to aggregate counts.

## Remaining gates

1. Complete page and data imports behind the website route boundaries, preserving reconciled source/locale identities and later adaptations.
2. Extend the dependency/build context to the complete website graph, including the immutable blog pin. Retain the extracted icon resolver and qualified component compatibility changes.
3. Defer large/generated input bodies and SVG processing under the current bounded-work constraint.
4. Verify actual demo poster references/digests and preserve DRAFT/PARTIAL publication states.
5. Expand asset checks to the production website corpus, including metadata images. Decide whether to adapt or defer the AI-plugin compatibility payload.
6. Qualify generated production crawler output, complete prerender execution and full browser/application handoffs. Replay server policy against the complete production output before deployment acceptance.
7. Bind production release provenance and verify deployment rollback before cutover.

The root route contract does not assign `/.well-known` to the website. A versioned AI-plugin payload does not establish a new root route.
