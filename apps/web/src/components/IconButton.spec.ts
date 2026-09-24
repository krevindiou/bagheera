import { describe, expect, it } from 'vitest';
import { mount } from '@vue/test-utils';
import IconButton from './IconButton.vue';

describe('IconButton', () => {
  it('keeps the label as accessible name and tooltip, with the icon hidden', () => {
    const wrapper = mount(IconButton, { props: { icon: 'trash', label: 'Delete' } });

    expect(wrapper.attributes('aria-label')).toBe('Delete');
    expect(wrapper.attributes('title')).toBe('Delete');
    expect(wrapper.text()).toBe('');
    expect(wrapper.get('svg').attributes('aria-hidden')).toBe('true');
  });

  it('is an outline-secondary button, or outline-danger when danger', () => {
    const plain = mount(IconButton, { props: { icon: 'edit', label: 'Edit' } });
    const danger = mount(IconButton, { props: { icon: 'trash', label: 'Delete', danger: true } });

    expect(plain.classes()).toContain('btn-outline-secondary');
    expect(danger.classes()).toContain('btn-outline-danger');
  });

  it('draws a different glyph per icon name', () => {
    const shapes = (icon: 'edit' | 'view') =>
      mount(IconButton, { props: { icon, label: 'x' } })
        .get('svg')
        .html();

    expect(shapes('edit')).not.toBe(shapes('view'));
  });
});
