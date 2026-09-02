import { safeHtml } from './escape-html';

describe('safeHtml', () => {
  it('leaves the static parts of the template untouched', () => {
    expect(safeHtml`Hello, world!`).toBe('Hello, world!');
  });

  it('interpolates a plain value unchanged', () => {
    expect(safeHtml`Hello, ${'Ada'}!`).toBe('Hello, Ada!');
  });

  it('escapes HTML-significant characters in an interpolated value', () => {
    expect(safeHtml`<p>${'<script>alert(1)</script>'}</p>`).toBe(
      '<p>&lt;script&gt;alert(1)&lt;/script&gt;</p>',
    );
  });

  it('escapes every interpolation, even one that looks already-safe', () => {
    const link = 'https://example.com/activate?key=abc123';
    expect(safeHtml`<a href="${link}">${link}</a>`).toBe(
      '<a href="https://example.com/activate?key=abc123">https://example.com/activate?key=abc123</a>',
    );
  });

  it('escapes quotes so an interpolated value cannot break out of an attribute', () => {
    expect(safeHtml`<a href="${'" onmouseover="alert(1)'}">link</a>`).toBe(
      '<a href="&quot; onmouseover=&quot;alert(1)">link</a>',
    );
  });

  it('handles multiple interpolations in one template', () => {
    expect(safeHtml`${'<a>'} and ${'<b>'}`).toBe('&lt;a&gt; and &lt;b&gt;');
  });

  it('does not get reformatted by prettier as embedded HTML (the reason this tag is not named `html`)', () => {
    const result = safeHtml`one two three four five six seven eight nine ten eleven twelve thirteen`;
    expect(result).not.toContain('\n');
  });
});
