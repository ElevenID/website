# Standalone website qualification

The public website must build and serve from this repository alone. The `Website standalone qualification` workflow checks out the exact PR head (or selected main commit), installs the pinned website dependency graph, exercises development browser routes and the isolated application handoff, prerenders the complete public route plan, builds a local image and checks it through Nginx. Its runner never checks out `marty-ui`.

The separate migration-provenance workflow compares selected assets with their original pinned source. It is an extraction audit, not a dependency of the standalone build.

## Run from a clean checkout

Use Bun 1.4.4 and the repository's Node 24 dependencies, Python 3.10+ available as `python3`, Chrome and Docker. The image's demo browser gate requires a non-root user and working Chromium sandbox; it never retries without the sandbox. The CI reference environment is Ubuntu 24.04 with Node 24.22.1. Do not change a shared Docker daemon or running installation to run these checks.

```sh
node scripts/verify-package-manager.mjs
bun install --frozen-lockfile --linker=hoisted
bun run test
bun run test:nginx
export MARTY_WEBSITE_SOURCE_SHA="$(git rev-parse HEAD)"
export MARTY_PRODUCTION_PAGES=public
export CHROME_PATH=/usr/bin/google-chrome
bun run build:website:production
node scripts/verify-public-assets.mjs
bun run build:website:image
node scripts/qualify-website-nginx.mjs
node scripts/website-qualification.mjs finalize
```

Production-mode qualification rejects a claimed SHA different from actual HEAD, staged or unstaged tracked changes, and untracked source files. Build output and `.qualification/` are ignored output directories. The production build begins by clearing only known evidence files and starting a new context. An unexpected file or symlink in the evidence directory causes failure rather than deletion.

The image uses a digest-pinned Nginx base. The HTTP check runs the exact inspected image ID with a read-only filesystem, bounded temporary mounts and a loopback-only port. Before issuing its receipt, it runs all six public-demo browser behaviors against that same container. It removes only the container it created. No image is pushed and no deployment is modified.

## What the checks establish

- All planned routes render nonempty content, match their expected canonical URL and remain free of loading/error fallback markers. Legal, product and article aliases cannot pass using homepage metadata.
- Normal rendering signals and a delayed, constrained fallback are recorded separately. A caught React error is a failed route even if earlier valid metadata remains in the page.
- Sitemap, robots, social metadata, local JSON-LD images, immutable assets and draft-demo disclaimers remain consistent with the output.
- All 46 selected public assets are present. Nginx checks every planned page, selected resources, MIME/cache/security headers and denied application/private paths.
- Every qualification stage uses the same exact source checkout and unchanged output tree. The image-build and HTTP receipts refer to the same local Docker image ID.
- Four viewport checks exercise demo first paint, overflow, lazy-image completion and catalog/detail navigation. The remaining two exercise every active scenario's canonical/poster, retired HTTP410 paths, and consent/captions/chapter navigation for historical public recordings. All six must execute once and pass; failure or skip prevents the Nginx receipt.

The browser gate uses versioned `/_website/<revision>/` catalog and poster resources and compares served catalog data with the selected source. It permits the owned loopback origin only. The two reviewed Google Fonts stylesheet URLs receive local empty CSS, so layout uses system fallback fonts. YouTube iframe requests receive a local HTML fixture after consent. These checks establish local rendering and navigation behavior, not Google font delivery, remote video playback, recording authenticity, product release approval or live activation. The older development/prerender renderer retains its separately documented `--no-sandbox` behavior; the transferred production demo gate enables sandboxing.

## Evidence artifact

After all stages succeed, CI uploads `web-qualification-RUN_ID-RUN_ATTEMPT` for 14 days. The upload action's artifact ID, archive digest and download URL appear in the job summary. Those post-upload values are not retroactively inserted into the bytes they identify.

| File | Meaning |
| --- | --- |
| `qualification-context.json` | Exact checkout SHA/tree, source-input hashes and workflow context |
| `prerender.json` | Successful rendering, canonical and readiness counts |
| `output-verification.json` | Validation of final emitted HTML, metadata and assets |
| `image-build.json` | Built local image ID, pinned base and route contract |
| `nginx.json` | HTTP qualification of that same local image |
| `website-output-manifest.json` | Sorted relative file paths, byte sizes and SHA-256 hashes |
| `website-qualification.json` | Aggregate tying all successful stages to unchanged output and source |

The separate `website-demo-browser-RUN_ID-RUN_ATTEMPT` artifact retains the Playwright report, logs, screenshots and failure traces from `.demo-browser/`. Its summary records the exact source/image, six successful executions, report digest and fixture limitations. The Nginx receipt includes that summary. This artifact is unsigned test evidence and does not change the original five-file production proof set or release grammar.

The finalizer rejects missing stages, changed output, mixed sources or workflow attempts, substituted image IDs and altered receipt fields. Workflow SHA/ref remain separate from checkout SHA: PR workflow identity can refer to a synthetic merge while the build uses the exact PR head.

These records use `marty.website-qualification/v1` and related qualification schemas. They are **unsigned test evidence**. `local_image_id` is a Docker image/config ID, not an OCI registry manifest digest. The records explicitly state that registry publication, cryptographic provenance verification, live application handoff and production deployment have not occurred. Do not rename them to the existing production receipt/artifact names or feed them to release intake.

## Standalone release contract

The active production consumers still reside in `marty-ui`: `website_release.py`, `website_provenance.py`, `web_release_intake.py`, `package_web_composition.py` and `deploy_website.py`. The first platform extraction contains generic installer consumers, not these website lifecycle modules.

The [standalone release contract](standalone-release-contract.md) defines the Bun v3 build plan for this repository's actual lockfile, Dockerfile and static build context, retaining historical v2 compatibility. After all four qualification stages succeed, `node scripts/website-release-contract.mjs plan` revalidates the clean checkout and current output before emitting that plan. The image build explicitly targets and inspects `linux/amd64`. Public image metadata uses `marty.website-image/v3`; the existing full-adapter marker stays v1 and is not admitted by the public standalone producer.

The coordinated consumer compatibility changes authorize this repository only as a website producer, retain legacy public/private validation, and preserve original signatures and run-attempt identity through composition and retained-slot checks. Shared synthetic fixtures test the schema and canonical hash across languages. Those tests are not live signature or host evidence. Protected-main publication and actual host/application qualification follow reviewed compatibility code; the unsigned qualification artifact remains inadmissible as a production release receipt.
