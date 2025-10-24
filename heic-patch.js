// HEIC/HEIF → WebP (and large JPG/PNG → WebP). Non-blocking submit.
(function(){
  window.__heicPatchWebp = true;

  var MAX_FILES = 15;
  var TARGET_MAX_DIM = 2560; // downscale if larger (keeps aspect)
  var WEBP_QUALITY = 0.86;

  function isHeic(f){
    var n=(f.name||'').toLowerCase(), t=(f.type||'').toLowerCase();
    return t.includes('heic')||t.includes('heif')||/\.hei[cf]$/i.test(n);
  }
  function isRaster(f){
    var t=(f.type||'').toLowerCase();
    return t.startsWith('image/');
  }
  function needResize(w,h){
    return Math.max(w,h) > TARGET_MAX_DIM;
  }
  async function drawToCanvas(blob, type){
    const bmp = await createImageBitmap(blob);
    let w=bmp.width, h=bmp.height;
    if (needResize(w,h)){
      if (w>=h){ h = Math.round(h * TARGET_MAX_DIM / w); w = TARGET_MAX_DIM; }
      else     { w = Math.round(w * TARGET_MAX_DIM / h); h = TARGET_MAX_DIM; }
    }
    const c=document.createElement('canvas'); c.width=w; c.height=h;
    const g=c.getContext('2d');
    g.drawImage(bmp,0,0,w,h);
    const out = await new Promise((res,rej)=>c.toBlob(b=>b?res(b):rej(new Error('toBlob fail')),'image/webp',WEBP_QUALITY));
    return out;
  }

  async function heicToWebp(f){
    if (typeof window.heic2any!=='function') return null;
    try{
      const webp = await window.heic2any({ blob:f, toType:'image/webp', quality: WEBP_QUALITY });
      return new File([webp], (f.name||'photo').replace(/\.(heic|heif)$/i,'')+'.webp', {type:'image/webp'});
    }catch(e){ console.warn('heic->webp failed', e); return null; }
  }
  async function anyToWebpViaCanvas(f){
    try{
      const blob = await f.arrayBuffer();
      const out = await drawToCanvas(new Blob([blob],{type:f.type||'image/*'}), f.type);
      return new File([out], (f.name||'photo').replace(/\.(jpe?g|png)$/i,'')+'.webp', {type:'image/webp'});
    }catch(e){ console.warn('canvas->webp failed', e); return null; }
  }

  async function normalize(input){
    const files = Array.from(input?.files||[]).filter(isRaster).slice(0, MAX_FILES);
    const out = [];
    for (let f of files){
      let nf = f;
      if (isHeic(f)){
        nf = await heicToWebp(f) || f;
      } else {
        // for JPEG/PNG, convert to webp only if very large (or already webp leave as is)
        const t=(f.type||'').toLowerCase();
        if (t==='image/jpeg' || t==='image/png'){
          try{
            const bmp = await createImageBitmap(f);
            if (bmp && (Math.max(bmp.width, bmp.height) > TARGET_MAX_DIM)){
              nf = await anyToWebpViaCanvas(f) || f;
            }
          }catch(e){ console.warn('probe size failed', e); }
        }
      }
      out.push(nf);
    }
    return out;
  }

  document.addEventListener('DOMContentLoaded', function(){
    const form=document.querySelector('form');
    const input=document.querySelector('input[type=\"file\"]');
    if(!form || !input) return;
    form.addEventListener('submit', async function(e){
      if(!input.files || !input.files.length) return;
      e.preventDefault();
      try{
        const files = await normalize(input);
        if (!files.length){ alert('Выберите изображения'); return; }
        const fd=new FormData(form);
        ['photos','photos[]','images','images[]','file','files[]','photo','photo[]'].forEach(k=>fd.delete(k));
        files.forEach(f=>fd.append('photos[]', f, f.name));
        const action=form.getAttribute('action')||form.action||location.href;
        const method=(form.getAttribute('method')||form.method||'POST').toUpperCase();
        const resp=await fetch(action,{method,body:fd});
        if(!resp.ok) throw new Error('Upload failed '+resp.status);
        form.reset();
        alert('Teie ankeet on saadetud');
      }catch(err){
        console.error(err);
        alert('Не удалось отправить форму. Попробуйте ещё раз.');
      }
    });
  });
})();