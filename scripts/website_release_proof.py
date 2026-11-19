#!/usr/bin/env python3
"""Retain and verify the standalone website's original receipt and image proofs.

The website-only admission policy is adapted from the merged consumer's
website_provenance.py and web_producer_evidence.py. It runs the same pinned
verifiers without importing application, private-commerce or installer code.
The fixed repository-local Node validator owns the full v2 receipt contract.
"""
from __future__ import annotations

import argparse
from concurrent.futures import ThreadPoolExecutor
import hashlib
import json
import os
from pathlib import Path
import re
import shutil
import stat
import subprocess
import sys
import tempfile
from typing import Callable

REPOSITORY = "ElevenID/website"
REPOSITORY_ID = "1459542519"
WORKFLOW = ".github/workflows/production-website-release.yml"
REF = "refs/heads/main"
IMAGE = "ghcr.io/elevenid/website"
ISSUER = "https://token.actions.githubusercontent.com"
SIGNER = f"https://github.com/{REPOSITORY}/{WORKFLOW}@{REF}"
PREDICATE = "https://slsa.dev/provenance/v1"
JSON_LIMIT = 1024 * 1024
PROOF_LIMIT = 4 * 1024 * 1024
ERROR_LIMIT = 64 * 1024
INITIAL_FILES = ("website-release.json", "website-release.json.sigstore.json", "web-surface-routes.json")
PROOF_FILES = ("website-release.json.provenance.jsonl", "image.provenance.jsonl")
FILES = INITIAL_FILES + PROOF_FILES
CONTRACT_VALIDATOR = Path(__file__).resolve().with_name("website-release-contract.mjs")
Run = Callable[[list[str]], str]


def require(condition: bool, message: str) -> None:
    if not condition:
        raise ValueError(message)


def digest(raw: bytes) -> str:
    return "sha256:" + hashlib.sha256(raw).hexdigest()


def strict_json(raw: bytes | str) -> object:
    def pairs(items):
        result = {}
        for key, value in items:
            require(key not in result, "duplicate JSON field")
            result[key] = value
        return result

    def invalid_constant(_value):
        raise ValueError("invalid JSON number")

    try:
        return json.loads(raw, object_pairs_hook=pairs, parse_constant=invalid_constant)
    except (UnicodeError, json.JSONDecodeError, RecursionError):
        raise ValueError("invalid proof JSON") from None


def checked_path(path: Path) -> None:
    require(path.is_absolute(), "proof paths must be absolute")
    require(not any(part.is_symlink() for part in (path, *path.parents)),
            "proof paths must not contain symlinks")


def private_directory(directory: Path) -> None:
    checked_path(directory)
    info = directory.stat()
    require(stat.S_ISDIR(info.st_mode), "proof staging must be a directory")
    require(info.st_uid == os.getuid() and not info.st_mode & 0o077,
            "proof staging must be private and owned by the current user")


def local_file(path: Path, *, maximum: int | None = None, private: bool = False) -> os.stat_result:
    checked_path(path)
    info = path.stat()
    require(stat.S_ISREG(info.st_mode) and info.st_size > 0
            and (maximum is None or info.st_size <= maximum), "invalid or oversized proof file")
    if private:
        private_directory(path.parent)
        require(info.st_uid == os.getuid() and not info.st_mode & 0o022,
                "proof file is writable by another user")
    return info


def read_file(path: Path, *, maximum: int, private: bool = False) -> bytes:
    info = local_file(path, maximum=maximum, private=private)
    flags = os.O_RDONLY | getattr(os, "O_NOFOLLOW", 0) | getattr(os, "O_NONBLOCK", 0)
    with os.fdopen(os.open(path, flags), "rb") as stream:
        held = os.fstat(stream.fileno())
        require(stat.S_ISREG(held.st_mode) and (held.st_dev, held.st_ino) == (info.st_dev, info.st_ino),
                "proof file changed while opening")
        raw = stream.read(maximum + 1)
    require(0 < len(raw) <= maximum and len(raw) == info.st_size, "proof file size changed while reading")
    return raw


