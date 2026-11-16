# Batch 5: source reconciliation and metadata images

Work is tracked in [website PR #5](https://github.com/ElevenID/website/pull/5), based on accepted main `98bb8f265558bb3fa22ef762f3f046a55d938abb`.

## Changes

The [source reconciliation](../input-inventory/source-reconciliation.json) accounts for all five source changes and the English marketing locale change between the pinned snapshot and `marty-ui@e10a7f26cda8ac217c7ddefebc709fc246dabaff`. They come from source PR #1783 and preserve the newer “Start Verifying” calls to action. The reviewed deltas add no new module import edges. `/verify` remains application-owned; its page and backend are outside this extraction. The affected source and locale files have not been copied.

Four unchanged metadata files were then copied with their original paths and Git blob identities (8,159 bytes). A separate adaptation makes the default social image and both JSON-LD logo locations share an absolute URL built from the existing immutable asset base. The canonical site URL and explicit social-image overrides retain their prior behavior. The static-asset helper remains verbatim; the two adapted consumers are identified separately in extraction provenance.

| Checkpoint | Commit |
| --- | --- |
| Source reconciliation and route coverage | `3eee3f5e90c5d0438349f2d83db569e3ad865587` |
| Verbatim metadata extraction | `6b311a71c642f597d01610fd362be929518d650d` |
| Metadata correction and regression tests | `604f4a519641555a514054239f1ffffedb8fb567` |
| AWS tested source tree | `12329420a69fa9894e3e5b7da73a1f2a02a87bbe` |

## Validation

On the existing AWS development instance, using the preserved Node.js **24.22.1** runtime:

- Reconciliation and the verbatim extraction each passed the existing 19 tests.
- Before the correction, the expanded suite reproduced the old root-logo defect: **22 passed, 2 failed**.
- After the correction, **all 24 tests passed**, with zero failures, cancellations or skips.
- Staged changes and the entire PR passed whitespace checks.
- The existing six-hour automatic-stop timer was active; no new infrastructure or dependency installation was needed.

The five additional tests execute the actual static-asset, shared metadata and JSON-LD modules with root and revision-namespaced build environments. They cover passthrough inputs, query/fragment retention and independence from mutable browser runtime settings. The test command uses Node's `--experimental-vm-modules` flag to supply `import.meta.env`; this is test configuration, not a production runtime change.

The following checkpoint changes documentation only. See PR #5 for its final head, required hosted check and accepted merge receipt.

## Qualification limits and next work

This does not qualify a full Vite build, emitted logo files, React/DOM behavior, prerender, Nginx, browser handoffs or release production. The social-image consumer wiring was reviewed; the native VM tests do not render `SEOHead`. No full large source file, SVG/binary contents, lockfile or large generated module was read. No public assets were copied.

1. Confirm the accepted PR #5 merge and clean AWS checkout before starting the next branch.
2. Continue a bounded extraction of the website navigation/runtime boundary and focused tests. Preserve application ownership of verification, login and console routes.
3. Import the remaining classified website source and assets in separate batches, applying the six current-blob preservation decisions. Refresh source drift if source main advances.
4. Create the website-only dependency/build context, preserving the blog pin and MUI resolver and declaring `prop-types` directly.
5. Verify actual asset emission and metadata images, generated inputs/crawler outputs, prerender, Nginx/browser handoffs and release/rollback identity before production cutover.
