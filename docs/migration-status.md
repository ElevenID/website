# Migration checkpoint — full-asset fixture and real browser startup

Continue [website PR #13](https://github.com/ElevenID/website/pull/13), branch `feat/complete-website-source-graph`. It remains **draft**. Accepted main is still `c586c1ca2800f181594ffd03c5045fd3b93f76fb`; no production cutover.

## Latest verified functional head

`37f592b0fcbb7e410bc3fde919eebebca3ed8aa0`, tree `18dbcff459847a41f82c20bc2f1d43033c31f610`.

- All **79/79** original source candidates are committed. Preserve the immutable source pin and reconciled `/verify` CTA/locale changes.
- **38/46** selected public assets are committed. The other eight original files (16,574,562 bytes) have now been imported and verified successfully in a separate, ephemeral CI migration fixture, **not persisted in this repository**.
- Both the [required independent CI](https://github.com/ElevenID/website/actions/runs/44149436306/job/134273369969) and [complete-asset migration/browser job](https://github.com/ElevenID/website/actions/runs/44149436307/job/134273368119) passed at the functional head. Verify final PR-head checks after any subsequent documentation commit.
- Suite composition is **576 records**: 65 native, 345 DOM, 146 build and 20 Nginx, including 24 new asset-tool regression cases. Five Python cases nested in a build wrapper are not counted again.
- The complete-asset fixture verifies **46/46**, repeats import with **zero writes**, removes its source checkout, and builds independently: **1,147 modules / 66 JavaScript chunks / 37 verified executable entry references**.
- Actual Chrome now renders home, product, standards, protocol, demos and blog with headings/canonicals, completed startup and no missing same-origin resource requests. A real `/verify` CTA click loads a separate application fixture document. This is not a live authenticated-app test.
- Corrected a real startup failure: `base` and `assetsDir` previously doubled the immutable asset prefix. Entry/preload URLs now resolve to actual emitted files. Demo canonical/version selection remains unchanged; 2026.08.0 stays DRAFT/PARTIAL with its disclaimer.

[Current detailed receipt](checkpoints/batch-13-asset-browser-followup.md) · [Earlier source/bundle receipt](checkpoints/batch-13-complete-source-bundle.md).

## Next execution

1. Refresh this existing PR and its branch; do not duplicate it. Keep related verified checkpoints in the same larger PR.
2. Restore interactive execution on the existing AWS development instance. Preserve rootless Docker, existing workloads and the six-hour stop safeguard. No AWS status was reverified in this session.
3. From the website checkout, use a separate local source checkout containing `df6ec6c4bfee803d89c54e9333297f29f378cee3`:

   ```sh
   node scripts/import-large-public-assets.mjs --source /absolute/path/to/marty-ui
   node scripts/verify-public-assets.mjs
   ```

   The corrected importer supports root-level `favicon.svg`, preflights every entry, refuses collisions and does not commit/push/deploy. Review and commit the exact eight files from [the source-bound manifest](../contracts/large-public-assets.json). The large-file/SVG restriction is removed; transfer and test on the instance without printing contents.
4. Run the independent suite and development build with Node 24.22.1. The separate migration workflow is a temporary validation input, not a production build dependency; ordinary `Website contracts` never checks out application source.
5. Complete full-route production prerender, sitemap/robots and metadata acceptance, real Nginx against complete output, live application handoffs, image/provenance publication, platform intake and retained-slot rollback. Keep private commerce, application-owned `/verify` and draft demo states intact.

## Qualification limits

Current artifacts are development-audience client bundles. The browser fixture inspects real rendered DOM but does not persist production prerendered documents. Six-route smoke coverage does not prove every route, complete SEO, visual layout, external fonts/services, or the authenticated application. Eight resources remain uncommitted despite successful temporary transfer. Do not merge or publish this as a qualified production website yet.
