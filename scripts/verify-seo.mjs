import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = fileURLToPath(new URL('../', import.meta.url));
const site = 'https://flamingoauto.eu';
const sitemap = await readFile(path.join(root, 'sitemap.xml'), 'utf8');
const urls = [...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map(match => match[1]);
assert(urls.length >= 4);
assert.equal(new Set(urls).size, urls.length);
assert(!sitemap.includes('admin') && !sitemap.includes('example.com'));

for (const url of urls) {
  assert(url.startsWith(site + '/'));
  const route = new URL(url).pathname;
  const file = route === '/' ? 'index.html' : route.endsWith('/') ? route.slice(1) + 'index.html' : route.slice(1) + '.html';
  const html = await readFile(path.join(root, file), 'utf8');
  assert(html.startsWith('<!DOCTYPE html>'), file + ': doctype');
  assert.equal([...html.matchAll(/<h1[\s>]/g)].length, 1, file + ': one h1');
  assert.equal([...html.matchAll(/rel="canonical"/g)].length, 1, file + ': one canonical');
  assert(html.includes(`rel="canonical" href="${url}"`), file + ': canonical');
  assert(!html.includes('example.com'), file + ': no placeholder domain');
  assert(!html.includes('noindex'), file + ': indexable');
  assert(/<title>.+<\/title>/.test(html), file + ': title');
  assert(/name="description" content="[^\"]+"/.test(html), file + ': description');
  for (const match of html.matchAll(/type="application\/ld\+json">([\s\S]*?)<\/script>/g)) {
    const schema = JSON.parse(match[1]);
    assert.equal(schema.url, site + '/');
    assert(!schema.telephone && !schema.openingHours && !schema.sameAs, 'No unverified business details');
  }
  if (route.startsWith('/artiklid/')) {
    assert(html.includes('class="post-body"') && !html.includes('<script'), file + ': static safe article');
    assert(html.includes('#form-container'), file + ': conversion link');
  }
}
for (const [file, pair] of [['index.html', ['/', '/ru']], ['ru.html', ['/', '/ru']], ['blog-et.html', ['/blog-et', '/blog-ru']], ['blog-ru.html', ['/blog-et', '/blog-ru']]]) {
  const html = await readFile(path.join(root, file), 'utf8');
  assert(html.includes(`hreflang="et-EE" href="${site}${pair[0]}"`));
  assert(html.includes(`hreflang="ru-EE" href="${site}${pair[1]}"`));
  if (file.startsWith('blog')) {
    assert(!html.includes('blog-github.js'));
    assert(html.includes('<article class="post-card">'));
    assert.equal((html.match(/blog-cta:start/g) || []).length, 1, 'Idempotent CTA');
  }
}
// Every local static href/src on indexable pages resolves to a real file or route.
for (const url of urls) {
  const route = new URL(url).pathname;
  const file = route === '/' ? 'index.html' : route.endsWith('/') ? route.slice(1) + 'index.html' : route.slice(1) + '.html';
  const html = await readFile(path.join(root, file), 'utf8');
  for (const [, value] of html.matchAll(/(?:href|src)="([^\"]+)"/g)) {
    const target = new URL(value, url);
    if (target.origin !== site) continue;
    const p = target.pathname;
    const targetFile = p === '/' ? 'index.html' : p.endsWith('/') ? p.slice(1) + 'index.html' : path.extname(p) ? p.slice(1) : p.slice(1) + '.html';
    await readFile(path.join(root, targetFile));
  }
}
const sourceRecords = await Promise.all((await readdir(path.join(root, 'content/posts')))
  .filter(file => /^\d+\.json$/.test(file)).map(async file => JSON.parse(await readFile(path.join(root, 'content/posts', file), 'utf8'))));
const uniquePublished = new Set(sourceRecords.filter(post => post.published !== false)
  .map(post => JSON.stringify([post.locale, post.title, post.content])));
assert.equal(urls.filter(url => url.includes('/artiklid/')).length, uniquePublished.size, 'One URL per unique published source article');
console.log(`SEO verification passed for ${urls.length} pages: metadata, sitemap, language links, schema and internal links.`);
