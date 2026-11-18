# Website input inventory

**Latest checkpoint — PR #13:** All 79 original source candidate paths are now present, including the 10 large public modules and 8 diagram files. A separate selected-public-asset inventory has 38 of 46 paths present and eight large binary paths remaining. The latest independent Vite smoke (development audience) passed with 1,147 transformed modules and 66 JavaScript chunks; it does not qualify production prerender, complete assets or release. See [batch 13](../checkpoints/batch-13-complete-source-bundle.md) for exact evidence. The batch 12 counts below are historical.

This directory records source, asset, build and test evidence for the website extraction.

## Evidence and scope

- Immutable source snapshot: `ElevenID/marty-ui@df6ec6c4bfee803d89c54e9333297f29f378cee3`.
- Historical full source/public comparison: `e10a7f26cda8ac217c7ddefebc709fc246dabaff`, retained in [source drift](source-drift.json).
- [Latest source metadata receipt](source-refresh-batch-12.json): source main remains `9ff6e9779a020839ebeafc60095370725e9fb694`. UI/contracts subtree identities remain unchanged from [batch 11](source-refresh-batch-11.json), preserving 77 UI candidates, two contract candidates and the reconciled locale. The selected root startup script was separately compared at the original and current revisions.
- [Original public inventory](asset-inventory.json): 83 tracked files, including 46 retained and 37 excluded by the inspected website plugin. The production asset corpus has not received a new content audit.
- [Original build/test inventory](build-inventory.json): classification of helpers, configuration, generated inputs, dependency constraints and tests. Later execution evidence is recorded in batch receipts.
- [Batch 12 provenance](../../contracts/extraction-provenance-batch-12.json): seven imports totaling **45,628 bytes**, retaining one verbatim wallet-schema projection and six explicitly adapted sources. It extends [batch 11 provenance](../../contracts/extraction-provenance-batch-11.json) and the [original shard](../../contracts/extraction-provenance.json); earlier target records remain unchanged.

The source refresh retains **74 original-pin matches, five reconciled source matches and one reconciled locale match**, with no missing paths or unexpected differences. Earlier changes to root `.github/`, `release/`, `scripts/` and `tests/` remain outside the original candidate comparison. Only the selected startup script has received the additional root-file comparison in this milestone.

## Candidate closure and provenance counts

The original [79-file source candidate inventory](../source-import-inventory.json) has **79 paths present and zero missing** on PR #13. Its original 61/18 split is preserved in the batch 12 receipt. The separate public-asset transfer has 38 of 46 selected resources; eight large binary resources remain to import with exact Git-blob verification.

The provenance chain contains **86 targets**, a separate set that includes build and other extracted files. Do not treat that total as the number of original source candidates or as evidence that the full website graph is complete.

The inventories remain bounded evidence. DOM, Vite, generation, crawler and server fixtures qualify selected modules and contracts; they do not establish the complete production website.

## Preserve newer source changes

Five candidate source files and one public translation changed after the original pin. The [reconciliation record](source-reconciliation.json) accounts for source PR #1783: verification CTAs use `Start Verifying` and application-owned `/verify`. All six current blobs remain covered by the latest tree-identity proof. Preserve them at later import; the original audit remains unchanged.

The reviewed CTA changes add no module-import edges. That limited conclusion does not qualify the complete source/build graph. The application verification page and backend remain outside the website extraction.

## Completed foundations and current validation

| Batch | Scope and executed evidence |
| --- | --- |
| [7](../checkpoints/batch-7-react-integration.md) | Pinned DOM dependencies, React navigation and metadata; 88 passing tests |
| [8](../checkpoints/batch-8-runtime-pages-build.md) | Runtime sources, ten public pages, shared components and Vite fixtures; 178 passing tests |
| [9](../checkpoints/batch-9-demo-catalog-composition.md) | Page/catalog/demo helpers and composition foundations; 272 passing tests |
| [10](../checkpoints/batch-10-crawler-build-routes.md) | Build/crawler sources and route wiring; 353 aggregate records passed |
| [11](../checkpoints/batch-11-sections-release-routing.md) | Six runtime and six build/server imports; 436 native/DOM/build plus 20 separate HTTP records passed |
| [12](../checkpoints/batch-12-pages-build-runtime.md) | Seven page/schema/build/startup imports; source checkpoint 458 passed, including 20 HTTP records; final aggregate 528 passed plus 20 HTTP records, totaling 548 |

The final original educational-page comparison ran **41 cases: 25 passed and 16 failed**, in 7.58 seconds. Three native boundary cases passed. These are regression-case outcomes, not a count of independent production incidents. The corrected page checkpoint passed **482 native/DOM/build records** in 61.39 seconds: 61 native, 345 DOM across 24 files and 76 build, with no failures, cancellations or skips. The detailed receipt records the intervening gutter-test correction; page source was unchanged by that correction. The original generator/runner comparison passed 10 and failed 18 of 28 cases in 3.94 seconds. The focused adapted build suite passed all 46 cases in 4.28 seconds: 16 generator, 12 runner and 18 startup cases. The original startup script is not executed because it uses fixed global output paths and a secrets loader.

The [source-copy required CI job passed](https://github.com/ElevenID/website/actions/runs/44009299256/job/133792151996). Final validation passed **548 records**: 61 native, 345 DOM across 24 files and 122 build records in 64.77 seconds, plus 20 HTTP records in 0.77 seconds. No failures, cancellations or skips remained. The fresh dependency audit found zero vulnerabilities at every severity (exit 0). Five Python cases inside an existing build wrapper are reported separately without double counting. Track final checks and merge on [PR #12](https://github.com/ElevenID/website/pull/12).

## Remaining gates

1. Resolve the large-input and diagram deferrals before completing the website page graph. Preserve reconciled source/locale identities and later adaptations.
2. Extend the dependency/build context to the complete graph, including the immutable blog pin. The runner currently requires missing production prerequisites; fixture TypeScript invocation does not establish production type-check success.
3. Preserve DRAFT/PARTIAL demo publication states and verify production manifests, poster references and digests before publishing demo claims.
4. Qualify the production asset corpus, including metadata images and any AI-plugin compatibility payload. The route contract does not assign `/.well-known` to the website.
5. Qualify complete crawler/prerender output, actual browser/application handoffs and container startup. Replay the server policy against that complete output.
6. Bind production release identity and verify rollback before cutover.

Continue bounded work without reading large source bodies or SVG. The current public runtime fixtures support specified single-line generated metadata forms; they do not replace acceptance of the full production HTML corpus.
