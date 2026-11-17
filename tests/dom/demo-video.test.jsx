import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import DemoVideoPlayer from '../../ui/src/components/demos/DemoVideoPlayer.jsx';

// Real React/MUI rendering in jsdom; no external resources are enabled. These
// cases qualify consent/publication behavior, not YouTube playback or manifests.
const scenario = {
  slug: 'fixture-recording', scenario_revision: 1, title: 'Fixture recording',
  state: 'PUBLIC', youtube_id: 'abcdefghijk',
  poster: { src: '/demos/fixture-poster.png', alt: 'Fixture poster' },
};
const consent = () => fireEvent.click(screen.getByRole('button', { name: /Load .* from YouTube/ }));
const frame = () => document.querySelector('iframe');
afterEach(cleanup);

describe('demo recording consent', () => {
  it('shows a local versioned poster and accessible consent control before embedding', () => {
    render(<DemoVideoPlayer scenario={scenario} />);
    expect(frame()).toBeNull();
    expect(screen.getByRole('img', { name: 'Fixture poster' }).getAttribute('src')).toMatch(
      /^\/_website\/[a-f0-9]{40}\/demos\/fixture-poster\.png$/,
    );
    expect(screen.getByRole('button', { name: 'Load Fixture recording from YouTube' }).textContent).toContain('Play recording');
  });

  it('embeds only after consent, using the privacy host and current origin', () => {
    render(<DemoVideoPlayer scenario={scenario} startSeconds={37} />);
    consent();
    expect(document.querySelectorAll('iframe')).toHaveLength(1);
    const player = frame();
    const src = new URL(player.getAttribute('src'));
    expect(src.origin).toBe('https://www.youtube-nocookie.com');
    expect(src.pathname).toBe('/embed/abcdefghijk');
    expect(Object.fromEntries(src.searchParams)).toEqual({
      autoplay: '1', cc_load_policy: '1', enablejsapi: '1', playsinline: '1', rel: '0', start: '37', origin: window.location.origin,
    });
    expect(player.getAttribute('title')).toBe('Fixture recording video');
    expect(player.hasAttribute('allowfullscreen')).toBe(true);
    expect(screen.queryByRole('img')).toBeNull();
    expect(screen.queryByRole('button')).toBeNull();
  });

  it.each([
    ['DRAFT', 'Scenario in development'],
    ['VALIDATED', 'Validated demonstration'],
    ['YOUTUBE_UNLISTED', 'Recording in review'],
    ['PARTIAL', 'Recording unavailable'],
    ['unexpected-state', 'Recording unavailable'],
  ])('keeps %s recordings unavailable even when an ID exists', (state, expectedCopy) => {
    render(<DemoVideoPlayer scenario={{ ...scenario, state }} />);
    expect(frame()).toBeNull();
    expect(screen.queryByRole('button')).toBeNull();
    expect(screen.getByText(expectedCopy)).toBeTruthy();
    expect(screen.getByRole('img', { name: 'Fixture poster' })).toBeTruthy();
  });

  it('does not offer playback when a public recording lacks an ID', () => {
    render(<DemoVideoPlayer scenario={{ ...scenario, youtube_id: undefined }} />);
    expect(frame()).toBeNull();
    expect(screen.queryByRole('button')).toBeNull();
    expect(screen.getByText('Recording unavailable')).toBeTruthy();
  });

  it('keeps the unavailable recording title visually emphasized', () => {
    render(<DemoVideoPlayer scenario={{ ...scenario, state: 'DRAFT' }} />);
    expect(getComputedStyle(screen.getByText('Scenario in development')).fontWeight).toBe('700');
  });

  it('centers the unavailable recording message and status icon', () => {
    render(<DemoVideoPlayer scenario={{ ...scenario, state: 'DRAFT' }} />);
    const message = screen.getByText('Scenario in development').closest('.MuiStack-root');
    expect(message).not.toBeNull();
    expect(getComputedStyle(message).alignItems).toBe('center');
  });

  it.each([
    ['scenario identity', { slug: 'different-scenario' }],
    ['scenario revision', { scenario_revision: 2 }],
    ['recording identity', { youtube_id: 'lmnopqrstuv' }],
  ])('requires fresh consent when the %s changes', (_label, changed) => {
    const view = render(<DemoVideoPlayer scenario={scenario} />);
    consent();
    const previousPlayer = frame();
    expect(previousPlayer).not.toBeNull();
    view.rerender(<DemoVideoPlayer scenario={{ ...scenario, ...changed }} />);
    expect(previousPlayer.isConnected).toBe(false);
    expect(frame()).toBeNull();
    expect(screen.getByRole('button', { name: 'Load Fixture recording from YouTube' })).toBeTruthy();
    consent();
    expect(new URL(frame().getAttribute('src')).pathname).toBe('/embed/' + (changed.youtube_id || scenario.youtube_id));
  });

  it('resets the title-based identity when a scenario has no slug', () => {
    const withoutSlug = { ...scenario, slug: undefined };
    const view = render(<DemoVideoPlayer scenario={withoutSlug} />);
    consent();
    view.rerender(<DemoVideoPlayer scenario={{ ...withoutSlug, title: 'Another recording' }} />);
    expect(frame()).toBeNull();
    expect(screen.getByRole('button', { name: 'Load Another recording from YouTube' })).toBeTruthy();
  });

  it.each(['DRAFT', 'PARTIAL'])('removes the old player on %s and requires consent after republication', (state) => {
    const view = render(<DemoVideoPlayer scenario={scenario} />);
    consent();
    const previousPlayer = frame();
    view.rerender(<DemoVideoPlayer scenario={{ ...scenario, state }} />);
    expect(previousPlayer.isConnected).toBe(false);
    expect(frame()).toBeNull();
    expect(screen.queryByRole('button')).toBeNull();
    view.rerender(<DemoVideoPlayer scenario={scenario} />);
    expect(frame()).toBeNull();
    expect(screen.getByRole('button', { name: 'Load Fixture recording from YouTube' })).toBeTruthy();
  });

  it('preserves consent across chapter changes and replaces the old player', () => {
    const view = render(<DemoVideoPlayer scenario={scenario} startSeconds={0} />);
    consent();
    const previousPlayer = frame();
    view.rerender(<DemoVideoPlayer scenario={scenario} startSeconds={82} />);
    expect(previousPlayer.isConnected).toBe(false);
    expect(document.querySelectorAll('iframe')).toHaveLength(1);
    expect(new URL(frame().getAttribute('src')).searchParams.get('start')).toBe('82');
    expect(screen.queryByRole('button')).toBeNull();
  });

  it('uses the selected chapter when consent is granted after changing chapters', () => {
    const view = render(<DemoVideoPlayer scenario={scenario} startSeconds={0} />);
    view.rerender(<DemoVideoPlayer scenario={scenario} startSeconds={105} />);
    expect(frame()).toBeNull();
    consent();
    expect(new URL(frame().getAttribute('src')).searchParams.get('start')).toBe('105');
  });
});
