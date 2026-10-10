import type { ScriptableContext } from 'chart.js';

// Colors are assigned by hashing the label (currency, category, …), so a
// currency reads the same on every page, whatever else shares it.
//
// Gold, indigo, wine, violet, forest, mauve: validated against the dark
// panel surface (#171220) for lightness, chroma, 3:1 contrast and
// adjacent-pair separation (ΔE 10.0 CVD / 19.1 normal). The order matters:
// wine keeps indigo and violet apart. Re-check lightness, chroma, 3:1
// contrast on #171220 and adjacent-pair ΔE before changing a value or the
// order. --green/--red are left out: they already mean credit/debit.
export const SYNTHESIS_COLORS = ['#b17834', '#0077bd', '#b7445d', '#916fd4', '#48823b', '#af578c'];

// FNV-1a, 32-bit: stable, not cryptographic.
function hashCode(value: string): number {
  let hash = 0x811c9dc5;
  for (let i = 0; i < value.length; i++) {
    hash ^= value.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}

export function colorForCurrency(currency: string): string {
  return colorForLabel(currency);
}

export function colorForLabel(label: string): string {
  return SYNTHESIS_COLORS[hashCode(label) % SYNTHESIS_COLORS.length];
}

function withAlpha(hex: string, alpha: number): string {
  const match = /^#([0-9a-f]{6})$/i.exec(hex);
  if (!match) return hex;
  const value = parseInt(match[1], 16);
  const r = (value >> 16) & 255;
  const g = (value >> 8) & 255;
  const b = value & 255;
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

// Fades the fill from the line down to transparent, rather than a flat
// wash — scriptable so Chart.js can rebuild it against the live chart area
// (canvas size/zoom changes invalidate a cached gradient).
export function verticalFillGradient(color: string, ctx: ScriptableContext<'line'>) {
  const { chartArea, ctx: canvasCtx } = ctx.chart;
  if (!chartArea) return withAlpha(color, 0.18);
  const gradient = canvasCtx.createLinearGradient(0, chartArea.top, 0, chartArea.bottom);
  gradient.addColorStop(0, withAlpha(color, 0.28));
  gradient.addColorStop(1, withAlpha(color, 0));
  return gradient;
}
