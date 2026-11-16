import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { Link, MemoryRouter, useLocation } from 'react-router';
import WebSurfaceBoundary from '../../ui/src/apps/shared/WebSurfaceBoundary.jsx';
import { redirectBrowser } from '../../ui/src/application/routing/appHandoff.js';

// Independently authored additions to the preserved upstream boundary tests.
// Real React, router, DOM and handoff helpers run; only document navigation is recorded.
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

const destination = '/verify?next=%2Fconsole%3Ftab%3Dkeys%23active#start';
function CurrentRoute() {
  const { pathname, search, hash } = useLocation();
  return <output data-testid="route">{pathname + search + hash}</output>;
}
function Fixture({ to = destination, initial = '/product', attributes = {}, onLinkClick }) {
  return <MemoryRouter initialEntries={[initial]}>
    <WebSurfaceBoundary surface="website">
      <Link to={to} {...attributes} onClick={onLinkClick}><span>Continue</span></Link>
      <CurrentRoute />
    </WebSurfaceBoundary>
  </MemoryRouter>;
}

beforeEach(() => {
  window.history.replaceState(null, '', '/product');
  delete window.__MARTY_RUNTIME_CONFIG__;
  browserCalls.length = 0;
  vi.clearAllMocks();
});
afterEach(() => { cleanup(); delete window.__MARTY_RUNTIME_CONFIG__; });

describe('WebSurfaceBoundary DOM integration', () => {
  it('finds a child anchor and hands off before Link or its bubble handler', async () => {
    const onClick = vi.fn();
    render(<Fixture onLinkClick={onClick} />);
    await act(async () => { fireEvent.click(screen.getByText('Continue'), { button: 0 }); });
    expect(redirectBrowser).toHaveBeenCalledWith(destination, { replace: false });
    expect(browserCalls).toEqual([{ method: 'assign', value: destination }]);
    expect(onClick).not.toHaveBeenCalled();
    expect(screen.getByTestId('route').textContent).toBe('/product');
  });

  it('handles an explicit self target as ordinary document navigation', async () => {
    render(<Fixture attributes={{ target: '_self' }} />);
    await act(async () => { fireEvent.click(screen.getByRole('link'), { button: 0 }); });
    expect(browserCalls).toEqual([{ method: 'assign', value: destination }]);
  });

  it('leaves an already-cancelled click alone', async () => {
    render(<Fixture />);
    const event = new MouseEvent('click', { bubbles: true, cancelable: true, button: 0 });
    event.preventDefault();
    await act(async () => { fireEvent(screen.getByRole('link'), event); });
    expect(redirectBrowser).not.toHaveBeenCalled();
    expect(screen.getByTestId('route').textContent).toBe('/product');
  });

  it.each([{ altKey: true }, { button: 2 }])('preserves additional native click forms %j', async (options) => {
    render(<Fixture />);
    const link = screen.getByRole('link');
    // Suppress jsdom's unsupported native document navigation after capture has run.
    link.addEventListener('click', (event) => event.preventDefault());
    await act(async () => { fireEvent.click(link, { button: 0, ...options }); });
    expect(redirectBrowser).not.toHaveBeenCalled();
    expect(screen.getByTestId('route').textContent).toBe('/product');
  });

  it.each([{ target: 'report' }, { download: '' }])('preserves named targets and empty download attributes %j', async (attributes) => {
    render(<Fixture attributes={attributes} />);
    const link = screen.getByRole('link');
    link.addEventListener('click', (event) => event.preventDefault());
    await act(async () => { fireEvent.click(link, { button: 0 }); });
    expect(redirectBrowser).not.toHaveBeenCalled();
  });

  it('keeps the website verification page and its query/hash in React Router', async () => {
    const to = '/verification?language=en%2Bja#examples';
    render(<Fixture to={to} />);
    await act(async () => { fireEvent.click(screen.getByRole('link'), { button: 0 }); });
    expect(redirectBrowser).not.toHaveBeenCalled();
    expect(screen.getByTestId('route').textContent).toBe(to);
  });

  it('honors the mounted document surface even on an unknown router path', async () => {
    window.history.replaceState(null, '', '/unknown');
    render(<Fixture initial="/unknown" />);
    await act(async () => { fireEvent.click(screen.getByRole('link'), { button: 0 }); });
    expect(browserCalls).toEqual([{ method: 'assign', value: destination }]);
    expect(screen.getByTestId('route').textContent).toBe('/unknown');
  });

  it('does not intercept document links after unmounting', async () => {
    const view = render(<Fixture />);
    view.unmount();
    const link = document.createElement('a');
    link.href = destination;
    link.textContent = 'Outside';
    link.addEventListener('click', (event) => event.preventDefault());
    document.body.appendChild(link);
    try {
      await act(async () => { fireEvent.click(link, { button: 0 }); });
      expect(redirectBrowser).not.toHaveBeenCalled();
    } finally { link.remove(); }
  });
});
