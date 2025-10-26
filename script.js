const form = document.getElementById('car-form');
const popup = document.getElementById('popup');
const closeBtn = document.querySelector('.close-btn');
const photoInput = document.getElementById('photos');

/*__WEBP_COMPRESS_HELPERS__*/
const BYTES_MB = 1024 * 1024;
const BUDGET = 4.8 * BYTES_MB; // aim lower than server cap (legacy - dokunma)
const ABS_LIMIT = 5.3 * BYTES_MB; // extra safety (legacy - dokunma)

/* === iPhone Safari uyumlu global sınırlar (TOPLAM garanti) === */
const MAX_FILES = 6;                       // en fazla 6 dosya
const SERVER_HARD_LIMIT = 5 * BYTES_MB;    // asla geçme
const TRIGGER_BYTES = 4 * BYTES_MB;        // bunu aşarsa 2 MB hedefine indir
const FINAL_TARGET = 2 * BYTES_MB;         // hedef toplam (tetik sonrası)

/* ---- Tip yardımcıları ---- */
function isImg(f){ return /^image\//i.test(f.type) || /\.hei[c|f]$/i.test((f.name||'')); }
function isHeic(f){
  const t = (f.type||'').toLowerCase(), n = (f.name||'').toLowerCase();
  return t.includes('heic') || t.includes('heif') || /\.hei[c|f]$/.test(n);
}
function totalBytes(files){ return files.reduce((s,f)=> s + (f.size||0), 0); }

/* ---- Canvas yardımcıları (iOS toBlob fallback’li) ---- */
function canvasToBlob(canvas, mime='image/webp', quality=0.82){
  return new Promise((resolve)=>{
    canvas.toBlob((b)=>{
      if (b) return resolve(b);
      try {
        const dataURL = canvas.toDataURL(mime, quality);
        const byteString = atob(dataURL.split(',')[1]||'');
        const ab = new ArrayBuffer(byteString.length);
        const ia = new Uint8Array(ab);
        for (let i=0;i<byteString.length;i++) ia[i] = byteString.charCodeAt(i);
        resolve(new Blob([ab], {type: mime}));
      } catch(e){ resolve(null); }
    }, mime, quality);
  });
}

function drawToCanvas(img, tw, th){
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(tw));
  canvas.height = Math.max(1, Math.round(th));
  const ctx = canvas.getContext('2d', {alpha:false});
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
  return canvas;
}

/* ---- Görsel yükleme ---- */
function loadHTMLImage(url){
  return new Promise((resolve, reject)=>{
    const img = new Image();
    img.onload = ()=> resolve(img);
    img.onerror = reject;
    img.src = url;
  });
}

async function fileToImage(file){
  // (Opsiyonel) Eğer sayfaya heic2any dahil ettiysen (CDN), HEIC’i önce JPEG’e çevir
  if (isHeic(file) && typeof heic2any === 'function'){
    try{
      const out = await heic2any({ blob: file, toType: 'image/jpeg', quality: 0.8 });
      const blob = Array.isArray(out) ? out[0] : out;
      const url = URL.createObjectURL(blob);
      try{
        const img = await loadHTMLImage(url);
        return {img, mime: 'image/jpeg'};
      } finally { URL.revokeObjectURL(url); }
    } catch(e){
      console.warn('heic2any başarısız; doğrudan decode denenecek', e);
    }
  }
  // Normal yol (iOS HEIC’i decode edebilirse buradan da çalışır)
  const url = URL.createObjectURL(file);
  try{
    const img = await loadHTMLImage(url);
    return {img, mime: file.type || 'image/jpeg'};
  } finally { URL.revokeObjectURL(url); }
}

