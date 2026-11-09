import { beforeEach, describe, expect, it, vi } from 'vitest';
import { mount } from '@vue/test-utils';

// Fresh module per test: the intro flag lives at module scope.
async function loadStream() {
  return (await import('./StreamBackground.vue')).default;
}

describe('StreamBackground', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it('is decorative only', async () => {
    const svg = mount(await loadStream()).find('svg');
    expect(svg.attributes('aria-hidden')).toBe('true');
    expect(svg.attributes('focusable')).toBe('false');
  });

  it('draws one tinted band per layer', async () => {
    const paths = mount(await loadStream()).findAll('path');
    expect(paths).toHaveLength(4);
    for (const path of paths) {
      expect(path.attributes('d')).toMatch(/^M.* Z$/);
      expect(path.attributes('fill')).toMatch(/^color-mix\(/);
    }
  });

  it('plays the intro on the first guest page only', async () => {
    const Stream = await loadStream();
    expect(mount(Stream).find('svg').classes()).toContain('intro');
    expect(mount(Stream).find('svg').classes()).not.toContain('intro');
  });
});
