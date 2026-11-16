import { staticAssetHref } from '../../utils/staticAssetHref.js';

// Canonical site identity stays fixed; assets follow the immutable build base.
export const SITE_URL = 'https://elevenidllc.com';
export const DEFAULT_SEO_IMAGE_URL = new URL(staticAssetHref('/logo512.png'), SITE_URL).href;
