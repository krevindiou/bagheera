import { mount } from '@vue/test-utils';
import { describe, expect, it } from 'vitest';
import { withGlobalPlugins } from '../../test-support/withGlobalPlugins';
import ImportDropZone from './ImportDropZone.vue';

function mountZone(props: { disabled?: boolean; fileName?: string | null } = {}) {
  return mount(ImportDropZone, {
    ...withGlobalPlugins(),
    props: { disabled: false, fileName: null, ...props },
  });
}

const file = new File(['<OFX>'], 'bank.ofx');

describe('ImportDropZone', () => {
  it('reports a chosen file and clears the input so that the same file can be chosen again', async () => {
    const wrapper = mountZone();
    const input = wrapper.find('[data-testid="import-file"]');
    Object.defineProperty(input.element, 'files', { value: [file], configurable: true });

    await input.trigger('change');

    expect(wrapper.emitted('file')).toEqual([[file]]);
    expect((input.element as HTMLInputElement).value).toBe('');
  });

  it('ignores a change that holds no file', async () => {
    const wrapper = mountZone();
    await wrapper.find('[data-testid="import-file"]').trigger('change');
    expect(wrapper.emitted('file')).toBeUndefined();
  });

  it('reports a dropped file and stops highlighting', async () => {
    const wrapper = mountZone();
    const zone = wrapper.find('[data-testid="import-drop"]');
    await zone.trigger('dragover');
    expect(zone.classes()).toContain('import-drop--over');

    await zone.trigger('drop', { dataTransfer: { files: [file] } });

    expect(wrapper.emitted('file')).toEqual([[file]]);
    expect(zone.classes()).not.toContain('import-drop--over');
  });

  it('stops highlighting when the file leaves the zone', async () => {
    const wrapper = mountZone();
    const zone = wrapper.find('[data-testid="import-drop"]');
    await zone.trigger('dragenter');
    await zone.trigger('dragleave');
    expect(zone.classes()).not.toContain('import-drop--over');
  });

  it('ignores a drop that holds no file', async () => {
    const wrapper = mountZone();
    await wrapper
      .find('[data-testid="import-drop"]')
      .trigger('drop', { dataTransfer: { files: [] } });
    expect(wrapper.emitted('file')).toBeUndefined();
  });

  it('takes nothing while it is busy', async () => {
    const wrapper = mountZone({ disabled: true });
    const zone = wrapper.find('[data-testid="import-drop"]');

    await zone.trigger('dragover');
    await zone.trigger('drop', { dataTransfer: { files: [file] } });

    expect(zone.classes()).not.toContain('import-drop--over');
    expect(zone.classes()).toContain('import-drop--disabled');
    expect(wrapper.find('[data-testid="import-file"]').attributes('disabled')).toBeDefined();
    expect(wrapper.emitted('file')).toBeUndefined();
  });

  it('gives the limits of a file before there is one', () => {
    const wrapper = mountZone();
    expect(wrapper.find('[data-testid="import-limits"]').text()).toBe(
      'Up to 5 MB and 5000 rows, one account at a time.',
    );
    expect(wrapper.find('[data-testid="import-file-name"]').exists()).toBe(false);
    expect(wrapper.classes()).not.toContain('import-drop--compact');
  });

  it('shrinks to the name of the file, with a way to replace it, once there is one', () => {
    const wrapper = mountZone({ fileName: 'bank.ofx' });

    expect(wrapper.find('[data-testid="import-file-name"]').text()).toBe('File: bank.ofx');
    expect(wrapper.find('[data-testid="import-replace"]').text()).toBe('Replace file');
    expect(wrapper.find('[data-testid="import-limits"]').exists()).toBe(false);
    expect(wrapper.classes()).toContain('import-drop--compact');
  });

  it('still takes a file when it has shrunk', async () => {
    const wrapper = mountZone({ fileName: 'bank.ofx' });
    await wrapper
      .find('[data-testid="import-drop"]')
      .trigger('drop', { dataTransfer: { files: [file] } });
    expect(wrapper.emitted('file')).toEqual([[file]]);
  });

  it('accepts bank files only', () => {
    expect(mountZone().find('[data-testid="import-file"]').attributes('accept')).toBe('.ofx,.qfx');
  });
});
