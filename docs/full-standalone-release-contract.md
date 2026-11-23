# Full standalone website contract

The full standalone build uses the website source in `ElevenID/website` and a
source-bound website adapter staged by the original private
`ElevenID/marty-subscriptions` producer. V4 is a new full-only contract. Existing
public v2/v3 receipts and legacy public/private v1 receipts retain their original
schemas, subjects, workflows, images and proof bytes.

This source change does not publish an image, create signed release evidence,
change an application/backend selection, or activate a website. A real release
requires coordinated private producer and consumer support followed by its own
complete original-proof and runtime qualification.

## Two source identities, one original private producer

| Property | Full standalone v4 |
| --- | --- |
| Website source repository | `ElevenID/website` |
| Website source | Exact lowercase 40-character `source_sha` |
| Private source repository | `ElevenID/marty-subscriptions` |
| Private source | Exact `commerce_extension.source_sha` |
| Revision | `<website SHA>-<private SHA>` |
| Production pages | `full` |
| Image | `ghcr.io/elevenid/marty-subscriptions/website` |
| Original producer repository and numeric ID | `ElevenID/marty-subscriptions`, `1207411806` |
| Original producer workflow/ref | `.github/workflows/production-ui-release.yml`, `refs/heads/main` |
| Original producer source | Exactly the private source SHA |
| Platform | `linux/amd64` |
| Build plan / image marker / receipt | `marty.website-build-plan/v4`, `marty.website-image/v4`, `marty.website-release/v4` |

The website SHA identifies website code; it cannot replace the private
producer's SHA. The public website workflow cannot sign or claim this private
image. The receipt fixes both source identities, the combined revision, the
original private workflow/run/attempt, and the image coordinate. A public
receipt cannot become a full receipt by changing its envelope or audience.

The closed factories and validators live in
`scripts/lib/full-standalone-release-contract.mjs`. They construct and check
unsigned data. Signature, original workflow provenance and OCI verification
remain mandatory in the existing consumers.

## Build inputs and private adapter boundary

V4 retains the v3 `prebuilt-static` shape, bounded output inventory, route
identity, digest-pinned Nginx base, `bun@1.4.4`, `bun.lock`, and npm reference-lock
identity checks. Its closed fingerprint set contains exactly fourteen paths:

```text
package.json
package-lock.json
Dockerfile.website.full
contracts/web-surface-routes.json
scripts/build-website-image.mjs
scripts/prerender-website.mjs
scripts/website-prerender-plan.mjs
ui/nginx.website.conf
ui/nginx.website.headers.conf
ui/scripts/render-website-nginx.mjs
ui/vite.config.mjs
bun.lock
ui/scripts/production-build-contract.mjs
ui/scripts/web-surface-build-contract.mjs
```

The exact website commit also binds the complete tracked source tree. Private
source files are not copied into this repository or its public fingerprint
list. The private producer must stage only its exact tracked frontend source,
verify private source custody, and keep that context outside the website
checkout and final image context.

The build requires `MARTY_PRODUCTION_PAGES=full`, exact
`MARTY_WEBSITE_SOURCE_SHA` and `MARTY_COMMERCE_SOURCE_SHA`, and an absolute
`MARTY_COMMERCE_EXTENSION_PATH` naming the staged `src/extension.jsx`. The
resolver checks `commerce-source.json` against the selected private repository
and SHA, requires bounded regular files without symlink components, and selects
the sibling `src/website.jsx`. The actual Vite alias uses that website adapter;
the bundle must retain its module identity. A public-only graph with a full
marker fails the build.

The existing application, payment, checkout and pricing module exclusions stay
active. Full builds disable source maps. Qualification rejects raw JSX/TS,
source maps, dependency manifests, `.env` files and the private source marker in
the output. The private producer must additionally scan every layer of the
frozen final image before publishing that exact image.

Pricing remains withheld: no pricing prerender or sitemap entry is introduced,
and HTTP qualification requires `/pricing`, `/pricing/` and
`/pricing/checkout` to return 404. Application paths, including organization
setup and billing, are denied by the website container. A full website build
does not activate checkout or payment capabilities.

## Container identity

