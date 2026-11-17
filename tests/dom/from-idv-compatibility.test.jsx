import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { createTheme, ThemeProvider } from '@mui/material/styles';
import FromIDVPage from '../../ui/src/components/FromIDVPage.jsx';
import { BrandingContext } from '../../ui/src/contexts/BrandingContext.jsx';

const theme = createTheme();
function mount() {
  return render(<ThemeProvider theme={theme}><MemoryRouter initialEntries={['/why-verifiable-identity']}>
    <BrandingContext.Provider value={{ branding: { appName: 'Example University' }, isLoading: false }}>
      <FromIDVPage />
    </BrandingContext.Provider>
  </MemoryRouter></ThemeProvider>);
}
function clearMetadata() {
  document.title = '';
  document.head.querySelectorAll(
    'meta[name="description"],meta[name="keywords"],meta[property^="og:"],meta[name^="twitter:"],link[rel="canonical"],script[data-seo-jsonld="true"]',
  ).forEach((element) => element.remove());
}
beforeEach(() => {
  delete window.__MARTY_RUNTIME_CONFIG__;
  window.history.replaceState(null, '', '/why-verifiable-identity');
  clearMetadata();
});
afterEach(() => {
  cleanup();
  clearMetadata();
  delete window.__MARTY_RUNTIME_CONFIG__;
});

// Eleven source Typography declarations produce seventeen rendered headings.
// These cases check effective MUI styles, without asserting jsdom pixel layout.
const weights = [
  ['hero', ['Plan a Verifiable Identity Workflow']],
  ['workflow decision', ['Start with the decision your workflow must make']],
  ['wallet evaluation', ['Review wallets, formats, and acceptance requirements together']],
  ['trust responsibility', ['Make Trust Responsibilities Explicit']],
  ['infrastructure primitives', ['• Trust Profiles', '• Credential Templates', '• Presentation Policies', '• Deployment Profiles']],
  ['deployment brand', ['Evaluate Marty by Example University']],
  ['bounded evaluation', [/^Begin with synthetic data and a bounded workflow\./]],
  ['audience introduction', ['Who This Is For']],
  ['audience cards', ['Governments', 'Enterprises', 'Platforms & Issuers', 'Developers']],
  ['evaluation outcome', ['What the Evaluation Should Establish']],
  ['next evaluation', ['Define your next evaluation']],
];
const centered = [
  /^Record the tested scope, trust decisions, and known limitations for each workflow\./,
  /^Begin with synthetic data and a bounded workflow\./,
  'Who This Is For',
  'Identify the workflow owner, operating team, and acceptance requirements',
  'What the Evaluation Should Establish',
  'A recorded result for the exact release, inputs, and operating environment',
];
const paragraphs = [
  ['Identify the claim or document check', '16px'],
  ['A reusable credential may support more than one workflow', '16px'],
  ['Names such as W3C Verifiable Credentials', '16px'],
  ['Distinguish the questions your workflow asks:', '16px'],
  ['Keep structural checks, cryptographic authenticity, and holder binding distinct.', '16px'],
  ['Use these configuration concepts to describe the selected workflow:', '24px'],
  ['Connect these concepts through a defined flow.', '16px'],
  ['Use the release documentation and executed tests to evaluate the scope your organization needs:', '24px'],
];

describe('verifiable identity page MUI compatibility', () => {
  it.each(weights)('preserves the %s heading weight', (_label, names) => {
    mount();
    for (const name of names) {
      expect(['700', 'bold']).toContain(getComputedStyle(screen.getByRole('heading', { name })).fontWeight);
    }
  });

  it.each([
    ['primitive cards', ['• Trust Profiles', '• Credential Templates', '• Presentation Policies', '• Deployment Profiles'], ['xs-12', 'sm-6']],
    ['audience cards', ['Governments', 'Enterprises', 'Platforms & Issuers', 'Developers'], ['xs-12', 'sm-6', 'md-3']],
  ])('preserves responsive sizing of %s', (_label, names, sizes) => {
    mount();
    for (const name of names) {
      const grid = screen.getByRole('heading', { name }).closest('.MuiGrid-root');
      expect(grid).not.toBeNull();
      for (const size of sizes) expect(grid.classList.contains('MuiGrid-grid-' + size)).toBe(true);
    }
  });

  it.each(centered)('centers the intended heading %s', (name) => {
    mount();
    expect(getComputedStyle(screen.getByRole('heading', { name })).textAlign).toBe('center');
  });

  it.each(paragraphs)('preserves paragraph spacing for %s', (prefix, margin) => {
    mount();
    const paragraph = screen.getByText((_content, element) => element?.tagName === 'P'
      && element.textContent.replace(/\s+/g, ' ').startsWith(prefix));
    expect(getComputedStyle(paragraph).marginBottom).toBe(margin);
  });

  it('preserves the larger type for the implementation checklist', () => {
    mount();
    for (const prefix of [
      'Define the credential format, issuer, wallet, and presentation profile',
      'Test credential reuse under each verifier',
      'Configure issuer trust and policy decisions',
      'Validate the selected disclosure mechanism with synthetic data',
    ]) {
      const item = screen.getByText((_content, element) => element?.classList.contains('MuiListItemText-primary')
        && element.textContent.startsWith(prefix));
      expect(['1.05rem', '16.8px']).toContain(getComputedStyle(item).fontSize);
    }
  });
});
