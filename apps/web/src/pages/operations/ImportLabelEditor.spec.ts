import { mount } from '@vue/test-utils';
import { describe, expect, it } from 'vitest';
import { withGlobalPlugins } from '../../test-support/withGlobalPlugins';
import ImportLabelEditor from './ImportLabelEditor.vue';

function mountEditor(props: Partial<InstanceType<typeof ImportLabelEditor>['$props']> = {}) {
  return mount(ImportLabelEditor, {
    ...withGlobalPlugins(),
    props: { line: 4, initialText: 'CB CARREFOUR', initialRemember: true, ...props },
    attachTo: document.body,
  });
}

describe('ImportLabelEditor', () => {
  it('starts with the given text and remember choice, and focuses the field', () => {
    const wrapper = mountEditor({ initialRemember: false });
    const input = wrapper.find('[data-testid="import-label-input"]');
    expect((input.element as HTMLInputElement).value).toBe('CB CARREFOUR');
    expect(document.activeElement).toBe(input.element);
    expect(
      (wrapper.find('[data-testid="import-label-remember"]').element as HTMLInputElement).checked,
    ).toBe(false);
    expect(input.attributes('aria-label')).toBe('Third party of row 4');
    wrapper.unmount();
  });

  it('names its buttons after what they do', () => {
    const wrapper = mountEditor();
    expect(wrapper.find('[data-testid="import-label-apply"]').text()).toBe('Apply');
    expect(wrapper.find('[data-testid="import-label-cancel"]').text()).toBe('Cancel');
    wrapper.unmount();
  });

  it('caps the text at the width of a third party', () => {
    const wrapper = mountEditor();
    expect(wrapper.find('[data-testid="import-label-input"]').attributes('maxlength')).toBe('64');
    wrapper.unmount();
  });

  it('reports the trimmed text and the remember choice when kept', async () => {
    const wrapper = mountEditor();
    await wrapper.find('[data-testid="import-label-input"]').setValue('  Carrefour ');
    await wrapper.find('[data-testid="import-label-remember"]').setValue(false);

    await wrapper.find('form').trigger('submit');

    expect(wrapper.emitted('keep')).toEqual([[{ thirdParty: 'Carrefour', remember: false }]]);
    wrapper.unmount();
  });

  it('reports a cancellation from the button and from Escape', async () => {
    const wrapper = mountEditor();
    await wrapper.find('[data-testid="import-label-cancel"]').trigger('click');
    await wrapper.find('form').trigger('keydown', { key: 'Escape' });

    expect(wrapper.emitted('cancel')).toHaveLength(2);
    wrapper.unmount();
  });
});
