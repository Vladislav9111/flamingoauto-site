import { BOT_TOKEN, CHAT_ID } from './config.js';

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
function renderPosts() {
    const container = document.getElementById('posts-container');
    const noPosts = document.getElementById('no-posts');
    if (!container) return;
    const raw = localStorage.getItem(POSTS_KEY);
    let posts = [];
    try { posts = raw ? JSON.parse(raw) : []; } catch (e) { posts = []; }
    container.innerHTML = '';
    // determine current page locale: 'et', 'ru', or null (show all)
    const path = (location.pathname || '').toLowerCase();
    let currentLocale = null;
    // robust detection: check for explicit blog filenames or page language hints
    if (path.includes('blog-et') || path.includes('index.html') || path.endsWith('/')) currentLocale = 'et';
    else if (path.includes('blog-ru') || path.includes('ru.html')) currentLocale = 'ru';
    // if currentLocale is null, we show all posts (generic blog page / admin preview)
    if (currentLocale) {
        posts = posts.filter(p => {
            // posts with locale 'all' should be shown on any localized blog,
            // posts specifically tagged 'et' shown on Estonian blog only, 'ru' on Russian only.
            const locale = (p.locale || 'all').toLowerCase();
            if (locale === 'all') return true;
            return locale === currentLocale;
        });
    }
    if (!posts || posts.length === 0) {
        if (noPosts) noPosts.style.display = '';
        return;
    }
    if (noPosts) noPosts.style.display = 'none';
    posts.slice().reverse().forEach(post => {
        const article = document.createElement('article');
        article.className = 'blog-post';
        article.style.background = '#fff';
        article.style.padding = '1.25rem';
        article.style.borderRadius = '8px';
        // build gallery html if photos exist
        const hasPhotos = post.photos && post.photos.length;
        const galleryClass = hasPhotos && post.photos.length > 1 ? 'post-gallery multiple' : 'post-gallery';
        const photosHtml = hasPhotos ? `<div class="${galleryClass}">${post.photos.slice(0,6).map((p, idx) => `<img src="${p}" alt="Post image ${idx+1}">`).join('')}</div>` : '';
        article.innerHTML = `
            <div class="post-grid">
                <div class="post-text">
                    <h2>${escapeHtml(post.title)}</h2>
                    <p style="color:#444">${escapeHtml(post.excerpt)}</p>
                    ${post.content ? `<div style="margin-top:0.75rem;color:#333">${sanitizeSimpleHtml(post.content)}</div>` : ''}
                </div>
                ${photosHtml || '<div class="post-gallery"></div>'}
            </div>
        `;
        container.appendChild(article);
    });
}

/**
 * Escape plain text to prevent injection for title/excerpt
 */
