# Website-owned demo validation and browser behavior

The website owns public demo manifests, their generated module, posters, pages and HTTP routes. Application repositories continue to own the product being demonstrated, its authenticated release evidence and credential journeys. The recorder owns capture, privacy review, media integrity and evidence-bound publication operations.

## Preserved catalog state

This batch starts from website source `601b148130f10639144e9e6a2f53d5fc2ac11ab7`. It changes no manifest, poster, generated catalog or approval record.

| Catalog edition | Release state | Coverage | Scenario state |
| --- | --- | --- | --- |
| `2026.07.0` | `DRAFT` | `PARTIAL` | Three historical `PUBLIC` scenarios and three drafts |
| `2026.08.0` | `DRAFT` | `PARTIAL` | Fourteen drafts; deployment binding pending |

Both release readiness flags remain false. `latest_approved_stack_version` remains null and `latest_available_stack_version` remains `2026.08.0`. A public scenario within a draft release does not approve that release. Retired D-07/D-08 source records remain in historical archives, while current catalog cards exclude them and direct retired website routes return HTTP410.

## Read-only content gate

```sh
bun run check:demos
bun run test
```

The stdlib Python semantic validator checks release/scenario state, recorded evidence fields, automated publication checks, media hashes, wallet evidence, current versus historical portfolio rules, index consistency and actual poster bytes. It requires true booleans for readiness and refuses traversal, ambiguous poster paths and symlinks. SVG/VTT hashing retains canonical newline handling; binary hashes retain exact bytes. It then checks that committed generated exports match the source inputs.

`predev` and `prebuild:website` run this check without regenerating files. Intentional edits use `bun run generate:demos`, followed by review and commit of the generated diff. Python3.10+ must be available as `python3`.

[Import provenance](../contracts/demo-validation-provenance.json) pins the original Marty main source and records the website adaptations. Original extraction receipts remain intact. The validator reads the website's existing wallet-schema projection. It does not execute a general JSON Schema validator: the inherited full root schema describes an older approval format and is deliberately not imported as a v2 contract.

The gate validates public data consistency. Hash-shaped fields and editorial-check names do not authenticate the underlying recorder or product evidence, and the gate never creates approval, recording or publication records.

## Browser coverage follows the website

The six website-only behaviors formerly exercised by Marty's credential lifecycle prerequisite now run inside `scripts/qualify-website-nginx.mjs`, before its successful receipt, in both existing standalone qualification and protected-main publication. The same exact production image is served on a fresh loopback port. The tests verify four viewport layouts, first-paint protection, decoded images, console/network failures, every active detail canonical and poster, retired HTTP410 responses, and historical public-player consent/captions/chapter navigation.

The browser requires the installed `CHROME_PATH`, a non-root user and sandbox support. It uses a fresh home/profile, blocks service workers and denies unexpected external requests. Only the two known Google Fonts CSS URLs and the consented privacy-enhanced player URL receive local fixtures. The resulting evidence explicitly describes system fallback fonts and locally fulfilled iframe responses; it does not establish actual font delivery or YouTube playback.

The separate browser artifact is unsigned. Its report must contain six executions, six passes, no skip and no retry. Failure prevents the Nginx qualification receipt and subsequent publication. Existing v3 release input keys, original proof files and producer authority remain unchanged.

## Subsequent publication work

The original combined beta publisher remains bound to its signed product aggregate, reviewed source and recorder. Its mutable `ui-prod` content deployment is unsuitable for the standalone website. This batch does not retarget it.

New recordings still need original product/recorder authentication, exact evidence and media bindings, privacy/editorial checks and the existing approval transitions. Reviewed website content then enters the existing signed website publication, authenticated composition and selected-host promotion/rollback path. The old live product-marker assertion remains a deployed-composition acceptance concern; local website browser success cannot satisfy it or identify the public host.
