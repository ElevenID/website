import assert from 'node:assert/strict';
import test from 'node:test';
import { DEMO_BROWSER_TEST_TITLES, validateDemoBrowserReport, validateDemoBrowserTemporaryRoot } from '../../scripts/lib/demo-browser-qualification.mjs';

function report() {
  return {
    errors: [], stats: { expected: 6, unexpected: 0, flaky: 0, skipped: 0 },
    suites: [{ suites: [{ specs: DEMO_BROWSER_TEST_TITLES.map((title) => ({ title, file: 'demo-platform.spec.mjs',
      tests: [{ projectName: 'website-demo', projectId: 'website-demo', expectedStatus: 'passed', status: 'expected', results: [{ status: 'passed', retry: 0 }] }],
    })) }] }],
  };
}

test('browser evidence admits six executed one-attempt successes', () => {
  assert.deepEqual(validateDemoBrowserReport(report()), { executed: 6, passed: 6, skipped: 0, retried: 0 });
});

for (const [name, mutate] of [
  ['a setup error despite passing counts', (value) => value.errors.push({ message: 'Browser failed to launch' })],
  ['a skipped check', (value) => { value.stats.skipped = 1; }],
  ['a retried flaky check', (value) => { value.stats.flaky = 1; }],
  ['a missing scenario check', (value) => { value.suites[0].suites[0].specs.pop(); }],
  ['a failed execution behind fabricated totals', (value) => { value.suites[0].suites[0].specs[0].tests[0].results[0].status = 'failed'; }],
  ['an expected failure instead of behavior success', (value) => { value.suites[0].suites[0].specs[0].tests[0].expectedStatus = 'failed'; }],
  ['an unexecuted result', (value) => { value.suites[0].suites[0].specs[0].tests[0].results = []; }],
  ['a second successful attempt', (value) => { value.suites[0].suites[0].specs[0].tests[0].results[0].retry = 1; }],
  ['a duplicate replacing a distinct behavior', (value) => { value.suites[0].suites[0].specs[1].title = value.suites[0].suites[0].specs[0].title; }],
  ['an unrelated passing behavior', (value) => { value.suites[0].suites[0].specs[0].title = 'unrelated success'; }],
  ['an unrelated test file', (value) => { value.suites[0].suites[0].specs[0].file = 'fake.spec.mjs'; }],
  ['an unrelated project', (value) => { value.suites[0].suites[0].specs[0].tests[0].projectName = 'other'; }],
]) {
  test('browser evidence rejects ' + name, () => {
    const value = report(); mutate(value);
    assert.throws(() => validateDemoBrowserReport(value));
  });
}

test('Chromium temporary roots reject overlong and multibyte paths before launch', () => {
  assert.equal(validateDemoBrowserTemporaryRoot('/tmp'), '/tmp');
  for (const value of ['/tmp/' + 'x'.repeat(40), '/tmp/' + 'é'.repeat(20), 'relative']) {
    assert.throws(() => validateDemoBrowserTemporaryRoot(value), /short absolute temporary root/);
  }
});