def snapshot(directory: Path, names: tuple[str, ...]) -> dict[str, bytes]:
    private_directory(directory)
    require({entry.name for entry in directory.iterdir()} == set(names),
            "website proof directory has unexpected or missing files")
    return {name: read_file(directory / name,
                           maximum=PROOF_LIMIT if name.endswith((".sigstore.json", ".provenance.jsonl")) else JSON_LIMIT,
                           private=True) for name in names}


def anonymous_environment(directory: str) -> dict[str, str]:
    # In particular, never inherit GitHub tokens, Docker helpers, proxies,
    # NODE_OPTIONS, custom trust roots or Sigstore/TLS overrides.
    result = {key: os.environ[key] for key in ("SYSTEMROOT", "WINDIR") if key in os.environ}
    result.update(HOME=directory, USERPROFILE=directory, GH_CONFIG_DIR=directory,
                  DOCKER_CONFIG=directory, XDG_CONFIG_HOME=directory, XDG_CACHE_HOME=directory,
                  GH_PROMPT_DISABLED="1", GH_HOST="github.com")
    return result


def command(args: list[str], *, timeout: int = 120) -> str:
    """Bound both output streams while executing in an anonymous private home."""
    with tempfile.TemporaryDirectory(prefix="website-proof-verifier-") as temporary:
        try:
            process = subprocess.Popen(args, stdin=subprocess.DEVNULL, stdout=subprocess.PIPE,
                                       stderr=subprocess.PIPE, cwd=temporary,
                                       env=anonymous_environment(temporary))
        except OSError:
            raise ValueError("website proof verifier failed to start") from None

        def read(stream, maximum):
            data = bytearray()
            try:
                while chunk := stream.read(min(64 * 1024, maximum + 1 - len(data))):
                    data.extend(chunk)
                    if len(data) > maximum:
                        process.kill()
                        return bytes(data[:maximum]), True
                return bytes(data), False
            finally:
                stream.close()

        with ThreadPoolExecutor(max_workers=2) as workers:
            output = workers.submit(read, process.stdout, PROOF_LIMIT)
            errors = workers.submit(read, process.stderr, ERROR_LIMIT)
            timed_out = False
            try:
                code = process.wait(timeout=timeout)
            except subprocess.TimeoutExpired:
                timed_out = True
                process.kill()
                code = process.wait()
            stdout, output_overflow = output.result()
            _stderr, error_overflow = errors.result()
        require(not timed_out, "website proof verifier timed out")
        require(not output_overflow and not error_overflow, "website proof verifier exceeded output bounds")
        # Do not expose remote stderr or credential-bearing URLs in failures.
        require(code == 0, "website proof verifier failed")
        try:
            return stdout.decode("utf-8")
        except UnicodeError:
            raise ValueError("website proof verifier returned invalid text") from None


def producer(source_sha: str, run_id: str, run_attempt: str) -> dict[str, str]:
    require(isinstance(source_sha, str) and re.fullmatch(r"[0-9a-f]{40}", source_sha) is not None,
            "an exact website source SHA is required")
    require(all(isinstance(value, str) and re.fullmatch(r"[1-9][0-9]*", value)
                for value in (run_id, run_attempt)), "an exact original run and attempt are required")
    return {"repository": REPOSITORY, "workflow": WORKFLOW, "source_sha": source_sha,
            "ref": REF, "run_id": run_id, "run_attempt": run_attempt}


