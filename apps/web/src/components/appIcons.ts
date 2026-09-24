type IconShape = { tag: 'path' | 'rect' | 'circle'; attrs: Record<string, string | number> };

export interface IconDef {
  viewBox: string;
  strokeWidth: number;
  shapes: IconShape[];
}

const path = (d: string): IconShape => ({ tag: 'path', attrs: { d } });

// Action and page glyphs are drawn on a 24-unit grid; the menu glyphs
// (chevron, check, logout) on a 16-unit one with their own stroke widths.
// Every icon is stroked in `currentColor`, round caps and joins.
export const ICONS = {
  plus: { viewBox: '0 0 24 24', strokeWidth: 1.75, shapes: [path('M12 5v14'), path('M5 12h14')] },
  edit: {
    viewBox: '0 0 24 24',
    strokeWidth: 1.75,
    shapes: [path('M4 20h4L20 8l-4-4L4 16v4Z'), path('M13.5 6.5l4 4')],
  },
  archive: {
    viewBox: '0 0 24 24',
    strokeWidth: 1.75,
    shapes: [
      { tag: 'rect', attrs: { x: 3, y: 4, width: 18, height: 4, rx: 1 } },
      path('M5 8v10a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8'),
      path('M10 13h4'),
    ],
  },
  trash: {
    viewBox: '0 0 24 24',
    strokeWidth: 1.75,
    shapes: [
      path('M4 7h16'),
      path('M9 7V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v3'),
      path('M6 7l1 12a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-12'),
      path('M10 11v6'),
      path('M14 11v6'),
    ],
  },
  view: {
    viewBox: '0 0 24 24',
    strokeWidth: 1.75,
    shapes: [
      path('M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7Z'),
      { tag: 'circle', attrs: { cx: 12, cy: 12, r: 3 } },
    ],
  },
  hide: {
    viewBox: '0 0 24 24',
    strokeWidth: 1.75,
    shapes: [
      path('M3 3l18 18'),
      path('M10.6 5.1A10.9 10.9 0 0 1 12 5c6.5 0 10 7 10 7a17.6 17.6 0 0 1-3.1 4.1'),
      path('M6.2 6.2A17.9 17.9 0 0 0 2 12s3.5 7 10 7a10.4 10.4 0 0 0 4.2-.9'),
      path('M9.5 9.7a3 3 0 0 0 4.2 4.2'),
    ],
  },
  search: {
    viewBox: '0 0 24 24',
    strokeWidth: 1.75,
    shapes: [{ tag: 'circle', attrs: { cx: 11, cy: 11, r: 7 } }, path('M21 21l-4.3-4.3')],
  },
  trendUp: {
    viewBox: '0 0 24 24',
    strokeWidth: 1.75,
    shapes: [path('M4 16l6-6 4 4 6-8'), path('M14 6h6v6')],
  },
  trendDown: {
    viewBox: '0 0 24 24',
    strokeWidth: 1.75,
    shapes: [path('M4 8l6 6 4-4 6 8'), path('M14 18h6v-6')],
  },
  chevron: { viewBox: '0 0 16 16', strokeWidth: 1.7, shapes: [path('M4 6l4 4 4-4')] },
  check: { viewBox: '0 0 16 16', strokeWidth: 1.8, shapes: [path('M3 8.5l3.2 3.2L13 4.5')] },
  logout: {
    viewBox: '0 0 16 16',
    strokeWidth: 1.4,
    shapes: [
      path('M6 2H3a1 1 0 00-1 1v10a1 1 0 001 1h3'),
      path('M10.5 11L14 8l-3.5-3'),
      path('M14 8H6'),
    ],
  },
} satisfies Record<string, IconDef>;

export type IconName = keyof typeof ICONS;
