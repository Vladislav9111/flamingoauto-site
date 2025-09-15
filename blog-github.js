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

    const postsHTML = filteredPosts.map((post, index) => {
        let photosHTML = '';
        if (post.photos && post.photos.length > 0) {
            const photosToShow = post.photos.slice(0, 3);
            photosHTML = `
                <div style="display:flex;gap:0.5rem;margin:1rem 0;flex-wrap:wrap;">
                    ${postsToImages(post.photos, index)}
                    ${post.photos.length > 3 ? `<span style="color:#666;font-size:0.9rem;align-self:center;">+${post.photos.length - 3} фото</span>` : ''}
                </div>
            `;
        }
        
        const shortContent = (post.content || '').substring(0, 200);
        const hasMore = (post.content || '').length > 200;
        
        return `
            <article style="background:#fff;padding:1.5rem;border-radius:8px;box-shadow:0 2px 8px rgba(0,0,0,0.1);margin-bottom:1rem;transition:transform 0.2s;" 
                     onmouseover="this.style.transform='translateY(-2px)'" 
                     onmouseout="this.style.transform='translateY(0)'">
                <h2 style="margin:0 0 0.5rem 0;color:#333;cursor:pointer;transition:all 0.3s;text-decoration:underline;text-decoration-color:transparent;" 
                    onclick="openFullPost(${index})" 
                    onmouseover="this.style.color='#007bff';this.style.textDecorationColor='#007bff'" 
                    onmouseout="this.style.color='#333';this.style.textDecorationColor='transparent'"
                    title="Нажмите, чтобы открыть полный текст в новой вкладке">
                    ${escapeHtml(post.title)} 🔗
                </h2>
                <div style="color:#666;font-size:0.9rem;margin-bottom:1rem;">
                    📅 ${new Date(post.created || post.date).toLocaleDateString('ru-RU')} • ✍️ ${escapeHtml(post.author || 'Flamingo Auto')}
                </div>
                <div style="line-height:1.6;color:#444;margin-bottom:1rem;">
                    ${escapeHtml(post.excerpt || '')}
                </div>
                ${photosHTML}
                <div style="line-height:1.6;color:#444;">
                    ${sanitizeHtml(shortContent)}${hasMore ? '...' : ''}
                </div>
                ${hasMore ? `<button onclick="openFullPost(${index})" style="background:#007bff;color:white;border:none;padding:0.75rem 1.5rem;border-radius:6px;cursor:pointer;margin-top:1rem;font-weight:500;transition:background 0.3s;" onmouseover="this.style.background='#0056b3'" onmouseout="this.style.background='#007bff'">📖 Читать полностью в новой вкладке</button>` : ''}
            </article>
        `;
    }).join('');

    container.innerHTML = postsHTML;
}

