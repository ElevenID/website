import { createInstance } from 'i18next';
import { I18nextProvider, initReactI18next } from 'react-i18next';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import { MemoryRouter, useLocation } from 'react-router';
import { render } from '@testing-library/react';

// Real translation, MUI, metadata and router implementations are retained.
export const educationI18n = createInstance();
await educationI18n.use(initReactI18next).init({
  lng: 'en', fallbackLng: 'en', ns: ['marketing'], defaultNS: 'marketing',
  resources: { en: { marketing: {} }, fixture: { marketing: {
    protocol: { heroTitle: 'Translated fixture protocol', ctaGitHub: 'Translated fixture repository' },
  } } },
  interpolation: { escapeValue: false },
});
const theme = createTheme();
function CurrentRoute() {
  const location = useLocation();
  return <output data-testid="education-current-route">{location.pathname}</output>;
}
export function mountEducationPage(Component, path) {
  return render(<I18nextProvider i18n={educationI18n}><ThemeProvider theme={theme}>
    <MemoryRouter initialEntries={[path]}><Component /><CurrentRoute /></MemoryRouter>
  </ThemeProvider></I18nextProvider>);
}
export function clearEducationMetadata() {
  document.title = '';
  document.head.querySelectorAll(
    'meta[name="description"],meta[name="keywords"],meta[property^="og:"],meta[name^="twitter:"],link[rel="canonical"],script[data-seo-jsonld="true"]',
  ).forEach((element) => element.remove());
}
export function configureEducationPublicEntry() {
  window.__MARTY_RUNTIME_CONFIG__ = {
    hosting: { canonicalOrigin: 'https://identity.example.test', publicEntryOrigins: ['https://192.0.2.10'] },
  };
}
export function educationMetadata() {
  return {
    canonical: document.head.querySelector('link[rel="canonical"]')?.getAttribute('href'),
    schema: [...document.head.querySelectorAll('script[data-seo-jsonld="true"]')]
      .flatMap((element) => JSON.parse(element.textContent)),
  };
}
export function educationGridItems(container) {
  return [...container.querySelectorAll('.MuiGrid-root:not(.MuiGrid-container)')];
}
