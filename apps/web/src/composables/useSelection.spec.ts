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

  describe('toggleAll', () => {
    it('selects every given id from an empty or partial selection', () => {
      const { selectedIdList, toggleSelected, toggleAll } = useSelection();
      toggleSelected('a');
      toggleAll(['a', 'b']);
      expect(selectedIdList.value).toEqual(['a', 'b']);
    });

    it('clears the selection once every given id is already selected', () => {
      const { selectedIdList, toggleAll } = useSelection();
      toggleAll(['a', 'b']);
      toggleAll(['a', 'b']);
      expect(selectedIdList.value).toEqual([]);
    });
  });

  describe('allSelectState', () => {
    it('is neither checked nor indeterminate when nothing is selected', () => {
      const { allSelectState } = useSelection();
      expect(allSelectState(['a', 'b'])).toEqual({ checked: false, indeterminate: false });
    });

    it('is indeterminate once some, but not all, of the given ids are selected', () => {
      const { toggleSelected, allSelectState } = useSelection();
      toggleSelected('a');
      expect(allSelectState(['a', 'b'])).toEqual({ checked: false, indeterminate: true });
    });

    it('is checked once every given id is selected', () => {
      const { toggleAll, allSelectState } = useSelection();
      toggleAll(['a', 'b']);
      expect(allSelectState(['a', 'b'])).toEqual({ checked: true, indeterminate: false });
    });

    it('is neither checked nor indeterminate for an empty id list', () => {
      const { allSelectState } = useSelection();
      expect(allSelectState([])).toEqual({ checked: false, indeterminate: false });
    });
  });
});
