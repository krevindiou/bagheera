import { describe, expect, it } from 'vitest';
import { pagerItems } from './pagerItems';

describe('pagerItems', () => {
  it('lists every page while they all fit', () => {
    expect(pagerItems(1, 1)).toEqual([1]);
    expect(pagerItems(2, 3)).toEqual([1, 2, 3]);
    expect(pagerItems(5, 9)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9]);
  });

  it('collapses the far end behind a gap near the start', () => {
    expect(pagerItems(1, 13)).toEqual([1, 2, 3, 4, 5, 6, 7, 'gap', 13]);
    expect(pagerItems(5, 13)).toEqual([1, 2, 3, 4, 5, 6, 7, 'gap', 13]);
  });

  it('collapses the near end behind a gap near the end', () => {
    expect(pagerItems(13, 13)).toEqual([1, 'gap', 7, 8, 9, 10, 11, 12, 13]);
    expect(pagerItems(9, 13)).toEqual([1, 'gap', 7, 8, 9, 10, 11, 12, 13]);
  });

  it('shows two pages on each side of the current one in the middle, with a gap each way', () => {
    expect(pagerItems(7, 13)).toEqual([1, 'gap', 5, 6, 7, 8, 9, 'gap', 13]);
    expect(pagerItems(6, 20)).toEqual([1, 'gap', 4, 5, 6, 7, 8, 'gap', 20]);
  });

  it('always has the same number of slots, past the point where pages stop fitting', () => {
    for (let pageCount = 10; pageCount <= 40; pageCount++) {
      for (let page = 1; page <= pageCount; page++) {
        expect(pagerItems(page, pageCount)).toHaveLength(9);
      }
    }
  });

  it('never hides a single page behind a gap, and keeps pages ascending and the current one in view', () => {
    for (let pageCount = 10; pageCount <= 40; pageCount++) {
      for (let page = 1; page <= pageCount; page++) {
        const items = pagerItems(page, pageCount);
        expect(items[0]).toBe(1);
        expect(items.at(-1)).toBe(pageCount);
        expect(items).toContain(page);
        items.forEach((item, i) => {
          if (item !== 'gap') return;
          const before = items[i - 1] as number;
          const after = items[i + 1] as number;
          expect(after - before).toBeGreaterThan(2);
        });
      }
    }
  });
});
