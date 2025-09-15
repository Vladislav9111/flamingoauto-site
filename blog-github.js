// Простая система загрузки статей из GitHub API
const GITHUB_REPO = 'Vladislav9111/flamingoauto-site';
const GITHUB_BRANCH = 'main';
const POSTS_PATH = 'content/posts';
const MARKDOWN_PATH = 'content/blog';

// Загрузка статей через GitHub API (JSON из content/posts)
async function loadPostsFromGitHub() {
    try {
        console.log('🔄 Загружаем JSON-статьи из GitHub...');
        const response = await fetch(`https://api.github.com/repos/${GITHUB_REPO}/contents/${POSTS_PATH}`);
        if (!response.ok) {
            throw new Error(`GitHub API error: ${response.status}`);
        }
        const files = await response.json();
        const jsonFiles = files.filter(file => file.name.endsWith('.json'));
        console.log(`📁 Найдено ${jsonFiles.length} JSON файлов с постами`);
        const posts = await Promise.all(
            jsonFiles.map(async (file) => {
                try {
                    const contentResponse = await fetch(file.download_url);
                    const post = await contentResponse.json();
                    if (!post.date && post.created) {
                        post.date = post.created;
                    }
                    // По умолчанию публикация включена, если не указано иначе
                    if (typeof post.published === 'undefined') post.published = true;
                    return post;
                } catch (error) {
                    console.error(`❌ Ошибка загрузки файла ${file.name}:`, error);
                    return null;
                }
            })
        );
        const validPosts = posts.filter(post => post !== null && post.published !== false);
        console.log(`✅ Загружено ${validPosts.length} JSON-статей из GitHub`);
        return validPosts;
    } catch (error) {
        console.error('❌ Ошибка загрузки JSON-статей:', error);
        return [];
    }
}

// Парсинг markdown поста
function parseMarkdownPost(content, filename) {
    const lines = content.split('\n');
    const frontmatter = {};
    let contentStart = 0;
    if (lines[0] === '---') {
        for (let i = 1; i < lines.length; i++) {
            if (lines[i] === '---') {
                contentStart = i + 1;
                break;
            }
            const line = lines[i];
            const colonIndex = line.indexOf(':');
            if (colonIndex > -1) {
                const key = line.substring(0, colonIndex).trim();
                let value = line.substring(colonIndex + 1).trim();
                if (value.startsWith('"') && value.endsWith('"')) {
                    value = value.slice(1, -1);
                }
                frontmatter[key] = value;
            }
        }
    }
    const slug = filename.replace('.md', '');
    const bodyLines = lines.slice(contentStart);
    const description = bodyLines.slice(0, 3).join(' ').substring(0, 150) + '...';
    return {
        id: slug,
        title: frontmatter.title || 'Статья без названия',
        date: frontmatter.date || new Date().toISOString(),
        excerpt: frontmatter.excerpt || frontmatter.description || description,
        content: bodyLines.join('\n'),
        author: frontmatter.author || 'Flamingo Auto',
        locale: frontmatter.locale || frontmatter.lang || 'all',
        published: frontmatter.published !== false,
        photos: frontmatter.photos || frontmatter.images || []
    };
}

// Загрузка Markdown-статей через GitHub API (из content/blog)
async function loadMarkdownPostsFromGitHub() {
    try {
        console.log('🔄 Загружаем Markdown-статьи из GitHub...');
        const response = await fetch(`https://api.github.com/repos/${GITHUB_REPO}/contents/${MARKDOWN_PATH}`);
        if (!response.ok) {
            // Если папки нет или нет доступа — не фейлим общий процесс
            console.warn('⚠️ Markdown папка недоступна:', response.status);
            return [];
        }
        const files = await response.json();
        const mdFiles = files.filter(file => file.name.endsWith('.md'));
        console.log(`📁 Найдено ${mdFiles.length} Markdown файлов с постами`);
        const posts = await Promise.all(
            mdFiles.map(async (file) => {
                try {
                    const contentResponse = await fetch(file.download_url);
                    const raw = await contentResponse.text();
                    const post = parseMarkdownPost(raw, file.name);
                    return post.published !== false ? post : null;
                } catch (error) {
                    console.error(`❌ Ошибка загрузки markdown ${file.name}:`, error);
                    return null;
                }
            })
        );
        const valid = posts.filter(Boolean);
        console.log(`✅ Загружено ${valid.length} Markdown-татей из GitHub`);
        return valid;
    } catch (error) {
        console.error('❌ Ошибка загрузки Markdown-татей:', error);
        return [];
    }
}

// Общая загрузка: объединяем JSON и Markdown посты
async function loadAllPostsFromGitHub() {
    const [jsonPosts, mdPosts] = await Promise.all([
        loadPostsFromGitHub().catch(() => []),
        loadMarkdownPostsFromGitHub().catch(() => [])
    ]);
    const combined = [...jsonPosts, ...mdPosts];
    // Сортируем по дате (новые сначала)
    combined.sort((a, b) => new Date(b.created || b.date) - new Date(a.created || a.date));
    console.log(`📊 Итого постов (JSON+MD): ${combined.length}`);
    return combined;
}

