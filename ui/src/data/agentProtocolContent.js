/**
 * Educational descriptions of optional protocol contracts.
 * These records are not runtime discovery or a support/qualification catalog.
 */
export const PUBLIC_MIP_BASELINE_VERSION = '0.5.0';

export const CORE_PRIMITIVES = [
  { name: 'Trust Profile', description: 'Who is trusted and how identity evidence is validated.' },
  { name: 'Credential Template', description: 'What is issued: claims, format, cryptography, and validity.' },
  { name: 'Presentation Policy', description: 'What must be proved and which claims may be disclosed.' },
  { name: 'Deployment Profile', description: 'Where identity workflows run and which configured profiles they use.' },
  { name: 'Flow', description: 'How an identity workflow moves through application, approval, issuance, presentation, and verification.' },
];

export const DELEGATION_ROLES = [
  { name: 'Issuer', question: 'Who maintains the grant?', description: 'The authority that issues or maintains the delegation record and its status.' },
  { name: 'Grantor', question: 'Who approves representation?', description: 'The person or authority entitled to approve these exact terms.' },
  { name: 'Represented subject', question: 'On whose behalf?', description: 'The person or organization the delegate is permitted to represent.' },
  { name: 'Delegate', question: 'Who is actually acting?', description: 'The independently authenticated agent or other principal making the request.' },
];

export const DELEGATION_STEPS = [
  { title: 'Define a bounded grant', description: 'Name the parties, proof binding, permitted actions, resources, audiences, constraints, and validity period.' },
  { title: 'Approve the exact terms', description: 'A trusted confirmation checks the grantor’s authority and records explicit approval of the immutable terms.' },
  { title: 'Bind the actor and request', description: 'Authenticate the delegate and bind the proof key, runtime or session, and challenge to the proposed operation.' },
  { title: 'Recheck at final use', description: 'Check current grant status, approval, policy, scope, freshness, and the exact operation before recording a decision.' },
  { title: 'Verify decision evidence', description: 'The application verifies the signed result and applies its own current permissions, constraints, and execution controls.' },
  { title: 'Recover the original result', description: 'After a lost response, an authorized reader retrieves the original outcome with its original timestamps and expiry.' },
];

export const AGENT_TRUST_BOUNDARIES = [
  { marty: 'Identity, credentials, provenance, and proof bindings', application: 'Agent definitions, models, prompts, memory, and host isolation' },
  { marty: 'Scoped grants, explicit approval, and current authority', application: 'Tasks, resource permissions, budgets, and reservations' },
  { marty: 'Identity-policy decisions and signed evidence', application: 'Provider calls, payments, execution, and business outcomes' },
  { marty: 'Original challenge and decision recovery', application: 'Operation idempotency and outcome reconciliation' },
];
