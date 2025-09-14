// Простая и надёжная система блога - только Git Gateway
const POSTS_STORAGE_KEY = 'flamingo_blog_posts';

// Создание поста
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

// Сохранение в localStorage
function savePosts(posts) {
    try {
        localStorage.setItem(POSTS_STORAGE_KEY, JSON.stringify(posts));
        return true;
    } catch (error) {
        console.error('Ошибка сохранения:', error);
        return false;
    }
}

// Загрузка из localStorage
function loadPosts() {
    try {
        const stored = localStorage.getItem(POSTS_STORAGE_KEY);
        return stored ? JSON.parse(stored) : [];
    } catch (error) {
        console.error('Ошибка загрузки:', error);
        return [];
    }
}

// ЕДИНСТВЕННЫЙ НАДЁЖНЫЙ СПОСОБ - Git Gateway
async function saveToGitHub(post) {
    try {
        console.log('🔄 Публикуем статью через Git Gateway...');
        
        // Проверяем авторизацию
        if (!window.netlifyIdentity) {
            console.error('❌ Netlify Identity не загружен');
            alert('❌ Netlify Identity не загружен. Перезагрузите страницу.');
            return false;
        }
        
        const currentUser = window.netlifyIdentity.currentUser();
        if (!currentUser) {
            console.error('❌ Пользователь не авторизован');
            alert('❌ Войдите через Netlify Identity для публикации статей');
            return false;
        }
        
        console.log('✅ Пользователь авторизован:', currentUser.email);

        const token = await currentUser.jwt();
        console.log('✅ Токен получен, длина:', token.length);
        
        // Создаем имя файла
        const date = new Date(post.date);
        const dateStr = date.toISOString().split('T')[0];
        const slug = post.title.toLowerCase()
            .replace(/[^a-zа-яё0-9\s]/gi, '')
            .replace(/\s+/g, '-')
            .substring(0, 50);
        const filename = `${dateStr}-${slug}.md`;
        console.log('📝 Создаем файл:', filename);

        // Создаем markdown
        const markdownContent = `---
title: "${post.title}"
date: ${post.date}
excerpt: "${post.title}"
author: "${post.author}"
locale: "${post.locale}"
published: true
---

${post.content}`;

        // Кодируем в base64
        const encodedContent = btoa(encodeURIComponent(markdownContent).replace(/%([0-9A-F]{2})/g, function(match, p1) {
            return String.fromCharCode(parseInt(p1, 16));
        }));

        // Отправляем через Git Gateway (правильный формат для Netlify)
        console.log('🔗 Отправляем запрос к Git Gateway...');
        const response = await fetch(`/.netlify/git/github/contents/content/blog/${filename}`, {
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
            console.log('✅ Статья опубликована в GitHub');
            alert('✅ Статья успешно опубликована!');
            return true;
        } else {
            const errorText = await response.text();
            console.error('❌ Ошибка:', response.status, errorText);
            
            if (response.status === 401) {
                alert('❌ Ошибка авторизации. Включите Git Gateway в Netlify.');
            } else if (response.status === 404) {
                alert('❌ Git Gateway не найден. Включите в Netlify Dashboard → Identity → Git Gateway.');
            } else {
                alert(`❌ Ошибка ${response.status}. Статья сохранена локально.`);
            }
            return false;
        }
    } catch (error) {
        console.error('❌ Ошибка:', error);
        alert('❌ Ошибка: ' + error.message);
        return false;
    }
}

// Добавление поста
async function addPost(title, content, author, locale = 'all', photos = []) {
    if (!title || !content) {
        alert('Заполните заголовок и содержание!');
        return false;
    }

    try {
        // Создаем пост
        const newPost = createPost(title, content, author, locale, photos);

        // Сохраняем локально
        const posts = loadPosts();
        posts.unshift(newPost);
        savePosts(posts);

        // Публикуем в GitHub
        const success = await saveToGitHub(newPost);
        
        if (success) {
            console.log('✅ Статья опубликована в GitHub');
            return true;
        } else {
            console.warn('⚠️ Статья НЕ опубликована в GitHub, сохранена только локально');
            // Возвращаем false чтобы показать что публикация не удалась
            return false;
        }
    } catch (error) {
        console.error('Ошибка:', error);
        alert('Ошибка: ' + error.message);
        return false;
    }
}

// Загрузка постов из GitHub
async function loadPostsFromGitHub() {
    try {
        console.log('🔄 Загружаем посты через Netlify Function...');
        const response = await fetch('/.netlify/functions/get-posts-simple');
        
        console.log('📡 Ответ сервера:', response.status);
        
        if (response.ok) {
            const posts = await response.json();
            console.log('✅ Получены посты из Netlify Function:', posts.length);
            savePosts(posts); // Кешируем локально
            return posts;
        } else {
            const errorText = await response.text();
            console.error('❌ Ошибка Netlify Function:', response.status, errorText);
            return [];
        }
    } catch (error) {
        console.error('❌ Сетевая ошибка при загрузке постов:', error);
        return [];
    }
}

// Получение постов
async function getPosts(locale = null) {
    console.log('🔄 Получаем посты...');
    
    // Сначала пробуем GitHub, потом localStorage
    let posts = await loadPostsFromGitHub();
    console.log('📊 Из GitHub:', posts.length, 'постов');
    
    if (posts.length === 0) {
        posts = loadPosts();
        console.log('📱 Из localStorage:', posts.length, 'постов');
    }

    // Фильтруем по языку
    if (locale) {
        const filtered = posts.filter(post => {
            const postLocale = (post.locale || 'all').toLowerCase();
            return postLocale === 'all' || postLocale === locale.toLowerCase();
        });
        console.log('🌐 После фильтрации по языку', locale + ':', filtered.length, 'постов');
        return filtered;
    }
    
    console.log('📝 Всего постов:', posts.length);
    return posts;
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

        posts.splice(postIndex, 1);
        savePosts(posts);
        console.log('Пост удален из localStorage');
        return true;
    } catch (error) {
        console.error('Ошибка при удалении:', error);
        return false;
    }
}