`Dockerfile.website.full` accepts exactly these build arguments:

```text
WEBSITE_SOURCE_SHA
WEBSITE_REVISION
WEBSITE_ROUTE_CONTRACT_SHA256
COMMERCE_SOURCE_SHA
```

Its OCI source/revision labels identify the original private producer repository
and private SHA. `com.elevenid.website.repository` stays `ElevenID/website`;
`com.elevenid.website.source-sha` and
`com.elevenid.website.commerce-source-sha` bind both inputs. The version label
is the combined revision, pages are `full`, and route identity must match the
website marker. Only the compiled static tree and Nginx configuration enter the
container context. Local images use
`elevenid-website:<website SHA>-<private SHA>`.

## Qualification and unsigned recording

The existing production pipeline supports the explicit full selection:

```sh
node scripts/verify-package-manager.mjs
bun install --frozen-lockfile --linker=hoisted
bun run build:website:production
node scripts/verify-public-assets.mjs
bun run build:website:image
node scripts/qualify-website-nginx.mjs
node scripts/website-qualification.mjs finalize
node scripts/full-website-release-contract.mjs plan
```

Set the exact full environment described above and `CHROME_PATH` before those
commands. Run the test suites in their ordinary public fixture environment;
private producer inputs belong to the selected full production build.

Full qualification uses unsigned v2 context/stage/inventory/aggregate records
that bind both sources, the combined revision, unchanged output, and the same
inspected local image. Existing public qualification remains v1. All four
stages are mandatory. The six sandboxed browser behaviors still execute once,
without skips or retries, against the same loopback container and combined
asset revision. Their historical import provenance is preserved; only the
current adapted browser hashes change.

In GitHub Actions, full qualification accepts only the original private manual
main workflow, repository ID, and workflow SHA matching the selected private
source. A local qualification can remain unsigned with no workflow context.

After the private producer has scanned and published the frozen image and
verified its actual manifest digest, it can record the unsigned subject:

```sh
node scripts/full-website-release-contract.mjs record \
  --image-digest "$IMAGE_DIGEST" \
  --run-id "$GITHUB_RUN_ID" --run-attempt "$GITHUB_RUN_ATTEMPT" \
  --output "$RELEASE_DIRECTORY/website-release.json"
```

Recording rechecks qualification and both sources. It also requires the exact
original private GitHub workflow context, run/attempt and Linux X64 hosted
runner. The output must be a new absolute file with an existing regular parent;
it is created with mode 0600. A local image/config ID cannot stand in for the
manifest digest. Recording does not perform the registry proof itself and does
not sign or attest anything.

`validate --receipt ABSOLUTE_PATH` checks a bounded v4 receipt. Original proof
intake additionally rejects duplicate JSON fields and authenticates the exact
subject bytes. The retained website artifact still has the existing five
receipt/signature/provenance/route files; no unsigned qualification file is
promoted into that set.

## Compatibility and verification scope

`contracts/fixtures/standalone-website-release-v4.json` is explicitly synthetic.
Its canonical plan digest is
`sha256:fb9a0fe427f40dc89a700e1b9ac4ac1bffe0f116bc53348465d54755f7185831`.
The shared fixture exercises JavaScript/Python compatibility and private
producer authority. It is not release evidence.

Focused tests reject source/owner/workflow/image substitutions, public/full
schema mixing, altered locks and output, missing qualification stages, leaked
source maps, missing adapters, pricing/checkout modules, and symlinked private
inputs. The complete real website graph also builds with a synthetic disabled
private adapter. Those tests establish build and contract behavior; they do
not establish a signed publication, real private build, deployed billing
journey or production activation.

### Private runner context for unsigned recording

The full recorder accepts the original private workflow on GitHub-hosted runners
and on the isolated, one-job self-hosted runner qualified by the private producer.
Both retain the exact private repository ID, main workflow/ref, source commit,
run/attempt, Linux and X64 checks. Unknown runner classes are refused.

This step captures unsigned metadata. The private producer must still verify its
protected release approval, sign and attest the original subjects, and retain
the proofs. Consumers independently authenticate the image, original job and
signed approval before admission. Recording a subject does not qualify a release.