/* ---- Tek dosyayı WebP/JPEG’e çevir ve sıkıştır ---- */
async function toWebP(file, quality=0.82, maxDim=1920){
  try{
    const {img} = await fileToImage(file);
    const w = img.naturalWidth || img.width, h = img.naturalHeight || img.height;
    const scale = Math.min(1, maxDim / w, maxDim / h);
    const tw = Math.max(1, Math.round(w * scale));
    const th = Math.max(1, Math.round(h * scale));
    const canvas = drawToCanvas(img, tw, th);

    let blob = await canvasToBlob(canvas, 'image/webp', quality);
    if (!blob || !blob.size){
      blob = await canvasToBlob(canvas, 'image/jpeg', Math.max(0.5, quality));
    }
    const ext = (blob && blob.type && blob.type.includes('webp')) ? '.webp' : '.jpg';
    const name = (file.name||'image').replace(/\.(png|jpe?g|webp|gif|bmp|tiff|heic|heif)$/i,'') + ext;
    return new File([blob], name, {type: blob.type, lastModified: Date.now()});
  }catch(e){
    console.warn('toWebP başarısız; orijinali döndürüyorum', e);
    return file;
  }
}

/* ---- (ESKİ) Toplu bütçeye sıkıştırıcı – dokunmuyoruz ama kullanmıyoruz ---- */
async function compressAllToBudget(files, target=BUDGET){
  let items = Array.from(files);
  if (!items.length) return items;

  let work = await Promise.all(items.map(async f => isImg(f) ? await toWebP(f, 0.82, 1920) : f));
  if (totalBytes(work) <= target) return work;

  const rounds = [
    {q:0.7, dim:1600},
    {q:0.58, dim:1280},
    {q:0.5, dim:1024},
    {q:0.42, dim:900},
    {q:0.35, dim:800},
    {q:0.28, dim:720},
    {q:0.24, dim:640},
  ];

  for (let r=0; r<rounds.length && totalBytes(work) > target; r++){
    const {q, dim} = rounds[r];
    const order = work.map((f,i)=>({i, size:f.size||0})).sort((a,b)=> b.size-a.size);
    for (const {i} of order){
      if (!isImg(work[i])) continue;
      const nxt = await toWebP(work[i], q, dim);
      if (nxt.size < work[i].size) work[i] = nxt;
      if (totalBytes(work) <= target) break;
    }
  }

  if (totalBytes(work) > ABS_LIMIT){
    for (let i=0; i<work.length; i++){
      if (!isImg(work[i])) continue;
      work[i] = await toWebP(work[i], 0.22, 560);
    }
  }
  return work;
}

const photoError = document.getElementById('photo-error');

/* ======= YENİ: Toplamı 4 MB aşarsa 2 MB hedefine indirici ======= */

/* 1) Başlangıç dönüştürme (orta kalite) */
async function initialConvert(files){
  const arr = Array.from(files).slice(0, MAX_FILES);
  const out = [];
  for (const f of arr){
    if (isImg(f)) out.push(await toWebP(f, 0.82, 1920));
    else out.push(f);
  }
  return out;
}

