import { afterEach, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import AppHeader from '../../ui/src/components/layouts/AppHeader.jsx';
import { DEFAULT_BRAND } from '../../ui/src/shared/web-layout/header.mjs';

afterEach(cleanup);

it('renders the general ElevenID LLC header and preserves the existing action', () => {
  const login = vi.fn();
  render(<AppHeader><button onClick={login}>Login</button></AppHeader>);
  const header = screen.getByRole('banner');
  expect(header.classList.contains('elevenid-appbar')).toBe(true);
  expect(header.querySelector('.elevenid-brand').textContent).toBe(DEFAULT_BRAND);
  expect(header.querySelectorAll('#brand-name').length).toBe(1);
  const action = within(header).getByRole('button', { name: 'Login' });
  expect(header.querySelector('.elevenid-toolbar-actions').contains(action)).toBe(true);
  fireEvent.click(action);
  expect(login).toHaveBeenCalledTimes(1);
});

it('keeps deployment branding as text and retains React theme and logo overrides', () => {
  const brand = '<img src=x onerror=alert(1)> & LLC';
  render(<AppHeader brandName={brand} primaryColor="#123456" logoUrl="/logo.svg"><a href="/login">Login</a></AppHeader>);
  const header = screen.getByRole('banner');
  expect(header.querySelector('.elevenid-brand').textContent).toBe(brand);
  expect(header.querySelector('.elevenid-brand img')).toBeNull();
  expect(header.style.getPropertyValue('--elevenid-header-primary')).toBe('#123456');
  expect(within(header).getByAltText(brand).getAttribute('src')).toBe('/logo.svg');
  expect(within(header).getByRole('link', { name: 'Login' }).getAttribute('href')).toBe('/login');
});
