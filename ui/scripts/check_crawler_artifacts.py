"""Validate the crawler artifacts emitted by a public UI build.

Usage: python scripts/check_crawler_artifacts.py [dist-directory] [URL-output-file]
"""

from __future__ import annotations

import json
import re
import sys
from pathlib import Path
from urllib.parse import unquote, urlsplit
from xml.etree import ElementTree

CANONICAL_ORIGIN = "https://elevenidllc.com"
SITEMAP_NAMESPACE = "http://www.sitemaps.org/schemas/sitemap/0.9"
WEBSITE_ROUTES = json.loads(
    (Path(__file__).resolve().parents[2] / "contracts/web-surface-routes.json")
    .read_text(encoding="utf-8")
)["website"]


def _require_nonempty(path: Path) -> bytes:
    if not path.is_file():
        raise AssertionError(f"required crawler artifact is missing: {path}")
    content = path.read_bytes()
    if not content.strip():
        raise AssertionError(f"crawler artifact is empty: {path}")
    return content


def _canonical_url(raw_url: str, *, artifact: Path) -> tuple[str, str]:
    if "\\" in raw_url or any(ord(character) <= 32 or ord(character) == 127 for character in raw_url):
        raise AssertionError(f"{artifact.name} contains a noncanonical URL: {raw_url!r}")
    parsed = urlsplit(raw_url)
    if parsed.scheme != "https" or parsed.netloc != "elevenidllc.com":
        raise AssertionError(
            f"{artifact.name} contains a noncanonical URL: {raw_url!r}"
        )
    if parsed.query or parsed.fragment or parsed.username or parsed.password:
        raise AssertionError(
            f"{artifact.name} contains a URL with forbidden components: {raw_url!r}"
        )
    if parsed.path != "/" and parsed.path.endswith("/"):
        raise AssertionError(
            f"{artifact.name} contains a noncanonical trailing slash: {raw_url!r}"
        )
    decoded_path = unquote(parsed.path)
    if (
        not parsed.path.startswith("/")
        or "//" in decoded_path
        or "\\" in decoded_path
        or any(part in {".", ".."} for part in decoded_path.split("/"))
        or any(ord(character) < 32 or ord(character) == 127 for character in decoded_path)
        or re.search(r"%(?![0-9A-Fa-f]{2})", parsed.path)
    ):
        raise AssertionError(f"{artifact.name} contains a noncanonical path: {raw_url!r}")
    return parsed.path, raw_url


def _is_private(path: str) -> bool:
    if path == "/pricing" or path.startswith(("/pricing/", "/_website/")):
        return True
    # Keep known resources out without rejecting dotted article/author slugs.
    if re.search(
        r"\.(?:css|[cm]?js|json|txt|xml|map|png|jpe?g|gif|webp|avif|ico|svg|woff2?|ttf|otf|eot|mp[34]|webm|pdf|zip|wasm)$",
        unquote(path), flags=re.IGNORECASE,
    ):
        return True
    return not (
        path in WEBSITE_ROUTES["exact_paths"]
        or any(
            path.startswith(prefix)
            for prefix in WEBSITE_ROUTES["path_prefixes"]
            if prefix != "/_website/"
        )
    )


