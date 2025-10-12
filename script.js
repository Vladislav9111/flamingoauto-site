// === CONFIG (universal) ===
const MB = 1024 * 1024;
const TARGET_BUDGET = 4.8 * MB;   // целимся ниже серверного лимита
const ABS_BUDGET    = 5.2 * MB;   // страховка
const XHR_TIMEOUT   = 120000;     // 120s на весь запрос

// === Progress UI ===
function ensureProgressUI(){
  let box = document.getElementById('upload-progress-box');
  if (!box){
    box = document.createElement('div');
    box.id = 'upload-progress-box';
    box.style.cssText =
      'position:fixed;left:12px;right:12px;bottom:12px;padding:10px;background:#111;color:#fff;border-radius:10px;box-shadow:0 6px 20px rgba(0,0,0,.35);z-index:9999;font-family:system-ui,-apple-system,Segoe UI,Roboto,Arial,sans-serif';
    const label = document.createElement('div');
    label.id = 'upload-progress-text';
    label.style.cssText = 'font-size:13px;opacity:.9';
    label.textContent = '0%';
    const barWrap = document.createElement('div');
    barWrap.style.cssText = 'width:100%;height:10px;background:#2a2a2a;border-radius:6px;overflow:hidden;margin-top:6px;';
    const bar = document.createElement('div');
    bar.id = 'upload-progress-bar';
    bar.style.cssText = 'width:0%;height:100%;background:linear-gradient(90deg,#4ea7ff,#6effb5);transition:width .2s ease;';
    barWrap.appendChild(bar);
    box.appendChild(label);
    box.appendChild(barWrap);
    document.body.appendChild(box);
  }
  return box;
}
function updateProgressUI(percent, text){
  ensureProgressUI();
  const bar = document.getElementById('upload-progress-bar');
  const label = document.getElementById('upload-progress-text');
  if (bar)   bar.style.width = Math.max(0, Math.min(100, percent)) + '%';
  if (label) label.textContent = text || (Math.round(percent) + '%');
}
function removeProgressUI(){ const box = document.getElementById('upload-progress-box'); if (box) box.remove(); }

// === Canvas.toBlob полифил (старые Safari) ===
if (!HTMLCanvasElement.prototype.toBlob) {
  HTMLCanvasElement.prototype.toBlob = function (cb, type, quality) {
    const dataURL = this.toDataURL(type, quality);
    const bin = atob((dataURL.split(',')[1]||'')); const len = bin.length;
    const u8 = new Uint8Array(len); for (let i=0;i<len;i++) u8[i]=bin.charCodeAt(i);
    cb(new Blob([u8], { type: type || 'image/png' }));
  };
}

// === Компрессия WebP/JPEG ===
const isImg = f => /^image\//i.test(f?.type||'');
const totalBytes = a => a.reduce((s,f)=> s+((f&&f.size)||0),0);
function loadImg(file){
  return new Promise((res,rej)=>{
    const url = URL.createObjectURL(file), img = new Image();
    img.onload=()=>{ URL.revokeObjectURL(url); res(img); };
    img.onerror=e=>{ URL.revokeObjectURL(url); rej(e); };
    img.src = url;
  });
}
async function toWebPOrJPEG(file, q=0.82, maxDim=1920){
  try{
    const img = await loadImg(file);
    const w = img.naturalWidth||img.width, h = img.naturalHeight||img.height;
    const s = Math.min(1, maxDim/Math.max(1,w), maxDim/Math.max(1,h));
    const cw = Math.max(1, Math.round(w*s)), ch = Math.max(1, Math.round(h*s));
    const c = document.createElement('canvas'); c.width=cw; c.height=ch;
    c.getContext('2d',{alpha:false}).drawImage(img,0,0,cw,ch);
    let blob = await new Promise(r=> c.toBlob(r,'image/webp',q));
    if (!blob) blob = await new Promise(r=> c.toBlob(r,'image/jpeg',Math.max(0.6,q)));
    if (!blob) return file;
    const name = (file.name||'image').replace(/\.(png|jpg|jpeg|webp|gif|bmp|tif|tiff|heic|heif)$/i,'') + (blob.type.includes('webp')?'.webp':'.jpg');
    return new File([blob], name, {type: blob.type, lastModified: Date.now()});
  }catch(e){ console.warn('compress fail', e); return file; }
}
async function compressAllToBudget(files){
  let work = [];
  for (const f of files) work.push(isImg(f) ? await toWebPOrJPEG(f,0.82,1920) : f);
  if (totalBytes(work) <= TARGET_BUDGET) return work;
  const rounds = [
    {q:0.70, dim:1600},{q:0.58, dim:1280},{q:0.50, dim:1024},
    {q:0.42, dim:900},{q:0.35, dim:800},{q:0.28, dim:720},{q:0.24, dim:640},
  ];
  for (const r of rounds){
    if (totalBytes(work) <= TARGET_BUDGET) break;
    work.sort((a,b)=>(b.size||0)-(a.size||0));
    for (let i=0;i<work.length && totalBytes(work)>TARGET_BUDGET;i++){
      if (!isImg(work[i])) continue;
      const s = await toWebPOrJPEG(work[i], r.q, r.dim);
      if (s.size < work[i].size) work[i]=s;
    }
  }
  while (totalBytes(work) > ABS_BUDGET && work.length>0){ work.sort((a,b)=>(b.size||0)-(a.size||0)); work.shift(); }
  return work;
}

