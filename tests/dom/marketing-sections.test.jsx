import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { MemoryRouter, useLocation } from 'react-router';
import { createTheme, ThemeProvider } from '@mui/material/styles';
import ProductCapabilitiesSection from '../../ui/src/components/landing/ProductCapabilitiesSection.jsx';
import EndUserExperienceSection from '../../ui/src/components/landing/EndUserExperienceSection.jsx';
import DeploymentModelsSection from '../../ui/src/components/landing/DeploymentModelsSection.jsx';
import ProofLabSection from '../../ui/src/components/landing/ProofLabSection.jsx';
import { journeys, DEPLOYMENT_MODELS, scenarios } from '../fixtures/marketing-section-data.mjs';

// Actual sections, shared layout, MUI, Router and public-entry helpers execute.
// Only the missing large marketing data and deployment diagram have explicit
// test boundaries. These cases do not qualify the production data or SVG.
const theme = createTheme();
const t = (_key, fallback) => typeof fallback === 'string' ? fallback : fallback?.defaultValue;
function CurrentRoute() {
  const location = useLocation();
  return <output data-testid="section-current-route">{location.pathname}</output>;
}
function ui(Component, props = {}) {
  return <ThemeProvider theme={theme}><MemoryRouter initialEntries={['/']}>
    <Component t={t} {...props} /><CurrentRoute />
  </MemoryRouter></ThemeProvider>;
}
const mount = (Component, props) => render(ui(Component, props));
function publicEntry() {
  window.__MARTY_RUNTIME_CONFIG__ = {
    hosting: { canonicalOrigin: 'https://identity.example.test', publicEntryOrigins: ['https://192.0.2.10'] },
  };
}
function expectGrid(container, sizes) {
  const items = [...container.querySelectorAll('.MuiGrid-root:not(.MuiGrid-container)')];
  expect(items.length).toBeGreaterThan(0);
  expect(items.every((item) => item.classList.contains('MuiGrid-grid-xs-12'))).toBe(true);
  for (const size of sizes) expect(container.querySelectorAll('.MuiGrid-grid-' + size).length).toBeGreaterThan(0);
}
const proofProps = (overrides = {}) => ({
  isMobile: false, activeScenario: scenarios[0], onScenarioChange: vi.fn(), onRun: vi.fn(),
  status: 'idle', result: null, requestPreview: { requested: ['badge_type'] },
  presentationData: '{"fixture":"presentation"}', ...overrides,
});
beforeEach(() => { window.history.replaceState(null, '', '/'); delete window.__MARTY_RUNTIME_CONFIG__; });
afterEach(() => { cleanup(); delete window.__MARTY_RUNTIME_CONFIG__; });

describe('product capabilities section', () => {
  it('retains bold product names and heading gutters', () => {
    mount(ProductCapabilitiesSection);
    for (const name of ['Fixture verifier', 'Fixture issuer', 'Fixture kiosk', 'Fixture authenticator']) {
      const title = screen.getByRole('heading', { name });
      expect(['700', 'bold']).toContain(getComputedStyle(title).fontWeight);
      expect(['0.35em', '7px']).toContain(getComputedStyle(title).marginBottom);
    }
  });

  it('limits featured products and deployment labels while linking every card to the website product page', () => {
    mount(ProductCapabilitiesSection);
    expect(screen.getByRole('heading', { name: 'Marty Components' })).toBeTruthy();
    expect(screen.queryByText('Fifth fixture product')).toBeNull();
    expect(screen.queryByText('Hidden third deployment')).toBeNull();
    expect(screen.getAllByRole('link', { name: 'View Details' })).toHaveLength(4);
    const links = screen.getAllByRole('link');
    expect(links).toHaveLength(5);
    expect(links.every((link) => link.getAttribute('href') === '/product')).toBe(true);
  });

  it('uses canonical DNS product links from a configured public IP entry', () => {
    publicEntry();
    mount(ProductCapabilitiesSection);
    for (const link of screen.getAllByRole('link')) {
      expect(link.getAttribute('href')).toBe('https://identity.example.test/product');
    }
  });

  it('retains four-column desktop and two-column tablet card sizing', () => {
    expectGrid(mount(ProductCapabilitiesSection).container, ['sm-6', 'md-3']);
  });
});

