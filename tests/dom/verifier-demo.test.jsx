import { describe, expect, it } from 'vitest';
import {
  createVerifierDemoMockPresentation,
  serializeVerifierDemoPresentation,
  resolveVerifierDemoRequest,
  createVerifierDemoVerificationResult,
  createVerifierDemoVerificationError,
} from '../../ui/src/application/verifier/verifierDemoFlow.js';
import {
  PROOF_LAB_RUNTIME,
  createProofLabPresentation,
  createProofLabPresentationData,
  createProofLabRequestPreview,
} from '../../ui/src/components/landing/proofLabRuntime.js';

// These helpers format requests and demo results. No JWT authenticity, remote
// verification, manifest validation or proof-lab network execution is simulated.
describe('verifier demo request and result boundaries', () => {
  it('creates independent deterministic sample presentations that round-trip as JSON', () => {
    const issuanceDate = '2026-01-02T03:04:05.000Z';
    const first = createVerifierDemoMockPresentation({ issuanceDate });
    const second = createVerifierDemoMockPresentation({ issuanceDate });
    expect(first).toEqual(second);
    expect(first).not.toBe(second);
    expect(first.verifiableCredential[0]).not.toBe(second.verifiableCredential[0]);
    expect(first.verifiableCredential[0].issuanceDate).toBe(issuanceDate);
    expect(first.verifiableCredential[0].credentialSubject.age_over_21).toBe(true);
    expect(JSON.parse(serializeVerifierDemoPresentation(first))).toEqual(first);
  });

  it('routes an opaque token without treating it as verified', () => {
    expect(resolveVerifierDemoRequest({ presentationData: '  opaque.jwt.input\n' })).toEqual({
      requestType: 'presentation',
      payload: { presentation_jwt: 'opaque.jwt.input', expected_audience: 'demo_verifier', expected_nonce: null },
    });
  });

  it('takes expected audience from the caller, not from an untrusted JSON envelope', () => {
    const presentationData = JSON.stringify({
      presentation_jwt: 'sample.jwt', expected_audience: 'attacker', expected_nonce: 'injected',
    });
    expect(resolveVerifierDemoRequest({ presentationData, expectedAudience: 'chosen_verifier' })).toEqual({
      requestType: 'presentation',
      payload: { presentation_jwt: 'sample.jwt', expected_audience: 'chosen_verifier', expected_nonce: null },
    });
  });

  it('routes the first string credential without trusting a submitted issuer constraint', () => {
    const presentationData = JSON.stringify({ verifiableCredential: ['first.jwt', 'second.jwt'], expected_issuer: 'untrusted' });
    expect(resolveVerifierDemoRequest({ presentationData })).toEqual({
      requestType: 'credential', payload: { credential_jwt: 'first.jwt', expected_issuer: null },
    });
  });

  it('serializes the first object credential for the credential endpoint', () => {
    const credential = { type: ['VerifiableCredential'], credentialSubject: { age_over_21: true } };
    expect(resolveVerifierDemoRequest({ presentationData: JSON.stringify({ verifiableCredential: [credential] }) })).toEqual({
      requestType: 'credential', payload: { credential_jwt: JSON.stringify(credential), expected_issuer: null },
    });
  });

  it('rejects missing input, broken JSON and unsupported JSON presentations', () => {
    expect(() => resolveVerifierDemoRequest()).toThrow('Please scan a QR code or enter presentation data first');
    expect(() => resolveVerifierDemoRequest({ presentationData: ' \n ' })).toThrow('Please scan a QR code or enter presentation data first');
    expect(() => resolveVerifierDemoRequest({ presentationData: '{broken' })).toThrow(SyntaxError);
    for (const value of [{}, { verifiableCredential: [] }, { credential: 'unsupported' }]) {
      expect(() => resolveVerifierDemoRequest({ presentationData: JSON.stringify(value) })).toThrow('Invalid presentation format');
    }
  });

  it('preserves verification evidence and uses holder when issuer is absent', () => {
    const claims = { age_over_21: true };
    const presentation_summary = { requested: 1, disclosed: 1 };
    const result = createVerifierDemoVerificationResult({ valid: true, claims, holder: 'did:example:holder', presentation_summary });
    expect(result).toMatchObject({ success: true, verified: true, issuer: 'did:example:holder', claims, presentation_summary });
    expect(result.checks.map(({ check_name, passed }) => [check_name, passed])).toEqual([
      ['JWT Structure', true], ['Signature', true], ['Claims', true],
    ]);
    expect(result.checks[2].details).toBe('Found 1 claims');
    expect(createVerifierDemoVerificationResult({ valid: true, issuer: 'issuer', holder: 'holder' }).issuer).toBe('issuer');
  });

  it('does not claim extracted claims when a valid response has none', () => {
    const result = createVerifierDemoVerificationResult({ valid: true });
    expect(result.verified).toBe(true);
    expect(result.checks[2]).toMatchObject({ passed: false, details: 'Found 0 claims' });
  });

  it('keeps negative and missing verification results unsuccessful', () => {
    const result = createVerifierDemoVerificationResult({ valid: false, error: 'invalid signature', claims: { age_over_21: true } });
    expect(result).toMatchObject({ success: false, verified: false, error: 'invalid signature' });
    expect(result.checks.every(({ passed }) => passed === false)).toBe(true);
    expect(result.checks[0].details).toBe('invalid signature');
    expect(createVerifierDemoVerificationResult().verified).toBe(false);
  });

  it('requires explicit boolean true before displaying successful verification', () => {
    for (const valid of ['false', 'true', 1, {}, []]) {
      const result = createVerifierDemoVerificationResult({ valid, claims: { age_over_21: true } });
      expect(result.success).toBe(false);
      expect(result.verified).toBe(false);
      expect(result.checks.every(({ passed }) => passed === false)).toBe(true);
    }
  });

  it('formats a request failure without creating successful checks', () => {
    expect(createVerifierDemoVerificationError('network unavailable')).toEqual({
      success: false, verified: false, error: 'Verification failed: network unavailable',
      checks: [{ check_name: 'Format Check', passed: false, details: 'network unavailable' }],
    });
  });
});

