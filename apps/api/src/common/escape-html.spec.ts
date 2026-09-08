import { safeHtml } from './escape-html';

describe('safeHtml', () => {
  it('leaves static template parts untouched', () => {
    expect(safeHtml`<p>hello</p>`).toBe('<p>hello</p>');
  });

  it('escapes every HTML-significant character in an interpolated value', () => {
    expect(safeHtml`${'&'}`).toBe('&amp;');
    expect(safeHtml`${'<'}`).toBe('&lt;');
    expect(safeHtml`${'>'}`).toBe('&gt;');
    expect(safeHtml`${'"'}`).toBe('&quot;');
    expect(safeHtml`${"'"}`).toBe('&#39;');
  });

  it('escapes a value that looks like a script tag', () => {
    expect(safeHtml`<p>${'<script>alert(1)</script>'}</p>`).toBe(
      '<p>&lt;script&gt;alert(1)&lt;/script&gt;</p>',
    );
  });

  it('escapes multiple interpolations independently, leaving the text between them alone', () => {
    expect(safeHtml`Hi ${'<Bob>'}, re: ${'"invoice"'}.`).toBe(
      'Hi &lt;Bob&gt;, re: &quot;invoice&quot;.',
    );
  });

  it('passes an already-safe value through unchanged', () => {
    expect(safeHtml`${'plain text, no markup'}`).toBe('plain text, no markup');
  });
});