function postsToImages(photos, postIndex) {
    const photosToShow = photos.slice(0, 3);
    return photosToShow.map((photo, photoIndex) => `
        <img src="${photo.dataUrl || photo}" alt="Фото к статье" 
             style="width:80px;height:60px;object-fit:cover;border-radius:4px;border:1px solid #ddd;cursor:pointer;transition:transform 0.3s;"
             onclick="openImageInNewTab('${photo.dataUrl || photo}')"
             onmouseover="this.style.transform='scale(1.05)'"
             onmouseout="this.style.transform='scale(1)'"
             title="Нажмите, чтобы открыть изображение в новой вкладке">
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

// Глобальная переменная для хранения постов
let globalPosts = [];

// Функция для открытия полного поста в новой вкладке
window.openFullPost = function(postIndex) {
    const post = globalPosts[postIndex];
    if (!post) return;
    
    let photosHTML = '';
    if (post.photos && post.photos.length > 0) {
        photosHTML = `
            <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:1rem;margin:2rem 0;">
                ${post.photos.map((photo, index) => `
                    <img src="${photo.dataUrl || photo}" alt="Фото ${index + 1}" 
                         style="width:100%;height:200px;object-fit:cover;border-radius:8px;border:1px solid #ddd;">
                `).join('')}
            </div>
        `;
    }
    
    // Создаем HTML для новой страницы
    const fullPostHTML = `
        <!DOCTYPE html>
        <html lang="ru">
        <head>
            <meta charset="utf-8">
            <meta name="viewport" content="width=device-width,initial-scale=1">
            <title>${escapeHtml(post.title)} — Flamingo Auto Blog</title>
            <meta name="description" content="${escapeHtml(post.excerpt || '')}">
            <link rel="icon" type="image/png" href="/favicon.png">
            <style>
                * { margin: 0; padding: 0; box-sizing: border-box; }
                body {
                    font-family: 'Noto Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
                    line-height: 1.6;
                    color: #333;
                    background: #f8f9fa;
                    padding: 2rem 1rem;
                }
                .container {
                    max-width: 800px;
                    margin: 0 auto;
                    background: white;
                    padding: 3rem;
                    border-radius: 12px;
                    box-shadow: 0 4px 20px rgba(0,0,0,0.1);
                }
                .header {
                    border-bottom: 2px solid #007bff;
                    padding-bottom: 1rem;
                    margin-bottom: 2rem;
                }
                .back-link {
                    display: inline-block;
                    color: #007bff;
                    text-decoration: none;
                    margin-bottom: 1rem;
                    font-weight: 500;
                    transition: color 0.3s;
                }
                .back-link:hover {
                    color: #0056b3;
                }
                h1 {
                    color: #333;
                    font-size: 2.5rem;
                    font-weight: 600;
                    margin-bottom: 1rem;
                    line-height: 1.2;
                }
                .meta {
                    color: #666;
                    font-size: 1rem;
                    display: flex;
                    align-items: center;
                    gap: 1rem;
                }
                .content {
                    font-size: 1.1rem;
                    line-height: 1.8;
                    color: #444;
                }
                .content p {
                    margin-bottom: 1.5rem;
                }
                img {
                    max-width: 100%;
                    height: auto;
                    border-radius: 8px;
                }
                @media (max-width: 768px) {
                    body { padding: 1rem 0.5rem; }
                    .container { padding: 2rem 1.5rem; }
                    h1 { font-size: 2rem; }
                }
            </style>
        </head>
        <body>
            <div class="container">
                <div class="header">
                    <a href="javascript:window.close()" class="back-link">← Закрыть</a>
                    <h1>${escapeHtml(post.title)}</h1>
                    <div class="meta">
                        <span>📅 ${new Date(post.created || post.date).toLocaleDateString('ru-RU')}</span>
                        <span>✍️ ${escapeHtml(post.author || 'Flamingo Auto')}</span>
                    </div>
                </div>
                
                ${photosHTML}
                
                <div class="content">
                    ${sanitizeHtml(post.content || '')}
                </div>
            </div>
        </body>
        </html>
    `;
    
    // Открываем новую вкладку с полным постом
    const newWindow = window.open('', '_blank');
    newWindow.document.write(fullPostHTML);
    newWindow.document.close();
};

// Функция для закрытия модального окна поста
window.closePostModal = function() {
    const modal = document.getElementById('post-modal');
    if (modal) {
        modal.remove();
        document.body.style.overflow = '';
    }
};

// Функция для открытия изображения в новой вкладке
window.openImageInNewTab = function(imageSrc) {
    const imageHTML = `
        <!DOCTYPE html>
        <html lang="ru">
        <head>
            <meta charset="utf-8">
            <meta name="viewport" content="width=device-width,initial-scale=1">
            <title>Изображение — Flamingo Auto</title>
            <style>
                * { margin: 0; padding: 0; box-sizing: border-box; }
                body {
                    background: #000;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    min-height: 100vh;
                    padding: 2rem;
                }
                img {
                    max-width: 100%;
                    max-height: 100vh;
                    object-fit: contain;
                    border-radius: 8px;
                    box-shadow: 0 4px 20px rgba(255,255,255,0.1);
                }
                .close-btn {
                    position: fixed;
                    top: 2rem;
                    right: 2rem;
                    background: rgba(255,255,255,0.9);
                    border: none;
                    width: 50px;
                    height: 50px;
                    border-radius: 50%;
                    font-size: 1.5rem;
                    cursor: pointer;
                    z-index: 1000;
                }
            </style>
        </head>
        <body>
            <button class="close-btn" onclick="window.close()" title="Закрыть">&times;</button>
            <img src="${imageSrc}" alt="Изображение">
        </body>
        </html>
    `;
    
    const newWindow = window.open('', '_blank');
    newWindow.document.write(imageHTML);
    newWindow.document.close();
};

// Функция для открытия изображения в полном размере (старая версия для совместимости)
window.openImageModal = function(imageSrc, postIndex, imageIndex) {
    const post = globalPosts[postIndex];
    const currentIndex = imageIndex;
    const totalImages = post.photos.length;
    
    const modalHTML = `
        <div id="image-modal" style="position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.9);z-index:1001;display:flex;align-items:center;justify-content:center;" onclick="closeImageModal()">
            <button onclick="closeImageModal()" style="position:absolute;top:2rem;right:2rem;background:white;border:none;width:40px;height:40px;border-radius:50%;font-size:1.5rem;cursor:pointer;z-index:1002;">&times;</button>
            
            ${totalImages > 1 ? `
                <button onclick="prevImage(${postIndex}, ${currentIndex})" style="position:absolute;left:2rem;top:50%;transform:translateY(-50%);background:rgba(255,255,255,0.8);border:none;width:50px;height:50px;border-radius:50%;font-size:1.5rem;cursor:pointer;z-index:1002;">‹</button>
                <button onclick="nextImage(${postIndex}, ${currentIndex})" style="position:absolute;right:2rem;top:50%;transform:translateY(-50%);background:rgba(255,255,255,0.8);border:none;width:50px;height:50px;border-radius:50%;font-size:1.5rem;cursor:pointer;z-index:1002;">›</button>
            ` : ''}
            
            <div style="text-align:center;max-width:90%;max-height:90%;" onclick="event.stopPropagation()">
                <img id="modal-image" src="${imageSrc}" alt="Фото" style="max-width:100%;max-height:100%;object-fit:contain;border-radius:8px;">
                ${totalImages > 1 ? `<div style="color:white;margin-top:1rem;font-size:1.1rem;">${currentIndex + 1} из ${totalImages}</div>` : ''}
            </div>
        </div>
    `;
    
    document.body.insertAdjacentHTML('beforeend', modalHTML);
    document.body.style.overflow = 'hidden';
};

// Функция для закрытия модального окна изображения
window.closeImageModal = function() {
    const modal = document.getElementById('image-modal');
    if (modal) {
        modal.remove();
        document.body.style.overflow = '';
    }
};

// Навигация по изображениям
window.prevImage = function(postIndex, currentIndex) {
    const post = globalPosts[postIndex];
    const newIndex = currentIndex > 0 ? currentIndex - 1 : post.photos.length - 1;
    closeImageModal();
    openImageModal(post.photos[newIndex].dataUrl || post.photos[newIndex], postIndex, newIndex);
};

window.nextImage = function(postIndex, currentIndex) {
    const post = globalPosts[postIndex];
    const newIndex = currentIndex < post.photos.length - 1 ? currentIndex + 1 : 0;
    closeImageModal();
    openImageModal(post.photos[newIndex].dataUrl || post.photos[newIndex], postIndex, newIndex);
};

// Обновляем функцию рендеринга чтобы сохранять посты глобально
const originalRenderBlogPosts = renderBlogPosts;
renderBlogPosts = async function(containerId = 'posts-container', locale = null) {
    const posts = await loadAllPostsFromGitHub();
    const filteredPosts = locale ? posts.filter(post => {
        const postLocale = (post.locale || 'all').toLowerCase();
        const targetLocale = locale.toLowerCase();
        return postLocale === 'all' || postLocale === targetLocale;
    }) : posts;
    
    globalPosts = filteredPosts; // Сохраняем для модальных окон
    
    return originalRenderBlogPosts(containerId, locale);
};

// Экспортируем функции для тестов
window.BlogGitHub = {
    loadPostsFromGitHub,           // JSON
    loadMarkdownPostsFromGitHub,   // Markdown
    loadAllPostsFromGitHub,        // Комбинированная загрузка
    renderBlogPosts,
    getCurrentLocale,
    parseMarkdownPost,
    openFullPost,
    openImageModal,
    closePostModal,
    closeImageModal
};