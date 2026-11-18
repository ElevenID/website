# Migration checkpoint — standalone release contract and consumer compatibility

[Website PR #13](https://github.com/ElevenID/website/pull/13) is merged at `e65be9c615fd8ccddc2d4753d098ebbc0e826d2a`. Its final source tree passed [Website CI](https://github.com/ElevenID/website/actions/runs/44395320515) and [standalone production qualification](https://github.com/ElevenID/website/actions/runs/44395321376) on main. Refresh current PR and Actions results before continuing from this checkpoint.

## Recovered November 18 checkpoint

- All **79/79** original source candidates and **46/46** selected public assets are committed. The eight large assets total **16,574,562 bytes**, imported from immutable marty-ui source `df6ec6c4bfee803d89c54e9333297f29f378cee3` at website commit `8ad4b340a4ec7e325e72bb8adfa00492b0bd966b`.
- The last chat's final head, `1ba942da211d3cf236369d45427c0e7205a4794f`, finished successfully after its checkpoint was written: [Website CI](https://github.com/ElevenID/website/actions/runs/44265461081) and [migration qualification](https://github.com/ElevenID/website/actions/runs/44265460945).
- That historical qualification checked 257 routes, 253 canonical URLs, 46 assets, a local image built from a pinned Nginx base, 57 HTTP resource checks and 19 denied application/private paths. Its application handoff was an isolated fixture.
- The architecture plan [marty-ui #1969](https://github.com/ElevenID/marty-ui/pull/1969) and initial installer-consumer extraction [platform #1](https://github.com/ElevenID/platform/pull/1) are merged. Neither establishes standalone website release admission or a complete platform installer.

## Batch 15 changes

Review found gaps not covered by the earlier green run. The current qualification now:

1. Includes `/privacy`, `/terms`, `/verification`, `/issuance` and `/blog/foundations`, bringing the plan to **262 routes / 254 canonical paths**. Every rendered and HTTP-served route must match its own canonical identity, so a homepage fallback cannot pass as another page.
2. Rejects caught React error pages and remaining loading markers. Readiness fallback becomes eligible only after 25 seconds; normal `app-rendered` evidence takes precedence. Behavioral tests exercise errors, loaders, demo settlement and the signal/fallback race.
3. Builds on a fresh runner that never checks out `marty-ui`. Exact source-asset replay remains a separate migration audit.
4. Requires a clean checkout matching the claimed source SHA and records four successful stages against the same final distribution bytes. Nginx starts the exact inspected local image ID.
5. Uploads a bounded `web-qualification-RUN-ATTEMPT` artifact with per-file hashes, input identities, workflow context and stage receipts. These are explicitly unsigned qualification records, not production intake evidence.
6. Commits the existing demo generator's normalized output. The previous import retained an older serialization that the first build rewrote; the generated exports now match every committed JSON input without dirtying the checkout. Original blob identity remains in the extraction history and the adaptation receipt.

See [qualification procedure and evidence](standalone-qualification.md). The authoritative acceptance result is the associated **Website contracts**, **Migration asset provenance** and **Standalone production qualification** checks on the final source head.

## Source merge versus release activation

The approved [independent release plan](https://github.com/ElevenID/marty-ui/blob/main/docs/independent-website-release.md#first-cutover) separates reviewed source changes from subsequent protected-main signing and live-host qualification. The earlier Batch 14 wording conflated those gates. Merge this extraction milestone only after review and exact-head source/build/contract/browser/HTTP checks pass. A source merge does not publish or activate a website image.

## Milestone 16 — standalone producer contract

This batch defines closed v2 website build-plan, release and image contracts for `ElevenID/website`, its reserved `.github/workflows/production-website-release.yml` publisher identity and `ghcr.io/elevenid/website`. The plan binds eleven source input hashes, the clean exact source, the final output inventory, public routes, public-only pages, a pinned Nginx base and the inspected Linux amd64 image platform. The qualification workflow now verifies that it can construct this plan from the same fully qualified output. Its evidence remains unsigned.

The coordinated `marty-ui` consumer changes admit this identity only for website receipts and its own image. Application, backend and outer composition authorities stay with their existing producers. Legacy public/private v1 receipts remain supported, and the optional composition website owner defaults to `ElevenID/marty-ui`. Shared synthetic fixtures verify cross-language canonical hashing; role, original-evidence, composition and retained-slot tests cover the new boundary. See the [standalone release contract](standalone-release-contract.md).

The future publisher identity is reserved in the contract; this batch does not install or invoke a signing/publishing workflow. A v2 object or the qualified local Docker image ID cannot replace original cryptographic proof and a registry manifest digest.

## Next development milestone

Implement the hosted protected-main publisher, qualify digest publication and original signatures, then exercise authenticated cross-owner intake/composition against real artifacts. Bind the published registry manifest to the exact qualified image bytes. Follow with real application/OIDC handoff and promotion/retained-slot rollback on the existing isolated host. Only after website release ownership has moved and the remaining application build is self-contained should `marty-ui` become `application`.

No production traffic change, image publication, private-commerce exposure, source deletion or repository rename is part of this checkpoint. AWS was signed out during the earlier recovery; local checks and GitHub-hosted qualification continue without changing cloud resources.
