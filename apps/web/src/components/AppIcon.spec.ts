import { describe, expect, it } from 'vitest';
import { mount } from '@vue/test-utils';
import AppIcon from './AppIcon.vue';
import { ICONS, type IconName } from './appIcons';

describe('AppIcon', () => {
  it('draws a decorative stroked svg from the registry entry', () => {
    const svg = mount(AppIcon, { props: { name: 'edit' } }).get('svg');

    expect(svg.attributes('viewBox')).toBe('0 0 24 24');
    expect(svg.attributes('stroke')).toBe('currentColor');
    expect(svg.attributes('stroke-width')).toBe('1.75');
    expect(svg.attributes('aria-hidden')).toBe('true');
    expect(svg.findAll('path')).toHaveLength(2);
  });

  it('renders every kind of shape a registry entry declares', () => {
    expect(mount(AppIcon, { props: { name: 'archive' } }).findAll('rect')).toHaveLength(1);
    expect(mount(AppIcon, { props: { name: 'view' } }).findAll('circle')).toHaveLength(1);
  });

  it('uses each entry’s own viewBox and stroke width', () => {
    const chevron = mount(AppIcon, { props: { name: 'chevron' } }).get('svg');

    expect(chevron.attributes('viewBox')).toBe('0 0 16 16');
    expect(chevron.attributes('stroke-width')).toBe(String(ICONS.chevron.strokeWidth));
  });

  it('sets width and height only when a size is given', () => {
    const sized = mount(AppIcon, { props: { name: 'plus', size: 16 } }).get('svg');
    const unsized = mount(AppIcon, { props: { name: 'plus' } }).get('svg');

    expect(sized.attributes('width')).toBe('16');
    expect(sized.attributes('height')).toBe('16');
    expect(unsized.attributes('width')).toBeUndefined();
    expect(unsized.attributes('height')).toBeUndefined();
  });

  it('passes a class through to the svg', () => {
    const svg = mount(AppIcon, { props: { name: 'check' }, attrs: { class: 'menu-check' } });

    expect(svg.classes()).toContain('menu-check');
  });

  it.each(Object.keys(ICONS) as IconName[])('draws at least one shape for %s', (name) => {
    expect(mount(AppIcon, { props: { name } }).get('svg').element.children.length).toBeGreaterThan(
      0,
    );
  });
});