// === XHR с прогрессом ===
function xhrUpload(url, formData, onProgress){
  return new Promise((resolve,reject)=>{
    const xhr = new XMLHttpRequest();
    xhr.open('POST', url, true);
    xhr.timeout = XHR_TIMEOUT;
    xhr.upload.onprogress = e => { if (onProgress && e && e.lengthComputable) onProgress(e.loaded/e.total); };
    xhr.onreadystatechange = ()=>{ if (xhr.readyState===4){ (xhr.status>=200&&xhr.status<300)?resolve(xhr.responseText||''):reject(new Error('status_'+xhr.status)); } };
    xhr.onerror = ()=> reject(new Error('network_error'));
    xhr.ontimeout = ()=> reject(new Error('timeout'));
    xhr.send(formData);
  });
}

// === Сабмит формы: ОДИН запрос с фото ===
document.addEventListener('DOMContentLoaded', ()=>{
  const form = document.querySelector('form');
  if (!form) return;
  form.addEventListener('submit', async (e)=>{
    e.preventDefault();
    const submitBtn = form.querySelector('[type="submit"]');
    const photosEl  = document.getElementById('photos') || document.querySelector('input[type=file]');
    if (submitBtn) submitBtn.disabled = true;

    const raw = photosEl?.files ? Array.from(photosEl.files).slice(0, 10) : [];
    const files = await compressAllToBudget(raw);

    const fd = new FormData(form);
    for (let i=0;i<files.length;i++) fd.append(`photo${i}`, files[i]);
    fd.append('photoCount', String(files.length));

    ensureProgressUI();
    updateProgressUI(1, (document.documentElement.lang==='ru' ? 'Подготовка…' : 'Ettevalmistamine…'));
    try{
      const respText = await xhrUpload('/.netlify/functions/send-telegram', fd, (ratio)=>{
        const label = (document.documentElement.lang==='ru') ? `Загрузка… ${Math.round(ratio*100)}%` : `Üleslaadimine… ${Math.round(ratio*100)}%`;
        updateProgressUI(ratio*100, label);
      });
      let result = {}; try{ result = JSON.parse(respText||'{}'); }catch{}
      const popup = document.getElementById('popup');
      if (popup) popup.classList.remove('hidden');
      updateProgressUI(100, (document.documentElement.lang==='ru') ? 'Готово' : 'Valmis');
      setTimeout(removeProgressUI, 1200);
      form.reset();
    }catch(err){
      console.warn('send failed', err);
      alert(document.documentElement.lang==='ru'
        ? 'Не удалось отправить. Проверьте интернет и попробуйте ещё раз.'
        : 'Saatmine ebaõnnestus. Palun proovige uuesti.');
    }finally{
      if (submitBtn) submitBtn.disabled = false;
    }
  });
});
