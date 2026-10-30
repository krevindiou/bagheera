import type { ScriptableContext } from 'chart.js';
import { describe, expect, it, vi } from 'vitest';
import {
  assignLabelColors,
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

describe('assignLabelColors', () => {
  it('deals palette colors in order, so labels never share one', () => {
    const labels = SYNTHESIS_COLORS.map((_, i) => `label-${i}`);
    const colors = assignLabelColors(labels);
    expect(labels.map((l) => colors.get(l))).toEqual(SYNTHESIS_COLORS);
  });

  it('gives a repeated label the color it already has', () => {
    const colors = assignLabelColors(['Leisure', 'Rent', 'Leisure']);
    expect(colors.size).toBe(2);
    expect(colors.get('Leisure')).toBe(SYNTHESIS_COLORS[0]);
    expect(colors.get('Rent')).toBe(SYNTHESIS_COLORS[1]);
  });

  it('falls back to the label hash once the palette is used up', () => {
    const labels = [...SYNTHESIS_COLORS.map((_, i) => `label-${i}`), 'Extra'];
    expect(assignLabelColors(labels).get('Extra')).toBe(colorForLabel('Extra'));
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
    expect(verticalFillGradient('#0f766e', ctx)).toBe('rgba(15, 118, 110, 0.18)');
  });

  it('passes a non-hex color through unchanged', () => {
    const { ctx } = contextWith(undefined);
    expect(verticalFillGradient('red', ctx)).toBe('red');
  });

  it('fades from the line color to transparent across the chart area', () => {
    const { ctx, gradient, createLinearGradient } = contextWith({ top: 10, bottom: 210 });
    expect(verticalFillGradient('#2b6cb0', ctx)).toBe(gradient);
    expect(createLinearGradient).toHaveBeenCalledWith(0, 10, 0, 210);
    expect(gradient.addColorStop.mock.calls).toEqual([
      [0, 'rgba(43, 108, 176, 0.28)'],
      [1, 'rgba(43, 108, 176, 0)'],
    ]);
  });
});