describe('holder journey section', () => {
  it('retains emphasis on the selected journey, viewpoints, outcome and step labels', () => {
    mount(EndUserExperienceSection, { activeExperience: journeys[0], onSelectExperience: vi.fn() });
    expect(getComputedStyle(screen.getByRole('heading', { name: 'Receive a fixture badge' })).fontWeight).toBe('800');
    for (const text of [journeys[0].holderView, journeys[0].verifierView, journeys[0].outcome, 'Choose a wallet', 'Review the request']) {
      expect(['700', 'bold']).toContain(getComputedStyle(screen.getByText(text)).fontWeight);
    }
  });

  it('emits the selected journey ID and renders the externally controlled selection', () => {
    const onSelectExperience = vi.fn();
    const view = mount(EndUserExperienceSection, { activeExperience: journeys[0], onSelectExperience });
    fireEvent.click(screen.getByRole('button', { name: 'Visitor journey' }));
    expect(onSelectExperience).toHaveBeenCalledTimes(1);
    expect(onSelectExperience).toHaveBeenCalledWith('visitor');
    expect(screen.getByRole('heading', { name: 'Receive a fixture badge' })).toBeTruthy();
    view.rerender(ui(EndUserExperienceSection, { activeExperience: journeys[1], onSelectExperience }));
    expect(screen.getByRole('heading', { name: 'Present a fixture pass' })).toBeTruthy();
    expect(screen.queryByRole('heading', { name: 'Receive a fixture badge' })).toBeNull();
  });

  it('exposes the active controlled journey to assistive technology', () => {
    mount(EndUserExperienceSection, { activeExperience: journeys[0], onSelectExperience: vi.fn() });
    expect(screen.getByRole('button', { name: 'Learner journey' }).getAttribute('aria-pressed')).toBe('true');
    expect(screen.getByRole('button', { name: 'Visitor journey' }).getAttribute('aria-pressed')).toBe('false');
  });

  it('keeps holder disclosure, verifier checks and the outcome distinct', () => {
    mount(EndUserExperienceSection, { activeExperience: journeys[0], onSelectExperience: vi.fn() });
    expect(screen.getByText('Learner - Training lab')).toBeTruthy();
    const holder = screen.getByText('Holder experience').closest('.MuiPaper-root');
    expect(within(holder).getByText('Qualification type')).toBeTruthy();
    expect(within(holder).queryByText('Expiry')).toBeNull();
    const verifier = screen.getByText('Verifier experience').closest('.MuiPaper-root');
    expect(within(verifier).getByText('Issuer trust')).toBeTruthy();
    expect(within(verifier).getByText('Expiry')).toBeTruthy();
    expect(screen.getByText('The selected fixture proof is reviewed.')).toBeTruthy();
    expect(screen.getByText('Review the requested fixture claims.')).toBeTruthy();
  });

  it('renders supplied holder text without interpreting markup', () => {
    const marker = '<img src=x onerror=window.fixtureExecuted=true>';
    const view = mount(EndUserExperienceSection, {
      activeExperience: { ...journeys[0], holderView: marker }, onSelectExperience: vi.fn(),
    });
    expect(screen.getByText(marker)).toBeTruthy();
    expect(view.container.querySelector('img,script')).toBeNull();
  });

  it('retains the journey/detail column split and nested tablet cards', () => {
    expectGrid(mount(EndUserExperienceSection, { activeExperience: journeys[0], onSelectExperience: vi.fn() }).container, ['md-5', 'md-7', 'sm-6']);
  });
});