function escapeHtml(str = '') {
    return String(str)
        .replace(/&/g, '&')
        .replace(/</g, '<')
        .replace(/>/g, '>')
        .replace(/"/g, '"')
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
        .replace(/<(\/?(b|strong|i|em|br|p))>/g, '<$1>');
    return escaped;
}

// GitHub API blog loading functionality
async function loadBlogPosts() {
    try {
        // Fetch blog posts directly from GitHub API
        const response = await fetch('https://api.github.com/repos/Vladislav9111/flamingoauto-site/contents/content/blog');
        if (response.ok) {
            const files = await response.json();
            const markdownFiles = files.filter(file => file.name.endsWith('.md'));
            
            if (markdownFiles.length > 0) {
                const posts = await Promise.all(
                    markdownFiles.map(async (file) => {
                        const contentResponse = await fetch(file.download_url);
                        const content = await contentResponse.text();
                        return parseMarkdownPost(content, file.name);
                    })
                );
                
                // Sort by date (newest first)
                posts.sort((a, b) => new Date(b.date) - new Date(a.date));
                displayBlogPosts(posts);
            } else {
                showNoPosts();
            }
        } else {
            showNoPosts();
        }
    } catch (error) {
        console.log('Error loading blog posts:', error);
        showNoPosts();
    }
}

// Parse Markdown file to extract front matter and metadata
function parseMarkdownPost(content, filename) {
    const lines = content.split('\n');
    const frontmatter = {};
    let contentStart = 0;
    
    // Parse frontmatter (metadata between ---)
    if (lines[0] === '---') {
        let i = 1;
        while (i < lines.length && lines[i] !== '---') {
            const line = lines[i].trim();
            if (line && !line.startsWith('#')) {
                const colonIndex = line.indexOf(':');
                if (colonIndex > 0) {
                    const key = line.substring(0, colonIndex).trim();
                    let value = line.substring(colonIndex + 1).trim();
                    
                    // Remove quotes from value
                    if ((value.startsWith('"') && value.endsWith('"')) || 
                        (value.startsWith("'") && value.endsWith("'"))) {
                        value = value.slice(1, -1);
                    }
                    
                    // Handle arrays (tags)
                    if (value.startsWith('[') && value.endsWith(']')) {
                        try {
                            value = JSON.parse(value);
                        } catch (e) {
                            // Keep as string if JSON parsing fails
                        }
                    }
                    
                    frontmatter[key] = value;
                }
            }
            i++;
        }
        contentStart = i + 1;
    }
    
    // Extract content after frontmatter
    const bodyLines = lines.slice(contentStart);
    const body = bodyLines.join('\n').trim();
    
    // Extract excerpt from body (first paragraph or 150 chars)
    let excerpt = '';
    if (frontmatter.description) {
        excerpt = frontmatter.description;
    } else if (body) {
        const firstParagraph = body.split('\n\n')[0].replace(/#+\s*/, '').trim();
        excerpt = firstParagraph.length > 150 ? 
            firstParagraph.substring(0, 150) + '...' : 
            firstParagraph;
    }
    
    return {
        title: frontmatter.title || 'Без названия',
        excerpt: excerpt,
        content: body,
        date: frontmatter.date || new Date().toISOString(),
        locale: frontmatter.lang || 'ru',
        tags: frontmatter.tags || [],
        thumbnail: frontmatter.thumbnail || '',
        photos: frontmatter.thumbnail ? [frontmatter.thumbnail] : []
    };
}

// Display blog posts in the container
function displayBlogPosts(posts) {
    const container = document.getElementById('posts-container');
    const noPosts = document.getElementById('no-posts');
    if (!container) return;
    
    container.innerHTML = '';
    
    // Filter posts by current page locale
    const path = (location.pathname || '').toLowerCase();
    let currentLocale = null;
    if (path.includes('blog-et') || path.includes('index.html') || path.endsWith('/')) {
        currentLocale = 'et';
    } else if (path.includes('blog-ru') || path.includes('ru.html')) {
        currentLocale = 'ru';
    }
    
    let filteredPosts = posts;
    if (currentLocale) {
        filteredPosts = posts.filter(p => {
            const locale = (p.locale || 'all').toLowerCase();
            if (locale === 'all') return true;
            return locale === currentLocale;
        });
    }
    
    if (!filteredPosts || filteredPosts.length === 0) {
        if (noPosts) noPosts.style.display = '';
        return;
    }
    
    if (noPosts) noPosts.style.display = 'none';
    
    filteredPosts.forEach(post => {
        const article = document.createElement('article');
        article.className = 'blog-post';
        article.style.cssText = `
            background: #fff;
            padding: 1.25rem;
            border-radius: 8px;
            box-shadow: 0 2px 4px rgba(0,0,0,0.1);
            transition: transform 0.2s ease, box-shadow 0.2s ease;
        `;
        
        // Add hover effect
        article.addEventListener('mouseenter', () => {
            article.style.transform = 'translateY(-2px)';
            article.style.boxShadow = '0 4px 12px rgba(0,0,0,0.15)';
        });
        article.addEventListener('mouseleave', () => {
            article.style.transform = 'translateY(0)';
            article.style.boxShadow = '0 2px 4px rgba(0,0,0,0.1)';
        });
        
        // Build gallery HTML if photos exist
        const hasPhotos = post.photos && post.photos.length;
        const galleryClass = hasPhotos && post.photos.length > 1 ? 'post-gallery multiple' : 'post-gallery';
        const photosHtml = hasPhotos ? 
            `<div class="${galleryClass}" style="margin-top: 1rem;">
                ${post.photos.slice(0, 6).map((p, idx) => 
                    `<img src="${p}" alt="Post image ${idx + 1}" style="max-width: 100%; height: auto; border-radius: 4px;">`
                ).join('')}
            </div>` : '';
        
        // Format date
        const dateObj = new Date(post.date);
        const formattedDate = dateObj.toLocaleDateString('ru-RU', {
            year: 'numeric',
            month: 'long',
            day: 'numeric'
        });
        
        article.innerHTML = `
            <div class="post-content">
                <h2 style="margin: 0 0 0.5rem 0; color: #333;">${escapeHtml(post.title)}</h2>
                <p style="color: #666; font-size: 0.9rem; margin-bottom: 0.75rem;">${formattedDate}</p>
                <p style="color: #444; line-height: 1.5;">${escapeHtml(post.excerpt)}</p>
                ${photosHtml}
                ${post.tags && post.tags.length > 0 ? 
                    `<div style="margin-top: 1rem;">
                        ${post.tags.map(tag => 
                            `<span style="display: inline-block; background: #e3f2fd; color: #1976d2; padding: 0.25rem 0.5rem; border-radius: 12px; font-size: 0.8rem; margin-right: 0.5rem; margin-bottom: 0.5rem;">#${escapeHtml(tag)}</span>`
                        ).join('')}
                    </div>` : 
                    ''
                }
            </div>
        `;
        
        container.appendChild(article);
    });
}

// Show no posts message
function showNoPosts() {
    const container = document.getElementById('posts-container');
    const noPosts = document.getElementById('no-posts');
    if (container) container.innerHTML = '';
    if (noPosts) noPosts.style.display = '';
}

// expose functions for pages that load this script
window.FlamingoBlog = {
    renderPosts,
    loadBlogPosts,
    POSTS_KEY
};

// initialize posts render on pages where posts-container exists
document.addEventListener('DOMContentLoaded', () => {
    // Check if we're on a blog page
    const container = document.getElementById('posts-container');
    if (container) {
        // Load real blog posts from GitHub API
        loadBlogPosts();
    } else {
        // Fallback to localStorage posts if not on blog page
        renderPosts();
    }
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
