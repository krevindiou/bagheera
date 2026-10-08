// Colors are assigned by hashing the label (currency, category, …), so a
// currency reads the same on every page, whatever else shares it.
//
// Gold, indigo, wine, violet, forest, mauve: validated against the dark
// panel surface (#171220) for lightness, chroma, 3:1 contrast and
// adjacent-pair separation (ΔE 10.0 CVD / 19.1 normal). The order matters:
// wine keeps indigo and violet apart. Re-run the dataviz skill's
// `node scripts/validate_palette.js "<hexes>" --mode dark --surface "#171220"`
// before changing a value or the order. --green/--red are left out: they
// already mean credit/debit.
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
