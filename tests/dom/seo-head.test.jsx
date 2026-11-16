import React, { StrictMode } from 'react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { cleanup, render } from '@testing-library/react';
import SEOHead from '../../ui/src/components/seo/SEOHead.jsx';

// Actual React effects and jsdom with the isolated build asset namespace.
const site = 'https://elevenidllc.com';
const defaultImage = site + '/_website/0123456789abcdef0123456789abcdef01234567/logo512.png';
const initial = {
  title: 'Product',
  description: 'Portable verification workflows.',
  canonicalPath: '/product',
};
const ownedSelectors = [
  'meta[name="description"]', 'meta[name="keywords"]', 'link[rel="canonical"]',
  'meta[property^="og:"]', 'meta[name^="twitter:"]', 'script[data-seo-jsonld="true"]',
].join(',');

function clearHead() {
  document.head.querySelectorAll(ownedSelectors).forEach((element) => element.remove());
  document.title = '';
}

function content(selector) {
  return document.head.querySelector(selector)?.getAttribute('content');
}

function canonical() {
  return document.head.querySelector('link[rel="canonical"]')?.getAttribute('href');
}

beforeEach(clearHead);
afterEach(() => {
  cleanup();
  clearHead();
});

describe('SEOHead DOM integration', () => {
  it('sets canonical, title, description and social tags with a revision image', () => {
    render(<SEOHead {...initial} />);
    expect(document.title).toBe('Product | ElevenID LLC');
    expect(canonical()).toBe(site + '/product');
    for (const [selector, expected] of [
      ['meta[name="description"]', initial.description],
      ['meta[property="og:site_name"]', 'ElevenID LLC'],
      ['meta[property="og:type"]', 'website'],
      ['meta[property="og:title"]', 'Product | ElevenID LLC'],
      ['meta[property="og:description"]', initial.description],
      ['meta[property="og:url"]', site + '/product'],
      ['meta[property="og:image"]', defaultImage],
      ['meta[property="og:image:alt"]', 'Product'],
      ['meta[name="twitter:card"]', 'summary_large_image'],
      ['meta[name="twitter:title"]', 'Product | ElevenID LLC'],
      ['meta[name="twitter:description"]', initial.description],
      ['meta[name="twitter:image"]', defaultImage],
    ]) expect(content(selector), selector).toBe(expected);
  });

  it('preserves explicit image overrides and restores the default when omitted', () => {
    const image = 'https://cdn.example/article.png?width=1200#preview';
    const view = render(<SEOHead {...initial} ogImage={image} />);
    expect(content('meta[property="og:image"]')).toBe(image);
    expect(content('meta[name="twitter:image"]')).toBe(image);
    view.rerender(<SEOHead {...initial} />);
    expect(content('meta[property="og:image"]')).toBe(defaultImage);
    expect(content('meta[name="twitter:image"]')).toBe(defaultImage);
  });

  it('updates existing elements on page changes without duplicate metadata', () => {
    const view = render(<SEOHead {...initial} />);
    const link = document.head.querySelector('link[rel="canonical"]');
    const next = {
      title: 'Verification | ElevenID LLC',
      description: 'Verify portable credentials.',
      canonicalPath: '/verification',
      ogType: 'article',
    };
    view.rerender(<SEOHead {...next} />);
    expect(document.title).toBe(next.title);
    expect(canonical()).toBe(site + '/verification');
    expect(content('meta[name="description"]')).toBe(next.description);
    expect(content('meta[property="og:title"]')).toBe(next.title);
    expect(content('meta[property="og:description"]')).toBe(next.description);
    expect(content('meta[property="og:url"]')).toBe(site + '/verification');
    expect(content('meta[property="og:type"]')).toBe('article');
    expect(content('meta[name="twitter:title"]')).toBe(next.title);
    expect(content('meta[name="twitter:description"]')).toBe(next.description);
    expect(document.head.querySelector('link[rel="canonical"]')).toBe(link);
    for (const selector of ['link[rel="canonical"]', 'meta[name="description"]',
      'meta[property="og:title"]', 'meta[property="og:image"]', 'meta[name="twitter:image"]']) {
      expect(document.head.querySelectorAll(selector).length, selector).toBe(1);
    }
  });

  it('adds, updates and removes the JSON-LD element as page data changes', () => {
    const first = { '@context': 'https://schema.org', '@type': 'Organization', name: 'ElevenID LLC' };
    const view = render(<SEOHead {...initial} structuredData={first} />);
    const script = document.head.querySelector('script[data-seo-jsonld="true"]');
    expect(script?.getAttribute('type')).toBe('application/ld+json');
    expect(JSON.parse(script.textContent)).toEqual(first);
    const next = { '@context': 'https://schema.org', '@type': 'Article', headline: 'A <safe> title' };
    view.rerender(<SEOHead {...initial} structuredData={next} />);
    expect(document.head.querySelector('script[data-seo-jsonld="true"]')).toBe(script);
    expect(JSON.parse(script.textContent)).toEqual(next);
    expect(document.head.querySelectorAll('script[data-seo-jsonld="true"]').length).toBe(1);
    view.rerender(<SEOHead {...initial} structuredData={null} />);
    expect(document.head.querySelector('script[data-seo-jsonld="true"]')).toBeNull();
  });

  it('updates nonempty keywords in place', () => {
    const view = render(<SEOHead {...initial} keywords={['identity', 'credentials']} />);
    const tag = document.head.querySelector('meta[name="keywords"]');
    expect(content('meta[name="keywords"]')).toBe('identity, credentials');
    view.rerender(<SEOHead {...initial} keywords={['verification']} />);
    expect(content('meta[name="keywords"]')).toBe('verification');
    expect(document.head.querySelector('meta[name="keywords"]')).toBe(tag);
    expect(document.head.querySelectorAll('meta[name="keywords"]').length).toBe(1);
  });

  it('removes old keywords when a page supplies an empty list', () => {
    const view = render(<SEOHead {...initial} keywords={['old-page']} />);
    view.rerender(<SEOHead {...initial} canonicalPath="/verification" keywords={[]} />);
    expect(document.head.querySelector('meta[name="keywords"]')).toBeNull();
  });

  it('does not carry keywords into a replacement page that omits them', () => {
    const previous = render(<SEOHead {...initial} keywords={['old-page']} />);
    previous.unmount();
    render(<SEOHead title="Resources" description="Current resources." canonicalPath="/resources" />);
    expect(canonical()).toBe(site + '/resources');
    expect(document.head.querySelector('meta[name="keywords"]')).toBeNull();
  });

  it('reuses matching head elements already present before rendering', () => {
    const description = document.createElement('meta');
    description.setAttribute('name', 'description');
    description.setAttribute('content', 'Earlier page');
    const link = document.createElement('link');
    link.setAttribute('rel', 'canonical');
    link.setAttribute('href', site + '/earlier');
    document.head.append(description, link);
    render(<SEOHead {...initial} />);
    expect(document.head.querySelector('meta[name="description"]')).toBe(description);
    expect(description.getAttribute('content')).toBe(initial.description);
    expect(document.head.querySelector('link[rel="canonical"]')).toBe(link);
    expect(link.getAttribute('href')).toBe(site + '/product');
  });

  it('keeps one copy of owned elements during React StrictMode effect replay', () => {
    const data = { '@context': 'https://schema.org', '@type': 'Organization', name: 'ElevenID LLC' };
    render(<StrictMode><SEOHead {...initial} structuredData={data} keywords={['identity']} /></StrictMode>);
    for (const selector of ['meta[name="description"]', 'meta[name="keywords"]',
      'link[rel="canonical"]', 'meta[property="og:image"]', 'meta[name="twitter:image"]',
      'script[data-seo-jsonld="true"]']) {
      expect(document.head.querySelectorAll(selector).length, selector).toBe(1);
    }
  });
});
