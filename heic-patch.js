// Universal conversion to WEBP + resize; HEIC/HEIF via heic2any
(function(){
  window.__heicPatchWebp="force";
  var MAX_FILES=15, MAX_DIM=2560, WEBP_QUALITY=0.88;

  function isHeic(f){var n=(f.name||'').toLowerCase(),t=(f.type||'').toLowerCase();return t.includes('heic')||t.includes('heif')||/\.hei[cf]$/i.test(n);}
  function isImage(f){var t=(f.type||'').toLowerCase(); return t.startsWith('image/');}

  function scale(w,h){
    if(Math.max(w,h)<=MAX_DIM) return [w,h];
    if(w>=h){ return [MAX_DIM, Math.round(h*MAX_DIM/w)];}
    else{ return [Math.round(w*MAX_DIM/h), MAX_DIM];}
  }

  async function drawToWebp(blob){
    const bmp=await createImageBitmap(blob);
    const [w,h]=scale(bmp.width,bmp.height);
    const c=document.createElement('canvas'); c.width=w; c.height=h;
    const g=c.getContext('2d'); g.drawImage(bmp,0,0,w,h);
    const out=await new Promise((res,rej)=>c.toBlob(b=>b?res(b):rej(new Error('toBlob fail')),'image/webp',WEBP_QUALITY));
    return out;
  }

  async function heicToWebp(f){
    if(typeof heic2any!=='function') return null;
    try{
      const webp=await heic2any({blob:f,toType:'image/webp',quality:WEBP_QUALITY});
      return new File([webp], (f.name||'photo').replace(/\.(heic|heif)$/i,'')+'.webp',{type:'image/webp'});
    }catch(e){ console.warn('heic->webp',e); return null;}
  }
  async function anyToWebp(f){
    try{
      const buf=await f.arrayBuffer();
      const out=await drawToWebp(new Blob([buf],{type:f.type||'image/*'}));
      return new File([out], (f.name||'photo').replace(/\.(jpe?g|png|webp)$/i,'')+'.webp',{type:'image/webp'});
    }catch(e){ console.warn('any->webp',e); return null;}
  }

  async function normalize(input){
    const src=Array.from(input?.files||[]).filter(isImage).slice(0,MAX_FILES);
    const out=[];
    for(const f of src){
      let nf=f;
      if(isHeic(f)) nf = await heicToWebp(f) || f;
      else nf = await anyToWebp(f) || f;
      out.push(nf);
    }
    return out;
  }

  document.addEventListener('DOMContentLoaded', function(){
    const form=document.querySelector('form');
    const input=document.querySelector('input[type=\"file\"]');
    if(!form||!input) return;
    form.addEventListener('submit', async function(e){
      if(!input.files||!input.files.length) return;
      e.preventDefault();
      try{
        const files=await normalize(input);
        const fd=new FormData(form);
        ['photos','photos[]','images','images[]','file','files[]','photo','photo[]'].forEach(k=>fd.delete(k));
        // append under both names to match backend expectations
        files.forEach(f=>{ fd.append('photos[]',f,f.name); fd.append('photo[]',f,f.name); });
        const action=form.getAttribute('action')||form.action||location.href;
        const method=(form.getAttribute('method')||form.method||'POST').toUpperCase();
        const resp=await fetch(action,{method,body:fd});
        if(!resp.ok){ console.error('resp',resp.status); throw new Error('Upload failed '+resp.status); }
        form.reset(); alert('Teie ankeet on saadetud');
      }catch(err){ console.error('submit fail',err); alert('Не удалось отправить форму. Попробуйте ещё раз.'); }
    });
  });
})();