# Migration checkpoint

## Current batch: navigation and runtime helpers

[Website PR #6](https://github.com/ElevenID/website/pull/6) extracts six pure navigation/runtime helpers and corrects double decoding of landing-page authentication-error text. All **49 tests passed on AWS**, with zero failures, cancellations or skips. The required final hosted check and accepted merge receipt are linked from the PR.

| Evidence | Revision |
| --- | --- |
| Accepted base, PR #5 | `c4d3e03c97e892a846716fc753d3b4949af1893b` |
| Verbatim navigation extraction | `b577df9ec58d4d6f19fa6786941c9646616b77c5` |
| AWS-tested correction and tests | `8b021b03dd7b117e81984f06d5aa371573a12431` |
| AWS-tested source tree | `c0f63b5c27089a940455473b8dc453051973506a` |

Read [the batch 6 checkpoint](checkpoints/batch-6-navigation.md) for the regression evidence, test scope and remaining gates. The previous checkpoint is preserved byte-for-byte in [history through batch 5](migration-history-through-batch-5.md); its resume instructions are historical.

## Next bounded batch

1. Confirm the accepted PR #6 merge and clean AWS checkout before branching from current main. Preserve the existing automatic-stop safeguard and workloads.
2. Extract `useSurfaceNavigate` and `WebSurfaceBoundary` with their small inherited tests and a real React/DOM test environment. Qualify ordinary and modified clicks, targets/downloads, history navigation, query/hash retention and replace behavior.
3. Continue remaining website-owned source and asset extraction in separate batches. Apply the six current-blob preservation decisions in [source reconciliation](input-inventory/source-reconciliation.json), refreshing drift if source main advances.

## Remaining build and release gates

The candidate [source audit](source-import-inventory.json) and [input inventory](input-inventory/README.md) remain bounded evidence, not a complete executed build graph. Create the website-only dependency lock/build context, preserve the immutable blog pin and MUI resolver, and declare `prop-types` directly.

Qualify emitted assets and metadata images, generated inputs/crawler output, prerender, Nginx/browser handoffs and release/rollback identity before production cutover. Demo publication states and website/application route ownership remain unchanged.

Commit and push each verified slice promptly, and update this short checkpoint before expanding scope.