describe('proof-lab presentation isolation', () => {
  it.each(['retail-age', 'enterprise-access', 'airline-boarding'])('%s contains only its configured disclosure claims', (scenarioId) => {
    const runtime = PROOF_LAB_RUNTIME[scenarioId];
    const presentation = createProofLabPresentation(scenarioId);
    expect(presentation.type).toEqual(['VerifiablePresentation']);
    expect(presentation.verifiableCredential).toHaveLength(1);
    const credential = presentation.verifiableCredential[0];
    expect(credential).toMatchObject({
      type: ['VerifiableCredential', runtime.credentialType], issuer: runtime.issuer, issuanceDate: runtime.issuedAt,
    });
    expect(credential.credentialSubject).toEqual(runtime.claims);
    for (const privateSampleKey of ['given_name', 'family_name', 'birth_date', 'document_number']) {
      expect(Object.hasOwn(credential.credentialSubject, privateSampleKey)).toBe(false);
    }
    expect(JSON.parse(createProofLabPresentationData(scenarioId))).toEqual(presentation);
  });

  it('uses the retail fallback for absent, unknown and inherited object-property scenario IDs', () => {
    const fallback = createProofLabPresentation('retail-age');
    for (const scenarioId of [undefined, '', 'unknown-scenario', 'toString', 'constructor', '__proto__']) {
      expect(createProofLabPresentation(scenarioId)).toEqual(fallback);
    }
  });

  it('isolates generated claims so editing one presentation cannot change subsequent demos', () => {
    const runtime = PROOF_LAB_RUNTIME['retail-age'];
    const originalClaims = { ...runtime.claims };
    try {
      const first = createProofLabPresentation('retail-age');
      first.verifiableCredential[0].credentialSubject.age_over_21 = false;
      first.verifiableCredential[0].credentialSubject.injected = 'caller-only';
      expect(createProofLabPresentation('retail-age').verifiableCredential[0].credentialSubject).toEqual(originalClaims);
      expect(runtime.claims).toEqual(originalClaims);
      expect(runtime.expectedResult.claims).toEqual(originalClaims);
    } finally {
      // Restore shared source state even when this regression fails before a fix.
      for (const key of Object.keys(runtime.claims)) delete runtime.claims[key];
      Object.assign(runtime.claims, originalClaims);
    }
  });

  it('previews the selected policy and disclosed claims without executing a request', () => {
    const scenario = { requestPath: 'POST /api/presentations/verify', disclosed: ['age_over_21'], channel: 'retail' };
    expect(createProofLabRequestPreview(scenario, PROOF_LAB_RUNTIME['retail-age'])).toEqual({
      endpoint: '/api/presentations/verify', presentation_policy_id: 'policy_age_over_21',
      trust_profile_id: 'trust_retail_age_v1', requested_claims: ['age_over_21'], channel: 'retail',
    });
    expect(scenario.requestPath).toBe('POST /api/presentations/verify');
  });
});