def route_identity(value: object) -> dict:
    # The consumer's closed public route contract, with identical compact sorted
    # JSON bytes. Raw source bytes are bound separately by the v2 build plan.
    require(isinstance(value, dict) and set(value) == {"schema_version", "website", "fallback"},
            "website route contract fields differ")
    require(type(value["schema_version"]) is int and value["schema_version"] == 1
            and value["fallback"] == "application", "unsupported website route contract")
    routes = value["website"]
    require(isinstance(routes, dict) and set(routes) == {"exact_paths", "path_prefixes", "filename_patterns"},
            "website route fields differ")
    for name in ("exact_paths", "path_prefixes"):
        items = routes[name]
        require(isinstance(items, list) and all(isinstance(item, str) for item in items)
                and len(items) == len(set(items)), "invalid or duplicate website paths")
        for item in items:
            require(re.fullmatch(r"/[A-Za-z0-9._/-]*", item) is not None and "//" not in item
                    and not any(part in {".", ".."} for part in item.split("/")), "unsafe website path")
            if name == "path_prefixes":
                require(item != "/" and item.endswith("/"), "invalid website prefix")
    require("/" in routes["exact_paths"], "website homepage is missing")
    require(routes["filename_patterns"] == [r"^/sitemap-[^/]+\.xml$"], "unsupported website filename patterns")
    raw = json.dumps(value, sort_keys=True, separators=(",", ":"), ensure_ascii=False).encode()
    return {"version": 1, "sha256": digest(raw)}


def attestation_arguments(expected: dict) -> list[str]:
    return ["--repo", REPOSITORY, "--signer-workflow", REPOSITORY + "/" + WORKFLOW,
            "--source-ref", REF, "--source-digest", expected["source_sha"], "--deny-self-hosted-runners",
            "--predicate-type", PREDICATE, "--format", "json"]


def signature_arguments() -> list[str]:
    return ["--certificate-identity", SIGNER, "--certificate-oidc-issuer", ISSUER]


def verified_certificate(output: str, expected: dict) -> None:
    require(isinstance(output, str) and len(output.encode("utf-8")) <= PROOF_LIMIT, "invalid verifier output")
    result = strict_json(output)
    try:
        require(isinstance(result, list) and len(result) == 1 and isinstance(result[0]["attestation"], dict),
                "one original website attestation is required")
        certificate = result[0]["verificationResult"]["signature"]["certificate"]
        claims = {
            "issuer": ISSUER,
            "runInvocationURI": f"https://github.com/{REPOSITORY}/actions/runs/{expected['run_id']}/attempts/{expected['run_attempt']}",
            "runnerEnvironment": "github-hosted", "sourceRepositoryURI": f"https://github.com/{REPOSITORY}",
            "sourceRepositoryDigest": expected["source_sha"], "sourceRepositoryRef": REF,
            "sourceRepositoryIdentifier": REPOSITORY_ID, "buildSignerURI": SIGNER,
        }
        require(isinstance(certificate, dict) and all(certificate.get(key) == value for key, value in claims.items()),
                "original website certificate differs")
        for key, value in {"githubWorkflowRepository": REPOSITORY, "githubWorkflowSHA": expected["source_sha"],
                           "githubWorkflowRef": REF}.items():
            require(key not in certificate or certificate[key] == value, "legacy website certificate differs")
    except (KeyError, TypeError, IndexError):
        raise ValueError("original website attestation is invalid") from None


def verified_image_signature(output: str, manifest_digest: str) -> None:
    require(isinstance(output, str) and len(output.encode("utf-8")) <= PROOF_LIMIT, "invalid verifier output")
    result = strict_json(output)
    try:
        require(isinstance(result, list) and len(result) > 0
                and all(item["critical"]["image"]["docker-manifest-digest"] == manifest_digest for item in result),
                "verified website image digest differs")
    except (KeyError, TypeError):
        raise ValueError("website image signature result is invalid") from None


