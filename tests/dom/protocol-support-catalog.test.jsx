import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen, within } from '@testing-library/react';
import { createTheme, ThemeProvider } from '@mui/material/styles';
import ProtocolSupportCatalogView from '../../ui/src/components/pages/ProtocolSupportCatalogView.jsx';
import { normalizeProtocolSupportCatalog } from '../../ui/src/application/protocolSupportCatalog.js';

const revision = '0123456789abcdef0123456789abcdef01234567';
const descriptions = {
  implemented: 'Fixture direct consumer support.',
  derived: 'Fixture view derived from another capability.',
  partial: 'Fixture feature with deliberately incomplete scope.',
  unsupported: 'Fixture concept without a product surface.',
};
const entity = (id, name, level, extra = {}) => ({
  id, display_name: name, kind: 'credential',
  support_level: level, qualification: level === 'unsupported' ? 'not_applicable' : 'focused_source',
  owner_service: level === 'unsupported' ? null : 'fixture-service',
  api_paths: ['implemented', 'partial'].includes(level) ? ['/fixtures/' + id] : [],
  ui_paths: [], schema_refs: [],
  limitations: ['Synthetic fixture only: no production qualification.'],
  ...extra,
});
function fixture(overrides = {}) {
  return normalizeProtocolSupportCatalog({
    schema_version: 1,
    catalog_revision: '2026-01-15',
    discovery_path: '/v1/protocol-support',
    protocol_revision: revision,
    support_levels: descriptions,
    qualification_levels: {
      focused_source: 'Small source-focused fixture qualification only.',
      implementation_present: 'Fixture implementation present; no release qualification.',
      not_applicable: 'No product implementation to qualify.',
    },
    entities: [
      entity('issuer', 'Issuer Registry', 'implemented', {
        api_paths: ['/v1/issuers', '/v1/issuers/{id}'],
        ui_paths: ['/console/issuers', '/console/issuers/new', '/console/issuers/{id}'],
        limitations: ['Trust decisions are deployment-specific.', 'No production acceptance is implied.'],
      }),
      entity('issuance', 'Credential Issuance', 'implemented'),
      entity('search', 'Derived Search', 'derived'),
      entity('import', 'Draft Import', 'partial'),
      entity('wallet', 'Unsupported Wallet', 'unsupported'),
    ],
    ...overrides,
  });
}
const theme = createTheme();
function mount(catalog = fixture(), props = {}) {
  return render(<ThemeProvider theme={theme}>
    <ProtocolSupportCatalogView catalog={catalog} {...props} />
  </ThemeProvider>);
}
function card(name) {
  return screen.getByRole('heading', { level: 4, name }).closest('.MuiCard-root');
}
afterEach(cleanup);

