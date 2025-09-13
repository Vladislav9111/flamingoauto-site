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
        if (!window.netlifyIdentity || !window.netlifyIdentity.currentUser()) {
            alert('❌ Войдите через Netlify Identity для публикации');
            return false;
        }

        const token = await window.netlifyIdentity.currentUser().jwt();
        
        // Создаем имя файла
        const date = new Date(post.date);
        const dateStr = date.toISOString().split('T')[0];
        const slug = post.title.toLowerCase()
            .replace(/[^a-zа-яё0-9\s]/gi, '')
            .replace(/\s+/g, '-')
            .substring(0, 50);
        const filename = `${dateStr}-${slug}.md`;

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

        // Отправляем через Git Gateway
        const response = await fetch(`/.netlify/git/github/contents/content/blog/${filename}`, {
            method: 'PUT',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json',
                'Accept': 'application/vnd.github.v3+json'
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
            console.log('✅ Статья опубликована');
            return true;
        } else {
            console.warn('⚠️ Статья сохранена только локально');
            return true; // Не показываем ошибку в админке
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
        const response = await fetch('/.netlify/functions/get-posts');
        if (response.ok) {
            const posts = await response.json();
            savePosts(posts); // Кешируем локально
            return posts;
        }
        return [];
    } catch (error) {
        console.error('Ошибка загрузки:', error);
        return [];
    }
}

// Получение постов
async function getPosts(locale = null) {
    // Сначала пробуем GitHub, потом localStorage
    let posts = await loadPostsFromGitHub();
    if (posts.length === 0) {
        posts = loadPosts();
    }

    // Фильтруем по языку
    if (locale) {
        return posts.filter(post => {
            const postLocale = (post.locale || 'all').toLowerCase();
            return postLocale === 'all' || postLocale === locale.toLowerCase();
        });
    }
    
    return posts;
}

// Экспорт
window.FlamingoBlogSimple = {
    addPost,
    getPosts,
    loadPosts,
    savePosts
};