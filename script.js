// Configuration - использует переменные окружения Netlify или локальный config.js
let BOT_TOKEN, CHAT_ID;

try {
    // Пытаемся загрузить локальную конфигурацию для разработки
    const config = await import('./config.js');
    BOT_TOKEN = config.BOT_TOKEN;
    CHAT_ID = config.CHAT_ID;
} catch (e) {
    // Для продакшн используем переменные окружения Netlify
    // В Netlify они будут внедрены в процессе сборки
    BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN || 'your_telegram_bot_token_here';
    CHAT_ID = process.env.TELEGRAM_CHAT_ID || 'your_telegram_chat_id_here';
}

const form = document.getElementById('car-form');
const popup = document.getElementById('popup');
const closeBtn = document.querySelector('.close-btn');
const photoInput = document.getElementById('photos');
const photoError = document.getElementById('photo-error');

// New: simple blog storage & rendering utilities
const POSTS_KEY = 'flamingo_posts';

/**
 * Render posts into the blog page (if posts-container exists)
 */
async function renderPosts() {
    const container = document.getElementById('posts-container');
    const noPosts = document.getElementById('no-posts');
    if (!container) return;
    
    try {
        console.log('Starting to load posts...');
        // Пытаемся загрузить статьи из папки content/blog
        const response = await fetch('/.netlify/functions/get-posts');
        let posts = [];

        console.log('Netlify function response status:', response.status);
        if (response.ok) {
            posts = await response.json();
            console.log('✅ Loaded posts from Netlify function:', posts);
        } else {
            console.log('❌ Netlify function not available, trying posts.json');
            // Пробуем загрузить из posts.json
            try {
                const jsonResponse = await fetch('./posts.json');
                console.log('posts.json response status:', jsonResponse.status);
                if (jsonResponse.ok) {
                    posts = await jsonResponse.json();
                    console.log('✅ Loaded posts from posts.json:', posts);
                } else {
                    throw new Error('posts.json not found');
                }
            } catch (jsonError) {
                console.log('❌ posts.json not available, trying localStorage');
                console.error('posts.json error:', jsonError);
                // Если нет posts.json, пробуем localStorage (для обратной совместимости)
                const raw = localStorage.getItem(POSTS_KEY);
                try { posts = raw ? JSON.parse(raw) : []; } catch (e) { posts = []; }
                console.log('📦 Loaded posts from localStorage:', posts);
            }
        }
        
        container.innerHTML = '';
        
        // determine current page locale: 'et', 'ru', or null (show all)
        const path = (location.pathname || '').toLowerCase();
        let currentLocale = null;

        if (path.includes('blog-et') || path.includes('index.html') || path.endsWith('/')) currentLocale = 'et';
        else if (path.includes('blog-ru') || path.includes('ru.html')) currentLocale = 'ru';

        console.log('Current path:', path);
        console.log('Detected locale:', currentLocale);
        console.log('Posts before filtering:', posts);

        // Фильтруем по языку
        if (currentLocale) {
            posts = posts.filter(p => {
                const locale = (p.locale || 'all').toLowerCase();
                const shouldShow = locale === 'all' || locale === currentLocale;
                console.log(`Post "${p.title}" with locale "${locale}" should show: ${shouldShow}`);
                return shouldShow;
            });
        }

        console.log('Posts after filtering:', posts);
        
        if (!posts || posts.length === 0) {
            if (noPosts) noPosts.style.display = '';
            return;
        }
        
        if (noPosts) noPosts.style.display = 'none';
        
        // Отображаем посты (новые сверху)
        posts.slice().reverse().forEach(post => {
            const article = document.createElement('article');
            article.className = 'blog-post';
            article.style.background = '#fff';
            article.style.padding = '1.25rem';
            article.style.borderRadius = '8px';
            
            // Посты из markdown могут не иметь photos
            const hasPhotos = post.photos && post.photos.length;
            const galleryClass = hasPhotos && post.photos.length > 1 ? 'post-gallery multiple' : 'post-gallery';
            const photosHtml = hasPhotos ? `<div class="${galleryClass}">${post.photos.slice(0,6).map((p, idx) => `<img src="${p}" alt="Post image ${idx+1}">`).join('')}</div>` : '';
            
            article.innerHTML = `
                <div class="post-grid">
                    <div class="post-text">
                        <h2>${escapeHtml(post.title)}</h2>
                        <p style="color:#444">${escapeHtml(post.excerpt)}</p>
                        ${post.content ? `<div style="margin-top:0.75rem;color:#333">${sanitizeSimpleHtml(post.content)}</div>` : ''}
                        ${post.author ? `<small style="color:#666;margin-top:0.5rem;display:block;">Автор: ${escapeHtml(post.author)}</small>` : ''}
                        ${post.date ? `<small style="color:#666;">Дата: ${new Date(post.date).toLocaleDateString()}</small>` : ''}
                    </div>
                    ${photosHtml || '<div class="post-gallery"></div>'}
                </div>
            `;
            container.appendChild(article);
        });
        
    } catch (error) {
        console.error('Error loading posts:', error);
        console.error('Error details:', error.message, error.stack);
        if (noPosts) {
            noPosts.style.display = '';
            noPosts.innerHTML = `<h2>Ошибка загрузки</h2><p>Не удалось загрузить статьи блога.</p><p>Ошибка: ${error.message}</p>`;
        }
    }
}

/**
 * Escape plain text to prevent injection for title/excerpt
 */
