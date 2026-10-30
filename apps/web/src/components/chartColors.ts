import type { ScriptableContext } from 'chart.js';

// The theme's --accent (Chart.js can't read CSS variables). It leads the
// charts: the member's main currency is drawn in it (see useCurrencyColors),
// and a distribution chart gives it to its first, biggest label.
export const ACCENT_COLOR = '#c2410c';

// The other currencies' color is a hash of their code, so it reads the same
// on every page, whatever else shares it. Labels within one chart are
// instead dealt LABEL_COLORS in order (see assignLabelColors), so none
// collide.
//
// Violet, cyan, teal, blue, magenta: validated against the white chart
// surface for 3:1 contrast (3.7:1 minimum) and CIEDE2000 separation — every
// pair ≥17.6 under normal vision, adjacent pairs ≥12.0 under
// protan/deutan/tritan simulation. The accent clears the same bars (5.2:1
// on white; ≥38 ΔE from each of them under normal vision, ≥12.0 under
// simulation, the tightest being magenta under tritan). It replaces the gold
// this palette used to end with, which deutan vision could not tell from it
// (3.8 ΔE). Re-check contrast on #ffffff and pair ΔE before changing a value
// or the order. No green or red: --success and --danger already mean credit
// and danger.
export const SYNTHESIS_COLORS = ['#7c3aed', '#0891b2', '#0f766e', '#1d6fe0', '#b8329e'];

// What a chart dealing colors to its labels draws from, accent first.
export const LABEL_COLORS = [ACCENT_COLOR, ...SYNTHESIS_COLORS];

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

// Distinct labels take LABEL_COLORS in order, so no two share a color until
// they run out; the rest fall back to the label hash.
export function assignLabelColors(labels: string[]): Map<string, string> {
  const colors = new Map<string, string>();
  for (const label of labels) {
    if (colors.has(label)) continue;
    colors.set(
      label,
      colors.size < LABEL_COLORS.length ? LABEL_COLORS[colors.size] : colorForLabel(label),
    );
  }
  return colors;
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
