// Deterministic currency → color assignment, shared by every chart that
// colors a series/line by currency: the dashboard's 12-month synthesis
// chart, an account overview tile's sparkline (AccountSparkline.vue), and
// a single account's own 12-month chart (OperationsPage.vue). A currency
// must read as the same color everywhere regardless of which other
// currencies happen to share the page — a page with only one account in
// view has no visibility into the member's other currencies, so "assign
// by position among the currencies present on this page" (the first cut
// of this palette) can't stay consistent across pages. Hashing the
// currency code itself sidesteps that: same input, same color, anywhere.
//
// Categorical palette — gold, indigo, wine, violet (the theme's brand
// accent), forest, mauve — six moody/muted jewel tones chosen to match
// "FinTech Noir" rather than a bright generic-default spread (an earlier
// orange/blue/aqua/yellow/magenta pass validated fine but read as too
// loud/off-brand). Lower chroma (~0.11–0.15) than a typical bright
// categorical set, still validated with the dataviz skill's method against
// this app's actual dark panel surface (#171220): OKLCH lightness in the
// 0.48–0.67 dark band, chroma ≥ 0.10, ≥ 3:1 contrast on that surface, and
// worst-adjacent-pair separation of ΔE 10.0 simulated-CVD / 19.1
// normal-vision (targets: ≥8 / ≥15). The order is load-bearing, not
// cosmetic — indigo and violet are both cool purple-blues, so placing them
// adjacent (an earlier reorder attempt) fails CVD separation (ΔE 3.8) and
// even normal-vision separation (14.5, below the 15 floor); wine sits
// between them here specifically to keep that pair apart. Re-run
// `node scripts/validate_palette.js "<hexes>" --mode dark --surface "#171220"`
// (from the dataviz skill) before changing any value or the order —
// reordering a passing set doesn't necessarily keep it passing. Also
// deliberately skips this app's own --green/--red status colors — those
// already mean credit/success and debit/danger elsewhere (balance sign,
// dot-active), so reusing them here would make a currency's color look
// like a positive/negative signal it isn't.
export const SYNTHESIS_COLORS = ['#b17834', '#0077bd', '#b7445d', '#916fd4', '#48823b', '#af578c'];

// FNV-1a, 32-bit — small, dependency-free, good enough distribution for a
// handful of palette buckets. Not cryptographic; just needs to be stable.
function hashCode(value: string): number {
  let hash = 0x811c9dc5;
  for (let i = 0; i < value.length; i++) {
    hash ^= value.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}

export function colorForCurrency(currency: string): string {
  return SYNTHESIS_COLORS[hashCode(currency) % SYNTHESIS_COLORS.length]!;
}
