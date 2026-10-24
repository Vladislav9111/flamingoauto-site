import { cp, mkdir, readFile, writeFile, rm } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = fileURLToPath(new URL('../', import.meta.url));
const output = path.join(root, '_site');
// _site is disposable build output. Never remove source records or uploads.
await rm(output, { recursive: true, force: true });
await mkdir(output, { recursive: true });

const files = [
  'index.html', 'ru.html', 'blog-et.html', 'blog-ru.html', 'blog.html',
  'privacy.html', 'privacy-ru.html', 'terms.html', 'terms-ru.html',
  '404.html', 'style.css', 'landing.css', 'reader.css', 'script.js', 'admin-secure.js',
  'favicon.svg', 'favicon.png', 'favicon.ico', 'robots.txt', 'sitemap.xml', 'language.js', 'indexnow-key.txt',
  '_headers', '_redirects', 'admin.html', 'admin/index.html',
  'heic-patch.js', 'heic-ios-patch.js', 'heic-fetch-patch.js', 'native-webp-heic-patch.js'
];
for (const file of files) {
  await mkdir(path.dirname(path.join(output, file)), { recursive: true });
  await cp(path.join(root, file), path.join(output, file));
}
for (const directory of ['static', 'assets', 'js']) {
  await cp(path.join(root, directory), path.join(output, directory), { recursive: true });
}
// Only sitemap-listed articles are published: stale or unpublished generated pages
// cannot remain live after a source post is withdrawn.
const sitemap = await readFile(path.join(root, 'sitemap.xml'), 'utf8');
for (const [, id] of sitemap.matchAll(/\/artiklid\/(\d+)\//g)) {
  await cp(path.join(root, 'artiklid', id), path.join(output, 'artiklid', id), { recursive: true });
}
if (process.argv.includes('--preview')) {
  const headersFile = path.join(output, '_headers');
  const headers = await readFile(headersFile, 'utf8');
  await writeFile(headersFile, headers.replace('# Global headers\n/*\n',
    '# Global headers\n/*\n  X-Robots-Tag: noindex, nofollow\n'));
  console.log('Preview responses use X-Robots-Tag: noindex, nofollow.');
}
console.log('Prepared _site from an explicit public-file allowlist; repository history, archives, source configuration and diagnostic pages excluded.');