describe('deployment model section', () => {
  it('retains the emphasis of responsibility questions and model titles', () => {
    mount(DeploymentModelsSection, { onSelectMode: vi.fn() });
    for (const text of ['Plan the operating responsibilities.', 'Who operates this fixture?', 'Customer model', 'Partner model', 'Offline model']) {
      expect(getComputedStyle(screen.getByText(text)).fontWeight).toBe('800');
    }
  });

  it.each(DEPLOYMENT_MODELS.modes)('$title emits the selected model and follows its website route', async (mode) => {
    const onSelectMode = vi.fn();
    mount(DeploymentModelsSection, { onSelectMode });
    const link = screen.getByRole('link', { name: new RegExp(mode.title) });
    expect(link.getAttribute('href')).toBe(mode.path);
    await act(async () => { fireEvent.click(link); });
    expect(onSelectMode).toHaveBeenCalledTimes(1);
    expect(onSelectMode).toHaveBeenCalledWith(mode);
    expect(screen.getByTestId('section-current-route').textContent).toBe(mode.path);
  });

  it('keeps responsibilities and the declared diagram boundary visible', () => {
    mount(DeploymentModelsSection, { onSelectMode: vi.fn() });
    expect(screen.getByText('Who operates this fixture?')).toBeTruthy();
    expect(screen.getByText('The selected fixture operator.')).toBeTruthy();
    expect(screen.getByText('Holder -> Verifier -> Decision')).toBeTruthy();
    expect(screen.getByRole('complementary', { name: 'Deferred deployment diagram' })).toBeTruthy();
  });

  it('keeps each whole-card link free of nested keyboard controls', () => {
    mount(DeploymentModelsSection, { onSelectMode: vi.fn() });
    for (const link of screen.getAllByRole('link')) {
      expect(link.querySelector('button,[role="button"],a')).toBeNull();
    }
  });

  it('uses canonical DNS destinations from a configured public IP entry', () => {
    publicEntry();
    mount(DeploymentModelsSection, { onSelectMode: vi.fn() });
    for (const mode of DEPLOYMENT_MODELS.modes) {
      expect(screen.getByRole('link', { name: new RegExp(mode.title) }).getAttribute('href'))
        .toBe('https://identity.example.test' + mode.path);
    }
  });

  it('retains the large-screen overview split and three model cards', () => {
    expectGrid(mount(DeploymentModelsSection, { onSelectMode: vi.fn() }).container, ['lg-7', 'lg-5', 'md-4']);
  });
});

