// Простая система загрузки статей из GitHub API
const GITHUB_REPO = 'flamingoauto/flamingoauto.github.io';
const GITHUB_BRANCH = 'main';
const POSTS_PATH = 'content/posts';

// Загрузка статей через GitHub API
async function loadPostsFromGitHub() {
    try {
        console.log('🔄 Загружаем статьи из GitHub...');

        // Загружаем список файлов из папки posts
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

                    // Добавляем дату создания если её нет
                    if (!post.date && post.created) {
                        post.date = post.created;
                    }

                    return post;
                } catch (error) {
                    console.error(`❌ Ошибка загрузки файла ${file.name}:`, error);
                    return null;
                }
            })
        );

        // Фильтруем null значения
        const validPosts = posts.filter(post => post !== null);

        // Сортируем по дате (новые сначала)
        validPosts.sort((a, b) => new Date(b.created || b.date) - new Date(a.created || a.date));

        console.log(`✅ Загружено ${validPosts.length} статей из GitHub`);
        return validPosts;

    } catch (error) {
        console.error('❌ Ошибка загрузки статей:', error);
        return [];
    }
}

// Парсинг markdown поста
function parseMarkdownPost(content, filename) {
    const lines = content.split('\n');
    const frontmatter = {};
    let contentStart = 0;

    // Парсим frontmatter (метаданные между ---)
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
                // Убираем кавычки
                if (value.startsWith('"') && value.endsWith('"')) {
                    value = value.slice(1, -1);
                }
                frontmatter[key] = value;
            }
        }
    }

    // Получаем slug из имени файла
    const slug = filename.replace('.md', '');

    // Получаем первые несколько строк как описание
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

// Отображение постов на странице
async function renderBlogPosts(containerId = 'posts-container', locale = null) {
    const container = document.getElementById(containerId);
    if (!container) {
        console.log('❌ Контейнер для постов не найден:', containerId);
        return;
    }

    console.log('🎯 Начинаем рендеринг постов для языка:', locale);

    // Показываем индикатор загрузки
    container.innerHTML = '<p style="text-align:center;color:#666;padding:2rem;">🔄 Загружаем статьи...</p>';

    const posts = await loadPostsFromGitHub();

    // Фильтруем по языку если указан
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
        // Обработка фотографий
        let photosHTML = '';
        if (post.photos && post.photos.length > 0) {
            const photosToShow = post.photos.slice(0, 3); // Показываем максимум 3 фото в превью
            photosHTML = `
                <div style="display:flex;gap:0.5rem;margin:1rem 0;flex-wrap:wrap;">
                    ${photosToShow.map(photo => `
                        <img src="${photo}" alt="Фото к статье" 
                             style="width:80px;height:60px;object-fit:cover;border-radius:4px;border:1px solid #ddd;">
                    `).join('')}
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
                    ${escapeHtml(post.excerpt)}
                </div>
                ${photosHTML}
                <div style="line-height:1.6;color:#444;">
                    ${sanitizeHtml(post.content.substring(0, 200) + (post.content.length > 200 ? '...' : ''))}
                </div>
            </article>
        `;
    }).join('');

    container.innerHTML = postsHTML;
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
        if (node.nodeType === Node.TEXT_NODE) {
            return node.textContent;
        }

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

// Автоматическая инициализация при загрузке страницы
document.addEventListener('DOMContentLoaded', async function () {
    const container = document.getElementById('posts-container');
    if (container) {
        const locale = getCurrentLocale();
        console.log('Автоматическая загрузка постов для языка:', locale);
        await renderBlogPosts('posts-container', locale);
    }
});

// Экспорт функций
window.BlogGitHub = {
    loadPostsFromGitHub,
    renderBlogPosts,
    getCurrentLocale,
    parseMarkdownPost
};