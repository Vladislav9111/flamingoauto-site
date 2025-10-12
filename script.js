const form = document.getElementById('car-form');
const popup = document.getElementById('popup');
const closeBtn = document.querySelector('.close-btn');
const photoInput = document.getElementById('photos');

/*__ALWAYS_SEND_PIPELINE__*/
const BYTES_MB = 1024 * 1024;
const TARGET_BUDGET = 4.8 * BYTES_MB;
const HARD_BUDGET   = 5.2 * BYTES_MB;
function isImgAny(f){ return /^image\//i.test(f.type || '') }
if (!HTMLCanvasElement.prototype.toBlob) {
  HTMLCanvasElement.prototype.toBlob = function (callback, type, quality) {
    const dataURL = this.toDataURL(type, quality);
    const byteString = atob(dataURL.split(',')[1] || '');
    const ab = new ArrayBuffer(byteString.length);
    const ia = new Uint8Array(ab);
    for (let i = 0; i < byteString.length; i++) ia[i] = byteString.charCodeAt(i);
    callback(new Blob([ab], { type: type || 'image/png' }));
  };
}
function revoke(url){ try{ URL.revokeObjectURL(url); }catch(_){} }
function loadImgFromFile(file){
  return new Promise((resolve, reject)=>{
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = ()=>{ revoke(url); resolve(img); };
    img.onerror = (e)=>{ revoke(url); reject(e); };
    img.src = url;
  });
}
async function toWebPOrJPEG(file, quality=0.82, maxDim=1920){
  try{
    const img = await loadImgFromFile(file);
    const w = img.naturalWidth || img.width, h = img.naturalHeight || img.height;
    const scale = Math.min(1, maxDim/Math.max(1,w), maxDim/Math.max(1,h));
    const tw = Math.max(1, Math.round(w*scale)), th = Math.max(1, Math.round(h*scale));
    const c = document.createElement('canvas'); c.width=tw; c.height=th;
    const ctx = c.getContext('2d',{alpha:false});
    ctx.drawImage(img, 0, 0, tw, th);
    let blob = await new Promise(res=> c.toBlob(res, 'image/webp', quality));
    if (!blob) blob = await new Promise(res=> c.toBlob(res, 'image/jpeg', Math.max(0.6,quality)));
    if (!blob) return null;
    const name = (file.name||'image').replace(/\.(png|jpg|jpeg|webp|gif|bmp|tif|tiff|heic|heif)$/i,'') + (blob.type.includes('webp')?'.webp':'.jpg');
    return new File([blob], name, {type: blob.type, lastModified: Date.now()});
  }catch(e){
    console.warn('decode-failed skip:', file && file.type, e);
    return null;
  }
}
function sumBytes(list){ return list.reduce((a,f)=> a + ((f && f.size)||0), 0) }
async function compressEnsureUnderBudget(files){
  let work = [];
  for (const f of files){
    if (isImgAny(f)){
      const conv = await toWebPOrJPEG(f, 0.82, 1920);
      if (conv) work.push(conv);
    } else {
      work.push(f);
    }
  }
  const rounds = [
    {q:0.70, dim:1600},
    {q:0.58, dim:1280},
    {q:0.50, dim:1024},
    {q:0.42, dim:900},
    {q:0.35, dim:800},
    {q:0.28, dim:720},
    {q:0.24, dim:640},
  ];
  for (let r=0; r<rounds.length && sumBytes(work)>TARGET_BUDGET; r++){
    const {q, dim} = rounds[r];
    work.sort((a,b)=> (b.size||0)-(a.size||0));
    for (let i=0; i<work.length && sumBytes(work)>TARGET_BUDGET; i++){
      if (!isImgAny(work[i])) continue;
      const smaller = await toWebPOrJPEG(work[i], q, dim);
      if (smaller && smaller.size < work[i].size) work[i]=smaller;
    }
  }
  while (sumBytes(work) > HARD_BUDGET && work.length>0){
    work.sort((a,b)=> (b.size||0)-(a.size||0));
    work.shift();
  }
  return work;
}
const photoError = document.getElementById('photo-error');

// Initialize language on page load
document.addEventListener('DOMContentLoaded', function() {
    // Check multiple ways to determine if it's Russian
    const isRussian = window.location.pathname.includes('ru.html') || 
                     window.location.pathname.includes('/ru.html') ||
                     window.location.pathname.endsWith('ru') ||
                     document.documentElement.lang === 'ru' ||
                     document.querySelector('html[lang="ru"]') !== null ||
                     document.title.includes('Продайте авто');
    
    // Debug: log current language detection
    console.log('Current path:', window.location.pathname);
    console.log('HTML lang:', document.documentElement.lang);
    console.log('Document title:', document.title);
    console.log('Is Russian:', isRussian);
    
    // Update button texts
    const submitBtn = document.getElementById('submit-btn');
    const heroBtn = document.querySelector('.btn');
    const popupMessage = document.querySelector('#popup p');
    
    if (isRussian) {
        if (submitBtn) submitBtn.textContent = 'Отправить заявку';
        if (heroBtn) heroBtn.textContent = 'Отправить заявку';
        if (popupMessage) popupMessage.textContent = 'Ваша заявка отправлена';
        console.log('Set Russian language');
    } else {
        if (submitBtn) submitBtn.textContent = 'Saada päring';
        if (heroBtn) heroBtn.textContent = 'Saada päring';
        if (popupMessage) popupMessage.textContent = 'Teie ankeet on saadetud';
        console.log('Set Estonian language');
    }
});

function validatePhotos() {
    photoError.textContent = '';
    if (photoInput.files.length > 6) {
        // Check current page language for error message
        const isRussian = window.location.pathname.includes('ru.html') || 
                         window.location.pathname.includes('/ru.html') ||
                         window.location.pathname.endsWith('ru') ||
                         document.documentElement.lang === 'ru' ||
                         document.title.includes('Продайте авто');
        photoError.textContent = isRussian 
            ? 'Можно загрузить не более 6 фотографий.'
            : 'Saate üles laadida mitte rohkem kui 6 fotot.';
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
        const isRussian = window.location.pathname.includes('ru.html') || 
                         window.location.pathname.includes('/ru.html') ||
                         window.location.pathname.endsWith('ru') ||
                         document.documentElement.lang === 'ru' ||
                         document.title.includes('Продайте авто');
        
        submitButton.disabled = true;
        submitButton.textContent = isRussian ? 'Отправка...' : 'Saatmine...';

        const formElements = form.elements;

        // Prepare form data with photos
        const formData = new FormData();

        // Add text fields
        formData.append('regNumber', formElements['reg-number'].value);
        formData.append('make', formElements['make'].value);
        formData.append('model', formElements['model'].value);
        formData.append('year', formElements['year'].value);
        formData.append('mileage', formElements['mileage'].value);
        formData.append('transmission', formElements['transmission'].value);
        formData.append('engine', formElements['engine'].value);
        formData.append('price', formElements['price'].value);
        formData.append('name', formElements['name'].value);
        formData.append('email', formElements['email'].value);
        formData.append('phone', formElements['phone'].value);
        formData.append('city', formElements['city'].value);
        formData.append('note', formElements['note'].value);

        
        // Add photos — ALWAYS send (auto WebP/JPEG + ensure budget)
        const rawFiles = Array.from(photoInput.files).slice(0, 20);
        const files = await compressEnsureUnderBudget(rawFiles);
        for (let i = 0; i < files.length; i++) {
            formData.append(`photo${i}`, files[i]);
        }
        formData.append('photoCount', String(files.length));


        try {
            // Send to Netlify Function (with photos)
            const response = await fetch('/.netlify/functions/send-telegram', {
                method: 'POST',
                body: formData // No Content-Type header for FormData
            });

            const result = await response.json();

            if (response.ok && result.success) {
                // Show success popup
                popup.classList.remove('hidden');
                form.reset();
                photoError.textContent = '';
            } else {
                throw new Error(result.error || 'Unknown error');
            }

        } catch (error) {
            console.error('Form submission error:', error);
            const errorMessage = isRussian 
                ? 'Не удалось отправить заявку. Пожалуйста, попробуйте еще раз.'
                : 'Küsimustikku ei õnnestunud saata. Palun proovige uuesti.';
            alert(errorMessage);
        } finally {
            submitButton.disabled = false;
            submitButton.textContent = isRussian ? 'Отправить заявку' : 'Saada päring';
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

// Insert dynamic year for both pages if elements exist
(function setFooterYear() {
    const year = new Date().getFullYear();
    const elEt = document.getElementById('year-et');
    const elRu = document.getElementById('year-ru');
    if (elEt) elEt.textContent = year;
    if (elRu) elRu.textContent = year;
})();

// Language switch initialization
(function initLangSwitch() {
    const switchContainer = document.querySelector('.lang-switch');
    if (!switchContainer) return;

    const buttons = switchContainer.querySelectorAll('.lang-btn');
    buttons.forEach(btn => {
        // Make Enter/Space activate link for keyboard users
        btn.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                btn.click();
            }
        });

        // Set aria-pressed based on href matching current location
        try {
            const href = new URL(btn.href, location.href).pathname.split('/').pop();
            const current = location.pathname.split('/').pop() || 'index.html';
            btn.setAttribute('aria-pressed', href === current ? 'true' : 'false');
            if (href === current) btn.classList.add('active');
        } catch (e) {
            // Ignore URL errors
        }
    });
})();

// Debug function for testing Telegram integration
window.testTelegramFunction = async function() {
    console.log('🧪 Testing Telegram function...');

    const testData = {
        name: 'Test User',
        email: 'test@example.com',
        phone: '+372 12345678',
        regNumber: '123 ABC',
        make: 'Volkswagen',
        model: 'Golf',
        city: 'Tallinn',
        note: 'Test message from debug function'
    };

    try {
        const response = await fetch('/.netlify/functions/send-telegram', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(testData)
        });

        const result = await response.json();

        if (response.ok) {
            console.log('✅ Telegram test SUCCESS:', result);
            alert('✅ Telegram test successful! Check console for details.');
        } else {
            console.error('❌ Telegram test FAILED:', result);
            alert('❌ Telegram test failed: ' + (result.error || 'Unknown error'));
        }
    } catch (error) {
        console.error('❌ Network error:', error);
        alert('❌ Network error: ' + error.message);
    }
};

// Debug function for language detection
window.debugLanguage = function() {
    const isRussian = window.location.pathname.includes('ru.html') || 
                     window.location.pathname.includes('/ru.html') ||
                     window.location.pathname.endsWith('ru') ||
                     document.documentElement.lang === 'ru' ||
                     document.title.includes('Продайте авто');
    
    console.log('🔍 Language Debug Info:');
    console.log('- Current path:', window.location.pathname);
    console.log('- HTML lang:', document.documentElement.lang);
    console.log('- Document title:', document.title);
    console.log('- Includes ru.html:', window.location.pathname.includes('ru.html'));
    console.log('- Includes /ru.html:', window.location.pathname.includes('/ru.html'));
    console.log('- Ends with ru:', window.location.pathname.endsWith('ru'));
    console.log('- Title includes Продайте авто:', document.title.includes('Продайте авто'));
    console.log('- Final isRussian:', isRussian);
    
    alert(`Language detection: ${isRussian ? 'Russian' : 'Estonian'}`);
};
