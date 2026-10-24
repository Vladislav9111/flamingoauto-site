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
  const contactStage = document.getElementById('contact-stage');
  const detailStage = document.getElementById('details-stage');
  const consent = document.getElementById('contact-consent');
  const registration = document.getElementById('reg-number');
  const phone = document.getElementById('phone');
  const finish = document.getElementById('finish-without-details');
  const heading = document.getElementById('form-heading');
  const required = document.getElementById('required-fields');
  const initialHeading = heading.textContent;
  const initialRequired = required.textContent;
  const steps = document.querySelectorAll('.step-indicator li');
  const text = russian ? {
    unavailable: 'Проверка отправки временно недоступна. Попробуйте обновить страницу или напишите на email ниже.',
    verify: 'Подтвердите проверку перед отправкой.', sending: 'Отправка…',
    contactSend: 'Отправить контакт и продолжить', detailsSend: 'Отправить подробности',
    detailsHeading: 'Добавьте сведения об автомобиле', optional: 'Все поля второго шага необязательны.',
    error: 'Не удалось подтвердить отправку. Проверьте соединение и попробуйте ещё раз.', rate: 'Слишком много запросов. Подождите минуту.',
    photos: 'Можно загрузить до шести фотографий.', photoType: 'Выберите файлы изображений.',
    phone: 'Укажите номер телефона, содержащий не менее шести цифр.',
    sent: 'Спасибо! Контакт получен. Ответим в течение одного рабочего дня.',
    partial: 'Сведения отправлены, но фотографии доставить не удалось. Мы уточним детали при связи с вами.',
    expired: 'Время добавления подробностей истекло. Ранее отправленный контакт уже получен. Чтобы отправить новую заявку, нажмите «Изменить контакт».',
    edit: 'Проверьте контакт и подтвердите согласие снова. Повторное нажатие отправит новую контактную заявку.'
  } : {
    unavailable: 'Saatmise kontroll on ajutiselt kättesaamatu. Värskenda lehte või kirjuta alloleval e-posti aadressil.',
    verify: 'Enne saatmist läbi kontroll.', sending: 'Saatmine…',
    contactSend: 'Saada kontakt ja jätka', detailsSend: 'Saada auto andmed',
    detailsHeading: 'Lisa auto kohta täpsemad andmed', optional: 'Teise sammu kõik väljad on valikulised.',
    error: 'Saatmist ei õnnestunud kinnitada. Kontrolli ühendust ja proovi uuesti.', rate: 'Liiga palju päringuid. Palun oota minut.',
    photos: 'Saad lisada kuni kuus fotot.', photoType: 'Vali pildifailid.',
    phone: 'Sisesta vähemalt kuue numbriga telefoninumber.',
    sent: 'Aitäh! Kontakt on saadetud. Vastame ühe tööpäeva jooksul.',
    partial: 'Andmed saadeti, kuid fotosid ei õnnestunud edastada. Täpsustame üksikasju ühendust võttes.',
    expired: 'Lisainfo saatmise aeg on lõppenud. Varem saadetud kontakt on juba edastatud. Uue päringu saatmiseks vajuta „Muuda kontakti”.',
    edit: 'Kontrolli kontakti ja kinnita nõusolek uuesti. Uus saatmine loob uue kontaktipäringu.'
  };
  const messages = russian ? {
    'Verification required': 'Пройдите проверку Cloudflare и повторите отправку.',
    'Verification failed': 'Проверка Cloudflare не прошла. Повторите проверку и отправку.',
    'Invalid contact details': 'Проверьте номер машины, телефон и email, если он указан.',
    'Contact consent required': 'Подтвердите согласие на связь по поводу автомобиля.',
    'Invalid field': 'Проверьте поля и длину введённого текста.',
    'Please refresh the form and try again': 'Обновите страницу и заполните контакт ещё раз.',
    'Invalid photo': 'Не удалось обработать фотографию. Попробуйте JPEG, PNG или WebP.',
    'Use up to six JPEG, PNG or WebP photos': 'Добавьте не больше шести фотографий JPEG, PNG или WebP.'
  } : {
    'Verification required': 'Läbi Cloudflare’i kontroll ja proovi uuesti.',
    'Verification failed': 'Cloudflare’i kontroll ebaõnnestus. Läbi kontroll ja proovi uuesti.',
    'Invalid contact details': 'Kontrolli auto numbrit, telefoni ja e-posti aadressi, kui see on lisatud.',
    'Contact consent required': 'Kinnita nõusolek auto asjus ühenduse võtmiseks.',
    'Invalid field': 'Kontrolli välju ja sisestatud teksti pikkust.',
    'Please refresh the form and try again': 'Värskenda lehte ja täida kontakt uuesti.',
    'Invalid photo': 'Foto töötlemine ebaõnnestus. Proovi JPEG-, PNG- või WebP-faili.',
    'Use up to six JPEG, PNG or WebP photos': 'Lisa kuni kuus JPEG-, PNG- või WebP-fotot.'
  };
  let phase = 'contact';
  let leadToken = '';
  let challenge = '';
  let widget;
  let sending = false;
  let startedAt = Date.now();
  status.dataset.kind = 'verification';
  const setStatus = (message, kind = 'form') => { status.textContent = message; status.dataset.kind = kind; };
  let readinessTimer;
  const ready = () => {
    clearTimeout(readinessTimer);
    const wait = 2100 - (Date.now() - startedAt);
    submit.disabled = sending || !challenge || wait > 0;
    finish.disabled = sending;
    if (challenge && !sending && wait > 0) readinessTimer = setTimeout(ready, wait);
  };
  function verificationStatus(message) {
    if (!status.textContent || status.dataset.kind === 'verification') setStatus(message, 'verification');
  }
  function resetChallenge() {
    challenge = '';
    ready();
    if (widget !== undefined) window.turnstile.reset(widget);
  }
  async function setupVerification() {
    try {
      const response = await fetch('/api/form-config');
      if (!response.ok) throw new Error('UNAVAILABLE');
      const config = await response.json();
      await new Promise((resolve, reject) => {
        const script = document.createElement('script');
        script.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
        script.async = true; script.onload = resolve; script.onerror = reject;
        document.head.appendChild(script);
      });
      widget = window.turnstile.render('#form-verification', {
        sitekey: config.turnstileSiteKey, action: 'flamingo-lead', size: 'compact', language: russian ? 'ru' : 'et',
        callback: token => {
          challenge = token; ready();
          // A fresh challenge must not erase an explanation of a failed submission.
          if (status.dataset.kind === 'verification') setStatus('', 'verification');
        },
        'expired-callback': () => { challenge = ''; ready(); verificationStatus(text.verify); },
        'error-callback': () => { challenge = ''; ready(); verificationStatus(text.unavailable); }
      });
    } catch { verificationStatus(text.unavailable); }
  }
  const photoSelection = document.getElementById('photo-selection');
  const clearPhotos = document.getElementById('clear-photos');
  const emptySelection = photoSelection.textContent;
  function validatePhotos() {
    const files = Array.from(photoInput.files);
    const valid = files.length <= MAX_FILES && files.every(isImg);
    photoError.textContent = files.length > MAX_FILES ? text.photos : files.every(isImg) ? '' : text.photoType;
    return valid;
  }
  function updatePhotoSelection() {
    const count = photoInput.files.length;
    photoSelection.textContent = count ? (russian ? `Выбрано фотографий: ${count} из 6.` : `Valitud fotosid: ${count} / 6.`) : emptySelection;
    clearPhotos.hidden = count === 0;
    validatePhotos();
  }
  photoInput.addEventListener('change', updatePhotoSelection);
  clearPhotos.addEventListener('click', () => { photoInput.value = ''; updatePhotoSelection(); photoInput.focus(); });
  phone.addEventListener('input', () => phone.setCustomValidity(''));
  function displayPhase() {
    const details = phase === 'details';
    contactStage.hidden = details; detailStage.hidden = !details; finish.hidden = !details;
    registration.readOnly = details; phone.readOnly = details;
    steps.forEach((step, index) => { if (index === (details ? 1 : 0)) step.setAttribute('aria-current', 'step'); else step.removeAttribute('aria-current'); });
    heading.textContent = details ? text.detailsHeading : initialHeading;
    required.textContent = details ? text.optional : initialRequired;
    submit.textContent = details ? text.detailsSend : text.contactSend;
    form.action = details ? '/api/lead' : '/api/lead/start';
    ready();
  }
  function showSuccess(message) {
    document.querySelector('#popup p').textContent = message;
    popup.showModal();
    form.reset(); updatePhotoSelection(); leadToken = ''; phase = 'contact'; startedAt = Date.now(); displayPhase();
  }
  document.getElementById('edit-contact').addEventListener('click', () => {
    phase = 'contact'; leadToken = ''; consent.checked = false; startedAt = Date.now(); displayPhase();
    setStatus(text.edit); resetChallenge(); registration.focus();
  });
  finish.addEventListener('click', () => {
    if (phase !== 'details' || !leadToken || sending) return;
    showSuccess(text.sent); resetChallenge();
  });
  form.addEventListener('submit', async event => {
    event.preventDefault();
    if (sending) return;
    if (phone.value.replace(/\D/g, '').length < 6) phone.setCustomValidity(text.phone);
    const valid = phase === 'contact'
      ? [registration, phone, consent].every(input => input.reportValidity())
      : validatePhotos() && form.reportValidity();
    if (!valid) return;
    if (!challenge) { setStatus(text.verify, 'verification'); return; }
    sending = true; ready(); submit.textContent = text.sending; setStatus('');
    try {
      const data = new FormData();
      data.set('regNumber', registration.value); data.set('phone', phone.value);
      data.set('consent', 'contact'); data.set('website', form.elements.website.value);
      data.set('startedAt', String(startedAt)); data.set('turnstileToken', challenge);
      const endpoint = phase === 'contact' ? '/api/lead/start' : '/api/lead';
      if (phase === 'details') {
        data.set('leadToken', leadToken);
        for (const key of ['make', 'model', 'year', 'mileage', 'transmission', 'engine', 'price', 'name', 'email', 'city', 'note']) data.set(key, form.elements[key].value);
        let files = await initialConvert(Array.from(photoInput.files));
        if (totalBytes(files) > TRIGGER_BYTES) files = await compressToTarget(files, FINAL_TARGET);
        if (totalBytes(files) > SERVER_HARD_LIMIT) throw new Error('PHOTO_LIMIT');
        files.forEach((file, index) => data.append(`photo${index}`, file));
      }
      const response = await fetch(endpoint, { method: 'POST', body: data });
      const result = await response.json();
      if (!response.ok || result.success !== true) {
        setStatus(result.code === 'lead_receipt_invalid' ? text.expired : response.status === 429 ? text.rate : messages[result.error] || text.error);
        return;
      }
      if (phase === 'contact') {
        if (typeof result.leadToken !== 'string' || !result.leadToken) throw new Error('INVALID_RECEIPT');
        leadToken = result.leadToken; phase = 'details'; startedAt = Date.now();
        document.getElementById('saved-contact').textContent = registration.value + ' · ' + phone.value;
        displayPhase(); heading.focus({ preventScroll: true });
        document.querySelector('.estimate-card').scrollIntoView({ block: 'start', behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
      } else showSuccess(result.photosSent === false ? text.partial : text.sent);
    } catch { setStatus(text.error); }
    finally { sending = false; displayPhase(); resetChallenge(); }
  });
  closeBtn.addEventListener('click', () => popup.close());
  popup.addEventListener('click', event => { if (event.target === popup) popup.close(); });
  popup.addEventListener('close', () => heading.focus());
  const normalize = value => value.replace(/\/index\.html$/, '/').replace(/\.html$/, '').replace(/\/$/, '') || '/';
  document.querySelectorAll('.lang-btn').forEach(button => {
    const active = normalize(new URL(button.href).pathname) === normalize(location.pathname);
    button.removeAttribute('aria-pressed');
    if (active) button.setAttribute('aria-current', 'page'); else button.removeAttribute('aria-current');
    button.classList.toggle('active', active);
  });
  displayPhase(); setupVerification();
});
