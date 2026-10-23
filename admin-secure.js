const login = document.getElementById('admin-login');
const editor = document.getElementById('article-editor');
const message = document.getElementById('admin-status');
const list = document.getElementById('articles');
let current = null;
const status = value => { message.textContent = value; };

async function api(endpoint, options = {}) {
  const response = await fetch('/.netlify/functions/' + endpoint, { credentials: 'same-origin', ...options });
  if (response.status === 401) { login.hidden = false; editor.hidden = true; throw new Error('Войдите в админку.'); }
  if (!response.ok) throw new Error(response.status === 429 ? 'Слишком много запросов. Подождите минуту.' : 'Сервис недоступен. Проверьте настройки или попробуйте позже.');
  return response.json();
}
async function refresh() {
  const { posts } = await api('admin-posts');
  list.replaceChildren();
  for (const post of posts) {
    const item = document.createElement('li');
    const button = document.createElement('button');
    button.type = 'button';
    button.textContent = `[${post.locale}] ${post.title}`;
    button.addEventListener('click', async () => {
      try {
        current = await api('admin-posts?id=' + encodeURIComponent(post.id));
        for (const key of ['title', 'excerpt', 'content', 'locale']) editor.elements[key].value = current[key] || '';
        status('Статья загружена.');
      } catch (error) { status(error.message); }
    });
    item.append(button);
    list.append(item);
  }
}
login.addEventListener('submit', async event => {
  event.preventDefault();
  const password = login.elements.password.value;
  login.elements.password.value = '';
  try {
    await api('admin-session', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ password }) });
    login.hidden = true;
    editor.hidden = false;
    status('Вход выполнен.');
    await refresh();
  } catch (error) { status(error.message); }
});
document.getElementById('admin-logout').addEventListener('click', async () => {
  try {
    await api('admin-session', { method: 'DELETE' });
    current = null;
    editor.reset();
    editor.hidden = true;
    list.replaceChildren();
    login.hidden = false;
    status('Вы вышли.');
  } catch (error) { status(error.message); }
});
document.getElementById('new-article').addEventListener('click', () => { current = null; editor.reset(); status('Новая статья.'); });
editor.addEventListener('submit', async event => {
  event.preventDefault();
  const button = document.getElementById('save-article');
  button.disabled = true;
  try {
    const data = Object.fromEntries(['title', 'excerpt', 'content', 'locale'].map(key => [key, editor.elements[key].value]));
    if (current) { data.id = current.id; data.sha = current.sha; }
    const result = await api('admin-posts', { method: current ? 'PUT' : 'POST',
      headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) });
    current = { ...data, id: result.id, sha: result.sha };
    status('Статья сохранена. Публикация зависит от настроек сайта.');
    await refresh();
  } catch (error) { status(error.message); }
  finally { button.disabled = false; }
});
api('admin-session').then(async () => {
  login.hidden = true;
  editor.hidden = false;
  await refresh();
}).catch(() => { login.hidden = false; editor.hidden = true; });