describe('proof lab section', () => {
  it('retains emphasis on the scenario, channel, holder, decision and check labels', () => {
    mount(ProofLabSection, proofProps());
    expect(getComputedStyle(screen.getByRole('heading', { name: 'Synthetic badge proof' })).fontWeight).toBe('800');
    for (const text of [scenarios[0].channel, scenarios[0].holderSummary, scenarios[0].outcome, 'Fixture trust']) {
      expect(['700', 'bold']).toContain(getComputedStyle(screen.getByText(text)).fontWeight);
    }
  });

  it('shows the preview timeline without claiming a completed verification', () => {
    mount(ProofLabSection, proofProps());
    expect(screen.getByText('Preview only')).toBeTruthy();
    expect(screen.queryByTestId('proof-lab-result-chip')).toBeNull();
    expect(screen.getByText('Preview decision pending')).toBeTruthy();
    expect(screen.queryByText('Verification response')).toBeNull();
  });

  it('emits a run once and disables repeat activation while running', () => {
    const props = proofProps();
    const view = mount(ProofLabSection, props);
    fireEvent.click(screen.getByRole('button', { name: 'Run scenario verification' }));
    expect(props.onRun).toHaveBeenCalledTimes(1);
    view.rerender(ui(ProofLabSection, { ...props, status: 'running' }));
    const running = screen.getByRole('button', { name: 'Running verification...' });
    expect(running.disabled).toBe(true);
    fireEvent.click(running);
    expect(props.onRun).toHaveBeenCalledTimes(1);
  });

  it('emits a scenario ID and exposes the controlled selection', () => {
    const props = proofProps();
    mount(ProofLabSection, props);
    fireEvent.click(screen.getByRole('button', { name: 'Entry scenario' }));
    expect(props.onScenarioChange).toHaveBeenCalledTimes(1);
    expect(props.onScenarioChange).toHaveBeenCalledWith('entry');
    expect(screen.getByRole('button', { name: 'Badge scenario' }).getAttribute('aria-pressed')).toBe('true');
    expect(screen.getByRole('button', { name: 'Entry scenario' }).getAttribute('aria-pressed')).toBe('false');
  });

  it('replaces preview events with successful result checks and counts', () => {
    mount(ProofLabSection, proofProps({ result: {
      verified: true, issuer: 'did:example:fixture', presentation_summary: 'Fixture verified response',
      claims: { badge_type: 'fixture' }, checks: [
        { check_name: 'signature', details: 'Fixture signature accepted' },
        { check_name: 'issuer', details: 'Fixture issuer trusted' },
      ],
    } }));
    expect(screen.getByTestId('proof-lab-result-chip').textContent).toBe('VERIFIED');
    expect(screen.getByText('Issuer: did:example:fixture')).toBeTruthy();
    expect(screen.getByText('Checks: 2')).toBeTruthy();
    expect(screen.getByText('Claims: 1')).toBeTruthy();
    expect(screen.getByText('signature: Fixture signature accepted')).toBeTruthy();
    expect(screen.queryByText('Preview decision pending')).toBeNull();
  });

  it('shows a failed result and its actual decision detail', () => {
    mount(ProofLabSection, proofProps({ result: {
      verified: false, presentation_summary: 'Fixture rejected response',
      checks: [{ check_name: 'expiry', details: 'Fixture expired' }],
    } }));
    expect(screen.getByTestId('proof-lab-result-chip').textContent).toBe('FAILED');
    expect(screen.getByText('Fixture rejected response')).toBeTruthy();
    expect(screen.getByText('expiry: Fixture expired')).toBeTruthy();
    expect(screen.getByText('Claims: 0')).toBeTruthy();
    expect(screen.queryByText(/^Issuer:/)).toBeNull();
  });

  it('falls back to scenario guidance when a response has no checks or summary', () => {
    mount(ProofLabSection, proofProps({ result: { verified: false, checks: [] } }));
    expect(screen.getByText('Checks: 0')).toBeTruthy();
    expect(screen.getByText('Preview request prepared')).toBeTruthy();
    expect(screen.getAllByText('Fixture verification outcome')).toHaveLength(2);
  });

  it('renders request and proof previews as text without executing supplied markup', () => {
    const marker = '<img src=x onerror=window.fixtureExecuted=true>';
    const request = { requested: ['badge_type'], fixture: marker };
    const view = mount(ProofLabSection, proofProps({ requestPreview: request, presentationData: marker }));
    expect(JSON.parse(screen.getByTestId('proof-lab-request-preview').textContent)).toEqual(request);
    expect(screen.getByTestId('proof-lab-presentation-preview').textContent).toBe(marker);
    expect(view.container.querySelector('img,script')).toBeNull();
  });

  it('links the selected walkthrough through configured DNS without importing blog content', () => {
    publicEntry();
    mount(ProofLabSection, proofProps());
    expect(screen.getByRole('link', { name: 'Read the fixture walkthrough' }).getAttribute('href'))
      .toBe('https://identity.example.test/blog/fixture-badge-proof');
  });

  it('switches scenario control width when the parent supplies mobile state', () => {
    const props = proofProps({ isMobile: true });
    const view = mount(ProofLabSection, props);
    expect(screen.getByRole('button', { name: 'Badge scenario' }).classList.contains('MuiButton-fullWidth')).toBe(true);
    view.rerender(ui(ProofLabSection, { ...props, isMobile: false }));
    expect(screen.getByRole('button', { name: 'Badge scenario' }).classList.contains('MuiButton-fullWidth')).toBe(false);
  });

  it('retains the scenario/preview split and nested tablet cards', () => {
    expectGrid(mount(ProofLabSection, proofProps()).container, ['md-4', 'md-8', 'sm-6']);
  });
});