/* 2) Adaptif toplam hedefleme */
async function compressToTarget(files, targetBytes){
  const MIN_Q  = 0.16;
  const MIN_DIM = 280;

  // her dosya için son kullanılan dim/quality takibi
  const meta = new Map(); // index -> {q, dim}
  for (let i=0;i<files.length;i++){ meta.set(i, {q:0.82, dim:1920}); }

  let work = files.slice();
  let total = totalBytes(work);

  // Güvenlik: 5 MB üstünü hiç tutma
  if (total > SERVER_HARD_LIMIT){
    for (let i=0;i<work.length;i++){
      if (!isImg(work[i])) continue;
      const m = meta.get(i);
      m.q = Math.max(MIN_Q, m.q * 0.6);
      m.dim = Math.max(MIN_DIM, Math.round(m.dim * 0.6));
      work[i] = await toWebP(work[i], m.q, m.dim);
    }
    total = totalBytes(work);
  }

  // Hedefe inene kadar kademeli
  let guard = 14;
  while (total > targetBytes && guard-- > 0){
    const scale = Math.max(0.45, Math.sqrt(targetBytes / total)); // 0.45 altına düşürme
    for (let i=0;i<work.length;i++){
      if (!isImg(work[i])) continue;
      const m = meta.get(i);
      const newQ  = Math.max(MIN_Q,  m.q  * 0.92 * scale);
      const newDim= Math.max(MIN_DIM,Math.round(m.dim* 0.92 * scale));
      let nxt = await toWebP(work[i], newQ, newDim);
      if (nxt.size > work[i].size){
        // yeniden sıkıştırma büyüttüyse bir adım daha
        const newQ2 = Math.max(MIN_Q, newQ * 0.9);
        const newD2 = Math.max(MIN_DIM, Math.round(newDim * 0.9));
        const nxt2 = await toWebP(work[i], newQ2, newD2);
        if (nxt2.size <= work[i].size){ nxt = nxt2; m.q = newQ2; m.dim = newD2; }
      } else { m.q = newQ; m.dim = newDim; }
      work[i] = nxt;
    }
    total = totalBytes(work);
  }

  // Son çare: hâlâ hedef üstünde ise herkes min thumb
  if (total > targetBytes){
    for (let i=0;i<work.length;i++){
      if (!isImg(work[i])) continue;
      work[i] = await toWebP(work[i], MIN_Q, MIN_DIM);
    }
  }

  // Mutlak güvenlik: 5 MB üstünde kalmasın
  let hardGuard = 8;
  while (totalBytes(work) > SERVER_HARD_LIMIT && hardGuard-- > 0){
    work.sort((a,b)=> (b.size||0)-(a.size||0));
    for (let i=0;i<work.length && totalBytes(work) > SERVER_HARD_LIMIT; i++){
      if (!isImg(work[i])) continue;
      work[i] = await toWebP(work[i], MIN_Q, MIN_DIM);
    }
  }

  return work;
}

/* ==================== SAYFA YÜKLENİNCE DİL ==================== */
document.addEventListener('DOMContentLoaded', function() {
  const isRussian = window.location.pathname.includes('ru.html') || 
                   window.location.pathname.includes('/ru.html') ||
                   window.location.pathname.endsWith('ru') ||
                   document.documentElement.lang === 'ru' ||
                   document.querySelector('html[lang="ru"]') !== null ||
                   document.title.includes('Продайте авто');
  
  const submitBtn = document.getElementById('submit-btn');
  const heroBtn = document.querySelector('.btn');
  const popupMessage = document.querySelector('#popup p');
  
  if (isRussian) {
    if (submitBtn) submitBtn.textContent = 'Отправить заявку';
    if (heroBtn) heroBtn.textContent = 'Отправить заявку';
    if (popupMessage) popupMessage.textContent = 'Ваша заявка отправлена';
  } else {
    if (submitBtn) submitBtn.textContent = 'Saada päring';
    if (heroBtn) heroBtn.textContent = 'Saada päring';
    if (popupMessage) popupMessage.textContent = 'Teie ankeet on saadetud';
  }
});

/* ==================== FOTO DOĞRULAMA ==================== */
function validatePhotos() {
  photoError.textContent = '';
  if (photoInput.files.length > MAX_FILES) {
    const isRussian = window.location.pathname.includes('ru.html') || 
                     window.location.pathname.includes('/ru.html') ||
                     window.location.pathname.endsWith('ru') ||
                     document.documentElement.lang === 'ru' ||
                     document.title.includes('Продайте авто');
    photoError.textContent = isRussian 
      ? `Можно загрузить не более ${MAX_FILES} fotografий.`
      : `Saate üles laadida mitte rohkem kui ${MAX_FILES} fotot.`;
    return false;
  }
  return true;
}

photoInput.addEventListener('change', validatePhotos);

