"""Offline tests use synthetic verifier responses, never publication evidence."""
from __future__ import annotations

import importlib.util
import json
import os
from pathlib import Path
import stat
import subprocess
import sys
import tempfile
import unittest
from unittest.mock import patch

ROOT = Path(__file__).resolve().parents[2]
NODE = Path(sys.argv.pop(1)).resolve()
SPEC = importlib.util.spec_from_file_location("website_release_proof", ROOT / "scripts/website_release_proof.py")
proof = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(proof)
SOURCE, RUN, ATTEMPT = "a" * 40, "1234567890", "2"


def certificate(expected=None):
    expected = expected or proof.producer(SOURCE, RUN, ATTEMPT)
    return [{"attestation": {}, "verificationResult": {"signature": {"certificate": {
        "issuer": proof.ISSUER,
        "runInvocationURI": f"https://github.com/{proof.REPOSITORY}/actions/runs/{expected['run_id']}/attempts/{expected['run_attempt']}",
        "runnerEnvironment": "github-hosted", "sourceRepositoryURI": "https://github.com/" + proof.REPOSITORY,
        "sourceRepositoryDigest": expected["source_sha"], "sourceRepositoryRef": proof.REF,
        "sourceRepositoryIdentifier": proof.REPOSITORY_ID, "buildSignerURI": proof.SIGNER,
    }}}}]


