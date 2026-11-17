# Batch 11: website sections, release identity and server routing

This milestone is grouped in [website PR #11](https://github.com/ElevenID/website/pull/11), branch `feat/website-sections-release-routing`, starting from accepted PR #10 at `4f53c1768e59b464fddc3b032d260816c7047de2`.

It preserves the next six bounded runtime components and six website build/server sources, then qualifies actual component and artifact behavior. The full production website graph remains a later milestone.

## Source preservation

All **12 imports, 60,382 bytes total**, were preserved before adaptation. Every source file is smaller than 16 KiB. Their Git blobs match both the original source pin `df6ec6c4bfee803d89c54e9333297f29f378cee3` and the checked comparison `9ff6e9779a020839ebeafc60095370725e9fb694`.

| Source and target path | Bytes | Original Git blob |
| --- | ---: | --- |
| `ui/src/components/pages/AiCapabilityPage.jsx` | 9,839 | `2b0c0f055152e05af23bcc132456ad134f2ce441` |
| `ui/src/components/pages/MarketingProtocolSupportCatalog.jsx` | 656 | `5718f4a1ee33fd5ab8d2e5095a3824e218f12f2d` |
| `ui/src/components/landing/DeploymentModelsSection.jsx` | 8,524 | `e8a9ad5193db4c627bcd17c6d35f40054b6614d7` |
| `ui/src/components/landing/EndUserExperienceSection.jsx` | 5,572 | `84faa1e2fddb8d53619a362ab1001309e83c3210` |
| `ui/src/components/landing/ProductCapabilitiesSection.jsx` | 3,720 | `de73d281e803542ff4f0f51321255626879ec2da` |
| `ui/src/components/landing/ProofLabSection.jsx` | 13,613 | `6836204e406006c7d052c8ab5f9a23114067205f` |
| `ui/scripts/render-website-nginx.mjs` | 1,978 | `0edf2fd1ba1062f2b0226887abf8694bc8f1a769` |
| `ui/nginx.website.conf` | 1,478 | `013f4cc8424aa18a80f9a6d0c6e3bdf1a14800ea` |
| `ui/nginx.website.headers.conf` | 900 | `8c3884ec38f4c5c7bea7af8f980de5049895aeb1` |
| `ui/scripts/assert-website-dist.mjs` | 3,967 | `6167fe968afd96b0b8f91d1f6370880ad6dadbfe` |
| `ui/scripts/web-surface-build-contract.mjs` | 3,947 | `bcb80076c5fca772ab834b52db505987314d932e` |
| `ui/scripts/web-surface-build-contract.test.mjs` | 6,188 | `530795a0d87269f5dd108c101f98080159133e7e` |

The [batch provenance shard](../../contracts/extraction-provenance-batch-11.json) records these original identities and subsequent adaptations, extending [earlier provenance](../../contracts/extraction-provenance.json). The shard now contains one verbatim header file and 11 adapted source files; the earlier 67 target records remain unchanged. Two new native checks validate the bounded shard and exact source-copy identities. The [source metadata refresh](../input-inventory/source-refresh-batch-11.json) confirms that source main and the complete `ui/` and `contracts/` subtree identities remain unchanged since batch 10. Earlier reconciliation and intentional adaptations remain authoritative.

## Runtime component qualification and corrections

[AI page cases](../../tests/dom/ai-capability-page.test.jsx) execute the actual AI page, marketing catalog adapter, catalog normalizer/view, metadata and navigation helpers. [Marketing section cases](../../tests/dom/marketing-sections.test.jsx) execute the four actual sections and shared layout helpers with React, MUI and Router.

The tests establish:

- AI heading, canonical and structured metadata; visible snapshot/support limitations; keyboard-reachable interface links; safe separate-tab attributes; documentation handoff; and canonical DNS destinations from a configured public IP entry.
- Featured-product and deployment-label limits, product destinations and effective responsive card sizing.
- Controlled holder-journey selection, callback values, disclosure/check/outcome presentation and safe text rendering.
- Whole-card deployment links, selected-model callbacks, website route transitions and responsibility content.
- Proof preview and result states, disabled repeat execution while running, selected-scenario callbacks, successful/failed response details and counts, empty-result fallbacks, text-only previews, walkthrough destinations and mobile control sizing.
- Effective typography weights and retained heading gutters, using actual computed styles rather than mocked components or pixel-layout claims.

The first 33-case original-source run passed 22 and failed 11. Inspecting rendered typography exposed an additional compatibility problem; five focused computed-style cases extended the original-source run to **38 cases: 22 passed, 16 failed**, in 6.37 seconds. These are failing regression cases across related defects, not 16 independent production incidents.

The corrections are deliberately scoped:

1. Move **20 Grid declarations** from removed `item`/breakpoint props to `size`.
2. Move **22 direct Typography font-weight declarations** and **two primary text-slot font weights** into `sx`, preserving their values and existing margins/gutters.
3. Replace click-only AI interface panels with semantic links, preserving document destinations and applying `publicEntryHref` to those links, the bottom OpenAPI CTA and catalog source. Separate-tab links retain `noopener noreferrer`.
4. Expose controlled journey/scenario selection through `aria-pressed`.
5. Remove the nested keyboard control inside each deployment whole-card link while retaining its visible CTA.

The corrected aggregate passed **393 records**: 56 native, 304 DOM across 22 physical files and 33 build, in 52.9 seconds, with no failures, cancellations or skips. This is the component checkpoint before the additional build/server qualification below.

### Runtime boundary limits

The [test-only content boundary plugin](../../tests/fixtures/marketing-content-boundaries.mjs) uses exact component importer/specifier allowlists. Small independently authored marketing and catalog fixtures replace only the missing large data imports; one declared deployment-diagram marker replaces the diagram import. Unexpected imports from these six components fail before loading. The existing route-composition fixture remains separate and unchanged.

The fixtures establish component behavior, not production marketing copy, catalog acceptance, live proof verification, diagram implementation or blog content. The real public-entry helpers execute, but final documentation loads are recorded instead of navigating an actual browser. SVG/diagram bodies, large data and the immutable blog package were not imported or processed.

## Website release and server qualification

The combined surface helper is adapted to a website-only build contract. It validates source revision and explicit public/full/development modes, records `ElevenID/website` as the repository identity, and rejects application/private module leakage and withheld pricing. Actual Vite fixtures cover static and lazy adapter composition with small source and adapter identities.

The Nginx renderer now accepts `MARTY_WEBSITE_SOURCE_SHA`. The distribution CLI requires `DIST --source-sha SHA` and, for a full adapter build, `--commerce-sha SHA`; development fixtures require explicit `--allow-development`.

The distribution validator checks the expected website revision and, when applicable, commerce revision; explicit development mode; metadata/route ownership; resource namespace and path constraints; and symlink, traversal and loopback references. It reuses the existing Python crawler checker. HTML inspection uses the already-pinned `jsdom` dependency as an inert attribute parser; build checks therefore require development dependencies.

Nginx policy keeps known missing resources from falling through to page HTML and denies unowned files even when physically present. Dotted blog/author routes, numeric demo versions and the owned RSS route retain their intended behavior. The separate HTTP suite exercises actual Nginx with small synthetic content and a digest-pinned official image.

The 76 passing build records include 43 new cases for website identity, actual Vite composition and distribution checks. The separate HTTP suite passed all 20 cases against the digest-pinned official Nginx image.

### Intermediate server findings

The expanded build suite passed **76 of 76 records** (33 prior + 43 new), in 10.27 seconds. The original Nginx policy passed **13 of 19 HTTP cases and failed six**, in 0.77 seconds; the failures covered dotted page slugs and physically present unowned files. The first policy correction passed **16 of 19 cases and failed three**, also in 0.77 seconds. Its stricter default denial exposed the existing page fallback's internal redirect to `/index.html`.

The subsequent correction adds an exact internal-only `/index.html` handler so page fallbacks can resolve while direct public requests remain denied. One additional case exercises plain, encoded and query-bearing external index requests. The revised suite passed **20 of 20 HTTP cases**, in 0.72 seconds. The intermediate results above record the regression and correction sequence.

20 separate Nginx HTTP cases passed in 0.72 seconds. The separate `npm run test:nginx` suite requires Docker and the official image `nginx@sha256:785835ea65db4bba6f021acc0f3be91b0fef76a53fe41f8588c6698d2aed0606` to be available. Required CI pulls that exact image and runs the HTTP suite explicitly; `npm test` retains the native/DOM/build aggregate.

Release checks use small synthetic output trees and adapters; HTTP checks use generated route configuration and a synthetic content corpus. They qualify artifact identity and server policy, not the complete production website, real commerce/blog packages, a deployed release or rollback. The complete production corpus and browser/application handoffs still require acceptance.

## Execution and revision receipts

| Checkpoint | Verified evidence |
| --- | --- |
| Source preservation | 355 records passed: 56 native + 266 DOM + 33 build, in 45.12 seconds |
| Expanded original component baseline | 38 cases: 22 passed, 16 failed, in 6.37 seconds |
| Corrected component aggregate | 393 records passed: 56 native + 304 DOM + 33 build, in 52.9 seconds |
| Final native/DOM/build aggregate | 436 passed: 56 native + 304 DOM + 76 build, in 55.08 seconds |
| Server HTTP qualification | 20 separate Nginx HTTP cases passed in 0.72 seconds |
| Combined final records | 456 passed across the native/DOM/build and HTTP commands; no failures, cancellations or skips |
| Fresh dependency audit | zero vulnerabilities at every severity (exit 0) |
| Whitespace and documentation links | Full PR whitespace check and all 42 relative documentation links passed |

The existing crawler build wrapper also executes **five Python unittest cases**. They are reported separately and are not added again to the aggregate test-record totals.

| Revision | Identity |
| --- | --- |
| Accepted base | `4f53c1768e59b464fddc3b032d260816c7047de2` |
| Exact source-copy commit | `7193b1bdea2cf7c0ec81c223588540f39b8d8488` |
| Exact source-copy tree | `015362ebecedbc14fe58fc22405d8cdbd4dc6091` |
| Corrected component commit | `4c6047d17ce8696fe44fe3791f242a88a9a5e373` |
| Corrected component tree | `763f4656a1d593cc64ee4a403732a44f2ac9a88f` |
| Final functional commit | `67b5c1e3886e96dbf380757ab342d8b459bb6afa` |
| Verified final functional tree | `eaa47b8a1183b31e2e2402ef8672c3e39591934d` |

Track final hosted CI, the final documentation revision and the accepted merge on [PR #11](https://github.com/ElevenID/website/pull/11). Independent static review covered source identities, the exact runtime import boundaries, source adaptations and fixture count/accounting. Independent build review verified all nine functional artifact identities, the minimal Nginx fallback correction and the required CI integration.

## Remaining work

Complete the remaining page/data graph while retaining bounded reads and the SVG restriction. Large production marketing/catalog/manifest inputs, the immutable blog dependency, the production asset corpus, complete prerender and real browser/application handoffs remain unqualified. Synthetic build/server evidence does not replace acceptance of the complete production release, its deployment identity or rollback.

Preserve website/application ownership, withheld pricing, demo publication states and the reconciled verification CTA. Resume from the [compact checkpoint](../migration-status.md); production cutover remains a later milestone.
