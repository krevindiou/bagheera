import { describe, expect, it } from 'vitest';
import { colorForCurrency, SYNTHESIS_COLORS } from './chartColors';

describe('colorForCurrency', () => {
  it('is deterministic — the same currency always gets the same color', () => {
    expect(colorForCurrency('EUR')).toBe(colorForCurrency('EUR'));
  });

  it('always returns a color from the shared palette', () => {
    expect(SYNTHESIS_COLORS).toContain(colorForCurrency('EUR'));
    expect(SYNTHESIS_COLORS).toContain(colorForCurrency('USD'));
  });

  it("doesn't collide for the two currencies this app's dev data actually uses", () => {
    expect(colorForCurrency('EUR')).not.toBe(colorForCurrency('USD'));
  });
});
