export type PagerItem = number | 'gap';

// How many pages sit on each side of the current one.
const SIBLINGS = 2;
// First page, last page, the current page with its siblings, and the two
// gaps between them: every layout below uses this many slots, so the bar
// keeps one width as the user pages through.
const SLOTS = SIBLINGS * 2 + 5;

function range(from: number, to: number): number[] {
  return Array.from({ length: to - from + 1 }, (_, i) => from + i);
}

/**
 * The page numbers to show for `page` of `pageCount`, with `'gap'` standing
 * for the pages left out. The first and last page always show; a gap never
 * hides a single page (that one is shown instead).
 */
export function pagerItems(page: number, pageCount: number): PagerItem[] {
  if (pageCount <= SLOTS) return range(1, pageCount);

  const nearStart = page <= SIBLINGS + 3;
  const nearEnd = page >= pageCount - SIBLINGS - 2;
  // Slots left for numbers once the edge page and the gap are placed.
  const run = SLOTS - 2;

  if (nearStart) return [...range(1, run), 'gap', pageCount];
  if (nearEnd) return [1, 'gap', ...range(pageCount - run + 1, pageCount)];
  return [1, 'gap', ...range(page - SIBLINGS, page + SIBLINGS), 'gap', pageCount];
}
