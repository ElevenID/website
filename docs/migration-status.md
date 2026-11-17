# Migration checkpoint

## Current milestone: page, catalog, demo and composition foundations

[Website PR #9](https://github.com/ElevenID/website/pull/9), branch `feat/website-demo-catalog-composition`, continues from accepted PR #8. It preserves **12 source files totaling 46,957 bytes**. Eight have complete dependencies for the expanded fixture; four entry/route composition files retain deferred imports.

**All 272 tests passed on AWS** after correction: 54 native, 207 DOM across 19 files and 11 build records. The expanded suites first reproduced 40 targeted failures; all now pass. The fresh npm audit reported zero vulnerabilities, and the full PR whitespace check passed. Track final required CI and merge status on PR #9.

| Evidence | Revision/status |
| --- | --- |
| Accepted base, PR #8 | `fd5288e14660b4d296c70bee13b8a9182064a5d2` |
| Source-copy commit | `33fac865efe571130cafeeb136de00ad89cba20c` |
| Corrected functional commit | `2197809f17c92a27b3153bc3103cb174c00ffb2f` |
| AWS-tested functional tree | `8fe0c90a703e154f2e313f892aba78fb8d1aa1e9` |
| Final required CI and merge | Track PR #9 and its accepted-main receipt |

Read [the batch 9 receipt](checkpoints/batch-9-demo-catalog-composition.md) for source groups, reviewed correction scope and fixture limits. Historical receipts, including [batch 8](checkpoints/batch-8-runtime-pages-build.md), remain unchanged; their resume instructions describe earlier stopping points.

## Resume and next batches

1. Refresh PR #9 and its AWS receipt. If merged, begin from its accepted main; otherwise continue its existing branch and final checks. Preserve the existing environment, six-hour automatic stop and other workloads.
2. Keep the original provenance pin `df6ec6c4bfee803d89c54e9333297f29f378cee3`. Source main still resolves to `a4fc3801b636e2cfd0753797e8fc0dc846b42a22`, so the [batch 8 metadata receipt](input-inventory/source-refresh-batch-8.json) for all 79 candidates plus the reconciled locale remains applicable. Refresh before later imports if source advances.
3. Preserve the recorded WebsiteApp reconciliation: current blob `bb9616ba5618cac9899b4c487487b687a1caa51c` retains the `Start Verifying` CTA to `/verify`. Keep the other [source reconciliation decisions](input-inventory/source-reconciliation.json).
4. Resolve the remaining WebsiteApp/WebsiteRoutes/marketingRoutes/entry graph using the [source audit](source-import-inventory.json) and [input inventory](input-inventory/README.md), with bounded reads and no diagram/SVG processing. Importing the composition files alone does not close that graph.

## Remaining qualification

The expanded Vite fixture passed with eighteen actual inputs: the prior ten pages and eight new closed inputs. The website-shell DOM suite also passed with the deferred page boundary isolated and translation/analytics edges controlled; it does not execute the complete route graph.

Large marketing/catalog/manifest data, remaining page dependencies, the immutable blog dependency, production asset corpus, crawler output, real metadata-image emission, prerender, Nginx/browser handoffs and release/rollback identity remain pending. Demo fixtures do not establish playback, manifest validity or cryptographic verification. DOM navigation recording and computed styles do not qualify HTTP handoffs or pixel layout.

Retain website/application route ownership, withheld pricing and demo publication states. Commit and push verified batches promptly and keep this checkpoint compact.
