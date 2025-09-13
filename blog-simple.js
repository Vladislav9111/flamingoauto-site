// Простая и надежная система для блога
const POSTS_STORAGE_KEY = 'flamingo_blog_posts';

// Простая структура поста
function createPost(title, content, author, locale = 'all', photos = []) {
    return {
        id: Date.now().toString(),
        title: title.trim(),
        content: content.trim(),
        author: author.trim(),
        locale: locale,
        date: new Date().toISOString(),
        published: true,
        photos: photos || []
    };
}

// Сохранение постов в localStorage
function savePosts(posts) {
    try {
        localStorage.setItem(POSTS_STORAGE_KEY, JSON.stringify(posts));
        return true;
    } catch (error) {
        console.error('Ошибка сохранения:', error);
        return false;
    }
}

// Сохранение поста через Netlify Function или Git Gateway
async function saveToGitHub(post) {
    try {
        console.log('🔄 Начинаем сохранение в GitHub...');
        
        // Проверяем, есть ли токен Netlify Identity
        if (!window.netlifyIdentity) {
            console.error('❌ Netlify Identity не загружен');
            alert('Ошибка: Netlify Identity не загружен. Статья сохранена только локально.');
            return false;
        }
        
        const currentUser = window.netlifyIdentity.currentUser();
        if (!currentUser) {
            console.error('❌ Пользователь не авторизован в Netlify Identity');
            alert('Ошибка: Вы не авторизованы. Войдите через Netlify Identity для сохранения в GitHub.');
            return false;
        }
        
        console.log('✅ Пользователь авторизован:', currentUser.email);
        const token = await currentUser.jwt();
        console.log('✅ Токен получен, длина:', token.length);

        // Сначала пробуем через нашу Netlify Function
        try {
            console.log('🔄 Пробуем сохранить через Netlify Function...');
            const response = await fetch('/.netlify/functions/create-post', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    title: post.title,
                    content: post.content,
                    author: post.author,
                    locale: post.locale,
                    photos: post.photos
                })
            });

            if (response.ok) {
                const result = await response.json();
                console.log('✅ Статья успешно сохранена через Netlify Function:', result.filename);
                alert('✅ Статья успешно опубликована и сохранена в GitHub!');
                return true;
            } else if (response.status === 202) {
                // Netlify Function не может создать файл, но предоставляет данные для Git Gateway
                const result = await response.json();
                console.log('⚠️ Netlify Function fallback:', result.error);
                // Продолжаем с Git Gateway
            } else {
                const errorText = await response.text();
                console.error('❌ Netlify Function ошибка:', response.status, errorText);
                console.log('🔄 Пробуем Git Gateway...');
            }
        } catch (functionError) {
            console.warn('⚠️ Ошибка Netlify Function:', functionError.message);
        }

        // Пробуем альтернативную Netlify Function через GitHub API
        try {
            console.log('🔄 Пробуем альтернативную функцию через GitHub API...');
            const response = await fetch('/.netlify/functions/create-post-github', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    title: post.title,
                    content: post.content,
                    author: post.author,
                    locale: post.locale,
                    photos: post.photos
                })
            });

            if (response.ok) {
                const result = await response.json();
                console.log('✅ Статья успешно сохранена через GitHub API Function:', result.filename);
                alert('✅ Статья успешно опубликована через GitHub API!');
                return true;
            } else {
                const errorText = await response.text();
                console.error('❌ GitHub API Function ошибка:', response.status, errorText);
            }
        } catch (githubError) {
            console.warn('⚠️ Ошибка GitHub API Function:', githubError.message);
        }

        // Fallback на Git Gateway
        console.log('🔄 Пробуем сохранить через Git Gateway...');
        
        // Создаем имя файла
        const date = new Date(post.date);
        const dateStr = date.toISOString().split('T')[0]; // YYYY-MM-DD
        const slug = post.title.toLowerCase()
            .replace(/[^a-zа-яё0-9\s]/gi, '')
            .replace(/\s+/g, '-')
            .substring(0, 50);
        const filename = `${dateStr}-${slug}.md`;

        // Создаем содержимое markdown файла
        const markdownContent = `---
title: "${post.title}"
date: ${post.date}
excerpt: "${post.title}"
author: "${post.author}"
locale: "${post.locale}"
published: true
---

${post.content}`;

        // Кодируем в base64 (правильно для кириллицы)
        const encodedContent = btoa(encodeURIComponent(markdownContent).replace(/%([0-9A-F]{2})/g, function(match, p1) {
            return String.fromCharCode(parseInt(p1, 16));
        }));

        // Отправляем в GitHub через Netlify Git Gateway
        const apiUrl = `/.netlify/git/github/contents/content/blog/${filename}`;

        const response = await fetch(apiUrl, {
            method: 'PUT',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json',
                'Accept': 'application/vnd.github.v3+json',
                'X-Requested-With': 'XMLHttpRequest'
            },
            body: JSON.stringify({
                message: `Новая статья: ${post.title}`,
                content: encodedContent,
                branch: 'main'
            })
        });

        if (response.ok) {
            console.log('✅ Статья успешно сохранена через Git Gateway');
            alert('✅ Статья успешно опубликована через Git Gateway!');
            return true;
        } else {
            const errorText = await response.text();
            console.error('❌ Ошибка сохранения через Git Gateway:', response.status, errorText);
            
            // Показываем подробную ошибку пользователю
            if (response.status === 401) {
                alert('❌ Ошибка авторизации. Проверьте настройки Netlify Identity и Git Gateway.');
            } else if (response.status === 404) {
                alert('❌ Git Gateway не найден. Убедитесь что он включен в настройках Netlify.');
            } else {
                alert(`❌ Ошибка сохранения: ${response.status}. Статья сохранена только локально.`);
            }
            return false;
        }
    } catch (error) {
        console.error('❌ Общая ошибка при сохранении:', error);
        return false;
    }
}

