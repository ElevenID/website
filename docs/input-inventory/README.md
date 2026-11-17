# Website input inventory

This directory records source, asset, build and test evidence for the website extraction.

## Evidence and scope

- Immutable source snapshot: `ElevenID/marty-ui@df6ec6c4bfee803d89c54e9333297f29f378cee3`.
- Historical full source/public comparison: `e10a7f26cda8ac217c7ddefebc709fc246dabaff`, retained in [source drift](source-drift.json).
- [Latest source metadata receipt](source-refresh-batch-8.json): all 79 candidate source paths and the reconciled English locale checked at `a4fc3801b636e2cfd0753797e8fc0dc846b42a22`; no missing paths or unexpected differences. Other public assets are not refreshed by this receipt.
- [Original public inventory](asset-inventory.json): 83 tracked files, including 46 retained and 37 excluded by the inspected website plugin.
- [Original build/test inventory](build-inventory.json): classification of helpers, configuration, generated inputs, dependency constraints and tests. New execution evidence is recorded separately in [batch 8](../checkpoints/batch-8-runtime-pages-build.md).

The inventories remain bounded evidence. Actual Vite fixtures now qualify selected asset-emission contracts and page imports, but do not establish a complete standalone website, production asset corpus or generated-output graph.

## Preserve newer source changes

Five candidate source files and one public translation changed after the original pin. The [reconciliation record](source-reconciliation.json) accounts for source PR #1783: verification calls to action point to the application-owned `/verify` route and use “Start Verifying” text. All six recorded current blobs still match the latest metadata comparison. Preserve them at later import; the original audit is retained unchanged.

The reviewed CTA deltas add no new module-import edges. This limited conclusion does not qualify the complete source/build graph. The application verification page and backend remain outside the website extraction.

## Completed foundations and current validation

[Batch 7](../checkpoints/batch-7-react-integration.md) created the pinned DOM dependency environment and lock, declared `prop-types` directly, and qualified React navigation and metadata with 88 passing AWS tests.

[Batch 8](../checkpoints/batch-8-runtime-pages-build.md) adds nine runtime sources, ten public pages and five shared components, expands the pinned dependency environment, and qualifies the documented runtime/UI compatibility corrections and Vite fixtures. Its full AWS result is **178 passing tests**, with clean installation, dependency validation and zero reported npm audit findings. Final hosted-check and merge status are tracked on [PR #8](https://github.com/ElevenID/website/pull/8).

PR #4 extracted two unchanged, dependency-free build helpers and their original tests (4,806 bytes total):

- `ui/scripts/dev-server-origin.mjs`
- `ui/scripts/dev-server-origin.test.mjs`
- `ui/scripts/generated-text.mjs`
- `ui/scripts/generated-text.test.mjs`

These copies retain original paths and are recorded in the extraction provenance. Their existence alone does not qualify the complete source graph or standalone build.

## Remaining gates

1. Complete WebsiteApp/WebsiteRoutes composition and remaining page imports. Preserve reconciled source/locale blobs and refresh drift when source main advances.
2. Extend the existing lock and build context to the remaining website graph, including the immutable blog pin. Retain the extracted icon resolver; do not assume it supplies Grid or other component compatibility.
3. Review and transfer classified larger/generated inputs in bounded batches without full content dumps or SVG parsing.
4. Verify real demo poster references/digests and preserve DRAFT/PARTIAL publication states.
5. Expand fixture asset checks to the actual website corpus, including metadata images. Decide whether to adapt or defer the AI-plugin compatibility payload.
6. Qualify generated crawler outputs, full prerender execution and actual Nginx/browser/application handoffs.
7. Rebind release provenance and verify rollback before production cutover.

The root route contract does not assign `/.well-known` to the website. A versioned AI-plugin payload does not establish a new root route.

## Historical batch 4 AWS receipt

The following receipt remains historical. Later navigation, DOM and build evidence is recorded in the checkpoints linked above.

After AWS sign-in was restored, the existing development instance fetched and tested commit `88fcf5a70f50724ef17af13937f672ccbc31bba3` (tree `d4924696073d82c952e4a09b2397401827dbdd5b`) using the preserved Node.js 24.22.1 runtime. All **19 tests passed**, with no failures or skips; the checkout and whitespace check were clean. The existing six-hour automatic-stop timer was active. No new infrastructure or dependency installation was needed.

[Required hosted check](https://github.com/ElevenID/website/actions/runs/43940036162/job/133554816226) also passed all 19 tests for that source head. The validation covers contracts and copied helpers, not a full website build. See PR #4 for the final checkpoint commit's required check and merge receipt.
