import { ref } from 'vue';
import { describe, expect, it } from 'vitest';
import { useStepBackToLastPage } from './useStepBackToLastPage';

const result = (page: number, items: unknown[], total: number) => ({
  items,
  total,
  page,
  pageSize: 20,
});

describe('useStepBackToLastPage', () => {
  it('steps back to the last page that has rows when the current page is empty', () => {
    const page = ref(3);
    useStepBackToLastPage(page, () => result(3, [], 21));
    expect(page.value).toBe(2);
  });

  it('goes to page 1 when nothing is left', () => {
    const page = ref(2);
    useStepBackToLastPage(page, () => result(2, [], 0));
    expect(page.value).toBe(1);
  });

  it('leaves a page that has rows', () => {
    const page = ref(2);
    useStepBackToLastPage(page, () => result(2, [{}], 21));
    expect(page.value).toBe(2);
  });

  it('leaves an empty first page', () => {
    const page = ref(1);
    useStepBackToLastPage(page, () => result(1, [], 0));
    expect(page.value).toBe(1);
  });

  it('ignores a result for another page than the current one', () => {
    const page = ref(3);
    useStepBackToLastPage(page, () => result(2, [], 20));
    expect(page.value).toBe(3);
  });

  it('ignores a missing result', () => {
    const page = ref(3);
    useStepBackToLastPage(page, () => undefined);
    expect(page.value).toBe(3);
  });
});
