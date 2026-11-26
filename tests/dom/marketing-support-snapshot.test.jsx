import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { createTheme, ThemeProvider } from '@mui/material/styles';
import MarketingProtocolSupportCatalog from '../../ui/src/components/pages/MarketingProtocolSupportCatalog.jsx';

afterEach(() => { cleanup(); delete window.__MARTY_RUNTIME_CONFIG__; });
const mount = () => render(<ThemeProvider theme={createTheme()}>
  <MarketingProtocolSupportCatalog />
</ThemeProvider>);

describe('historical marketing support snapshot', () => {
  it('separates the old snapshot from current agent capabilities before it is expanded', () => {
    mount();
    const warning = screen.getByRole('alert').textContent;
    expect(warning).toContain('Historical support snapshot');
    expect(warning).toContain('predates the latest agent identity and delegation work');
    expect(warning).toContain("Check your deployment's live catalog before integrating.");
    const summary = screen.getByText('Review historical support snapshot');
    expect(summary.tagName).toBe('SUMMARY');
    expect(summary.closest('details').open).toBe(false);
  });

  it('lets readers inspect unchanged support limits and find deployment documentation', () => {
    mount();
    fireEvent.click(screen.getByText('Review historical support snapshot'));
    const unsupported = screen.getByRole('heading', { name: 'Fixture unsupported capability' }).closest('.MuiCard-root');
    expect(within(unsupported).getByText('No product surface is represented.')).toBeTruthy();
    expect(within(unsupported).queryByText(/^API:/)).toBeNull();
    const docs = screen.getByRole('link', { name: 'deployment API documentation' });
    expect(docs.getAttribute('href')).toBe('/docs');
    expect(docs.getAttribute('target')).toBe('_blank');
    expect(docs.getAttribute('rel')).toBe('noopener noreferrer');
    expect(screen.queryByRole('link', { name: 'machine-readable catalog' })).toBeNull();
  });
});