/* ==================== FORM GÖNDERME ==================== */
form.addEventListener('submit', async function(event) {
  event.preventDefault();

  const arePhotosValid = validatePhotos();
  if (!form.checkValidity()) {
    form.reportValidity();
    return;
  }
  const isFormValid = form.checkValidity();
  if (!(isFormValid && arePhotosValid)) {
    console.log('Form submission failed validation.');
    if(!isFormValid) form.reportValidity();
    return;
  }

  const submitButton = document.getElementById('submit-btn');
  const isRussian = window.location.pathname.includes('ru.html') || 
                   window.location.pathname.includes('/ru.html') ||
                   window.location.pathname.endsWith('ru') ||
                   document.documentElement.lang === 'ru' ||
                   document.title.includes('Продайте авто');

  submitButton.disabled = true;
  submitButton.textContent = isRussian ? 'Отправка...' : 'Saatmine...';

  const formElements = form.elements;
  const formData = new FormData();

  // Metin alanları
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

  // Fotoğraflar — kural: 6 adete kadar, toplam asla > 5 MB olmaz.
  const originalFiles = Array.from(photoInput.files).slice(0, MAX_FILES);

  // 1) Orta kalite ilk dönüşüm
  let files = await initialConvert(originalFiles);
  let sum = totalBytes(files);

  // 2) Toplam > 4 MB ise 2 MB hedefine indir
  if (sum > TRIGGER_BYTES){
    files = await compressToTarget(files, FINAL_TARGET);
    sum = totalBytes(files);
  }

  // 3) Ek güvenlik: 5 MB altı garantisi
  if (sum > SERVER_HARD_LIMIT){
    files = await compressToTarget(files, Math.min(FINAL_TARGET, SERVER_HARD_LIMIT - 50*1024)); // küçük pay
    sum = totalBytes(files);
  }

  // 4) Hâlâ teorik olarak > 5 MB olursa (çok düşük ihtimal) min thumb
  if (sum > SERVER_HARD_LIMIT){
    for (let i=0;i<files.length;i++){
      if (!isImg(files[i])) continue;
      files[i] = await toWebP(files[i], 0.16, 280);
    }
    sum = totalBytes(files);
  }

  // Dosyaları ekle
  for (let i=0;i<files.length;i++){
    formData.append(`photo${i}`, files[i]);
  }
  formData.append('photoCount', String(files.length));
  formData.append('totalBytes', String(sum));

  try {
    // Netlify Function’a gönder
    const response = await fetch('/.netlify/functions/send-telegram', {
      method: 'POST',
      body: formData // FormData => Content-Type otomatik atanır
    });
    const result = await response.json();

    if (response.ok && result.success) {
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
});

/* ==================== POPUP ==================== */
function closePopup() { popup.classList.add('hidden'); }
closeBtn.addEventListener('click', closePopup);
popup.addEventListener('click', function(event) {
  if (event.target === popup) { closePopup(); }
});

/* ==================== FOOTER YILI ==================== */
(function setFooterYear() {
  const year = new Date().getFullYear();
  const elEt = document.getElementById('year-et');
  const elRu = document.getElementById('year-ru');
  if (elEt) elEt.textContent = year;
  if (elRu) elRu.textContent = year;
})();

/* ==================== DİL SWITCH A11Y ==================== */
(function initLangSwitch() {
  const switchContainer = document.querySelector('.lang-switch');
  if (!switchContainer) return;

  const buttons = switchContainer.querySelectorAll('.lang-btn');
  buttons.forEach(btn => {
    // Klavye erişilebilirliği
    btn.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); btn.click(); }
    });

    // aria-pressed
    try {
      const href = new URL(btn.href, location.href).pathname.split('/').pop();
      const current = location.pathname.split('/').pop() || 'index.html';
      btn.setAttribute('aria-pressed', href === current ? 'true' : 'false');
      if (href === current) btn.classList.add('active');
    } catch (e) { /* ignore */ }
  });
})();

/* ==================== DEBUG: TELEGRAM ==================== */
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

/* ==================== DEBUG: DİL TESPİT ==================== */
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
