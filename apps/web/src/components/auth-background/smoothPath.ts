export type Point = readonly [number, number];

const fmt = (n: number) => n.toFixed(1);

// Catmull-Rom spline through every point, written as cubic Béziers, so a
// handful of samples draws one smooth curve.
export function smoothPath(points: readonly Point[]): string {
  const first = points[0];
  if (!first) return '';
  let d = `M${fmt(first[0])},${fmt(first[1])}`;
  points.forEach((p1, i) => {
    const p2 = points[i + 1];
    if (!p2) return;
    // Past either end, the end point stands in for its missing neighbour.
    const p0 = points[i - 1] ?? p1;
    const p3 = points[i + 2] ?? p2;
    const c1x = p1[0] + (p2[0] - p0[0]) / 6;
    const c1y = p1[1] + (p2[1] - p0[1]) / 6;
    const c2x = p2[0] - (p3[0] - p1[0]) / 6;
    const c2y = p2[1] - (p3[1] - p1[1]) / 6;
    d += ` C${fmt(c1x)},${fmt(c1y)} ${fmt(c2x)},${fmt(c2y)} ${fmt(p2[0])},${fmt(p2[1])}`;
  });
  return d;
}

// A closed band between two smooth edges sampled left to right: along the
// top edge, then back along the bottom one.
export function bandPath(top: readonly Point[], bottom: readonly Point[]): string {
  const back = smoothPath([...bottom].reverse());
  return `${smoothPath(top)} L${back.slice(1)} Z`;
}
