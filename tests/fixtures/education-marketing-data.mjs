// Independently authored, small inputs for the three educational pages.
// These values are not the deferred production marketing corpus.
export const IDENTITY_CONCEPTS = {
  whatIs: {
    title: 'Fixture trust and purpose', tagline: 'A limited teaching fixture',
    definition: '<em>Fixture definition remains text</em>',
    problems: ['Fixture problem: isolated credentials', 'Fixture problem: unclear policy'],
  },
  threeQuestions: {
    conclusion: 'The fixture separates issuer, claim and verifier responsibilities.',
    questions: [
      { question: 'Fixture issuer?', description: 'Who issued the example?', detail: 'A fixture issuer.' },
      { question: 'Fixture claim?', description: 'What is asserted?', detail: 'A fixture qualification.' },
      { question: 'Fixture verifier?', description: 'Who evaluates it?', detail: 'A fixture verifier.' },
    ],
  },
  fourPrimitives: {
    title: 'Fixture governed primitives', tagline: 'Independent configuration examples',
    primitives: [
      { name: 'Fixture trust rules', purpose: 'Define the permitted issuers.', contains: ['Issuer list', 'Trust period'], stability: 'Fixture version 1' },
      { name: 'Fixture disclosure policy', purpose: 'Limit the requested claims.', contains: ['Requested claims', 'Disclosure purpose'], stability: 'Fixture version 2' },
    ],
  },
  flows: {
    title: 'Fixture credential journeys', description: 'A small, non-production flow inventory.',
    examples: [
      { name: 'Fixture issue', description: 'A holder receives a fixture credential.' },
      { name: 'Fixture present', description: 'A holder reviews a fixture presentation.' },
      { name: 'Fixture check', description: 'A verifier evaluates a fixture claim.' },
    ],
  },
};

export const STANDARDS_STRATEGIC = { header: 'Fixture standards are configured and versioned' };
export const STANDARDS_INFO = {
  whyStandardsMatter: { points: [
    { title: 'Portability', description: 'Fixture portability depends on the selected profile.' },
    { title: 'Trust', description: 'Fixture trust requires an explicit policy.' },
    { title: 'Longevity', description: 'Fixture versions retain their identity.' },
    { title: 'Interoperability', description: 'Fixture integrations require executed evidence.' },
  ] },
  layers: [
    { name: 'Fixture formats', description: 'How fixture claims are represented.', standards: [
      { name: 'Fixture format A', description: 'An illustrative encoding.' },
      { name: 'Fixture format B', description: '<strong>Fixture markup stays text</strong>' },
    ] },
    { name: 'Fixture exchange', description: 'How fixture claims are exchanged.', standards: [
      { name: 'Fixture exchange profile', description: 'An illustrative protocol profile.' },
    ] },
  ],
};

export const PROTOCOL = {
  version: '0.0.0-fixture', status: 'Draft fixture', license: 'Fixture license',
  tagline: 'A bounded protocol content fixture.', thesis: 'Fixture policy is reviewed before use.',
  githubUrl: 'https://github.com/example/fixture-protocol',
  standards: [
    { name: 'Fixture mapping A', coverage: 'Draft mapping; no certification.' },
    { name: 'Fixture mapping B', coverage: 'Profile-specific fixture coverage.' },
  ],
  governance: { model: 'Fixture governance is independently reviewed.' },
};
