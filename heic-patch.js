// HEIC/HEIF safe convert; never block submit with alerts
(function(){
  window.__heicPatchActive=true;
  var MAX_FILES=15, JPEG_QUALITY=0.86;

  function byExt(name){ return (name||'').toLowerCase().match(/\.(jpe?g|png|heic|heif)$/); }
  function isImage(file){
    var t=(file.type||'').toLowerCase();
    return t.startsWith('image/') || byExt(file.name);
  }
  function isHeic(file){
    var t=(file.type||'').toLowerCase(), n=(file.name||'').toLowerCase();
    return t.indexOf('heic')>=0 || t.indexOf('heif')>=0 || /\.hei[cf]$/.test(n);
  }

  async function convertHeic(file){
    if(typeof window.heic2any!=='function') return null;
    try{
      var blob = await window.heic2any({ blob:file, toType:'image/jpeg', quality: JPEG_QUALITY });
      var name=(file.name||'photo').replace(/\.(heic|heif)$/i,'')+'.jpg';
      return new File([blob], name, { type:'image/jpeg' });
    }catch(e){ console.warn('heic2any failed', e); return null; }
  }
  async function convertPng(file){
    try{
      var buf=await file.arrayBuffer();
      var img=await createImageBitmap(new Blob([buf],{type:'image/png'}));
      var c=document.createElement('canvas'); c.width=img.width; c.height=img.height;
      c.getContext('2d').drawImage(img,0,0);
      var blob=await new Promise((res,rej)=>c.toBlob(b=>b?res(b):rej(new Error('toBlob fail')),'image/jpeg',JPEG_QUALITY));
      return new File([blob], (file.name||'photo').replace(/\.png$/i,'')+'.jpg', {type:'image/jpeg'});
    }catch(e){ console.warn('png->jpeg failed', e); return null; }
  }

  async function prepareFiles(input){
    var list = Array.from(input?.files||[]).filter(isImage);
    if(list.length>MAX_FILES) list.length=MAX_FILES;
    var out = [];
    for(let f of list){
      if(isHeic(f)){
        let conv = await convertHeic(f);
        out.push(conv || f); // если не получилось — отправим исходник
      }else if((f.type||'').toLowerCase()==='image/png'){
        // PNG допускаем как есть, если конверсия не удалась
        let conv = await convertPng(f);
        out.push(conv || f);
      }else{
        out.push(f); // JPEG, WEBP (если вдруг), и т.д. — как есть
      }
    }
    return out;
  }

  document.addEventListener('DOMContentLoaded', function(){
    var form = document.querySelector('form');
    var input = document.querySelector('input[type=\"file\"]');
    if(!form || !input) return;

    form.addEventListener('submit', async function(e){
      if(!input.files || !input.files.length) return; // без файлов — идём по старой логике
      e.preventDefault();
      try{
        var files = await prepareFiles(input);
        if(files.length===0){ alert('Выберите изображения (JPG/PNG/HEIC).'); return; }
        var fd = new FormData(form);
        ['photos','photos[]','images','images[]','file','files[]','photo','photo[]'].forEach(k=>fd.delete(k));
        files.forEach(f=>fd.append('photos[]', f, f.name));
        var action = form.getAttribute('action') || form.action || location.href;
        var method = (form.getAttribute('method') || form.method || 'POST').toUpperCase();
        var resp = await fetch(action, { method, body: fd });
        if(!resp.ok) throw new Error('Upload failed '+resp.status);
        form.reset();
        try{ alert('Teie ankeet on saadetud'); }catch(_){}
      }catch(err){
        console.error('submit failed', err);
        alert('Не удалось отправить форму. Попробуйте ещё раз.');
      }
    });
  });
})();