# Migration checkpoint

## Current milestone: crawler artifacts, build contracts and route wiring

[Website PR #10](https://github.com/ElevenID/website/pull/10), branch `feat/website-crawler-build-routes`, continues from accepted PR #9. It preserves **four source files totaling 13,734 bytes**, adds actual Vite adapter checks, and exercises the real website/marketing route modules with explicit page boundaries.

The source-copy checkpoint passed the existing **272 tests** plus the two preserved production-contract cases and five Python crawler cases. The expanded baseline passed all 266 DOM cases and exposed 11 crawler-check failures among 33 build records. After correction, **all 353 records passed**: 54 native, 266 DOM across 20 files and 33 build. The fresh npm audit reported zero vulnerabilities. Track final hosted CI and merge status on PR #10. One build record also executes five Python cases; those cases are not added again to the aggregate.

| Evidence | Revision/status |
| --- | --- |
| Accepted base, PR #9 | `7b477a0372b2058fc5ea71ba41bccbbf16afc575` |
| Source-copy commit | `9d6dc382fdf5d76ed1d657b06e149a2a6950c76e` |
| Source-copy tree | `d310635a29cce97a26ca6762b6671f75a4494083` |
| Corrected functional commit | `9f058051860caaf7d709aa83fca5a260a6fd98bc` |
| Verified functional tree | `b88fe9fa6579f4133daae029e589e95cdc5f7e97` |
| Final expanded execution and audit | 353 passed; zero reported vulnerabilities |
| Final required CI and merge | Track PR #10 for the final revision and accepted merge |

Read [the batch 10 receipt](checkpoints/batch-10-crawler-build-routes.md) for the source identities, crawler corrections, test counts and fixture limits. [Batch 9](checkpoints/batch-9-demo-catalog-composition.md) and earlier receipts remain historical.

## Resume and next batches

1. Refresh PR #10. If merged, continue from its accepted main; otherwise continue its existing branch and remaining checks.
2. Retain immutable provenance pin `df6ec6c4bfee803d89c54e9333297f29f378cee3`. The [batch 10 metadata receipt](input-inventory/source-refresh-batch-10.json) compares source main `9ff6e9779a020839ebeafc60095370725e9fb694` with the prior comparison. Identical `ui/` and `contracts/` subtrees preserve all 79 candidate identities and the reconciled locale. Root `.github/`, `release/`, `scripts/` and `tests/` changed and need separate review before use.
3. Preserve the [recorded source reconciliation](input-inventory/source-reconciliation.json), including WebsiteApp's `Start Verifying` CTA to application-owned `/verify`. Preserve later intentional adaptations separately.
4. Close the remaining page/data dependency graph using the [source audit](source-import-inventory.json) and [input inventory](input-inventory/README.md), with bounded reads and no SVG processing. Keep verified changes in cohesive PRs and maintain this compact checkpoint.

## Remaining qualification

The route fixture uses the actual route modules, React Router, runtime configuration, unavailable page and public commerce implementation. Distinct page-boundary markers isolate page content and its data, diagram and blog dependencies. It establishes route selection, parameters, redirects and gates; it does not execute the complete pages or browser document handoffs.

Crawler fixtures exercise small synthetic files, and commerce fixtures bind synthetic adapter identities and actual Vite output. They do not qualify generated production crawler output or a real commerce release. Large marketing/catalog/manifest inputs, the immutable blog dependency, production assets, full prerender, Nginx/browser handoffs and release/rollback identity remain pending.

Retain website/application ownership, withheld pricing and demo publication states. Full website build qualification and production cutover remain future milestones.