// Загрузка постов из localStorage
function loadPosts() {
    try {
        const stored = localStorage.getItem(POSTS_STORAGE_KEY);
        return stored ? JSON.parse(stored) : [];
    } catch (error) {
        console.error('Ошибка загрузки:', error);
        return [];
    }
}

// Загрузка постов из GitHub (через Netlify Function)
async function loadPostsFromGitHub() {
    try {
        console.log('🔄 Загружаем посты из GitHub...');

        // Пробуем загрузить через Netlify Function
        const response = await fetch('/.netlify/functions/get-posts');
        if (response.ok) {
            const posts = await response.json();
            console.log('✅ Загружено из GitHub:', posts.length, 'постов');

            // Сохраняем в localStorage для быстрого доступа
            savePosts(posts);
            return posts;
        } else {
            console.log('❌ Netlify Function недоступна');
            return [];
        }
    } catch (error) {
        console.error('❌ Ошибка загрузки из GitHub:', error);
        return [];
    }
}

// Синхронизация: всегда пробуем загрузить из GitHub, fallback на localStorage
async function syncPosts() {
    console.log('🔄 Синхронизируем посты...');

    // Сначала пробуем загрузить из GitHub
    const githubPosts = await loadPostsFromGitHub();

    if (githubPosts.length > 0) {
        console.log('✅ Используем посты из GitHub:', githubPosts.length);
        return githubPosts;
    }

    // Если GitHub недоступен, используем localStorage
    const localPosts = loadPosts();
    console.log('📱 Используем локальные посты:', localPosts.length);
    return localPosts;
}

// Добавление нового поста (с сохранением в GitHub)
async function addPost(title, content, author, locale = 'all', photos = []) {
    if (!title || !content) {
        alert('Заполните заголовок и содержание!');
        return false;
    }

    try {
        // Создаем пост
        const newPost = createPost(title, content, author, locale, photos);

        // Сохраняем в localStorage для быстрого доступа
        const posts = loadPosts();
        posts.unshift(newPost);
        savePosts(posts);

        // Сохраняем в GitHub
        const success = await saveToGitHub(newPost);

        if (success) {
            console.log('✅ Статья успешно опубликована в GitHub');
            return true;
        } else {
            // Если GitHub не сработал, оставляем в localStorage
            console.warn('⚠️ GitHub сохранение не удалось, статья сохранена только локально');
            alert('⚠️ Статья сохранена локально, но не опубликована в GitHub. Проверьте настройки Netlify Identity и Git Gateway.');
            return true; // Возвращаем true чтобы не показывать ошибку в админке
        }
    } catch (error) {
        console.error('Ошибка при добавлении поста:', error);
        alert('Ошибка при сохранении статьи: ' + error.message);
        return false;
    }
}

// Обновление существующего поста
async function updatePost(postId, title, content, author, locale = 'all', photos = []) {
    if (!title || !content) {
        alert('Заполните заголовок и содержание!');
        return false;
    }

    try {
        const posts = loadPosts();
        const postIndex = posts.findIndex(p => p.id === postId);

        if (postIndex === -1) {
            alert('Пост не найден!');
            return false;
        }

        // Обновляем пост, сохраняя оригинальные ID и дату создания
        const originalPost = posts[postIndex];
        const updatedPost = {
            ...originalPost,
            title: title.trim(),
            content: content.trim(),
            author: author.trim(),
            locale: locale,
            photos: photos || [],
            updatedAt: new Date().toISOString()
        };

        posts[postIndex] = updatedPost;
        savePosts(posts);

        // Сохраняем в GitHub
        const success = await saveToGitHub(updatedPost);

        if (success) {
            return true;
        } else {
            console.warn('GitHub сохранение не удалось, статья обновлена локально');
            return true;
        }
    } catch (error) {
        console.error('Ошибка при обновлении поста:', error);
        alert('Ошибка при обновлении статьи: ' + error.message);
        return false;
    }
}

