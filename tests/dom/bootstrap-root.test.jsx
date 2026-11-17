import { act } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { mountApp } from '../../ui/src/bootstrapRoot.jsx';

// i18n's real initialization is exercised separately; this suite controls only
// that side effect and records actual React roots so each test can unmount them.
vi.mock('../../ui/src/i18n/index.js', () => ({ default: {} }));
const roots = vi.hoisted(() => []);
vi.mock('react-dom/client', async (importOriginal) => {
  const actual = await importOriginal();
  return { ...actual, default: {
    ...actual.default,
    createRoot: (...args) => {
      const root = actual.createRoot(...args);
      roots.push(root);
      return root;
    },
  } };
});
const fontDescriptor = Object.getOwnPropertyDescriptor(document, 'fonts');
let frames;
let nextFrame;
beforeEach(() => {
  frames = new Map();
  nextFrame = 0;
  document.body.innerHTML = '<div id="root"></div>';
  document.documentElement.className = 'app-loading';
  document.body.className = 'app-loading';
  Object.defineProperty(document, 'fonts', { configurable: true, value: { ready: Promise.resolve() } });
  vi.stubGlobal('requestAnimationFrame', (callback) => {
    frames.set(++nextFrame, callback);
    return nextFrame;
  });
});
afterEach(async () => {
  await act(async () => { for (const root of roots.splice(0)) root.unmount(); });
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  if (fontDescriptor) Object.defineProperty(document, 'fonts', fontDescriptor);
  else delete document.fonts;
  document.body.innerHTML = '';
  document.documentElement.className = '';
  document.body.className = '';
});
async function frame() {
  const callbacks = [...frames.values()];
  frames.clear();
  await act(async () => { for (const callback of callbacks) callback(0); });
}
const Root = () => <h1>Website runtime mounted</h1>;

describe('website bootstrap with the actual React root', () => {
  it('renders immediately but removes the loading shell only after fonts and two frames', async () => {
    let resolveFonts;
    Object.defineProperty(document, 'fonts', { configurable: true,
      value: { ready: new Promise((resolve) => { resolveFonts = resolve; }) } });
    await act(async () => { mountApp(Root); });
    expect(document.querySelector('h1').textContent).toBe('Website runtime mounted');
    expect(document.body.classList.contains('app-loading')).toBe(true);
    expect(frames.size).toBe(0);
    await act(async () => { resolveFonts(); });
    expect(frames.size).toBe(1);
    await frame();
    expect(document.body.classList.contains('app-loading')).toBe(true);
    await frame();
    for (const element of [document.documentElement, document.body]) {
      expect(element.classList.contains('app-loading')).toBe(false);
      expect(element.classList.contains('app-ready')).toBe(true);
    }
  });

  it('can finish when the Font Loading API is unavailable', async () => {
    Object.defineProperty(document, 'fonts', { configurable: true, value: undefined });
    await act(async () => { mountApp(Root); });
    await frame();
    await frame();
    expect(document.body.classList.contains('app-ready')).toBe(true);
  });

  it('reports a missing mount element without creating a React root', () => {
    document.body.innerHTML = '';
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});
    mountApp(Root);
    expect(error).toHaveBeenCalledWith('Root element not found.');
    expect(roots).toHaveLength(0);
    expect(frames.size).toBe(0);
  });
});
