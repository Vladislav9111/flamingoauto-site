import { adminGuard, json, limitedBody } from '../lib/security.mjs';

// Scope is deliberately fixed to Flamingo Auto. Never accept a repository from a request.
const repository = 'Vladislav9111/flamingoauto-site';
async function github(suffix, options = {}) {
  if (!process.env.FLAMINGO_GITHUB_TOKEN) throw new Error('UNAVAILABLE');
  const response = await fetch(`https://api.github.com/repos/${repository}/contents/content/posts${suffix}`, {
    ...options, headers: { Authorization: `Bearer ${process.env.FLAMINGO_GITHUB_TOKEN}`,
      Accept: 'application/vnd.github+json', 'Content-Type': 'application/json',
      'X-GitHub-Api-Version': '2022-11-28' }, signal: AbortSignal.timeout(15000)
  });
  if (!response.ok) throw new Error('UPSTREAM');
  return response.json();
}
async function readPost(id) {
  const file = await github(`/${id}.json?ref=main`);
  return { sha: file.sha, post: JSON.parse(Buffer.from(file.content, 'base64').toString('utf8')) };
}
function summary(id, record) {
  const { title, content, locale, excerpt, created, author, published } = record.post;
  return { id, title, content, locale, excerpt, created, author, published, sha: record.sha };
}
export default async function handler(request) {
  if (new URL(request.url).pathname !== '/api/admin/posts') return json(404, { error: 'Not found' });
  const denial = adminGuard(request);
  if (denial) return denial;
  if (!['GET', 'POST', 'PUT'].includes(request.method)) return json(405, { error: 'Method not allowed' }, { Allow: 'GET, POST, PUT' });
  try {
    if (request.method === 'GET') {
      const id = new URL(request.url).searchParams.get('id');
      if (id) {
        if (!/^\d{13}$/.test(id)) return json(400, { error: 'Invalid id' });
        return json(200, summary(id, await readPost(id)));
      }
      const files = await github('?ref=main');
      const list = [];
      for (const file of files.filter(file => /^\d{13}\.json$/.test(file.name))) {
        const id = file.name.replace('.json', '');
        const { title, locale, created } = (await readPost(id)).post;
        list.push({ id, title, locale, created });
      }
      return json(200, { posts: list });
    }
    if (!(request.headers.get('content-type') || '').startsWith('application/json')) return json(415, { error: 'JSON required' });
    const data = JSON.parse(Buffer.from(await limitedBody(request, 100000)).toString('utf8'));
    if (typeof data.title !== 'string' || !data.title.trim() || data.title.length > 200 ||
        typeof data.content !== 'string' || !data.content.trim() || data.content.length > 40000 ||
        !['et', 'ru'].includes(data.locale) || typeof data.excerpt !== 'string' || data.excerpt.length > 500) {
      return json(400, { error: 'Invalid article' });
    }
    let id, previous = {}, sha;
    if (request.method === 'PUT') {
      if (!/^\d{13}$/.test(data.id) || typeof data.sha !== 'string') return json(400, { error: 'Invalid version' });
      id = data.id;
      const current = await readPost(id);
      if (current.sha !== data.sha) return json(409, { error: 'Article changed; reload before saving' });
      previous = current.post;
      sha = current.sha;
    } else id = String(Date.now());
    // Preserve original photos, author, publication time and other source fields on edits.
    const post = { ...previous, id: Number(id), title: data.title.trim(), content: data.content,
      excerpt: data.excerpt, locale: data.locale, created: previous.created || new Date().toISOString(),
      author: previous.author || 'Flamingo Auto', photos: previous.photos || [], published: previous.published ?? true };
    const result = await github(`/${id}.json`, { method: 'PUT', body: JSON.stringify({
      branch: 'main', message: `${sha ? 'Update' : 'Add'} Flamingo Auto article`,
      content: Buffer.from(JSON.stringify(post, null, 2)).toString('base64'), ...(sha ? { sha } : {})
    }) });
    return json(200, { success: true, id, sha: result.content.sha });
  } catch { return json(503, { error: 'Article service unavailable' }); }
}
export const config = { path: '/api/admin/posts', rateLimit: {
  windowLimit: 30, windowSize: 60, aggregateBy: ['ip', 'domain']
} };
