import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router';
import { DemoReleasePage, DemoScenarioPage } from '../../ui/src/components/pages/DemoPages.jsx';
import { DEMO_INDEX, DEMO_MANIFESTS } from '../../ui/src/generated/demoManifests.generated.js';

const version = '2026.08.0';
const archive = DEMO_MANIFESTS[version];
const retired = ['canvas-learning-achievement', 'external-evidence-to-credential'];
const retained = archive.scenarios.find(s => !retired.includes(s.slug));

beforeEach(() => {
  delete window.__ELEVENID_PRERENDER__;
  vi.stubGlobal('fetch', vi.fn(async url => ({ ok: true,
    json: async () => structuredClone(String(url).endsWith('/index.json') ? DEMO_INDEX : archive),
  })));
});
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

it('renders the real release catalog without provider cards while retaining platform cards', async () => {
  render(<MemoryRouter initialEntries={['/demos/' + version]}><Routes>
    <Route path="/demos/:stackVersion" element={<DemoReleasePage />} />
  </Routes></MemoryRouter>);
  expect((await screen.findAllByText(retained.title)).length).toBeGreaterThan(0);
  for (const slug of retired) {
    const scenario = archive.scenarios.find(s => s.slug === slug);
    expect(screen.queryByText(scenario.title)).toBeNull();
    expect(document.querySelector(`a[href$="/${slug}"]`)).toBeNull();
  }
});

it.each(retired)('settles a direct retired scenario route %s without rendering its detail or media', async slug => {
  render(<MemoryRouter initialEntries={['/demos/' + version + '/' + slug]}><Routes>
    <Route path="/demos/:stackVersion/:scenario" element={<DemoScenarioPage />} />
  </Routes></MemoryRouter>);
  expect(await screen.findByText(/This scenario is not part of ElevenID LLC/)).toBeTruthy();
  expect(screen.queryByText(archive.scenarios.find(s => s.slug === slug).title)).toBeNull();
  expect(document.querySelector('iframe')).toBeNull();
});
