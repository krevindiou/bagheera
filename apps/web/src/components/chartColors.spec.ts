import { describe, expect, it } from 'vitest';
import { colorForCurrency, colorForLabel, SYNTHESIS_COLORS } from './chartColors';

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

describe('colorForLabel', () => {
  it('is deterministic — the same label always gets the same color', () => {
    expect(colorForLabel('Food')).toBe(colorForLabel('Food'));
  });

  it('always returns a color from the shared palette', () => {
    expect(SYNTHESIS_COLORS).toContain(colorForLabel('Food'));
  });

  it('agrees with colorForCurrency for the same string, since it is the same hash', () => {
    expect(colorForLabel('EUR')).toBe(colorForCurrency('EUR'));
  });
});
