import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import { BrandingProvider } from '../../ui/src/contexts/BrandingContext.jsx';
import { useBranding } from '../../ui/src/hooks/useBranding.js';

const assetBase = '/_website/0123456789abcdef0123456789abcdef01234567/';
const success = (config) => ({ ok: true, json: async () => config });
const originalTitle = document.title;
function Consumer() {
  const { branding, isLoading } = useBranding();
  return <><output data-testid="status">{isLoading ? 'Loading' : 'Ready'}</output>
    <h1>{branding.appName}</h1><p>{branding.authenticatorName}</p>
    <output data-testid="color">{branding.primaryColor}</output></>;
}
const mount = () => render(<BrandingProvider><Consumer /></BrandingProvider>);
beforeEach(() => {
  window.history.replaceState(null, '', '/product');
  delete window.__MARTY_RUNTIME_CONFIG__;
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(success({})));
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  delete window.__MARTY_RUNTIME_CONFIG__;
  document.title = originalTitle;
});

describe('runtime branding integration', () => {
  it('keeps defaults available while loading, then merges deployment branding', async () => {
    let resolve;
    fetch.mockImplementation(() => new Promise((done) => { resolve = done; }));
    mount();
    expect(screen.getByTestId('status').textContent).toBe('Loading');
    expect(screen.getByRole('heading').textContent).toBe('ElevenID LLC');
    resolve(success({ appName: 'Example University', primaryColor: '#123456' }));
    await screen.findByText('Ready');
    expect(screen.getByRole('heading').textContent).toBe('Example University');
    expect(screen.getByTestId('color').textContent).toBe('#123456');
    expect(screen.getByText('ElevenID LLC Authenticator')).toBeTruthy();
    expect(fetch).toHaveBeenCalledWith(assetBase + 'config.json', undefined);
  });

  it('omits credentials on configured public-entry aliases', async () => {
    window.__MARTY_RUNTIME_CONFIG__ = { hosting: {
      canonicalOrigin: 'https://elevenidllc.com',
      publicEntryOrigins: [window.location.origin],
    } };
    mount();
    await screen.findByText('Ready');
    expect(fetch).toHaveBeenCalledWith(assetBase + 'config.json', { credentials: 'omit' });
  });

  it.each(['HTTP failure', 'network failure'])('finishes with defaults after %s', async (failure) => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    if (failure === 'HTTP failure') fetch.mockResolvedValue({ ok: false });
    else fetch.mockRejectedValue(new Error('offline'));
    mount();
    await screen.findByText('Ready');
    expect(screen.getByRole('heading').textContent).toBe('ElevenID LLC');
    expect(screen.getByTestId('color').textContent).toBe('#1976d2');
    expect(warn).toHaveBeenCalledTimes(1);
  });

  it('preserves the current public page title after branding finishes', async () => {
    document.title = 'Product | ElevenID LLC';
    fetch.mockResolvedValue(success({ appName: 'Deployment brand' }));
    mount();
    await screen.findByText('Ready');
    expect(document.title).toBe('Product | ElevenID LLC');
  });

  it('retains deployment-title behavior for a console route', async () => {
    window.history.replaceState(null, '', '/console/org');
    fetch.mockResolvedValue(success({ appName: 'Deployment brand' }));
    mount();
    await screen.findByText('Ready');
    await waitFor(() => expect(document.title).toBe('Deployment brand'));
  });
});
