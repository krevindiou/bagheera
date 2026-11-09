// A step between the page background (0) and the accent (100), so every
// shade in the backgrounds follows the theme.
export const tint = (accentPct: number) =>
  `color-mix(in srgb, var(--accent) ${Math.round(accentPct)}%, var(--bg))`;