// Удаление поста
async function deletePost(postId) {
    try {
        const posts = loadPosts();
        const postIndex = posts.findIndex(p => p.id === postId);

        if (postIndex === -1) {
            alert('Пост не найден!');
            return false;
        }

        // Удаляем из localStorage
        posts.splice(postIndex, 1);
        savePosts(posts);

        // TODO: Удаление из GitHub (требует дополнительной реализации)
        console.log('Пост удален из localStorage. Удаление из GitHub пока не реализовано.');

        return true;
    } catch (error) {
        console.error('Ошибка при удалении поста:', error);
        alert('Ошибка при удалении статьи: ' + error.message);
        return false;
    }
}

// Получение постов для отображения (с синхронизацией)
async function getPosts(locale = null) {
    const posts = await syncPosts();

    if (!locale) {
        return posts; // Возвращаем все посты
    }

    // Фильтруем по языку
    return posts.filter(post => {
        const postLocale = (post.locale || 'all').toLowerCase();
        return postLocale === 'all' || postLocale === locale.toLowerCase();
    });
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

    const posts = await getPosts(locale);
    console.log('📊 Получено постов:', posts.length, 'для языка:', locale);
    console.log('📝 Посты:', posts.map(p => ({ title: p.title, locale: p.locale })));

    if (posts.length === 0) {
        // Локализованные сообщения для разных языков
        const noPostsMessages = {
            'et': 'Artikleid pole veel avaldatud.',
            'ru': 'Пока нет опубликованных статей.',
            'all': 'Пока нет опубликованных статей.'
        };

        const message = noPostsMessages[locale] || noPostsMessages['all'];
        container.innerHTML = `<p style="text-align:center;color:#666;padding:2rem;">${message}</p>`;
        return;
    }

    const postsHTML = posts.map(post => `
        <article style="background:#fff;padding:1.5rem;border-radius:8px;box-shadow:0 2px 8px rgba(0,0,0,0.1);margin-bottom:1rem;">
            <h2 style="margin:0 0 0.5rem 0;color:#333;">${escapeHtml(post.title)}</h2>
            <div style="color:#666;font-size:0.9rem;margin-bottom:1rem;">
                ${new Date(post.date).toLocaleDateString('ru-RU')} • ${escapeHtml(post.author)}
                ${post.updatedAt ? ` • <em>обновлено ${new Date(post.updatedAt).toLocaleDateString('ru-RU')}</em>` : ''}
            </div>
            ${post.photos && post.photos.length > 0 ? `
                <div style="display:grid;grid-template-columns:${post.photos.length === 1 ? '1fr' : 'repeat(auto-fit,minmax(200px,1fr))'};gap:0.75rem;margin-bottom:1rem;">
                    ${post.photos.slice(0, 6).map(photo => `
                        <img src="${photo.dataUrl}" alt="${escapeHtml(photo.name)}"
                             style="width:100%;aspect-ratio:${post.photos.length === 1 ? '16/9' : '4/3'};object-fit:cover;border-radius:8px;cursor:pointer;transition:transform 0.2s ease,box-shadow 0.2s ease;"
                             onmouseover="this.style.transform='scale(1.02)';this.style.boxShadow='0 4px 12px rgba(0,0,0,0.15)'"
                             onmouseout="this.style.transform='scale(1)';this.style.boxShadow='none'"
                             onclick="window.open('${photo.dataUrl}', '_blank')">
                    `).join('')}
                </div>
            ` : ''}
            <div style="line-height:1.6;color:#444;">
                ${sanitizeHtml(post.content)}
            </div>
        </article>
    `).join('');

    container.innerHTML = postsHTML;
}

// Безопасное экранирование HTML
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// Безопасная обработка HTML (разрешены только определенные теги)
function sanitizeHtml(html) {
    // Разрешенные теги: b, i, strong, em, p, br
    const allowedTags = ['b', 'i', 'strong', 'em', 'p', 'br'];

    // Создаем временный элемент для парсинга
    const temp = document.createElement('div');
    temp.innerHTML = html;

    // Рекурсивно очищаем содержимое
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
                // Если тег не разрешен, возвращаем только содержимое
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
    if (path.includes('blog-et') || path.includes('index.html') || path.endsWith('/')) {
        return 'et';
    } else if (path.includes('blog-ru') || path.includes('ru.html')) {
        return 'ru';
    }
    return null; // Показать все
}

// Автоматическая инициализация при загрузке страницы
document.addEventListener('DOMContentLoaded', async function() {
    const container = document.getElementById('posts-container');
    if (container) {
        const locale = getCurrentLocale();
        console.log('Автоматическая загрузка постов для языка:', locale);
        await renderBlogPosts('posts-container', locale);
    }
});

// Экспорт функций для использования в админке
window.FlamingoBlogSimple = {
    addPost,
    updatePost,
    deletePost,
    getPosts,
    renderBlogPosts,
    getCurrentLocale,
    loadPosts,
    savePosts,
    loadPostsFromGitHub,
    syncPosts,
    sanitizeHtml,
    escapeHtml
};
