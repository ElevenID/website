const IMAGE_FIELDS = new Set(['image', 'thumbnailUrl', 'logo']);

export function structuredDataImageUrls(value) {
  const urls = [];
  const visit = (node, field = '') => {
    if (node === null || node === undefined) return;
    if (Array.isArray(node)) {
      node.forEach((item) => visit(item, field));
      return;
    }
    if (typeof node === 'string') {
      if (IMAGE_FIELDS.has(field)) urls.push(node);
      return;
    }
    if (typeof node !== 'object') return;
    if (IMAGE_FIELDS.has(field)) {
      if (typeof node.url === 'string') urls.push(node.url);
      if (typeof node.contentUrl === 'string') urls.push(node.contentUrl);
    }
    for (const [key, child] of Object.entries(node)) {
      if (IMAGE_FIELDS.has(field) && (key === 'url' || key === 'contentUrl')) continue;
      visit(child, key);
    }
  };
  visit(value);
  return [...new Set(urls)];
}
