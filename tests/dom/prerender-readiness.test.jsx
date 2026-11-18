import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, render } from '@testing-library/react';
import { MemoryRouter, useNavigate } from 'react-router';
import PrerenderReadySignal from '../../ui/src/apps/shared/PrerenderReadySignal.jsx';

// Translation transport completion is controlled at the i18n boundary. React,
// router effects, the DOM, MutationObserver and waitForFonts remain real.
const translations = vi.hoisted(() => ({ load: vi.fn() }));
vi.mock('../../ui/src/i18n/index.js', () => ({
  default: { options: { ns: ['common', 'marketing'] }, loadNamespaces: translations.load },
}));

const nativeObserver = window.MutationObserver;
const initialFonts = Object.getOwnPropertyDescriptor(document, 'fonts');
const observers = new Set();
const markers = new Set();
const frames = new Map();
let nextFrame;
let rendered;
let hadAppReady;

function deferred() {
  let resolve;
  const promise = new Promise((complete) => { resolve = complete; });
  return { promise, resolve };
}
function setFonts(ready) {
  Object.defineProperty(document, 'fonts', { configurable: true, value: ready ? { ready } : undefined });
}
function marker(name, value = '') {
  const element = document.createElement('div');
  element.setAttribute(name, value);
  markers.add(element);
  document.body.appendChild(element);
  return element;
}
function renderReady(path = '/product') {
  let navigate;
  function Probe() {
    navigate = useNavigate();
    return <><h1>Rendered page</h1><PrerenderReadySignal /></>;
  }
  const container = document.createElement('div');
  container.id = 'root';
  document.body.appendChild(container);
  return {
    ...render(<MemoryRouter initialEntries={[path]}><Probe /></MemoryRouter>, { container }),
    navigate: (destination) => navigate(destination),
  };
}
async function settle() {
  await act(async () => {
    for (let turn = 0; turn < 6; turn += 1) await Promise.resolve();
  });
}
async function frame() {
  await act(async () => {
    const pending = [...frames.values()];
    frames.clear();
    for (const callback of pending) callback(performance.now());
  });
}
async function paint() {
  await settle();
  await frame();
  await frame();
  await settle();
}

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
  hadAppReady = document.documentElement.classList.contains('app-ready');
  document.documentElement.classList.add('app-ready');
  translations.load.mockReset().mockResolvedValue(undefined);
  setFonts(undefined);
  nextFrame = 1;
  frames.clear();
  rendered = vi.fn();
  document.addEventListener('app-rendered', rendered);
  vi.stubGlobal('requestAnimationFrame', vi.fn((callback) => {
    const id = nextFrame++;
    frames.set(id, callback);
    return id;
  }));
  vi.stubGlobal('cancelAnimationFrame', vi.fn((id) => { frames.delete(id); }));
  vi.stubGlobal('MutationObserver', class TrackedObserver extends nativeObserver {
    observe(...args) { observers.add(this); return super.observe(...args); }
    disconnect() { observers.delete(this); return super.disconnect(); }
  });
});

afterEach(() => {
  cleanup();
  if (!hadAppReady) document.documentElement.classList.remove('app-ready');
  document.removeEventListener('app-rendered', rendered);
  for (const observer of [...observers]) observer.disconnect();
  for (const element of markers) element.remove();
  markers.clear();
  frames.clear();
  vi.clearAllTimers();
  vi.useRealTimers();
  vi.unstubAllGlobals();
  if (initialFonts) Object.defineProperty(document, 'fonts', initialFonts);
  else delete document.fonts;
});