class WebsiteProofTests(unittest.TestCase):
    def setUp(self):
        self.temporary = tempfile.TemporaryDirectory(prefix="website-original-proof-test-")
        self.addCleanup(self.temporary.cleanup)
        self.root = Path(self.temporary.name)
        self.assets = self.root / "assets"
        self.assets.mkdir(mode=0o700)
        self.routes = (ROOT / "contracts/web-surface-routes.json").read_bytes()
        self.release = json.loads((ROOT / "contracts/fixtures/standalone-website-release-v2.json").read_bytes())["release"]
        route = proof.route_identity(json.loads(self.routes))
        self.release["build_plan"]["route_contract"] = route
        self.release["build_plan"]["build_args"]["WEBSITE_ROUTE_CONTRACT_SHA256"] = route["sha256"]
        self.release["build_plan"]["input_sha256"]["contracts/web-surface-routes.json"] = proof.digest(self.routes)
        self.release["image_metadata"]["route_contract"] = route
        self.write_release()
        (self.assets / "web-surface-routes.json").write_bytes(self.routes)
        (self.assets / "website-release.json.sigstore.json").write_bytes(b"synthetic original signature bytes\n")
        self.subject_bundle = self.root / "subject-bundle.json"
        self.image_bundle = self.root / "image-bundle.json"
        self.subject_bundle.write_bytes(b"synthetic original receipt attestation bytes\n")
        self.image_bundle.write_bytes(b"synthetic original image attestation bytes\n")
        self.settings = self.root / "verifier-settings.json"
        self.log = self.root / "verifier-calls.jsonl"
        self.options = {
            "certificate_output": json.dumps(certificate()),
            "image_output": json.dumps([{"critical": {"image": {"docker-manifest-digest": self.release["image"]["digest"]}}}]),
        }
        self.write_settings()
        self.gh, self.cosign = self.root / "gh", self.root / "cosign"
        program = f"""#!{Path(sys.executable).resolve()}
import json, os, pathlib, sys
settings = json.loads(pathlib.Path({str(self.settings)!r}).read_text())
with pathlib.Path({str(self.log)!r}).open('a') as log:
    log.write(json.dumps({{'args': sys.argv, 'env': dict(os.environ), 'cwd': os.getcwd(),
                          'home_mode': pathlib.Path(os.environ['HOME']).stat().st_mode & 0o777}}) + '\\n')
operation = sys.argv[1]
if settings.get('exit_code'):
    sys.stderr.write('not echoed secret material')
    sys.exit(settings['exit_code'])
if operation == 'attestation':
    print(settings['certificate_output'])
elif operation == 'verify-blob':
    print('synthetic verification success')
elif operation == 'verify':
    if settings.get('mutate'):
        pathlib.Path(settings['mutate']).write_bytes(b'changed during verification')
    print(settings['image_output'])
else:
    sys.exit(17)
"""
        for executable in (self.gh, self.cosign):
            executable.write_text(program)
            executable.chmod(0o700)
        self.calls = []

    def write_release(self):
        raw_plan = (json.dumps(self.release["build_plan"], sort_keys=True, indent=2) + "\n").encode()
        self.release["build_plan_sha256"] = proof.digest(raw_plan)
        (self.assets / "website-release.json").write_text(json.dumps(self.release) + "\n")

    def write_settings(self):
        self.settings.write_text(json.dumps(self.options))

    def runner(self, args):
        self.calls.append(args)
        return proof.command(args)

    def verify(self, **overrides):
        kwargs = dict(subject_bundle=self.subject_bundle, image_bundle=self.image_bundle,
                      source_sha=SOURCE, run_id=RUN, run_attempt=ATTEMPT,
                      gh=self.gh, cosign=self.cosign, node=NODE, runner=self.runner)
        kwargs.update(overrides)
        proof.retain_and_verify(self.assets, **kwargs)

    def test_real_command_arguments_original_bundle_bytes_and_anonymous_environment(self):
        poisoned = {name: "must-not-be-inherited" for name in (
            "GH_TOKEN", "GITHUB_TOKEN", "DOCKER_CONFIG", "HTTP_PROXY", "HTTPS_PROXY", "ALL_PROXY", "NO_PROXY",
            "SSL_CERT_FILE", "SSL_CERT_DIR", "NODE_OPTIONS", "COSIGN_REPOSITORY", "SIGSTORE_ROOT_FILE")}
        with patch.dict(os.environ, poisoned):
            self.verify()
        self.assertEqual({item.name for item in self.assets.iterdir()}, set(proof.FILES))
        for name, source in zip(proof.PROOF_FILES, (self.subject_bundle, self.image_bundle)):
            self.assertEqual((self.assets / name).read_bytes(), source.read_bytes())
            self.assertEqual(stat.S_IMODE((self.assets / name).stat().st_mode), 0o600)
        self.assertEqual(len(self.calls), 5)
        self.assertEqual(self.calls[0], [str(NODE), str(proof.CONTRACT_VALIDATOR), "validate", "--receipt",
                                          str(self.assets / "website-release.json")])
        policy = ["--repo", "ElevenID/website", "--signer-workflow",
                  "ElevenID/website/.github/workflows/production-website-release.yml",
                  "--source-ref", "refs/heads/main", "--source-digest", SOURCE,
                  "--deny-self-hosted-runners", "--predicate-type", "https://slsa.dev/provenance/v1", "--format", "json"]
        identity = ["--certificate-identity", proof.SIGNER, "--certificate-oidc-issuer", proof.ISSUER]
        reference = proof.IMAGE + "@" + self.release["image"]["digest"]
        self.assertEqual(self.calls[1], [str(self.gh), "attestation", "verify", str(self.assets / "website-release.json"),
                                        "--bundle", str(self.assets / proof.PROOF_FILES[0]), *policy])
        self.assertEqual(self.calls[2], [str(self.cosign), "verify-blob", str(self.assets / "website-release.json"),
                                        "--bundle", str(self.assets / "website-release.json.sigstore.json"), *identity])
        self.assertEqual(self.calls[3], [str(self.gh), "attestation", "verify", "oci://" + reference,
                                        "--bundle", str(self.assets / proof.PROOF_FILES[1]), *policy])
        self.assertEqual(self.calls[4], [str(self.cosign), "verify", reference, *identity])
        calls = [json.loads(line) for line in self.log.read_text().splitlines()]
        self.assertEqual(len(calls), 4)
        for call in calls:
            environment = call["env"]
            self.assertEqual(environment["GH_HOST"], "github.com")
            self.assertEqual(environment["GH_PROMPT_DISABLED"], "1")
            self.assertEqual(call["home_mode"], 0o700)
            self.assertEqual(environment["DOCKER_CONFIG"], environment["HOME"])
            self.assertEqual(environment["GH_CONFIG_DIR"], environment["HOME"])
            self.assertEqual(call["cwd"], environment["HOME"])
            self.assertFalse(Path(environment["HOME"]).exists())
            for name in poisoned:
                if name != "DOCKER_CONFIG":
                    self.assertNotIn(name, environment)
            self.assertNotIn("PATH", environment)

    def test_cli_uses_the_fixed_node_validator_and_reports_no_new_receipt_schema(self):
        result = subprocess.run([str(Path(sys.executable).resolve()), "-I", "-B",
                                 str(ROOT / "scripts/website_release_proof.py"),
                                 "--assets", str(self.assets), "--subject-bundle", str(self.subject_bundle),
                                 "--image-bundle", str(self.image_bundle), "--source-sha", SOURCE,
                                 "--run-id", RUN, "--run-attempt", ATTEMPT,
                                 "--gh", str(self.gh), "--cosign", str(self.cosign)],
                                capture_output=True, text=True, timeout=30,
                                env={**os.environ, "PATH": str(NODE.parent) + os.pathsep + os.environ.get("PATH", "")})
        self.assertEqual(result.returncode, 0, result.stdout + result.stderr)
        self.assertIn(f"Verified original website receipt and image for ElevenID/website run {RUN} attempt {ATTEMPT}.", result.stdout)
        self.assertEqual({item.name for item in self.assets.iterdir()}, set(proof.FILES))

    def test_expected_source_run_attempt_and_owner_fail_before_any_external_command_or_copy(self):
        for field, value in (("source_sha", "b" * 40), ("run_id", "123"), ("run_attempt", "1"),
                             ("repository", "ElevenID/marty-ui"), ("workflow", ".github/workflows/ci.yml"),
                             ("ref", "refs/heads/topic")):
            with self.subTest(field=field):
                original = self.release["producer"][field]
                self.release["producer"][field] = value
                self.write_release()
                with self.assertRaisesRegex(ValueError, "expected original producer"):
                    self.verify()
                self.release["producer"][field] = original
                self.assertFalse(self.calls)
                self.assertEqual({item.name for item in self.assets.iterdir()}, set(proof.INITIAL_FILES))

    def test_full_v2_validator_rejects_nested_extra_fields_before_copying_proofs(self):
        self.release["build_plan"]["output"]["invented"] = True
        self.write_release()
        with self.assertRaisesRegex(ValueError, "verifier failed"):
            self.verify()
        self.assertEqual(len(self.calls), 1)
        self.assertFalse(self.log.exists())
        self.assertEqual({item.name for item in self.assets.iterdir()}, set(proof.INITIAL_FILES))

    def test_route_raw_source_and_canonical_identity_both_bind_receipt(self):
        (self.assets / "web-surface-routes.json").write_bytes(self.routes + b"\n")
        with self.assertRaisesRegex(ValueError, "route source bytes differ"):
            self.verify()
        self.assertFalse(self.log.exists())
        routes = json.loads(self.routes)
        routes["website"]["exact_paths"].append("/unexpected")
        (self.assets / "web-surface-routes.json").write_text(json.dumps(routes))
        with self.assertRaisesRegex(ValueError, "route identity differs"):
            self.verify()
        self.assertFalse(self.log.exists())

    def test_all_certificate_identity_claims_and_optional_legacy_claims_are_enforced(self):
        expected = proof.producer(SOURCE, RUN, ATTEMPT)
        mutations = {
            "issuer": "https://issuer.invalid", "runInvocationURI": f"https://github.com/ElevenID/website/actions/runs/{RUN}/attempts/1",
            "runnerEnvironment": "self-hosted", "sourceRepositoryURI": "https://github.com/ElevenID/marty-ui",
            "sourceRepositoryDigest": "b" * 40, "sourceRepositoryRef": "refs/heads/topic",
            "sourceRepositoryIdentifier": "1140864197", "buildSignerURI": proof.SIGNER.replace("production-website-release", "ci"),
            "githubWorkflowRepository": "ElevenID/marty-ui", "githubWorkflowSHA": "b" * 40,
            "githubWorkflowRef": "refs/heads/topic",
        }
        for key, value in mutations.items():
            with self.subTest(claim=key):
                result = certificate()
                result[0]["verificationResult"]["signature"]["certificate"][key] = value
                with self.assertRaises(ValueError):
                    proof.verified_certificate(json.dumps(result), expected)
        valid = certificate()
        valid[0]["verificationResult"]["signature"]["certificate"].update(
            githubWorkflowRepository=proof.REPOSITORY, githubWorkflowSHA=SOURCE, githubWorkflowRef=proof.REF)
        proof.verified_certificate(json.dumps(valid), expected)

    def test_ambiguous_malformed_and_duplicate_verifier_json_is_rejected(self):
        expected = proof.producer(SOURCE, RUN, ATTEMPT)
        valid = json.dumps(certificate())
        duplicate = valid.replace('"issuer":', '"issuer":"https://issuer.invalid","issuer":')
        values = ["{}", "[]", "null", "true", "1", "invalid", "[{}]", "[{},{}]", duplicate,
                  '{"outer":{"duplicate":1,"duplicate":2}}', '[{"attestation":{},"attestation":{}}]',
                  '[NaN]', json.dumps(certificate() * 2)]
        for value in values:
            with self.subTest(value=value[:50]), self.assertRaises(ValueError):
                proof.verified_certificate(value, expected)

    def test_image_signature_requires_every_verified_digest_to_match(self):
        digest = self.release["image"]["digest"]
        values = ["{}", "[]", "null", "[{}]", "invalid",
                  json.dumps([{"critical": {"image": {"docker-manifest-digest": "sha256:" + "b" * 64}}}]),
                  self.options["image_output"][:-1] + ',{"critical":{"image":{"docker-manifest-digest":"wrong"}}}]',
                  self.options["image_output"].replace('"docker-manifest-digest":', '"docker-manifest-digest":"wrong","docker-manifest-digest":')]
        for value in values:
            with self.subTest(value=value[:50]), self.assertRaises(ValueError):
                proof.verified_image_signature(value, digest)
        proof.verified_image_signature(self.options["image_output"], digest)

    def test_receipt_duplicate_fields_are_rejected_before_any_external_command(self):
        path = self.assets / "website-release.json"
        path.write_text(path.read_text().replace('"source_sha":', '"source_sha":"bad","source_sha":', 1))
        with self.assertRaisesRegex(ValueError, "duplicate JSON"):
            self.verify()
        self.assertFalse(self.calls)

    def test_each_retained_file_is_protected_against_changes_during_verification(self):
        for name in proof.FILES:
            with self.subTest(name=name):
                original = {entry.name: entry.read_bytes() for entry in self.assets.iterdir()}
                self.options["mutate"] = str(self.assets / name)
                self.write_settings()
                with self.assertRaisesRegex(ValueError, "changed during proof verification"):
                    self.verify()
                for entry in self.assets.iterdir():
                    entry.unlink()
                for filename, raw in original.items():
                    (self.assets / filename).write_bytes(raw)

    def test_contract_validation_cannot_mutate_retained_inputs(self):
        def mutate(args):
            (self.assets / "web-surface-routes.json").write_bytes(b"changed")
            return ""
        with self.assertRaisesRegex(ValueError, "changed during contract validation"):
            self.verify(runner=mutate)
        self.assertFalse(any((self.assets / name).exists() for name in proof.PROOF_FILES))

    def test_extra_missing_and_preexisting_proofs_fail_without_copy_or_commands(self):
        unexpected = self.assets / "unreviewed.json"
        unexpected.write_text("{}")
        with self.assertRaisesRegex(ValueError, "unexpected or missing"):
            self.verify()
        unexpected.unlink()
        signature = self.assets / "website-release.json.sigstore.json"
        raw = signature.read_bytes()
        signature.unlink()
        with self.assertRaisesRegex(ValueError, "unexpected or missing"):
            self.verify()
        signature.write_bytes(raw)
        (self.assets / proof.PROOF_FILES[0]).write_text("existing proof")
        with self.assertRaisesRegex(ValueError, "unexpected or missing"):
            self.verify()
        self.assertFalse(self.calls)

    def test_symlink_files_ancestors_and_verifiers_are_rejected(self):
        path = self.assets / "website-release.json.sigstore.json"
        raw = path.read_bytes()
        path.unlink()
        path.symlink_to(self.subject_bundle)
        with self.assertRaisesRegex(ValueError, "symlinks"):
            self.verify()
        path.unlink()
        path.write_bytes(raw)
        link = self.root / "linked-assets"
        link.symlink_to(self.assets, target_is_directory=True)
        with self.assertRaisesRegex(ValueError, "symlinks"):
            proof.snapshot(link, proof.INITIAL_FILES)
        self.gh.unlink()
        self.gh.symlink_to(self.cosign)
        with self.assertRaisesRegex(ValueError, "symlinks"):
            self.verify()
        self.assertFalse(self.calls)

    def test_private_staging_and_bounded_nonempty_files_are_required(self):
        self.assets.chmod(0o755)
        with self.assertRaisesRegex(ValueError, "private"):
            self.verify()
        self.assets.chmod(0o700)
        receipt = self.assets / "website-release.json"
        receipt.chmod(0o666)
        with self.assertRaisesRegex(ValueError, "writable"):
            self.verify()
        receipt.chmod(0o600)
        for name, size in (("website-release.json", proof.JSON_LIMIT + 1),
                           ("website-release.json.sigstore.json", proof.PROOF_LIMIT + 1),
                           ("web-surface-routes.json", 0)):
            with self.subTest(name=name):
                path = self.assets / name
                raw = path.read_bytes()
                path.write_bytes(b"x" * size)
                with self.assertRaisesRegex(ValueError, "invalid or oversized"):
                    self.verify()
                path.write_bytes(raw)
        self.assertFalse(self.calls)

    def test_original_action_bundle_bounds_are_checked_before_copy(self):
        self.subject_bundle.write_bytes(b"x" * (proof.PROOF_LIMIT + 1))
        with self.assertRaisesRegex(ValueError, "invalid or oversized"):
            self.verify()
        self.assertEqual({item.name for item in self.assets.iterdir()}, set(proof.INITIAL_FILES))
        self.assertFalse(self.log.exists())

    def test_failed_verifier_does_not_report_remote_stderr(self):
        self.options["exit_code"] = 23
        self.write_settings()
        with self.assertRaisesRegex(ValueError, "^website proof verifier failed$"):
            self.verify()

    def test_command_output_timeout_and_text_limits(self):
        python = str(Path(sys.executable).resolve())
        commands = [
            ([python, "-I", "-B", "-c", f"import sys;sys.stdout.buffer.write(b'x'*{proof.PROOF_LIMIT + 1})"], "output bounds", 10),
            ([python, "-I", "-B", "-c", f"import sys;sys.stderr.buffer.write(b'x'*{proof.ERROR_LIMIT + 1})"], "output bounds", 10),
            ([python, "-I", "-B", "-c", "import time;time.sleep(5)"], "timed out", 0.05),
            ([python, "-I", "-B", "-c", "import sys;sys.stdout.buffer.write(bytes([255]))"], "invalid text", 10),
        ]
        for args, error, timeout in commands:
            with self.subTest(error=error), self.assertRaisesRegex(ValueError, error):
                proof.command(args, timeout=timeout)


if __name__ == "__main__":
    unittest.main(verbosity=2)
