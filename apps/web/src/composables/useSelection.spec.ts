import { describe, expect, it } from 'vitest';
import { useSelection } from './useSelection';

describe('useSelection', () => {
  it('starts empty', () => {
    const { selectedIds, selectedIdList } = useSelection();
    expect(selectedIds.value.size).toBe(0);
    expect(selectedIdList.value).toEqual([]);
  });

  it("adds an id the first time it's toggled", () => {
    const { selectedIds, selectedIdList, toggleSelected } = useSelection();
    toggleSelected('a');
    expect(selectedIds.value.has('a')).toBe(true);
    expect(selectedIdList.value).toEqual(['a']);
  });

  it("removes an id the second time it's toggled", () => {
    const { selectedIds, toggleSelected } = useSelection();
    toggleSelected('a');
    toggleSelected('a');
    expect(selectedIds.value.has('a')).toBe(false);
  });

  it('tracks multiple ids independently', () => {
    const { selectedIdList, toggleSelected } = useSelection();
    toggleSelected('a');
    toggleSelected('b');
    toggleSelected('a');
    expect(selectedIdList.value).toEqual(['b']);
  });
});
