import { describe, expect, it } from 'vitest';
import { bandPath, smoothPath } from './smoothPath';

describe('smoothPath', () => {
  it('draws a single cubic between two points, its handles a sixth of the way in', () => {
    expect(
      smoothPath([
        [0, 0],
        [12, 0],
      ]),
    ).toBe('M0.0,0.0 C2.0,0.0 10.0,0.0 12.0,0.0');
  });

  it('passes through every point, one cubic per gap', () => {
    const d = smoothPath([
      [0, 0],
      [10, 20],
      [20, 5],
      [30, 15],
    ]);
    expect(d.startsWith('M0.0,0.0 ')).toBe(true);
    const ends = [...d.matchAll(/C\S+ \S+ (\S+)/g)].map((m) => m[1]);
    expect(ends).toEqual(['10.0,20.0', '20.0,5.0', '30.0,15.0']);
  });

  it('shapes each handle from the neighbouring points', () => {
    // The middle point's outgoing handle follows the line from its
    // predecessor to its successor: (20 - 0) / 6 across, (0 - 0) / 6 up.
    const d = smoothPath([
      [0, 0],
      [10, 10],
      [20, 0],
    ]);
    expect(d).toContain(' C13.3,10.0 ');
  });

  it('is only a move for a single point', () => {
    expect(smoothPath([[3, 4]])).toBe('M3.0,4.0');
  });

  it('draws nothing without points', () => {
    expect(smoothPath([])).toBe('');
  });
});

describe('bandPath', () => {
  it('runs along the top edge, back along the bottom one, and closes', () => {
    expect(
      bandPath(
        [
          [0, 0],
          [12, 0],
        ],
        [
          [0, 6],
          [12, 6],
        ],
      ),
    ).toBe('M0.0,0.0 C2.0,0.0 10.0,0.0 12.0,0.0 L12.0,6.0 C10.0,6.0 2.0,6.0 0.0,6.0 Z');
  });
});
