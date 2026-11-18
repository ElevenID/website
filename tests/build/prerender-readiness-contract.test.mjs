import assert from 'node:assert/strict';
import test from 'node:test';
import { JSDOM } from 'jsdom';
import { installPrerenderReadiness } from '../../scripts/lib/prerender-readiness.mjs';

function browser(t, { route = '/product', content = '<h1>Product</h1>' } = {}) {
  const dom = new JSDOM('<!doctype html><html class="app-ready"><body><div id="root">' + content + '</div></body></html>', {
    url: 'http://127.0.0.1:8080' + route, runScripts: 'outside-only',
  });
  const timers = new Map();
  let timerId = 0;
  dom.window.setTimeout = (callback, delay) => {
    timers.set(++timerId, { callback, delay });
    return timerId;
  };
  dom.window.clearTimeout = (id) => timers.delete(id);
  // Exercise the serialized function used by Chrome, including its absence of
  // module-scope dependencies, rather than a hand-built copy of the harness.
  const dispose = dom.window.eval('(' + installPrerenderReadiness.toString() + ')(window)');
  t.after(() => { dispose(); dom.window.close(); });
  return {
    document: dom.window.document,
    source: () => dom.window.document.documentElement.getAttribute('data-website-render-source'),
    signal: () => dom.window.document.dispatchEvent(new dom.window.Event('app-rendered')),
    deadline: () => {
      assert.equal(timers.size, 1);
      const [id, timer] = [...timers][0];
      assert.equal(timer.delay, 25000);
      timers.delete(id);
      timer.callback();
    },
  };
}

test('normal app-rendered wins before fallback is eligible', async (t) => {
  const page = browser(t);
  page.document.querySelector('h1').textContent = 'Ready product';
  await new Promise(setImmediate);
  assert.equal(page.source(), null, 'A ready heading alone must not claim an immediate fallback');
  page.signal();
  assert.equal(page.source(), 'signal');
  page.deadline();
  assert.equal(page.source(), 'signal');
});

test('a late normal signal replaces fallback evidence without being downgraded again', async (t) => {
  const page = browser(t);
  page.deadline();
  assert.equal(page.source(), 'app-ready-fallback');
  page.signal();
  page.document.querySelector('h1').textContent = 'Updated product';
  await new Promise(setImmediate);
  assert.equal(page.source(), 'signal');
});

for (const [label, content, route] of [
  ['loading', '<h1>Product</h1><div data-app-loading>Loading</div>', '/product'],
  ['caught React error', '<main data-website-error-boundary><h1>This page could not be loaded.</h1></main>', '/product'],
  ['empty heading', '<h1> </h1>', '/product'],
  ['unsettled demo', '<h1>Demo</h1>', '/demos/2026.08.0'],
]) {
  test(`normal and fallback readiness reject ${label}`, (t) => {
    const page = browser(t, { content, route });
    page.signal();
    assert.equal(page.source(), null);
    page.deadline();
    assert.equal(page.source(), 'timeout');
    assert.equal(page.document.documentElement.getAttribute('data-website-rendered'), null);
  });
}

test('a route that becomes ready after the deadline is observed without accepting its loader', async (t) => {
  const page = browser(t, { content: '<h1>Product</h1><div data-app-loading>Loading</div>' });
  page.deadline();
  assert.equal(page.source(), 'timeout');
  page.document.querySelector('[data-app-loading]').remove();
  await new Promise(setImmediate);
  assert.equal(page.source(), 'app-ready-fallback');
  assert.equal(page.document.documentElement.getAttribute('data-website-final-path'), '/product');
});

test('a settled demo can complete through the normal readiness signal', (t) => {
  const page = browser(t, {
    route: '/demos/2026.08.0', content: '<h1>Demo</h1><main data-demo-render-state="settled"></main>',
  });
  page.signal();
  assert.equal(page.source(), 'signal');
});
