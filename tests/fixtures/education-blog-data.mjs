// The immutable blog package stays deferred. Small synthetic arrays expose
// accidental writes to an imported catalogue, including frozen-array inputs.
export const GUIDE_CHAPTERS = Object.freeze([
  Object.freeze({ id: 1, title: 'Fixture foundations', color: '#123456', icon: 'School' }),
  Object.freeze({ id: 2, title: 'Fixture empty chapter', color: '#654321', icon: 'Category' }),
  Object.freeze({ id: 3, title: 'Fixture unindexed chapter', color: '#246813', icon: 'Unknown' }),
  Object.freeze({ id: 4, title: 'Fixture advanced chapter', color: '#135724', icon: 'Code' }),
]);
const article = (order) => Object.freeze({
  order, slug: `fixture-lesson-${order}`, title: `Fixture lesson ${order}`,
});
export const GUIDE_ARTICLES_BY_CHAPTER = {};
export function resetEducationBlogFixture({ frozen = false } = {}) {
  const values = {
    1: [article(3), article(1), article(6), article(2), article(5), article(4)],
    2: [],
    4: [Object.freeze({ order: 1, slug: 'fixture-advanced', title: 'Fixture advanced lesson' })],
  };
  for (const [id, articles] of Object.entries(values)) {
    GUIDE_ARTICLES_BY_CHAPTER[id] = frozen ? Object.freeze(articles) : articles;
  }
}
resetEducationBlogFixture();
