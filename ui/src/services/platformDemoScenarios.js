// Archived manifests retain provenance; current platform routes and cards only
// expose platform-owned demonstrations. D-07 and D-08 remain reserved outside the active platform portfolio.
export const RETIRED_DEMO_SLUGS = Object.freeze([
  'canvas-learning-achievement',
  'external-evidence-to-credential',
]);

export function platformDemoScenarios(scenarios) {
  return scenarios.filter((scenario) => !RETIRED_DEMO_SLUGS.includes(scenario.slug)
    && scenario.demo_id !== 'D-07'
    && scenario.demo_id !== 'D-08');
}
