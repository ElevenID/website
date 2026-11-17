# Migration checkpoint

## Current milestone: website sections, release identity and server routing

[Website PR #11](https://github.com/ElevenID/website/pull/11), branch `feat/website-sections-release-routing`, continues from accepted PR #10 at `4f53c1768e59b464fddc3b032d260816c7047de2`. It preserves **12 source files totaling 60,382 bytes**, each below 16 KiB, and groups component qualification with website build/server work.

The source-copy checkpoint passed **355 records**: 56 native, 266 DOM and 33 build, in 45.12 seconds. The new component baseline ran **38 cases: 22 passed and 16 failed**, exposing layout, typography, accessible control and canonical-link problems in the preserved sources. After correction: **436 passing native/DOM/build records** — 56 native, 304 DOM across 22 files, and 76 build. 20 separate Nginx HTTP cases passed in 0.72 seconds, for **456 passing records across both commands**, with no failures, cancellations or skips. Fresh npm audit: zero vulnerabilities at every severity (exit 0). The existing crawler wrapper also runs five Python cases; those cases are not added again to the aggregate.

| Evidence | Revision/status |
| --- | --- |
| Accepted base, PR #10 | `4f53c1768e59b464fddc3b032d260816c7047de2` |
| Exact source-copy commit | `7193b1bdea2cf7c0ec81c223588540f39b8d8488` |
| Source-copy tree | `015362ebecedbc14fe58fc22405d8cdbd4dc6091` |
| Corrected functional commit | `67b5c1e3886e96dbf380757ab342d8b459bb6afa` |
| Verified functional tree | `eaa47b8a1183b31e2e2402ef8672c3e39591934d` |
| Final required CI and merge | Track PR #11 for the final revision and accepted merge |

Read [the batch 11 receipt](checkpoints/batch-11-sections-release-routing.md) for source identities, executed results and qualification limits. [Batch 10](checkpoints/batch-10-crawler-build-routes.md) and earlier receipts remain historical.

## Resume and next batches

1. Refresh PR #11. If merged, continue from its accepted main; otherwise continue its existing branch and remaining checks.
2. Retain immutable source pin `df6ec6c4bfee803d89c54e9333297f29f378cee3`. The [batch 11 metadata receipt](input-inventory/source-refresh-batch-11.json) confirms source main remains `9ff6e9779a020839ebeafc60095370725e9fb694`. Unchanged `ui/` and `contracts/` trees retain the 79 candidate identities and reconciled locale. Earlier changes to root `.github/`, `release/`, `scripts/` and `tests/` still need separate inspection before use.
3. Preserve the [source reconciliation](input-inventory/source-reconciliation.json), including WebsiteApp's `Start Verifying` CTA to application-owned `/verify`. Retain both the [original provenance](../contracts/extraction-provenance.json) and [batch 11 shard](../contracts/extraction-provenance-batch-11.json); keep later adaptations separate from verbatim identities.
4. Close the remaining page/data graph using the [source audit](source-import-inventory.json) and [input inventory](input-inventory/README.md). Continue bounded reads, avoid SVG processing, and group related verified commits into cohesive PRs.

## Remaining qualification

The new DOM suites execute the actual AI page/catalog adapter and four landing sections. Small synthetic marketing/catalog inputs and one explicit diagram boundary leave production data and SVG deferred. The route-composition suite retains its separate page boundaries. These checks do not establish complete website content or browser document handoffs.

Release checks use small synthetic output trees and adapters; HTTP checks use generated route configuration and a synthetic content corpus. They qualify artifact identity and server policy, not the complete production website, real commerce/blog packages, a deployed release or rollback. The complete production corpus and browser/application handoffs still require acceptance.

Large marketing/catalog/manifest inputs, the immutable blog dependency, production assets, complete prerender, browser/application handoffs and release/rollback qualification remain pending. Preserve website/application ownership, withheld pricing and demo publication states. Production cutover remains a future milestone.
