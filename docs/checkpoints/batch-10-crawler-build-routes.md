# Batch 10: crawler artifacts, build contracts and route wiring

Work is grouped in [website PR #10](https://github.com/ElevenID/website/pull/10), branch `feat/website-crawler-build-routes`, based on accepted main `7b477a0372b2058fc5ea71ba41bccbbf16afc575`. The source-copy baseline, expanded regression evidence and corrected **353-record aggregate** are verified. The fresh npm audit reported zero vulnerabilities. Track final hosted CI and the accepted merge on PR #10.

## Preserved source and provenance

Source-copy commit `9d6dc382fdf5d76ed1d657b06e149a2a6950c76e`, tree `d310635a29cce97a26ca6762b6671f75a4494083`, preserves four files totaling **13,734 bytes**:

| File under `ui/scripts/` | Bytes | Original/current Git blob |
| --- | ---: | --- |
| `production-build-contract.mjs` | 2,303 | `ce50431b187494a7aef0d1d5000eaa9c172e285f` |
| `production-build-contract.test.mjs` | 2,481 | `5b22fccc0768ae6732c3ee5aef1ed0e9be73170c` |
| `check_crawler_artifacts.py` | 5,992 | `b22360ed56deafb53d2e2fafe410b651e4ff4b81` |
| `test_crawler_artifacts.py` | 2,958 | `0567d5c28953b769e63403144a531415ae674cdf` |

All four match immutable source pin `df6ec6c4bfee803d89c54e9333297f29f378cee3` and refreshed source main `9ff6e9779a020839ebeafc60095370725e9fb694`. The first checkpoint also updates extraction provenance and the copied-source identity contract.

The [source refresh receipt](../input-inventory/source-refresh-batch-10.json) proves that the complete `ui/` and `contracts/` subtrees are unchanged from the previous source comparison. It covers the prior 79 candidates plus locale: 74 original-pin source matches, five reconciled source matches and one reconciled locale match. Root `.github/`, `release/`, `scripts/` and `tests/` changed and require separate review before use. This is a subtree identity refresh of the prior per-path evidence, not a new full content audit.

The crawler checker and its five-case Python fixture are intentionally adapted for the extracted website. Original blob identities remain recorded. Final provenance accounting is **32 verbatim + 35 adapted = 67 targets**.

## Website crawler artifact boundary

The original checker was written for a combined public UI and required application-owned `/docs`. The website adaptation uses the actual route contract and retains `/` and `/product` as required public pages.

The reviewed scope covers:

- Website ownership and reserved publication state: reject application/fallback paths, withheld pricing, the resource namespace and known static-resource suffixes, including encoded suffixes. Preserve dotted article/author slugs and numeric demo releases.
- Canonical origin and covered URL-component/path rules: require the canonical HTTPS origin and reject alternate hosts/ports, credentials, query/fragment components, trailing-slash aliases, embedded ASCII whitespace, malformed escapes, decoded traversal, repeated separators, backslashes and controls.
- XML structure: require the sitemap namespace, supported root type and direct URL/index entries with exactly one nonempty scalar location.
- Sitemap relationships: reject duplicate locations, missing references, cycles and page shards unreachable from the `robots.txt` root sitemap. A redundant index may refer to the root URL set; every page shard must still be reachable.
- Deterministic sorted URL output and existing private crawl rules in `robots.txt`.

The preserved Python suite changes its representative public fixture from `/docs` to `/developers`. Seventeen Node build records exercise the Python CLI against small synthetic files; one of those records also runs the five Python unittest cases. These fixtures do not load or qualify a generated production crawler corpus.

## Actual production-build contract fixtures

The original production-contract module and its two Node cases remain unchanged. Three added cases use actual Vite builds to qualify static adapter inclusion, lazy adapter inclusion and rejection when the declared adapter was never imported.

The fixtures create small synthetic adapter/source-identity files, use the actual source-binding contract and bundle plugin, verify retained module/content identity, and compare physical emitted chunks with Vite's output. They do not fetch a commerce repository or qualify a real commerce release. Temporary fixture files are cleaned up.

## Actual route wiring with explicit page boundaries

Fifty-nine DOM cases execute the actual `WebsiteRoutes.jsx` and `marketingRoutes.jsx`, React Router, runtime configuration, unavailable page and checked-in public commerce implementation.

The fixture isolates page imports at those two route-module boundaries with distinct default/named export markers and real route-parameter rendering. Exact passthrough allowlists retain the known small dependencies and compiler JSX runtime imports; any unexpected import from either route module fails before loading. Other DOM suites continue to load their actual page components.

Coverage includes direct and named-export pages, content aliases, canonical redirects with replacement history, current query/hash behavior, dynamic parameters, static-route precedence, invalid/disabled public configuration, unavailable application/unknown paths, withheld commerce and the marketing demo-publication switch.

These cases establish route wiring and gates. They do not execute the deferred page contents, blog package, manifest service, diagrams, video playback or full website build. No production page substitutes are introduced.

## Execution evidence and final gates

Use Node **24.22.1** and **Python 3.10 or newer**. Python uses only the standard library; no npm dependency, lockfile or CI workflow change is introduced. The observed development Python version is **3.12.3**.

| Check | Observed result/status |
| --- | --- |
| Existing aggregate after exact source copies | **272 passed**, 30.68 seconds |
| Preserved production-contract Node cases, run separately | **2 passed**, 0.11 seconds |
| Preserved Python crawler cases, run separately | **5 passed**, 0.12 seconds |
| Expanded regression evidence against preserved source | 266 DOM cases passed; build records: 22 passed / 11 failed |
| Corrected native records | 54 passed |
| Corrected DOM records | 266 passed across 20 files |
| Corrected build records | 33 passed |
| **Corrected aggregate** | **353 passed; zero failures, cancellations or skips; 46.65 seconds** |
| Python cases within one build record | 5 passed, reported separately |
| Fresh npm audit | Exit 0; zero vulnerabilities at every reported severity |
| Full PR whitespace and documentation links | Passed; 30 relative documentation links |
| Corrected functional commit | `9f058051860caaf7d709aa83fca5a260a6fd98bc` |
| Verified functional tree | `b88fe9fa6579f4133daae029e589e95cdc5f7e97` |
| Required hosted CI and final head | Track PR #10 for the final documentation revision |
| Accepted GitHub merge | Track PR #10 |

The verified aggregate is the prior 272 records plus 59 route cases and 22 build records. The 22 added build records comprise two preserved production tests, three actual Vite tests and seventeen crawler records. Five Python cases execute inside one crawler record and are not added again to 353.

The 11 initial failures were expanded crawler checks against the preserved combined-site checker; they are not evidence of 11 independent production bugs, because its legacy `/docs` requirement can terminate some cases before their more specific assertions. All 33 build records passed after the website adaptations.

An intermediate full run could not load a known virtual page module after prior route execution. The fixture now predefines every permitted virtual module and does not depend on a preceding `resolveId` call. The targeted 59-case route rerun and subsequent full aggregate passed with the cache retained. Import guards, route assertions and production routing sources remain unchanged.

Independent static reviews cover source identities, fixture boundaries, production adapter tests and the crawler corrections, including the exact fixture lifecycle fix. Static review remains separate from executed validation. The verified functional tree exactly matches the published functional commit.

## Remaining qualification

Full website composition, deferred large marketing/catalog/manifest inputs, the immutable blog dependency, production assets and metadata images, generated crawler output, full prerender, browser/Nginx handoffs and release/rollback identity remain unqualified. There is no production cutover in this batch.

Resume from the compact [migration checkpoint](../migration-status.md). Historical source inventories and earlier batch receipts remain unchanged.
