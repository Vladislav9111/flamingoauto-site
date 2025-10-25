// heic-ios-patch.js — iOS-safe: HEIC/HEIF -> JPEG; keep PDF/ZIP intact; native submit
(function () {
  const JPEG_QUALITY = 0.9;

  function isImage(f){
    return (f && (f.type||'').toLowerCase().startsWith('image/')) || /\.(png|jpe?g|heic|heif)$/i.test(f?.name||'');
  }
  function isHeic(f){
    const n=(f?.name||'').toLowerCase(), t=(f?.type||'').toLowerCase();
    return t.includes('heic')||t.includes('heif')||/\.hei[cf]$/.test(n);
  }
  async function heicToJpeg(file){
    if(typeof window.heic2any!=='function') return null;
    try{
      const blob = await window.heic2any({ blob:file, toType:'image/jpeg', quality: JPEG_QUALITY });
      const name = (file.name||'photo').replace(/\.(heic|heif)$/i,'') + '.jpg';
      return new File([blob], name, { type:'image/jpeg', lastModified: Date.now() });
    }catch(e){ console.warn('heic->jpeg failed', e); return null; }
  }
  async function prepareFiles(list){
    const src = Array.from(list||[]);
    const out = [];
    for(const f of src){
      if(isImage(f) && isHeic(f)){
        const conv = await heicToJpeg(f);
        out.push(conv || f);
      }else{
        out.push(f);
      }
    }
    return out;
  }

  document.addEventListener('DOMContentLoaded', () => {
    const form  = document.querySelector('form');
    const input = document.querySelector('input[type=\"file\"]');
    if(!form || !input) return;

    if(!/multipart\/form-data/i.test(form.enctype||'')) form.enctype = 'multipart/form-data';
    if(!/post/i.test(form.method||'')) form.method = 'post';

    const handler = async (e) => {
      if(!input.files || input.files.length===0) return;
      e.preventDefault();
      try{
        const files = await prepareFiles(input.files);
        const dt = new DataTransfer();
        files.forEach(f => dt.items.add(f));
        input.files = dt.files;
        form.removeEventListener('submit', handler);
        form.submit();
      }catch(err){
        console.error('iOS submit error:', err);
        alert('Не удалось отправить форму. Попробуйте ещё раз.');
      }
    };
    form.addEventListener('submit', handler, false);
  });
})();