describe('prerender readiness and route lifecycle', () => {
  it('waits for fonts, translations, loading content and two frames', async () => {
    const font = deferred();
    const language = deferred();
    setFonts(font.promise);
    translations.load.mockReturnValue(language.promise);
    const loading = marker('data-app-loading');
    renderReady();
    await settle();
    expect(translations.load).toHaveBeenCalledWith(['common', 'marketing']);
    expect(frames.size).toBe(0);
    font.resolve();
    await settle();
    expect(frames.size).toBe(0);
    language.resolve();
    await settle();
    expect(frames.size).toBe(0);
    loading.remove();
    await settle();
    expect(frames.size).toBe(1);
    expect(rendered).not.toHaveBeenCalled();
    await frame();
    expect(rendered).not.toHaveBeenCalled();
    await frame();
    expect(rendered).toHaveBeenCalledTimes(1);
  });

  it('waits for app-ready, a real heading and removal of the loading marker', async () => {
    document.documentElement.classList.remove('app-ready');
    const loading = marker('data-app-loading');
    renderReady();
    await settle();
    expect(rendered).not.toHaveBeenCalled();
    document.documentElement.classList.add('app-ready');
    await settle();
    expect(rendered).not.toHaveBeenCalled();
    loading.remove();
    await paint();
    expect(rendered).toHaveBeenCalledTimes(1);
  });

  it('accepts a synchronous translation loader result without losing readiness', async () => {
    translations.load.mockReturnValue(undefined);
    renderReady();
    await paint();
    expect(rendered).toHaveBeenCalledTimes(1);
  });

  it('waits for an actual demo settled-state mutation', async () => {
    const demo = marker('data-demo-render-state', 'loading');
    renderReady('/demos/latest/example');
    await settle();
    expect(frames.size).toBe(0);
    expect(observers.size).toBe(1);
    demo.setAttribute('data-demo-render-state', 'settled');
    await paint();
    expect(rendered).toHaveBeenCalledTimes(1);
    expect(observers.size).toBe(0);
  });

  it('releases the translation deadline when readiness completes early', async () => {
    renderReady();
    await paint();
    expect(rendered).toHaveBeenCalledTimes(1);
    expect(vi.getTimerCount()).toBe(0);
  });

  it('disconnects a demo observer when the demo deadline expires', async () => {
    renderReady('/demos/latest/missing');
    await settle();
    expect(observers.size).toBe(1);
    await act(async () => { await vi.advanceTimersByTimeAsync(15000); });
    await paint();
    expect(rendered).toHaveBeenCalledTimes(1);
    expect(observers.size).toBe(0);
    expect(vi.getTimerCount()).toBe(0);
  });

  it('disconnects pending observers and deadlines when unmounted', async () => {
    translations.load.mockReturnValue(new Promise(() => {}));
    marker('data-app-loading');
    const view = renderReady('/demos/latest/pending');
    await settle();
    expect(observers.size).toBe(3);
    expect(vi.getTimerCount()).toBeGreaterThan(0);
    view.unmount();
    expect(observers.size).toBe(0);
    expect(vi.getTimerCount()).toBe(0);
    expect(frames.size).toBe(0);
  });

  it('cancels the old route wait and never publishes its stale readiness', async () => {
    const view = renderReady('/demos/latest/pending');
    await settle();
    expect(observers.size).toBe(1);
    await act(async () => { view.navigate('/product'); });
    await paint();
    expect(rendered).toHaveBeenCalledTimes(1);
    expect(observers.size).toBe(0);
    expect(vi.getTimerCount()).toBe(0);
    await act(async () => { await vi.advanceTimersByTimeAsync(15000); });
    await paint();
    expect(rendered).toHaveBeenCalledTimes(1);
  });

  it('cancels a pending second animation frame when unmounted', async () => {
    const view = renderReady();
    await settle();
    await frame();
    expect(frames.size).toBe(1);
    view.unmount();
    expect(frames.size).toBe(0);
    await frame();
    expect(rendered).not.toHaveBeenCalled();
  });

  it('publishes readiness again for a query-string route transition', async () => {
    const view = renderReady();
    await paint();
    expect(rendered).toHaveBeenCalledTimes(1);
    await act(async () => { view.navigate('/product?view=details'); });
    await paint();
    expect(rendered).toHaveBeenCalledTimes(2);
  });

  it('keeps translation failure and timeout from blocking readiness', async () => {
    translations.load.mockRejectedValueOnce(new Error('fixture unavailable'));
    const first = renderReady();
    await paint();
    expect(rendered).toHaveBeenCalledTimes(1);
    first.unmount();
    rendered.mockClear();
    translations.load.mockReturnValue(new Promise(() => {}));
    renderReady();
    await settle();
    await act(async () => { await vi.advanceTimersByTimeAsync(9999); });
    expect(rendered).not.toHaveBeenCalled();
    await act(async () => { await vi.advanceTimersByTimeAsync(1); });
    await paint();
    expect(rendered).toHaveBeenCalledTimes(1);
  });
});
