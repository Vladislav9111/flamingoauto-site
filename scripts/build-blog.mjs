import { readFile, writeFile, readdir, mkdir } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = fileURLToPath(new URL('../', import.meta.url));
const site = 'https://flamingoauto.eu';
const escape = value => String(value ?? '').replace(/[&<>"']/g, c => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
})[c]);
const copy = {
  et: { blog: 'Auto müügi nõuanded', read: 'Loe artiklit', back: 'Tagasi blogisse',
    cta: 'Saada auto andmed', home: '/', empty: 'Artikleid pole veel avaldatud.' },
  ru: { blog: 'Советы по продаже автомобиля', read: 'Читать статью', back: 'Вернуться в блог',
    cta: 'Отправить данные автомобиля', home: '/ru', empty: 'Пока нет опубликованных статей.' }
};

// Source JSON is retained, including duplicate and unpublished records.
// No network calls, tokens or visitor-side GitHub API requests are needed.
const records = [];
const seen = new Set();
for (const file of (await readdir(path.join(root, 'content/posts'))).sort()) {
  if (!/^\d+\.json$/.test(file)) continue;
  const post = JSON.parse(await readFile(path.join(root, 'content/posts', file), 'utf8'));
  if (post.published === false) continue;
  if (!copy[post.locale] || typeof post.content !== 'string' || !post.title) {
    throw new Error(`Unsupported published post: ${file}`);
  }
  const key = createHash('sha256').update(`${post.locale}\n${post.title}\n${post.content}`).digest('hex');
  if (seen.has(key)) continue;
  seen.add(key);
  const date = new Date(post.created || post.date);
  if (Number.isNaN(date.valueOf())) throw new Error(`Missing post date: ${file}`);
  records.push({ ...post, id: file.replace('.json', ''), date: date.toISOString().slice(0, 10) });
}
records.sort((a, b) => b.date.localeCompare(a.date) || a.id.localeCompare(b.id));

const articleUrl = post => `/artiklid/${post.id}/`;
const generated = [];
for (const locale of Object.keys(copy)) {
  const t = copy[locale];
  const posts = records.filter(post => post.locale === locale);
  const filename = path.join(root, `blog-${locale}.html`);
  let template = await readFile(filename, 'utf8');
  // Also accepts the original empty container on the first build.
  const listPattern = /<!-- static-posts:start -->[\s\S]*?<!-- static-posts:end -->|<!-- dynamic posts will be injected here -->\s*<div id="posts-container"[^>]*><\/div>/;
  if (!listPattern.test(template)) throw new Error(`Missing post-list marker: ${filename}`);
  const cards = posts.map(post => `<article class="post-card">
    <h2><a href="${articleUrl(post)}">${escape(post.title)}</a></h2>
    <time datetime="${post.date}">${new Date(post.date).toLocaleDateString(locale === 'et' ? 'et-EE' : 'ru-RU', { timeZone: 'UTC' })}</time>
    <p>${escape(post.excerpt)}</p><a href="${articleUrl(post)}">${t.read}</a>
  </article>`).join('\n');
  template = template.replace(listPattern, `<!-- static-posts:start -->\n<div id="posts-container">${cards || `<p>${t.empty}</p>`}</div>\n<!-- static-posts:end -->`);
  template = template.replace(/\s*<script[^>]*src="(?:blog-github\.js|https:\/\/unpkg\.com\/heic2any[^\"]*|\/assets\/js\/ios-heic-handler\.js)"[^>]*><\/script>/g, '');
  template = template.replace(/<!-- fallback for no posts -->[\s\S]*?<\/div>/, '');
  template = template.replace(/<h1>[^<]*<\/h1>/, `<h1>${t.blog}</h1>`);
  template = template.replace(/<\/main>/, `<!-- blog-cta:start --><p class="article-cta"><a class="btn" href="${t.home}#form-container">${t.cta}</a></p><!-- blog-cta:end -->\n</main>`)
    .replace(/(<!-- blog-cta:start -->[\s\S]*?<!-- blog-cta:end -->)\s*(?=<!-- blog-cta:start -->)/g, '');
  await writeFile(filename, template);

  for (const post of posts) {
    const url = articleUrl(post);
    const directory = path.join(root, url.slice(1));
    await mkdir(directory, { recursive: true });
    // Plain-text source is escaped rather than interpreted as trusted HTML.
    // No review, rating, phone number or legal-business details are invented.
    const article = `<!DOCTYPE html>
<html lang="${locale}">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>${escape(post.title)} | Flamingo Auto</title>
  <meta name="description" content="${escape((post.excerpt || post.content).slice(0, 180))}">
  <link rel="canonical" href="${site}${url}">
  <meta name="robots" content="index, follow">
  <meta property="og:type" content="article">
  <meta property="og:title" content="${escape(post.title)}">
  <meta property="og:url" content="${site}${url}">
  <link rel="icon" type="image/svg+xml" href="/favicon.svg">
  <link rel="stylesheet" href="/style.css">
</head>
<body>
  <header class="site-header"><div class="container"><a class="logo" href="${t.home}">FLAMINGO AUTO</a></div></header>
  <main class="container article-content">
    <nav aria-label="${escape(t.back)}"><a href="/blog-${locale}">${t.back}</a></nav>
    <article><h1>${escape(post.title)}</h1><time datetime="${post.date}">${post.date}</time>
    <div class="post-body">${escape(post.content)}</div></article>
    <p class="article-cta"><a class="btn" href="${t.home}#form-container">${t.cta}</a></p>
  </main>
  <footer class="site-footer"><div class="container">Flamingo Auto · <a href="/blog-${locale}">${t.blog}</a></div></footer>
</body>
</html>
`;
    await writeFile(path.join(directory, 'index.html'), article);
    generated.push(url);
  }
}

const urls = ['/', '/ru', '/blog-et', '/blog-ru', ...generated.sort()];
await writeFile(path.join(root, 'sitemap.xml'), `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.map(url => `  <url><loc>${site}${url}</loc></url>`).join('\n')}
</urlset>
`);
console.log(`Generated ${generated.length} static articles and ${urls.length} sitemap URLs; source records retained.`);
