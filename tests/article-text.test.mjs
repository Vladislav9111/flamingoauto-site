import test from 'node:test';
import assert from 'node:assert/strict';
import { renderArticleText, referenceLink } from '../scripts/article-text.mjs';

test('article text is readable without interpreting source HTML or Markdown links', () => {
  const html = renderArticleText('## <img src=x onerror=alert(1)>\n\n- <script>bad()</script>\n- [unsafe](javascript:alert(1))\n\nText & detail');
  assert(html.includes('<h2>&lt;img'));
  assert(html.includes('<ul><li>&lt;script&gt;'));
  assert(html.includes('<p>Text &amp; detail</p>'));
  assert(!html.includes('<script') && !html.includes('<img') && !html.includes('<a'));
});

test('external article references reject executable URLs and credentials', () => {
  for (const url of ['javascript:alert(1)', 'http://example.invalid', 'https://user:password@example.invalid']) {
    assert.throws(() => referenceLink({ title: 'Reference', url }));
  }
  assert.equal(referenceLink({ title: '<official>', url: 'https://transpordiamet.ee/soiduki-ost-muuk' }),
    '<li><a href="https://transpordiamet.ee/soiduki-ost-muuk">&lt;official&gt;</a></li>');
});
