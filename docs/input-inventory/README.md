# Website input inventory

This directory records the next extraction boundary after [website PR #3](https://github.com/ElevenID/website/pull/3).

## Evidence and scope

- Source snapshot: `ElevenID/marty-ui@df6ec6c4bfee803d89c54e9333297f29f378cee3`.
- Current-source comparison: `e10a7f26cda8ac217c7ddefebc709fc246dabaff`.
- [Public assets](asset-inventory.json): all 83 tracked files, their Git identities, sizes and dispositions. The existing website plugin selects 46 and excludes 37.
- [Build and tests](build-inventory.json): build helpers, configuration, generated inputs, dependency constraints and tests classified for copying, adapting or deferring.
- [Source drift](source-drift.json): comparison of the 79 candidate source files and 83 public files with the current-source revision above.

This is a metadata classification and targeted small-file review. It does not qualify an executable standalone website, all transitive imports, generated outputs, or runtime asset references.

## Preserve newer source changes

Five candidate source files and one public translation changed after the pinned snapshot. Their exact old and new blob identities are recorded in the drift file. Reconcile those changes before importing the affected files; do not silently replace current content with the older snapshot.

The next bounded source slice consists of two unchanged, dependency-free build helpers and their original tests (4,806 bytes total):

- `ui/scripts/dev-server-origin.mjs`
- `ui/scripts/dev-server-origin.test.mjs`
- `ui/scripts/generated-text.mjs`
- `ui/scripts/generated-text.test.mjs`

These copies retain original paths and must be recorded in the extraction provenance. Their existence alone does not qualify the complete source graph or standalone build.

## Remaining gates

1. Reconcile changed source and locale inputs.
2. Transfer classified large/generated inputs as a separate bounded operation; avoid printing their contents or parsing SVGs during review.
3. Verify demo poster references/digests and preserve the DRAFT/PARTIAL publication states.
4. Create the website-only dependency lock and build context, preserving the immutable blog pin and MUI compatibility resolver. Declare the directly used `prop-types` dependency.
5. Correct social/JSON-LD image URLs to use the immutable asset namespace; decide whether to adapt or defer the AI-plugin compatibility payload.
6. Qualify real asset emission, generated crawler outputs, prerender, Nginx and browser/application handoffs.
7. Rebind release provenance and verify rollback before any production cutover.

The root route contract does not assign `/.well-known` to the website. Retaining a versioned AI-plugin payload does not authorize inventing a new root route.

## Validation environment

The previous AWS checkout remains at the accepted PR #3 checkpoint. AWS sign-in expired before this batch, so these inventory/source preparations must not be described as newly executed or build-qualified on AWS. Repository CI can verify the dependency-free contracts and copied-source identities; AWS execution resumes after authenticated access is restored.
