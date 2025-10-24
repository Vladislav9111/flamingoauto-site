// HEIC robust patch
(function(){
  window.__heicPatchActive=true;
  var JPEG_QUALITY=0.86, MAX_FILES=15;
  function isHeic(f){var n=(f.name||'').toLowerCase(),t=(f.type||'').toLowerCase();return t.includes('heic')||t.includes('heif')||/\.hei[cf]$/i.test(n);}
  async function heicToJpeg(f){
    if(!isHeic(f)) return f;
    if(typeof heic2any!=='function') return f;
    try{
      var out=await heic2any({blob:f,toType:'image/jpeg',quality:JPEG_QUALITY});
      return new File([out], (f.name||'photo').replace(/\.(heic|heif)$/i,'')+'.jpg', {type:'image/jpeg'});
    }catch(e){ console.warn('heic2any failed',e); return f; }
  }
  async function pngToJpeg(f){
    if((f.type||'').toLowerCase()!=='image/png') return f;
    try{
      var buf=await f.arrayBuffer();
      var img=await createImageBitmap(new Blob([buf],{type:'image/png'}));
      var c=document.createElement('canvas'); c.width=img.width; c.height=img.height;
      c.getContext('2d').drawImage(img,0,0);
      var blob=await new Promise((res,rej)=>c.toBlob(b=>b?res(b):rej(new Error('toBlob fail')),'image/jpeg',JPEG_QUALITY));
      return new File([blob], (f.name||'photo').replace(/\.png$/i,'')+'.jpg', {type:'image/jpeg'});
    }catch(e){ console.warn('png→jpeg failed',e); return f; }
  }
  async function normalize(input){
    let files=Array.from(input?.files||[]);
    if(!files.length) return [];
    if(files.length>MAX_FILES) files.length=MAX_FILES;
    for(let i=0;i<files.length;i++) files[i]=await heicToJpeg(files[i]);
    for(let i=0;i<files.length;i++) files[i]=await pngToJpeg(files[i]);
    let finals=files.filter(f=>/image\/jpeg|image\/png/i.test(f.type||'')||/\.(jpe?g|png)$/i.test(f.name||''));
    if(!finals.length) finals=files; // отправим исходники, если конверсия не удалась
    return finals;
  }
  function showErr(m){ alert(m||'Ошибка при подготовке файлов. Разрешены JPG/PNG/HEIC/HEIF.'); }
  document.addEventListener('DOMContentLoaded', function(){
    const form=document.querySelector('form'); const input=document.querySelector('input[type="file"]');
    if(!form||!input) return;
    form.addEventListener('submit', async function(e){
      if(!input.files||!input.files.length) return;
      e.preventDefault();
      try{
        const files=await normalize(input); if(!files.length) return;
        const fd=new FormData(form);
        ['photos','photos[]','images','images[]','file','files[]'].forEach(k=>fd.delete(k));
        files.forEach(f=>fd.append('photos[]', f, f.name));
        const action=form.getAttribute('action')||form.action||location.href;
        const method=(form.getAttribute('method')||form.method||'POST').toUpperCase();
        const r=await fetch(action,{method,body:fd});
        if(!r.ok) throw new Error('Upload failed '+r.status);
        form.reset(); alert('Заявка отправлена!');
      }catch(err){ console.error(err); showErr(); }
    });
  });
})();