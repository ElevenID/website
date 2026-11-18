import assert from 'node:assert/strict';
import { test } from 'node:test';
import { structuredDataImageUrls } from '../../scripts/lib/structured-data-assets.mjs';

test('collects nested schema image, video thumbnail, and publisher logo URLs', () => {
  const data = {
    '@graph': [
      { '@type': 'Article', image: ['/article.png', { url: '/article-2.png' }] },
      { '@type': 'VideoObject', thumbnailUrl: ['/_website/rev/poster.svg'] },
      { '@type': 'Organization', publisher: { logo: { '@type': 'ImageObject', url: '/logo.png' } } },
    ],
    mainEntityOfPage: { '@id': 'https://elevenidllc.com/blog/example' },
  };
  assert.deepEqual(structuredDataImageUrls(data), [
    '/article.png', '/article-2.png', '/_website/rev/poster.svg', '/logo.png',
  ]);
});

test('does not misclassify canonical URLs, author links, or descriptive text as image assets', () => {
  assert.deepEqual(structuredDataImageUrls({
    url: 'https://elevenidllc.com/blog/example',
    author: { url: 'https://elevenidllc.com/authors/ada' },
    description: 'image is an ordinary word',
    publisher: { name: 'ElevenID LLC' },
  }), []);
});

test('deduplicates repeated structured-data image references', () => {
  assert.deepEqual(structuredDataImageUrls({
    image: '/same.png',
    thumbnailUrl: ['/same.png', '/other.png'],
  }), ['/same.png', '/other.png']);
});