def retain_and_verify(directory: Path, *, subject_bundle: Path, image_bundle: Path,
                      source_sha: str, run_id: str, run_attempt: str, gh: Path, cosign: Path,
                      node: Path, runner: Run = command) -> None:
    expected = producer(source_sha, run_id, run_attempt)
    held = snapshot(directory, INITIAL_FILES)
    release = strict_json(held["website-release.json"])
    require(isinstance(release, dict) and release.get("producer") == expected
            and release.get("source_sha") == source_sha, "receipt differs from the expected original producer")
    for executable in (gh, cosign, node, CONTRACT_VALIDATOR):
        local_file(executable)
    # The validator path is fixed in this source checkout and never read from
    # the receipt. Node is resolved from the trusted workflow PATH by main().
    runner([str(node), str(CONTRACT_VALIDATOR), "validate", "--receipt", str(directory / "website-release.json")])
    require(snapshot(directory, INITIAL_FILES) == held, "website evidence changed during contract validation")
    image = release.get("image")
    require(isinstance(image, dict) and set(image) == {"uri", "digest", "platform"}
            and image["uri"] == IMAGE and image["platform"] == "linux/amd64"
            and isinstance(image["digest"], str) and re.fullmatch(r"sha256:[0-9a-f]{64}", image["digest"]),
            "website image identity differs")
    try:
        require(route_identity(strict_json(held["web-surface-routes.json"])) == release["image_metadata"]["route_contract"],
                "website route identity differs")
        require(digest(held["web-surface-routes.json"]) == release["build_plan"]["input_sha256"]["contracts/web-surface-routes.json"],
                "website route source bytes differ")
    except (KeyError, TypeError):
        raise ValueError("website receipt contract is invalid") from None
    bundles = (read_file(subject_bundle, maximum=PROOF_LIMIT), read_file(image_bundle, maximum=PROOF_LIMIT))
    for name, raw in zip(PROOF_FILES, bundles):
        with (directory / name).open("xb") as stream:
            os.fchmod(stream.fileno(), 0o600)
            stream.write(raw)
    before = snapshot(directory, FILES)
    require(all(before[name] == raw for name, raw in held.items())
            and all(before[name] == raw for name, raw in zip(PROOF_FILES, bundles)), "retained original proof bytes differ")
    hashes = {name: digest(raw) for name, raw in before.items()}
    subject = directory / "website-release.json"
    output = runner([str(gh), "attestation", "verify", str(subject), "--bundle",
                     str(directory / PROOF_FILES[0]), *attestation_arguments(expected)])
    verified_certificate(output, expected)
    runner([str(cosign), "verify-blob", str(subject), "--bundle",
            str(directory / "website-release.json.sigstore.json"), *signature_arguments()])
    reference = IMAGE + "@" + image["digest"]
    output = runner([str(gh), "attestation", "verify", "oci://" + reference, "--bundle",
                     str(directory / PROOF_FILES[1]), *attestation_arguments(expected)])
    verified_certificate(output, expected)
    verified_image_signature(runner([str(cosign), "verify", reference, *signature_arguments()]), image["digest"])
    require({name: digest(raw) for name, raw in snapshot(directory, FILES).items()} == hashes,
            "website evidence changed during proof verification")


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--assets", type=Path, required=True)
    parser.add_argument("--subject-bundle", type=Path, required=True)
    parser.add_argument("--image-bundle", type=Path, required=True)
    parser.add_argument("--source-sha", required=True)
    parser.add_argument("--run-id", required=True)
    parser.add_argument("--run-attempt", required=True)
    parser.add_argument("--gh", type=Path, required=True)
    parser.add_argument("--cosign", type=Path, required=True)
    args = parser.parse_args()
    selected_node = shutil.which("node")
    require(selected_node is not None, "trusted workflow Node executable is unavailable")
    node = Path(selected_node).resolve(strict=True)
    retain_and_verify(args.assets, subject_bundle=args.subject_bundle, image_bundle=args.image_bundle,
                      source_sha=args.source_sha, run_id=args.run_id, run_attempt=args.run_attempt,
                      gh=args.gh, cosign=args.cosign, node=node)
    print(f"Verified original website receipt and image for {REPOSITORY} run {args.run_id} attempt {args.run_attempt}.")


if __name__ == "__main__":
    try:
        main()
    except (ValueError, OSError) as error:
        print(f"Website release proof verification failed: {error}", file=sys.stderr)
        sys.exit(1)