// Отображение постов на странице
async function renderBlogPosts(containerId = 'posts-container', locale = null) {
    const container = document.getElementById(containerId);
    if (!container) {
        console.log('❌ Контейнер для постов не найден:', containerId);
        return;
    }
    console.log('🎯 Начинаем рендеринг постов для языка:', locale);
    container.innerHTML = '<p style="text-align:center;color:#666;padding:2rem;">🔄 Загружаем статьи...</p>';

    // Загружаем все доступные посты
    const posts = await loadAllPostsFromGitHub();

    // Фильтр по языку
    const filteredPosts = locale ? posts.filter(post => {
        const postLocale = (post.locale || 'all').toLowerCase();
        const targetLocale = locale.toLowerCase();
        const matches = postLocale === 'all' || postLocale === targetLocale;
        console.log(`📝 Пост "${post.title}" (${postLocale}) ${matches ? '✅ подходит' : '❌ не подходит'} для языка ${targetLocale}`);
        return matches;
    }) : posts;

    console.log('📊 Получено постов:', filteredPosts.length, 'для языка:', locale);

    if (filteredPosts.length === 0) {
        const noPostsMessages = {
            'et': 'Artikleid pole veel avaldatud.',
            'ru': 'Пока нет опубликованных статей.',
            'all': 'Пока нет опубликованных статей.'
        };
        const message = noPostsMessages[locale] || noPostsMessages['all'];
        container.innerHTML = `<p style="text-align:center;color:#666;padding:2rem;">${message}</p>`;
        return;
    }

    const postsHTML = filteredPosts.map(post => {
        let photosHTML = '';
        if (post.photos && post.photos.length > 0) {
            const photosToShow = post.photos.slice(0, 3);
            photosHTML = `
                <div style="display:flex;gap:0.5rem;margin:1rem 0;flex-wrap:wrap;">
                    ${postsToImages(post.photos)}
                    ${post.photos.length > 3 ? `<span style="color:#666;font-size:0.9rem;align-self:center;">+${post.photos.length - 3} фото</span>` : ''}
                </div>
            `;
        }
        return `
            <article style="background:#fff;padding:1.5rem;border-radius:8px;box-shadow:0 2px 8px rgba(0,0,0,0.1);margin-bottom:1rem;">
                <h2 style="margin:0 0 0.5rem 0;color:#333;">${escapeHtml(post.title)}</h2>
                <div style="color:#666;font-size:0.9rem;margin-bottom:1rem;">
                    ${new Date(post.created || post.date).toLocaleDateString('ru-RU')} • ${escapeHtml(post.author || 'Flamingo Auto')}
                </div>
                <div style="line-height:1.6;color:#444;margin-bottom:1rem;">
                    ${escapeHtml(post.excerpt || '')}
                </div>
                ${photosHTML}
                <div style="line-height:1.6;color:#444;">
                    ${sanitizeHtml((post.content || '').substring(0, 200) + ((post.content || '').length > 200 ? '...' : ''))}
                </div>
            </article>
        `;
    }).join('');

    container.innerHTML = postsHTML;
}

function postsToImages(photos) {
    const photosToShow = photos.slice(0, 3);
    return photosToShow.map(photo => `
        <img src="${photo.dataUrl || photo}" alt="Фото к статье" 
             style="width:80px;height:60px;object-fit:cover;border-radius:4px;border:1px solid #ddd;">
    `).join('');
}

// Безопасное экранирование HTML
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// Безопасная обработка HTML
function sanitizeHtml(html) {
    const allowedTags = ['b', 'i', 'strong', 'em', 'p', 'br'];
    const temp = document.createElement('div');
    temp.innerHTML = html;
    function cleanNode(node) {
        if (node.nodeType === Node.TEXT_NODE) return node.textContent;
        if (node.nodeType === Node.ELEMENT_NODE) {
            const tagName = node.tagName.toLowerCase();
            if (allowedTags.includes(tagName)) {
                const children = Array.from(node.childNodes).map(cleanNode).join('');
                return `<${tagName}>${children}</${tagName}>`;
            } else {
                return Array.from(node.childNodes).map(cleanNode).join('');
            }
        }
        return '';
    }
    return Array.from(temp.childNodes).map(cleanNode).join('').replace(/\n/g, '<br>');
}

// Определение текущего языка страницы
function getCurrentLocale() {
    const path = window.location.pathname.toLowerCase();
    console.log('🌐 Определяем язык для пути:', path);
    if (path.includes('blog-et')) {
        console.log('📍 Язык: эстонский (ET)');
        return 'et';
    } else if (path.includes('blog-ru')) {
        console.log('📍 Язык: русский (RU)');
        return 'ru';
    } else if (path.includes('blog.html')) {
        console.log('📍 Язык: все языки');
        return null; // Показать все
    }
    console.log('📍 Язык по умолчанию: все');
    return null; // Показать все
}

// Автоматический рендер после загрузки страницы
document.addEventListener('DOMContentLoaded', async function () {
    try {
        const locale = getCurrentLocale();
        await renderBlogPosts('posts-container', locale);
    } catch (e) {
        console.error('❌ Ошибка рендера блога:', e);
    }
});

// Экспортируем функции для тестов
window.BlogGitHub = {
    loadPostsFromGitHub,           // JSON
    loadMarkdownPostsFromGitHub,   // Markdown
    loadAllPostsFromGitHub,        // Комбинированная загрузка
    renderBlogPosts,
    getCurrentLocale,
    parseMarkdownPost
};