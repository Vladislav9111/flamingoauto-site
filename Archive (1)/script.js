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
    
        try {
            // === Helper: progress UI ===
            function ensureProgressUI(){
                let box = document.getElementById('upload-progress-box');
                if (!box){
                    box = document.createElement('div');
                    box.id = 'upload-progress-box';
                    box.style.cssText = 'position:fixed;left:12px;right:12px;bottom:12px;padding:10px;background:#111;color:#fff;border-radius:10px;box-shadow:0 6px 20px rgba(0,0,0,.35);z-index:9999;font-family:system-ui,-apple-system,Segoe UI,Roboto,Arial,sans-serif';
                    const label = document.createElement('div');
                    label.id = 'upload-progress-text';
                    label.style.cssText = 'font-size:13px;opacity:.9';
                    label.textContent = '0%';
                    const barWrap = document.createElement('div');
                    barWrap.style.cssText = 'width:100%;height:10px;background:#2a2a2a;border-radius:6px;overflow:hidden;margin-top:6px;';
                    const bar = document.createElement('div');
                    bar.id = 'upload-progress-bar';
                    bar.style.cssText = 'width:0%;height:100%;background:linear-gradient(90deg,#4ea7ff,#6effb5);transition:width .2s ease;';
                    barWrap.appendChild(bar); box.appendChild(label); box.appendChild(barWrap);
                    document.body.appendChild(box);
                }
                return box;
            }
            function updateProgressUI(p,t){ ensureProgressUI(); 
                const bar = document.getElementById('upload-progress-bar'); 
                const label = document.getElementById('upload-progress-text');
                if (bar) bar.style.width = Math.max(0,Math.min(100,p)) + '%';
                if (label) label.textContent = t || (Math.round(p)+'%');
            }
            function removeProgressUI(){ const box = document.getElementById('upload-progress-box'); if (box) box.remove(); }

            // === Compression helpers ===
            const MB = 1024*1024;
            const TARGET_SINGLE = 2.5*MB; // целевой размер одного файла
            const MAX_DIM = 1920;
            function isImg(f){ return /^image\\//i.test(f && f.type || '') }
            function loadImg(file){
                return new Promise((resolve,reject)=>{
                    const url = URL.createObjectURL(file);
                    const img = new Image();
                    img.onload=()=>{ URL.revokeObjectURL(url); resolve(img); };
                    img.onerror=e=>{ URL.revokeObjectURL(url); reject(e); };
                    img.src = url;
                });
            }
            function canvasToBlob(canvas, type, quality){
                return new Promise(res=> canvas.toBlob(res, type, quality));
            }
            async function compressOne(file){
                if (!isImg(file)) return file;
                try{
                    const img = await loadImg(file);
                    const w = img.naturalWidth||img.width, h = img.naturalHeight||img.height;
                    const scale = Math.min(1, MAX_DIM/Math.max(1,w), MAX_DIM/Math.max(1,h));
                    const cw = Math.max(1, Math.round(w*scale)), ch = Math.max(1, Math.round(h*scale));
                    const c = document.createElement('canvas'); c.width=cw; c.height=ch;
                    c.getContext('2d',{alpha:false}).drawImage(img,0,0,cw,ch);
                    let q = 0.82, blob = await canvasToBlob(c,'image/webp',q);
                    const steps = [0.7,0.6,0.5,0.42,0.35,0.28,0.22,0.18,0.14];
                    let si = 0;
                    while (blob && blob.size > TARGET_SINGLE && si < steps.length){
                        q = steps[si++];
                        blob = await canvasToBlob(c,'image/webp',q);
                    }
                    if (!blob) blob = await canvasToBlob(c,'image/jpeg',0.8);
                    if (!blob) return file;
                    const name = (file.name||'image').replace(/\.(png|jpg|jpeg|webp|gif|bmp|tif|tiff|heic|heif)$/i,'') + (blob.type.includes('webp')?'.webp':'.jpg');
                    return new File([blob], name, {type: blob.type, lastModified: Date.now()});
                }catch(_){ return file; }
            }

            // === Build message as раньше ===
            let message = '';
            const formElements = form.elements;
            const addField = (label, value) => {
                if (value && value.trim()) {
                    message += `<b>${label}:</b> ${value.trim()}\\n`;
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
                message += `<b>Soovitud hind (€):</b> ${formElements['price'].value.trim()} €\\n`;
            }
            addField('Nimi', formElements['name'].value);
            addField('E-post', formElements['email'].value);
            addField('Telefon', formElements['phone'].value);
            addField('Linn', formElements['city'].value);
            addField('Lisainfo', formElements['note'].value);

            const files = photoInput && photoInput.files ? Array.from(photoInput.files).slice(0,10) : [];

            // Compress photos one-by-one
            const compressed = [];
            for (let i=0;i<files.length;i++){
                updateProgressUI((i*100)/(files.length+1), (document.documentElement.lang==='ru'?'Сжатие…':'Tihendamine…'));
                compressed.push(await compressOne(files[i]));
            }

            if (compressed.length > 0){
                // send album with XHR to show upload progress
                const formData = new FormData();
                formData.append('chat_id', CHAT_ID);
                const media = [];
                compressed.forEach((file, i)=>{
                    const key = `photo${i}`;
                    formData.append(key, file, file.name);
                    const mediaInfo = { type: 'photo', media: `attach://${key}` };
                    if (i === 0) { mediaInfo.caption = message; mediaInfo.parse_mode = 'HTML'; }
                    media.push(mediaInfo);
                });
                formData.append('media', JSON.stringify(media));

                ensureProgressUI();
                updateProgressUI(1, (document.documentElement.lang==='ru' ? 'Подготовка…' : 'Ettevalmistamine…'));

                await new Promise((resolve, reject)=>{
                    const xhr = new XMLHttpRequest();
                    xhr.open('POST', `https://api.telegram.org/bot${BOT_TOKEN}/sendMediaGroup`, true);
                    xhr.timeout = 120000;
                    xhr.upload.onprogress = (e)=>{
                        if (e && e.lengthComputable){
                            const p = (e.loaded / e.total) * 100;
                            const label = (document.documentElement.lang==='ru')
                                ? `Загрузка… ${Math.round(p)}%` : `Üleslaadimine… ${Math.round(p)}%`;
                            updateProgressUI(p, label);
                        } else {
                            updateProgressUI(5, (document.documentElement.lang==='ru')?'Подготовка…':'Ettevalmistamine…');
                        }
                    };
                    xhr.onreadystatechange = ()=>{
                        if (xhr.readyState === 4){
                            if (xhr.status>=200 && xhr.status<300) resolve();
                            else reject(new Error('status_'+xhr.status));
                        }
                    };
                    xhr.onerror = ()=> reject(new Error('network_error'));
                    xhr.ontimeout = ()=> reject(new Error('timeout'));
                    xhr.send(formData);
                });

            } else {
                // Text only
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

            // Success UI
            const popup = document.getElementById('popup');
            if (popup) popup.classList.remove('hidden');
            if (typeof removeProgressUI === 'function') setTimeout(removeProgressUI, 1200);
            form.reset();
            photoError.textContent = '';
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