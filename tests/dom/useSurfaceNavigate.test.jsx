import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, renderHook } from '@testing-library/react';
import { MemoryRouter, useLocation, useNavigate } from 'react-router';
import { useSurfaceNavigate } from '../../ui/src/application/routing/useSurfaceNavigate.js';
import { redirectBrowser } from '../../ui/src/application/routing/appHandoff.js';

// New hook tests use actual React Router history and the actual handoff helpers.
// Only the terminal location methods are replaced; no real document is loaded.
const browserCalls = vi.hoisted(() => []);
vi.mock('../../ui/src/application/routing/appHandoff.js', async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    redirectBrowser: vi.fn((destination, options = {}) => actual.redirectBrowser(destination, {
      ...options,
      location: {
        href: window.location.href,
        origin: window.location.origin,
        pathname: window.location.pathname,
        search: window.location.search,
        hash: window.location.hash,
        assign: (value) => browserCalls.push({ method: 'assign', value }),
        replace: (value) => browserCalls.push({ method: 'replace', value }),
      },
    })),
  };
});

function renderNavigation(entries = ['/product'], index = entries.length - 1) {
  window.history.replaceState(null, '', entries[index]);
  return renderHook(() => ({
    navigate: useSurfaceNavigate(),
    routerNavigate: useNavigate(),
    location: useLocation(),
  }), {
    wrapper: ({ children }) => <MemoryRouter initialEntries={entries} initialIndex={index}>{children}</MemoryRouter>,
  });
}
const pathOf = (location) => location.pathname + location.search + location.hash;
beforeEach(() => {
  window.history.replaceState(null, '', '/product');
  delete window.__MARTY_RUNTIME_CONFIG__;
  browserCalls.length = 0;
  vi.clearAllMocks();
});
afterEach(() => { cleanup(); delete window.__MARTY_RUNTIME_CONFIG__; });

describe('useSurfaceNavigate React Router integration', () => {
  it('delegates numeric history navigation to the real router', async () => {
    const { result } = renderNavigation(['/resources', '/product']);
    await act(async () => { result.current.navigate(-1); });
    expect(result.current.location.pathname).toBe('/resources');
    await act(async () => { result.current.navigate(1); });
    expect(result.current.location.pathname).toBe('/product');
    expect(redirectBrowser).not.toHaveBeenCalled();
  });

  it('pushes same-surface destinations with state and exact query/hash', async () => {
    const { result } = renderNavigation(['/resources', '/product']);
    const destination = '/solutions?return=%2Fproduct%23details#start';
    const state = { source: 'product' };
    await act(async () => { result.current.navigate(destination, { state }); });
    expect(pathOf(result.current.location)).toBe(destination);
    expect(result.current.location.state).toEqual(state);
    await act(async () => { result.current.navigate(-1); });
    expect(result.current.location.pathname).toBe('/product');
    expect(redirectBrowser).not.toHaveBeenCalled();
  });

  it('preserves replace semantics in actual router history', async () => {
    const { result } = renderNavigation(['/resources', '/product']);
    await act(async () => { result.current.navigate('/solutions', { replace: true, state: { replaced: true } }); });
    expect(result.current.location.state).toEqual({ replaced: true });
    await act(async () => { result.current.navigate(-1); });
    expect(result.current.location.pathname).toBe('/resources');
    expect(redirectBrowser).not.toHaveBeenCalled();
  });

  it('supports destination objects with an omitted or explicit pathname', async () => {
    const { result } = renderNavigation();
    await act(async () => { result.current.navigate({ search: '?term=C%2B%2B', hash: '#examples' }); });
    expect(pathOf(result.current.location)).toBe('/product?term=C%2B%2B#examples');
    await act(async () => { result.current.navigate({ pathname: '/verification', search: '?mode=public', hash: '#start' }); });
    expect(pathOf(result.current.location)).toBe('/verification?mode=public#start');
    expect(redirectBrowser).not.toHaveBeenCalled();
  });

  it('assigns the application document without changing router state', async () => {
    const { result } = renderNavigation();
    const destination = '/verify?next=%2Fconsole%3Ftab%3Dkeys%23active#start';
    let returned;
    await act(async () => { returned = result.current.navigate(destination); });
    expect(returned).toBe(true);
    expect(browserCalls).toEqual([{ method: 'assign', value: destination }]);
    expect(result.current.location.pathname).toBe('/product');
  });

  it('uses document replacement for cross-surface object destinations', async () => {
    const { result } = renderNavigation();
    await act(async () => {
      result.current.navigate({ pathname: '/login', search: '?next=%2Fverify', hash: '#prompt' }, { replace: true });
    });
    expect(browserCalls).toEqual([{ method: 'replace', value: '/login?next=%2Fverify#prompt' }]);
    expect(result.current.location.pathname).toBe('/product');
  });

  it('rejects unsafe destinations without changing history or loading a document', async () => {
    const { result } = renderNavigation();
    const originalKey = result.current.location.key;
    for (const destination of [
      'javascript:alert(1)', '//other.example/verify', 'https://other.example/verify',
      ' /verify', '/verify\n', '/\\other.example/verify',
    ]) {
      let returned;
      await act(async () => { returned = result.current.navigate(destination); });
      expect(returned).toBe(false);
    }
    expect(result.current.location.key).toBe(originalKey);
    expect(redirectBrowser).not.toHaveBeenCalled();
  });

  it('keeps application navigation local until entering the console document', async () => {
    const { result } = renderNavigation(['/login']);
    await act(async () => { result.current.navigate('/verify'); });
    expect(result.current.location.pathname).toBe('/verify');
    expect(redirectBrowser).not.toHaveBeenCalled();
    await act(async () => { result.current.navigate('/console/org?tab=keys#active'); });
    expect(browserCalls).toEqual([{ method: 'assign', value: '/console/org?tab=keys#active' }]);
    expect(result.current.location.pathname).toBe('/verify');
  });

  it('uses the current router pathname after another router transition', async () => {
    const { result } = renderNavigation();
    await act(async () => { result.current.routerNavigate('/verify'); });
    await act(async () => { result.current.navigate('/login'); });
    expect(result.current.location.pathname).toBe('/login');
    expect(redirectBrowser).not.toHaveBeenCalled();
  });

  it('uses the configured canonical origin for entry-alias navigation', async () => {
    expect(window.location.origin).toBe('https://192.0.2.10');
    window.__MARTY_RUNTIME_CONFIG__ = { hosting: {
      canonicalOrigin: 'https://elevenidllc.com', publicEntryOrigins: [window.location.origin],
    } };
    const { result } = renderNavigation();
    await act(async () => { result.current.navigate('/solutions?source=entry#start'); });
    expect(browserCalls).toEqual([{ method: 'assign', value: 'https://elevenidllc.com/solutions?source=entry#start' }]);
    expect(result.current.location.pathname).toBe('/product');
  });

  it.each([false, true])('keeps fragment-only navigation local (configured alias: %s)', async (configured) => {
    if (configured) window.__MARTY_RUNTIME_CONFIG__ = { hosting: {
      canonicalOrigin: 'https://elevenidllc.com', publicEntryOrigins: [window.location.origin],
    } };
    const { result } = renderNavigation();
    await act(async () => { result.current.navigate('#details'); });
    expect(pathOf(result.current.location)).toBe('/product#details');
    expect(redirectBrowser).not.toHaveBeenCalled();
    expect(browserCalls).toEqual([]);
  });
});
