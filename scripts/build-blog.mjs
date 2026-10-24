import { readFile, writeFile, readdir, mkdir } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { escape, renderArticleText, referenceLink } from './article-text.mjs';
import { postAliases } from './post-aliases.mjs';

const root = fileURLToPath(new URL('../', import.meta.url));
const site = 'https://flamingoauto.eu';
const copy = {
  et: { blog: 'Auto müügi nõuanded', read: 'Loe artiklit', back: 'Tagasi blogisse',
    cta: 'Saada auto andmed', home: '/', empty: 'Artikleid pole veel avaldatud.',
    updated: 'Uuendatud', related: 'Loe ka', references: 'Ametlik lisainfo', homeLabel: 'Avaleht', language: 'Keele valik', privacy: 'Privaatsusteave', terms: 'Kasutustingimused', privacyPath: '/privacy', termsPath: '/terms' },
  ru: { blog: 'Советы по продаже автомобиля', read: 'Читать статью', back: 'Вернуться в блог',
    cta: 'Отправить данные автомобиля', home: '/ru', empty: 'Пока нет опубликованных статей.',
    updated: 'Обновлено', related: 'Читайте также', references: 'Официальная информация', homeLabel: 'Главная', language: 'Выбор языка', privacy: 'Обработка заявок', terms: 'Условия использования', privacyPath: '/privacy-ru', termsPath: '/terms-ru' }
};

// Source JSON is retained, including duplicate and unpublished records.
// No network calls, tokens or visitor-side GitHub API requests are needed.
const records = [];
const seen = new Set();
for (const file of (await readdir(path.join(root, 'content/posts'))).sort()) {
  if (!/^\d+\.json$/.test(file)) continue;
  if (postAliases.has(file.replace('.json', ''))) continue;
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
const byId = new Map(records.map(post => [post.id, post]));
for (const post of records) {
  if (post.updated && (!/^\d{4}-\d{2}-\d{2}$/.test(post.updated) || Number.isNaN(Date.parse(post.updated)) || post.updated < post.date)) {
    throw new Error(`Invalid editorial update date: ${post.id}`);
  }
  if (post.translation) {
    const other = byId.get(post.translation);
    if (!other || other.locale === post.locale || other.translation !== post.id) {
      throw new Error(`Translation must be a reciprocal pair: ${post.id}`);
    }
  }
  for (const id of post.related || []) {
    if (!byId.has(id) || byId.get(id).locale !== post.locale || id === post.id) {
      throw new Error(`Related article must exist in the same language: ${post.id}`);
    }
  }
}
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
    ${post.updated ? `${t.updated}: ` : ''}<time datetime="${post.updated || post.date}">${new Date(post.updated || post.date).toLocaleDateString(locale === 'et' ? 'et-EE' : 'ru-RU', { timeZone: 'UTC' })}</time>
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
    const translation = byId.get(post.translation);
    const languageLinks = translation ? [post, translation].sort((a, b) => a.locale.localeCompare(b.locale))
      .map(p => `<link rel="alternate" hreflang="${p.locale}-EE" href="${site}${articleUrl(p)}">`).join('\n  ') : '';
    const related = (post.related || []).map(id => byId.get(id));
    const relatedHtml = related.length ? `<section class="article-related" aria-labelledby="related-heading"><h2 id="related-heading">${t.related}</h2><ul>${related.map(p => `<li><a href="${articleUrl(p)}">${escape(p.title)}</a></li>`).join('')}</ul></section>` : '';
    const references = (post.references || []).map(referenceLink);
    const referencesHtml = references.length ? `<section class="article-references" aria-labelledby="references-heading"><h2 id="references-heading">${t.references}</h2><ul>${references.join('')}</ul></section>` : '';
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
${languageLinks}
  <meta name="robots" content="index, follow">
  <meta property="og:type" content="article">
  <meta property="og:title" content="${escape(post.title)}">
  <meta property="og:url" content="${site}${url}">
  <meta property="og:description" content="${escape(post.excerpt || '')}">
  <link rel="icon" type="image/svg+xml" href="/favicon.svg">
  <link rel="preload" href="/static/fonts/noto-sans-v42-latin-afc7a910.woff2" as="font" type="font/woff2" crossorigin>
  <link rel="stylesheet" href="/style.css">
  <link rel="stylesheet" href="/reader.css">
</head>
<body>
  <header class="site-header"><div class="container"><div class="article-header"><a class="logo" href="${t.home}">FLAMINGO AUTO</a>${translation ? `<nav aria-label="${t.language}"><a href="${articleUrl(translation)}" lang="${translation.locale}" hreflang="${translation.locale}">${translation.locale.toUpperCase()}</a></nav>` : ''}</div></div></header>
  <main class="container article-content">
    <nav class="article-breadcrumbs" aria-label="${escape(t.back)}"><a href="${t.home}">${t.homeLabel}</a> / <a href="/blog-${locale}">${t.blog}</a></nav>
    <article><h1>${escape(post.title)}</h1><p class="article-date">${post.updated ? `${t.updated}: <time datetime="${post.updated}">${post.updated}</time>` : `<time datetime="${post.date}">${post.date}</time>`}</p>
    <div class="post-body">${renderArticleText(post.content)}</div>${referencesHtml}</article>
    ${relatedHtml}
    <p class="article-cta"><a class="btn" href="${t.home}#form-container">${t.cta}</a></p>
  </main>
  <footer class="site-footer"><div class="container">Flamingo Auto · <a href="/blog-${locale}">${t.blog}</a> · <a href="${t.privacyPath}">${t.privacy}</a> · <a href="${t.termsPath}">${t.terms}</a> · <a href="mailto:lv.tallinn@gmail.com">lv.tallinn@gmail.com</a></div></footer>
</body>
</html>
`;
    await writeFile(path.join(directory, 'index.html'), article);
    generated.push(url);
  }
}

const urls = ['/', '/ru', '/blog-et', '/blog-ru', '/privacy', '/privacy-ru', '/terms', '/terms-ru', ...generated.sort()];
await writeFile(path.join(root, 'sitemap.xml'), `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.map(url => `  <url><loc>${site}${url}</loc></url>`).join('\n')}
</urlset>
`);
console.log(`Generated ${generated.length} static articles and ${urls.length} sitemap URLs; source records retained.`);
