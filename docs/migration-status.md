# Migration checkpoint

## Current milestone: educational pages, build inputs and public runtime

[Website PR #12](https://github.com/ElevenID/website/pull/12) continues from accepted PR #11 at `57adcea498bb77935bdbd08ca49654eea44db878`. It preserves **seven source files totaling 45,628 bytes**, each below 16 KiB, and groups page qualification with generation, build and public startup contracts.

Final validation passed **548 records**: `npm test` passed 528 records in 64.77 seconds (61 native, 345 DOM across 24 files and 122 build), and the separate HTTP suite passed 20 records in 0.77 seconds. There were no failures, cancellations or skips. This adds **92 records** to batch 11. Fresh dependency audit: zero vulnerabilities at every severity (exit 0). Five Python cases inside an existing build record are reported separately without double counting.

The exact source-copy checkpoint passed 458 combined records; its [required hosted CI](https://github.com/ElevenID/website/actions/runs/44009299256/job/133792151996) passed. The corrected educational-page checkpoint passed 482 native/DOM/build records in 61.39 seconds; its [required hosted CI](https://github.com/ElevenID/website/actions/runs/44010150926/job/133794951739) also passed.

| Evidence | Revision/status |
| --- | --- |
| Accepted base, PR #11 | `57adcea498bb77935bdbd08ca49654eea44db878` |
| Exact source-copy commit | `5cc954693cb4de0ac3938a1f0871d68d1a0e47ab` |
| Exact source-copy tree | `c03207086ede15bf72698cdabab1dd82a3147a22` |
| Corrected educational-page commit | `dbc26e6e059a9a4de8a6d072b22571ec8bc83180` |
| Corrected educational-page tree | `c383b62a87ecd6d7e43374e387e6eef1597633cf` |
| Corrected functional commit | `6e76d883132773b11a2b694438a7a53d34a619cc` |
| Verified functional tree | `ba71d9f93cf9812e5db77a9cd4e82d406df466b2` |
| Final required CI and merge | Track PR #12 for the final revision and accepted merge |

Read [the batch 12 receipt](checkpoints/batch-12-pages-build-runtime.md) for the source identities, behavior changes and qualification limits. [Batch 11](checkpoints/batch-11-sections-release-routing.md) and earlier receipts remain historical.

## Resume and next batches

1. Refresh PR #12. If merged, continue from its accepted main; otherwise use its existing branch and remaining checks.
2. Retain immutable source pin `df6ec6c4bfee803d89c54e9333297f29f378cee3`. The [batch 12 metadata receipt](input-inventory/source-refresh-batch-12.json) confirms comparison main remains `9ff6e9779a020839ebeafc60095370725e9fb694`. Unchanged UI/contracts trees preserve the prior candidate identities and reconciled locale. The selected root startup script was checked separately; other changed root files need their own inspection before use.
3. Preserve the [source reconciliation](input-inventory/source-reconciliation.json), including `Start Verifying` to application-owned `/verify`, and the [batch 12 provenance chain](../contracts/extraction-provenance-batch-12.json). Later adaptations must retain their original source identities.
4. The original [79-file candidate inventory](source-import-inventory.json) now has **61 present and 18 deferred**: ten large inputs/page/service/catalog bodies and eight diagram modules/barrel. There are no remaining unimported, non-diagram candidates below 16 KiB in that inventory. Continue suitable bounded build/release work; completing the page graph requires resolving those large-input and diagram deferrals.
5. Keep related verified commits in cohesive PRs. Preserve website/application ownership, withheld pricing and DRAFT/PARTIAL demo publication states.

## Remaining qualification

The three educational pages execute with real React, MUI, i18n, metadata and routing helpers. Small marketing/blog inputs and named diagram boundaries keep production content and the immutable blog package deferred. Link semantics, router transitions and recorded document-load calls do not establish real browser handoffs.

Generator and startup checks use synthetic inputs. Vite executes in the build-runner fixture, while TypeScript invocation is instrumented. Complete production configuration and dependencies remain required; the runner rejects an incomplete checkout. Startup supports the tested single-line generated metadata forms, and file replacements are individually atomic rather than a transaction across the output corpus.

Production assets, complete crawler/prerender output, the real blog/commerce packages, browser/application handoffs, deployed release identity and rollback remain unqualified. The existing Nginx fixture evidence must be replayed against the complete production output before deployment acceptance. Production cutover is a later milestone.
