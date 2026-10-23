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

document.addEventListener('DOMContentLoaded', () => {
  const russian = document.documentElement.lang === 'ru';
  const submit = document.getElementById('submit-btn');
  const status = document.getElementById('form-status');
  const text = russian ? {
    unavailable: 'Форма временно недоступна. Пожалуйста, попробуйте позже.',
    verify: 'Подтвердите проверку перед отправкой.', sending: 'Отправка…', send: 'Отправить заявку',
    error: 'Не удалось отправить заявку. Попробуйте позже.', rate: 'Слишком много запросов. Подождите минуту.',
    photos: 'Можно загрузить до шести фотографий.', sent: 'Ваша заявка отправлена.',
    partial: 'Заявка отправлена, но фотографии доставить не удалось. Мы уточним детали при связи с вами.'
  } : {
    unavailable: 'Vorm on ajutiselt kättesaamatu. Palun proovige hiljem uuesti.',
    verify: 'Enne saatmist läbige kontroll.', sending: 'Saatmine…', send: 'Saada päring',
    error: 'Päringut ei õnnestunud saata. Palun proovige hiljem uuesti.', rate: 'Liiga palju päringuid. Palun oodake minut.',
    photos: 'Saate lisada kuni kuus fotot.', sent: 'Teie päring on saadetud.',
    partial: 'Päring saadeti, kuid fotosid ei õnnestunud edastada. Täpsustame üksikasju ühendust võttes.'
  };
  let challenge = '';
  let widget;
  let startedAt = Date.now();
  submit.disabled = true;
  const setStatus = message => { status.textContent = message; };
  async function setupVerification() {
    try {
      const response = await fetch('/api/form-config');
      if (!response.ok) throw new Error('UNAVAILABLE');
      const config = await response.json();
      await new Promise((resolve, reject) => {
        const script = document.createElement('script');
        script.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
        script.async = true;
        script.onload = resolve;
        script.onerror = reject;
        document.head.appendChild(script);
      });
      widget = window.turnstile.render('#form-verification', {
        sitekey: config.turnstileSiteKey, action: 'flamingo-lead', size: 'compact', language: russian ? 'ru' : 'et',
        callback: token => { challenge = token; submit.disabled = false; setStatus(''); },
        'expired-callback': () => { challenge = ''; submit.disabled = true; setStatus(text.verify); },
        'error-callback': () => { challenge = ''; submit.disabled = true; setStatus(text.unavailable); }
      });
    } catch { setStatus(text.unavailable); }
  }
  function validatePhotos() {
    const valid = photoInput.files.length <= MAX_FILES && Array.from(photoInput.files).every(isImg);
    photoError.textContent = valid ? '' : text.photos;
    return valid;
  }
  photoInput.addEventListener('change', validatePhotos);
  form.addEventListener('submit', async event => {
    event.preventDefault();
    if (!validatePhotos() || !form.checkValidity()) { form.reportValidity(); return; }
    if (!challenge) { setStatus(text.verify); return; }
    submit.disabled = true;
    submit.textContent = text.sending;
    setStatus('');
    try {
      const data = new FormData();
      for (const key of ['make', 'model', 'year', 'mileage', 'transmission', 'engine', 'price', 'name', 'email', 'phone', 'city', 'note']) {
        data.set(key, form.elements[key].value);
      }
      data.set('regNumber', form.elements['reg-number'].value);
      data.set('website', form.elements['website'].value);
      data.set('startedAt', String(startedAt));
      data.set('turnstileToken', challenge);
      let files = await initialConvert(Array.from(photoInput.files));
      if (totalBytes(files) > TRIGGER_BYTES) files = await compressToTarget(files, FINAL_TARGET);
      if (totalBytes(files) > SERVER_HARD_LIMIT) throw new Error('PHOTO_LIMIT');
      files.forEach((file, index) => data.append(`photo${index}`, file));
      const response = await fetch('/api/lead', { method: 'POST', body: data });
      const result = await response.json();
      if (!response.ok || result.success !== true) {
        setStatus(response.status === 429 ? text.rate : text.error);
        return;
      }
      document.querySelector('#popup p').textContent = result.photosSent === false ? text.partial : text.sent;
      popup.classList.remove('hidden');
      form.reset();
      photoError.textContent = '';
      startedAt = Date.now();
    } catch { setStatus(text.error); }
    finally {
      challenge = '';
      submit.textContent = text.send;
      submit.disabled = true;
      if (widget !== undefined) window.turnstile.reset(widget);
    }
  });
  closeBtn.addEventListener('click', () => popup.classList.add('hidden'));
  popup.addEventListener('click', event => { if (event.target === popup) popup.classList.add('hidden'); });
  const normalize = value => value.replace(/\/index\.html$/, '/').replace(/\.html$/, '').replace(/\/$/, '') || '/';
  document.querySelectorAll('.lang-btn').forEach(button => {
    const active = normalize(new URL(button.href).pathname) === normalize(location.pathname);
    button.setAttribute('aria-pressed', String(active));
    if (active) button.setAttribute('aria-current', 'page');
    button.classList.toggle('active', active);
  });
  setupVerification();
});
