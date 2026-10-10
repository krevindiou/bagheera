import type { ScriptableContext } from 'chart.js';
import { describe, expect, it, vi } from 'vitest';
import {
  colorForCurrency,
  colorForLabel,
  SYNTHESIS_COLORS,
  verticalFillGradient,
} from './chartColors';

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

describe('verticalFillGradient', () => {
  function contextWith(chartArea: { top: number; bottom: number } | undefined) {
    const gradient = { addColorStop: vi.fn() };
    const createLinearGradient = vi.fn(() => gradient);
    const ctx = { chart: { chartArea, ctx: { createLinearGradient } } };
    return { ctx: ctx as unknown as ScriptableContext<'line'>, gradient, createLinearGradient };
  }

  it('falls back to a flat translucent fill before the chart is laid out', () => {
    const { ctx } = contextWith(undefined);
    expect(verticalFillGradient('#b17834', ctx)).toBe('rgba(177, 120, 52, 0.18)');
  });

  it('passes a non-hex color through unchanged', () => {
    const { ctx } = contextWith(undefined);
    expect(verticalFillGradient('red', ctx)).toBe('red');
  });

  it('fades from the line color to transparent across the chart area', () => {
    const { ctx, gradient, createLinearGradient } = contextWith({ top: 10, bottom: 210 });
    expect(verticalFillGradient('#0077bd', ctx)).toBe(gradient);
    expect(createLinearGradient).toHaveBeenCalledWith(0, 10, 0, 210);
    expect(gradient.addColorStop.mock.calls).toEqual([
      [0, 'rgba(0, 119, 189, 0.28)'],
      [1, 'rgba(0, 119, 189, 0)'],
    ]);
  });
});
