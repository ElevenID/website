import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { Link, MemoryRouter, useLocation } from 'react-router';
import { createTheme, ThemeProvider } from '@mui/material/styles';
import { createInstance } from 'i18next';
import { I18nextProvider, initReactI18next } from 'react-i18next';
import FutureFeatureButton from '../../ui/src/components/FutureFeatureButton.jsx';
import PublicFooter from '../../ui/src/components/layouts/PublicFooter.jsx';
import LanguageSwitcher from '../../ui/src/components/common/LanguageSwitcher.jsx';
import WebSectionUnavailable from '../../ui/src/components/WebSectionUnavailable.jsx';
import { Section, SectionHeading } from '../../ui/src/components/landing/LandingSection.jsx';

// Independent cases with real MUI, React Router and a local i18next instance.
// No application test helpers, network backend, jest-dom, or user-event setup.
const theme = createTheme();
function CurrentRoute() {
  const { pathname } = useLocation();
  return <output data-testid="shared-route">{pathname}</output>;
}
function renderShared(children) {
  return render(<ThemeProvider theme={theme}><MemoryRouter initialEntries={['/product']}>
    {children}<CurrentRoute />
  </MemoryRouter></ThemeProvider>);
}
async function languageInstance(lng) {
  const i18n = createInstance();
  await i18n.use(initReactI18next).init({
    lng,
    fallbackLng: 'en',
    supportedLngs: ['en', 'de', 'ja', 'es', 'fr', 'nl'],
    nonExplicitSupportedLngs: true,
    resources: Object.fromEntries(['en', 'de', 'ja', 'es', 'fr', 'nl'].map(
      (language) => [language, { translation: { ready: 'ready' } }],
    )),
    react: { useSuspense: false },
    interpolation: { escapeValue: false },
  });
  return i18n;
}
beforeEach(() => {
  window.history.replaceState(null, '', '/product');
  delete window.__MARTY_RUNTIME_CONFIG__;
});
afterEach(() => {
  cleanup();
  delete window.__MARTY_RUNTIME_CONFIG__;
  vi.restoreAllMocks();
});

describe('shared website components', () => {
  it('keeps enabled feature buttons interactive', async () => {
    const onClick = vi.fn();
    renderShared(<FutureFeatureButton onClick={onClick}>Available feature</FutureFeatureButton>);
    const button = screen.getByRole('button', { name: 'Available feature' });
    expect(button.disabled).toBe(false);
    await act(async () => { fireEvent.click(button); });
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it('removes link destinations and handlers from disabled feature buttons', async () => {
    const onClick = vi.fn();
    renderShared(<FutureFeatureButton
      disabled component={Link} to="/pricing" href="/pricing" onClick={onClick}
    >Commercial scope</FutureFeatureButton>);
    const button = screen.getByRole('button', { name: 'Commercial scope' });
    expect(button.tagName).toBe('BUTTON');
    expect(button.disabled).toBe(true);
    expect(button.hasAttribute('href')).toBe(false);
    expect(button.hasAttribute('to')).toBe(false);
    expect(screen.queryByRole('link')).toBeNull();
    await act(async () => { fireEvent.click(button); });
    expect(onClick).not.toHaveBeenCalled();
    expect(screen.getByTestId('shared-route').textContent).toBe('/product');
  });

  it('renders durable footer destinations and navigates Resources within the website', async () => {
    renderShared(<PublicFooter />);
    expect(screen.getByRole('navigation', { name: 'Public site footer links' })).toBeTruthy();
    const destinations = {
      'Privacy Policy': '/privacy-policy',
      'Terms of Service': '/terms-of-service',
      Security: '/security',
      Demos: '/demos',
      Resources: '/resources',
      Contact: 'mailto:sales@elevenidllc.com',
    };
    for (const [name, href] of Object.entries(destinations)) {
      expect(screen.getByRole('link', { name }).getAttribute('href')).toBe(href);
    }
    await act(async () => { fireEvent.click(screen.getByRole('link', { name: 'Resources' })); });
    expect(screen.getByTestId('shared-route').textContent).toBe('/resources');
  });

  it('rewrites footer page destinations for the configured public-entry alias', () => {
    window.__MARTY_RUNTIME_CONFIG__ = { hosting: {
      canonicalOrigin: 'https://elevenidllc.com',
      publicEntryOrigins: [window.location.origin],
    } };
    renderShared(<PublicFooter />);
    expect(screen.getByRole('link', { name: 'Resources' }).getAttribute('href')).toBe('https://elevenidllc.com/resources');
    expect(screen.getByRole('link', { name: 'Privacy Policy' }).getAttribute('href')).toBe('https://elevenidllc.com/privacy-policy');
    expect(screen.getByRole('link', { name: 'Contact' }).getAttribute('href')).toBe('mailto:sales@elevenidllc.com');
  });

  it('hides public footer destinations when the public runtime section is disabled', () => {
    window.__MARTY_RUNTIME_CONFIG__ = { web: { enabled_sections: ['console'] } };
    renderShared(<PublicFooter />);
    expect(screen.queryByTestId('public-footer')).toBeNull();
    expect(screen.queryByRole('link')).toBeNull();
  });

  it('provides an accessible unavailable-page fallback', () => {
    renderShared(<WebSectionUnavailable />);
    expect(screen.getByRole('main').contains(screen.getByRole('heading', { level: 1, name: 'Page unavailable' }))).toBe(true);
  });

  it('preserves section semantics and heading hierarchy', () => {
    renderShared(<Section component="section" aria-label="Product overview" data-testid="overview">
      <SectionHeading subtitle="Choose the appropriate capability." divider>Capabilities</SectionHeading>
    </Section>);
    const section = screen.getByRole('region', { name: 'Product overview' });
    expect(section).toBe(screen.getByTestId('overview'));
    expect(section.contains(screen.getByRole('heading', { level: 2, name: 'Capabilities' }))).toBe(true);
    expect(section.textContent).toContain('Choose the appropriate capability.');
    expect(section.querySelector('hr')).not.toBeNull();
  });

  it('normalizes a regional language to the compact supported language label', async () => {
    const i18n = await languageInstance('de-DE');
    renderShared(<I18nextProvider i18n={i18n}><LanguageSwitcher compact /></I18nextProvider>);
    expect(screen.getByRole('combobox').textContent).toBe('DE');
    expect(screen.getByTestId('language-switcher').getAttribute('data-compact')).toBe('true');
  });

  it('offers the six supported languages and changes the actual i18next language', async () => {
    const i18n = await languageInstance('en-US');
    renderShared(<I18nextProvider i18n={i18n}><LanguageSwitcher compact /></I18nextProvider>);
    const control = screen.getByRole('combobox');
    control.focus();
    fireEvent.keyDown(control, { key: 'ArrowDown' });
    await screen.findByRole('listbox');
    expect(screen.getAllByRole('option').map((option) => option.textContent)).toEqual([
      'English', 'Deutsch', '日本語', 'Español', 'Français', 'Nederlands',
    ]);
    fireEvent.click(screen.getByRole('option', { name: '日本語' }));
    await waitFor(() => {
      expect(i18n.resolvedLanguage).toBe('ja');
      expect(screen.getByRole('combobox').textContent).toBe('JA');
    });
  });
});