function escapeHtml(str = '') {
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

/**
 * Very small sanitizer to allow a handful of inline tags in content (b, i, strong, em, br, p)
 * Keeps things simple for this demo admin.
 */
function sanitizeSimpleHtml(input = '') {
    // Remove script tags and event handlers
    const tmp = document.createElement('div');
    tmp.textContent = input;
    let escaped = tmp.innerHTML;
    // allow limited tags by replacing encoded tags back (after a whitelist)
    // For a simple approach: allow <b>, <strong>, <i>, <em>, <br>, <p>
    escaped = escaped
        .replace(/&lt;(\/?(b|strong|i|em|br|p))&gt;/g, '<$1>');
    return escaped;
}

// expose renderPosts for pages that load this script
window.FlamingoBlog = {
    renderPosts,
    POSTS_KEY
};

// initialize posts render on pages where posts-container exists
document.addEventListener('DOMContentLoaded', () => {
    renderPosts();
});

function validatePhotos() {
    photoError.textContent = '';
    if (photoInput.files.length > 6) {
        photoError.textContent = 'Saate üles laadida mitte rohkem kui 6 fotot.';
        return false;
    }
    return true;
}

photoInput.addEventListener('change', validatePhotos);

form.addEventListener('submit', async function(event) {
    event.preventDefault();

    const arePhotosValid = validatePhotos();
    // Force validation UI to show on all fields
    if (!form.checkValidity()) {
        form.reportValidity();
        return;
    }
    const isFormValid = form.checkValidity();

    if (isFormValid && arePhotosValid) {
        const submitButton = document.getElementById('submit-btn');
        submitButton.disabled = true;
        submitButton.textContent = 'Saatmine...';

        const formElements = form.elements;
        let message = '📩 Teile uus taotlus:\n\n';

        const addField = (label, value) => {
            if (value && value.trim()) {
                message += `<b>${label}:</b> ${value.trim()}\n`;
            }
        };

        addField('Reg nr', formElements['reg-number'].value);
        addField('Mark', formElements['make'].value);
        addField('Mudel', formElements['model'].value);
        addField('Tootmisaasta', formElements['year'].value);
        addField('Läbisõit', formElements['mileage'].value);
        addField('Käigukast', formElements['transmission'].value);
        addField('Mootor', formElements['engine'].value);
        if (formElements['price'].value && formElements['price'].value.trim()) {
            message += `<b>Soovitud hind (€):</b> ${formElements['price'].value.trim()} €\n`;
        }
        addField('Nimi', formElements['name'].value);
        addField('E-post', formElements['email'].value);
        addField('Telefon', formElements['phone'].value);
        addField('Linn', formElements['city'].value);
        addField('Lisainfo', formElements['note'].value);
        
        const files = photoInput.files;

        try {
            if (files.length > 0) {
                // Sending photos with caption
                const formData = new FormData();
                formData.append('chat_id', CHAT_ID);

                const media = [];
                for (let i = 0; i < files.length; i++) {
                    const file = files[i];
                    const photoKey = `photo${i}`;
                    formData.append(photoKey, file, file.name);
                    const mediaInfo = { type: 'photo', media: `attach://${photoKey}` };
                    if (i === 0) {
                        mediaInfo.caption = message;
                        mediaInfo.parse_mode = 'HTML';
                    }
                    media.push(mediaInfo);
                }
                formData.append('media', JSON.stringify(media));

                const response = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMediaGroup`, {
                    method: 'POST',
                    body: formData
                });
                if (!response.ok) throw new Error('Failed to send photos to Telegram');

            } else {
                // Sending text only
                await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        chat_id: CHAT_ID,
                        text: message,
                        parse_mode: 'HTML'
                    })
                });
            }
            
            popup.classList.remove('hidden');
            form.reset();
            photoError.textContent = '';

        } catch (error) {
            console.error('Telegram API Error:', error);
            alert('Küsimustikku ei õnnestunud saata. Palun proovige uuesti.');
        } finally {
            submitButton.disabled = false;
            submitButton.textContent = 'Saada päring';
        }

    } else {
        console.log('Form submission failed validation.');
        if(!isFormValid) form.reportValidity();
    }
});

function closePopup() {
    popup.classList.add('hidden');
}

closeBtn.addEventListener('click', closePopup);

popup.addEventListener('click', function(event) {
    // Close popup if the background overlay is clicked
    if (event.target === popup) {
        closePopup();
    }
});

// No in-page language toggle anymore — site uses separate pages (index.html = ET, ru.html = RU)

// Insert dynamic year for both pages if elements exist
(function setFooterYear() {
    const year = new Date().getFullYear();
    const elEt = document.getElementById('year-et');
    const elRu = document.getElementById('year-ru');
    if (elEt) elEt.textContent = year;
    if (elRu) elRu.textContent = year;
})();

// Small init for language switch: ensure aria-pressed matches current page and keyboard focus style
(function initLangSwitch() {
    const switchContainer = document.querySelector('.lang-switch');
    if (!switchContainer) return;
    const buttons = switchContainer.querySelectorAll('.lang-btn');
    buttons.forEach(btn => {
        // Make Enter/Space activate link for keyboard users (anchor normally does, but ensure role/tab behavior)
        btn.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                btn.click();
            }
        });
        // set aria-pressed based on href matching current location
        try {
            const href = new URL(btn.href, location.href).pathname.split('/').pop();
            const current = location.pathname.split('/').pop() || 'index.html';
            btn.setAttribute('aria-pressed', href === current ? 'true' : 'false');
            if (href === current) btn.classList.add('active');
        } catch (e) { /* ignore URL errors */ }
    });
})();