def validate(dist_root: Path, url_output: Path | None = None) -> tuple[int, int]:
    dist_root = dist_root.resolve()
    robots_path = dist_root / "robots.txt"
    robots = _require_nonempty(robots_path).decode("utf-8")
    sitemap_lines = [
        line.strip()
        for line in robots.splitlines()
        if line.lower().startswith("sitemap:")
    ]
    expected_sitemap_line = f"Sitemap: {CANONICAL_ORIGIN}/sitemap.xml"
    if sitemap_lines != [expected_sitemap_line]:
        raise AssertionError(
            f"robots.txt must contain exactly {expected_sitemap_line!r}; "
            f"got {sitemap_lines!r}"
        )

    required_disallows = {"/console", "/auth/*", "/api/*", "/v1/*"}
    actual_disallows = {
        line.split(":", 1)[1].strip()
        for line in robots.splitlines()
        if line.lower().startswith("disallow:")
    }
    missing_disallows = sorted(required_disallows - actual_disallows)
    if missing_disallows:
        raise AssertionError(
            f"robots.txt is missing private crawl rules: {missing_disallows}"
        )

    sitemap_paths = sorted(dist_root.glob("sitemap*.xml"))
    root_sitemap = dist_root / "sitemap.xml"
    if root_sitemap not in sitemap_paths:
        raise AssertionError(f"required crawler artifact is missing: {root_sitemap}")

    public_urls: dict[str, Path] = {}
    sitemap_references: dict[str, Path] = {}
    index_edges: dict[str, list[str]] = {}
    for sitemap_path in sitemap_paths:
        document = _require_nonempty(sitemap_path)
        try:
            root = ElementTree.fromstring(document)
        except ElementTree.ParseError as error:
            raise AssertionError(f"invalid XML in {sitemap_path}: {error}") from error

        urlset_tag = f"{{{SITEMAP_NAMESPACE}}}urlset"
        sitemapindex_tag = f"{{{SITEMAP_NAMESPACE}}}sitemapindex"
        loc_tag = f"{{{SITEMAP_NAMESPACE}}}loc"
        if root.tag not in {urlset_tag, sitemapindex_tag}:
            raise AssertionError(
                f"{sitemap_path.name} has unsupported root element {root.tag!r}"
            )

        if not len(root):
            raise AssertionError(f"{sitemap_path.name} contains no locations")
        entry_tag = f"{{{SITEMAP_NAMESPACE}}}{'url' if root.tag == urlset_tag else 'sitemap'}"
        locations = []
        for entry in root:
            if entry.tag != entry_tag:
                raise AssertionError(f"{sitemap_path.name} contains an unsupported sitemap entry")
            entries = entry.findall(loc_tag)
            if len(entries) != 1 or len(entries[0]) or not (entries[0].text or "").strip():
                raise AssertionError(f"{sitemap_path.name} entries require exactly one nonempty location")
            locations.append(entries[0].text.strip())
        if root.tag == sitemapindex_tag:
            index_edges[sitemap_path.name] = []

        target = sitemap_references if root.tag == sitemapindex_tag else public_urls
        for location in locations:
            path, canonical = _canonical_url(location, artifact=sitemap_path)
            if root.tag == urlset_tag and _is_private(path):
                raise AssertionError(
                    f"{sitemap_path.name} exposes private URL {canonical!r}"
                )
            identity = path if root.tag == urlset_tag else canonical
            if identity in target:
                raise AssertionError(
                    f"duplicate sitemap location {canonical!r} in "
                    f"{target[identity].name} and {sitemap_path.name}"
                )
            target[identity] = sitemap_path
            if root.tag == sitemapindex_tag:
                index_edges[sitemap_path.name].append(path.removeprefix("/"))

    for reference in sitemap_references:
        referenced_name = urlsplit(reference).path.removeprefix("/")
        if referenced_name not in {path.name for path in sitemap_paths}:
            raise AssertionError(
                f"sitemap index references missing artifact {reference!r}"
            )

    visited: set[str] = set()
    active: set[str] = set()

    def visit(name: str) -> None:
        if name in active:
            raise AssertionError(f"cyclic sitemap index reference: {name}")
        if name in visited:
            return
        active.add(name)
        for target in index_edges.get(name, []):
            visit(target)
        active.remove(name)
        visited.add(name)

    visit(root_sitemap.name)
    reachable = set(visited)
    for name in index_edges:
        visit(name)
    # A redundant index may point at the root urlset; all page shards must be reachable.
    orphaned = sorted({path.name for path in public_urls.values()} - reachable)
    if orphaned:
        raise AssertionError(f"unreachable page sitemap artifact(s): {orphaned}")

    for required_path in ("/", "/product"):
        if required_path not in public_urls:
            raise AssertionError(
                f"sitemap does not contain required public URL {required_path!r}"
            )

    if url_output is not None:
        url_output.write_text(
            "".join(f"{path}\n" for path in sorted(public_urls)), encoding="utf-8"
        )

    return len(sitemap_paths), len(public_urls)


def main() -> int:
    dist_root = Path(sys.argv[1]) if len(sys.argv) > 1 else Path("dist")
    url_output = Path(sys.argv[2]) if len(sys.argv) > 2 else None
    sitemap_count, url_count = validate(dist_root, url_output)
    print(
        f"Validated {sitemap_count} nonempty sitemap artifact(s), {url_count} unique "
        f"canonical public URL(s), and robots.txt in {dist_root.resolve()}"
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