describe('normalized protocol catalog presentation', () => {
  it('separates all four support groups and keeps qualification limits visible', () => {
    mount();
    for (const [label, count] of [['Implemented', 2], ['Derived', 1], ['Partial', 1], ['Unsupported', 1]]) {
      expect(screen.getByText(label + ': ' + count)).toBeTruthy();
      expect(screen.getByRole('heading', { level: 3, name: label })).toBeTruthy();
    }
    for (const description of Object.values(descriptions)) expect(screen.getByText(description)).toBeTruthy();
    expect(screen.getByText(/Qualification is shown separately and does not imply production release readiness/)).toBeTruthy();
    expect(screen.getAllByRole('heading', { level: 4 })).toHaveLength(5);
  });

  it('shows normalized qualification, first paths, remaining counts and every limitation', () => {
    mount();
    const issuer = within(card('Issuer Registry'));
    expect(issuer.getByText('credential')).toBeTruthy();
    expect(issuer.getByText('Qualification: focused source')).toBeTruthy();
    expect(issuer.getByText((_text, element) => element?.tagName === 'P'
      && element.textContent === 'API: /v1/issuers +1')).toBeTruthy();
    expect(issuer.getByText((_text, element) => element?.tagName === 'P'
      && element.textContent === 'UI: /console/issuers +2')).toBeTruthy();
    expect(issuer.getByText('Trust decisions are deployment-specific.')).toBeTruthy();
    expect(issuer.getByText('No production acceptance is implied.')).toBeTruthy();
  });

  it('keeps unsupported entities free of advertised API or UI surfaces', () => {
    mount();
    const unsupported = within(card('Unsupported Wallet'));
    expect(unsupported.queryByText(/^API:/)).toBeNull();
    expect(unsupported.queryByText(/^UI:/)).toBeNull();
    expect(unsupported.queryAllByRole('link')).toEqual([]);
    expect(unsupported.getByText('Synthetic fixture only: no production qualification.')).toBeTruthy();
    expect(screen.getByText('Unsupported: 1').closest('.MuiChip-root').classList.contains('MuiChip-outlined')).toBe(true);
  });

  it('displays the exact protocol pin and a safe separate-document catalog link', () => {
    mount();
    expect(screen.getByText(revision).tagName).toBe('CODE');
    const link = screen.getByRole('link', { name: 'machine-readable catalog' });
    expect(link.getAttribute('href')).toBe('/v1/protocol-support');
    expect(link.getAttribute('target')).toBe('_blank');
    expect(link.getAttribute('rel').split(/\s+/)).toEqual(expect.arrayContaining(['noopener', 'noreferrer']));
  });

  it('uses an explicitly supplied catalog source without changing the protocol pin', () => {
    mount(fixture(), { sourcePath: '/fixtures/support-catalog.json' });
    expect(screen.getByRole('link', { name: 'machine-readable catalog' }).getAttribute('href')).toBe('/fixtures/support-catalog.json');
    expect(screen.getByText(revision)).toBeTruthy();
  });

  it('renders untrusted display and limitation strings as text', () => {
    const display = '<script>window.catalogExecuted=true</script>';
    const limitation = '<img src=x onerror=window.catalogExecuted=true>';
    const { container } = mount(fixture({ entities: [
      entity('text', display, 'partial', { limitations: [limitation] }),
    ] }));
    expect(screen.getByRole('heading', { level: 4, name: display })).toBeTruthy();
    expect(screen.getByText(limitation)).toBeTruthy();
    expect(container.querySelector('script,img')).toBeNull();
  });

  it('tolerates an empty entity collection without inventing supported entities', () => {
    // The published schema requires an entity. This is display robustness only,
    // starting with a valid normalized fixture and then removing its entities.
    mount({ ...fixture(), entities: [] });
    for (const label of ['Implemented', 'Derived', 'Partial', 'Unsupported']) {
      expect(screen.getByText(label + ': 0')).toBeTruthy();
      expect(screen.getByRole('heading', { level: 3, name: label })).toBeTruthy();
    }
    expect(screen.queryAllByRole('heading', { level: 4 })).toEqual([]);
  });

  it('preserves responsive card sizing with the installed MUI Grid', () => {
    mount();
    for (const heading of screen.getAllByRole('heading', { level: 4 })) {
      const grid = heading.closest('.MuiGrid-root');
      expect(grid.classList.contains('MuiGrid-grid-xs-12')).toBe(true);
      expect(grid.classList.contains('MuiGrid-grid-md-6')).toBe(true);
    }
  });

  it('allows the support summary chips to wrap', () => {
    mount();
    const summary = screen.getByText('Implemented: 2').closest('.MuiStack-root');
    expect(getComputedStyle(summary).flexWrap).toBe('wrap');
  });

  it('keeps the protocol pin and source on a block metadata line', () => {
    mount();
    const metadata = screen.getByRole('link', { name: 'machine-readable catalog' }).closest('.MuiTypography-caption');
    expect(getComputedStyle(metadata).display).toBe('block');
  });

  it('aligns each entity name with its kind label', () => {
    mount();
    for (const heading of screen.getAllByRole('heading', { level: 4 })) {
      expect(getComputedStyle(heading.closest('.MuiStack-root')).alignItems).toBe('center');
    }
  });
});
