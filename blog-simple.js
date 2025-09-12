// Простая и надежная система для блога
const POSTS_STORAGE_KEY = 'flamingo_blog_posts';

// Простая структура поста
function createPost(title, content, author, locale = 'all') {
    return {
        id: Date.now().toString(),
        title: title.trim(),
        content: content.trim(),
        author: author.trim(),
        locale: locale,
        date: new Date().toISOString(),
        published: true
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

// Добавление нового поста
function addPost(title, content, author, locale = 'all') {
    if (!title || !content) {
        alert('Заполните заголовок и содержание!');
        return false;
    }

    const posts = loadPosts();
    const newPost = createPost(title, content, author, locale);
    posts.unshift(newPost); // Добавляем в начало массива
    
    if (savePosts(posts)) {
        alert('Статья успешно опубликована!');
        return true;
    } else {
        alert('Ошибка при сохранении статьи!');
        return false;
    }
}

// Получение постов для отображения
function getPosts(locale = null) {
    const posts = loadPosts();
    
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
function renderBlogPosts(containerId = 'posts-container', locale = null) {
    const container = document.getElementById(containerId);
    if (!container) {
        console.log('Контейнер для постов не найден:', containerId);
        return;
    }

    const posts = getPosts(locale);
    console.log('Отображаем посты:', posts.length, 'для языка:', locale);

    if (posts.length === 0) {
        container.innerHTML = '<p style="text-align:center;color:#666;padding:2rem;">Пока нет опубликованных статей.</p>';
        return;
    }

    const postsHTML = posts.map(post => `
        <article style="background:#fff;padding:1.5rem;border-radius:8px;box-shadow:0 2px 8px rgba(0,0,0,0.1);margin-bottom:1rem;">
            <h2 style="margin:0 0 0.5rem 0;color:#333;">${escapeHtml(post.title)}</h2>
            <div style="color:#666;font-size:0.9rem;margin-bottom:1rem;">
                ${new Date(post.date).toLocaleDateString('ru-RU')} • ${escapeHtml(post.author)}
            </div>
            <div style="line-height:1.6;color:#444;">
                ${escapeHtml(post.content).replace(/\n/g, '<br>')}
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
document.addEventListener('DOMContentLoaded', function() {
    const container = document.getElementById('posts-container');
    if (container) {
        const locale = getCurrentLocale();
        console.log('Автоматическая загрузка постов для языка:', locale);
        renderBlogPosts('posts-container', locale);
    }
});

// Экспорт функций для использования в админке
window.FlamingoBlogSimple = {
    addPost,
    getPosts,
    renderBlogPosts,
    getCurrentLocale,
    loadPosts,
    savePosts
};