// Обновление поста
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

        // Пробуем сохранить в GitHub
        const success = await saveToGitHub(updatedPost);
        
        if (success) {
            console.log('✅ Статья обновлена');
            return true;
        } else {
            console.warn('⚠️ Статья обновлена только локально');
            return true;
        }
    } catch (error) {
        console.error('Ошибка при обновлении:', error);
        alert('Ошибка: ' + error.message);
        return false;
    }
}

// Отображение постов на странице блога
async function renderBlogPosts(containerId = 'posts-container', locale = null) {
    const container = document.getElementById(containerId);
    if (!container) {
        console.log('❌ Контейнер не найден:', containerId);
        return;
    }

    console.log('🎯 Рендерим посты для языка:', locale);
    container.innerHTML = '<p style="text-align:center;color:#666;padding:2rem;">🔄 Загружаем статьи...</p>';

    const posts = await getPosts(locale);
    console.log('📊 Получено постов:', posts.length);

    if (posts.length === 0) {
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
            <div style="line-height:1.6;color:#444;">
                ${sanitizeHtml(post.content.substring(0, 300) + (post.content.length > 300 ? '...' : ''))}
            </div>
        </article>
    `).join('');

    container.innerHTML = postsHTML;
}

// Определение языка страницы
function getCurrentLocale() {
    const path = window.location.pathname.toLowerCase();
    if (path.includes('blog-et')) {
        return 'et';
    } else if (path.includes('blog-ru')) {
        return 'ru';
    }
    return null;
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

// Автоматическая инициализация
document.addEventListener('DOMContentLoaded', async function() {
    const container = document.getElementById('posts-container');
    if (container) {
        const locale = getCurrentLocale();
        console.log('Автозагрузка постов для языка:', locale);
        await renderBlogPosts('posts-container', locale);
    }
});

// Диагностическая функция
async function diagnoseSystem() {
    console.log('🔧 Диагностика системы...');
    
    // Проверяем Netlify Identity
    if (!window.netlifyIdentity) {
        console.error('❌ Netlify Identity не загружен');
        return { success: false, error: 'Netlify Identity не загружен' };
    }
    
    const currentUser = window.netlifyIdentity.currentUser();
    if (!currentUser) {
        console.error('❌ Пользователь не авторизован');
        return { success: false, error: 'Пользователь не авторизован' };
    }
    
    console.log('✅ Пользователь:', currentUser.email);
    
    try {
        const token = await currentUser.jwt();
        console.log('✅ Токен получен, длина:', token.length);
        
        // Проверяем Git Gateway
        const testResponse = await fetch('/.netlify/git/github', {
            method: 'GET',
            headers: {
                'Authorization': `token ${token}`,
                'Accept': 'application/vnd.github.v3+json',
                'User-Agent': 'Netlify-Git-Gateway'
            }
        });
        
        console.log('🔗 Git Gateway статус:', testResponse.status);
        
        if (testResponse.status === 401) {
            return { success: false, error: 'Git Gateway не авторизован' };
        } else if (testResponse.status === 404) {
            return { success: false, error: 'Git Gateway не найден' };
        }
        
        return { success: true, message: 'Система готова к работе' };
        
    } catch (error) {
        console.error('❌ Ошибка диагностики:', error);
        return { success: false, error: error.message };
    }
}

// Экспорт всех функций
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
    sanitizeHtml,
    escapeHtml,
    diagnoseSystem
};