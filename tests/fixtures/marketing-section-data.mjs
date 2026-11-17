// Small independently authored fixtures. These do not stand in for production
// marketing copy, catalog qualification, demo execution or the blog package.
export const PRODUCTS = [
  ['verification-api', 'Fixture verifier'], ['issuance-api', 'Fixture issuer'],
  ['kiosk', 'Fixture kiosk'], ['authenticator', 'Fixture authenticator'],
  ['omitted-product', 'Fifth fixture product'],
].map(([id, name]) => ({
  id, name, tagline: `${name} summary`, deployment: ['First deployment', 'Second deployment', 'Hidden third deployment'],
}));

export const journeys = [
  {
    id: 'learner', label: 'Learner journey', persona: 'Learner', environment: 'Training lab',
    title: 'Receive a fixture badge', summary: 'A small controlled holder example.',
    steps: [
      { label: 'Choose a wallet', description: 'Select the fixture wallet.' },
      { label: 'Review the request', description: 'Review the requested fixture claims.' },
    ],
    holderView: 'A holder controls the fixture presentation.', disclosed: ['Qualification type', 'Issuer'],
    verifierView: 'A verifier sees the selected proof.', verifierChecks: ['Issuer trust', 'Expiry'],
    outcome: 'The selected fixture proof is reviewed.', benefits: ['Limited disclosure'],
  },
  {
    id: 'visitor', label: 'Visitor journey', persona: 'Visitor', environment: 'Reception lab',
    title: 'Present a fixture pass', summary: 'A second controlled example.',
    steps: [{ label: 'Present the pass', description: 'Share only the fixture entry claim.' }],
    holderView: 'The visitor shares a one-time pass.', disclosed: ['Entry permission'],
    verifierView: 'Reception checks the fixture pass.', verifierChecks: ['Pass validity'],
    outcome: 'The visitor fixture is evaluated.', benefits: ['Scoped access'],
  },
];
export const END_USER_EXPERIENCES = {
  title: 'Fixture holder journeys', subtitle: 'Synthetic journeys for component qualification.', journeys,
};

export const DEPLOYMENT_MODELS = {
  title: 'Fixture operating models', subtitle: 'Synthetic responsibilities only.',
  questions: [{ question: 'Who operates this fixture?', answer: 'The selected fixture operator.' }],
  example: { title: 'Fixture example', flow: ['Holder', 'Verifier', 'Decision'], summary: 'No live deployment is represented.' },
  modes: [
    ['customer-operated', '/architecture', 'Customer model'],
    ['partner-operated', '/solutions', 'Partner model'],
    ['offline-evaluation', '/demos', 'Offline model'],
  ].map(([id, path, title]) => ({
    id, path, title, badge: `${title} badge`, summary: `${title} scope`,
    features: [`${title} feature`], bestFor: [`${title} audience`], cta: `Explore ${title}`,
  })),
};

export const scenarios = [
  {
    id: 'badge', label: 'Badge scenario', title: 'Synthetic badge proof', summary: 'Fixture presentation with explicit limits.',
    channel: 'Fixture verifier channel', requestPath: '/v1/fixture/verify', requestSummary: 'Request a fixture badge.',
    slug: 'fixture-badge-proof', cta: 'Read the fixture walkthrough', holderSummary: 'A synthetic holder reviews disclosure.',
    disclosed: ['Badge type', 'Fixture issuer'],
    verifierChecks: [{ label: 'Fixture trust', status: 'pass', detail: 'Synthetic trust configuration.' }],
    outcome: 'Fixture verification outcome', proof: 'Preview only',
    eventLog: ['Preview request prepared', 'Preview proof selected', 'Preview decision pending'],
  },
  { id: 'entry', label: 'Entry scenario' },
];
export const INTERACTIVE_PROOF_LAB = {
  title: 'Fixture proof lab', subtitle: 'Synthetic inputs; no live verifier execution.', eyebrow: 'Component fixture', scenarios,
};
