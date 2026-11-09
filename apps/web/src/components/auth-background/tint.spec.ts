import { describe, expect, it } from 'vitest';
import { tint } from './tint';

describe('tint', () => {
  it('mixes the accent into the page background by the given share', () => {
    expect(tint(40)).toBe('color-mix(in srgb, var(--accent) 40%, var(--bg))');
  });

  it('rounds to a whole percentage', () => {
    expect(tint(12.6)).toBe('color-mix(in srgb, var(--accent) 13%, var(--bg))');
  });
});
