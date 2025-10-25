// native-webp-heic-patch.js
(function () {
  const WEBP_QUALITY = 0.85;
  const JPEG_QUALITY = 0.92;

  function isImage(f){
    const t=(f?.type||'').toLowerCase();
    const n=(f?.name||'').toLowerCase();
    return t.startsWith('image/') || /\.(png|jpe?g|webp|gif|bmp|heic|heif|tiff?)$/i.test(n);
  }
  function isHeic(f){
    const n=(f?.name||'').toLowerCase(), t=(f?.type||'').toLowerCase();
    return t.includes('heic')||t.includes('heif')||/\.hei[cf]$/.test(n);
  }
  function blobToImg(blob){
    return new Promise((resolve,reject)=>{
      const url = URL.createObjectURL(blob);
      const img = new Image();
      img.onload=()=>{ URL.revokeObjectURL(url); resolve(img); };
      img.onerror=(e)=>{ URL.revokeObjectURL(url); reject(e); };
      img.src=url;
    });
  }
  function canvasEncode(img, type, quality){
    const canvas=document.createElement('canvas');
    canvas.width=img.naturalWidth||img.width;
    canvas.height=img.naturalHeight||img.height;
    const ctx=canvas.getContext('2d');
    ctx.drawImage(img,0,0,canvas.width,canvas.height);
    return new Promise((resolve)=>{
      canvas.toBlob((b)=>resolve(b), type, quality);
    });
  }
  async function toWebp(blob){
    const test = document.createElement('canvas').toDataURL('image/webp').indexOf('data:image/webp')===0;
    if(!test) return null;
    const img = await blobToImg(blob);
    const out = await canvasEncode(img, 'image/webp', WEBP_QUALITY);
    return out;
  }
  async function toJpeg(blob){
    const img = await blobToImg(blob);
    const out = await canvasEncode(img, 'image/jpeg', JPEG_QUALITY);
    return out;
  }
  async function fileToBlob(file){ const buf = await file.arrayBuffer(); return new Blob([buf],{type:file.type||'application/octet-stream'}); }

  async function convertFile(file){
    if(!isImage(file)) return file;
    let baseBlob;
    if(isHeic(file)){
      if(typeof window.heic2any==='function'){
        try{
          baseBlob = await window.heic2any({ blob:file, toType:'image/jpeg', quality: JPEG_QUALITY });
        }catch(e){ return file; }
      }else{ return file; }
    }else{
      baseBlob = await fileToBlob(file);
    }
    try{
      const webp = await toWebp(baseBlob);
      if(webp){
        const name=(file.name||'image').replace(/\.[^.]+$/, '')+'.webp';
        return new File([webp], name, {type:'image/webp', lastModified:Date.now()});
      }
    }catch(e){}
    try{
      const jpeg = await toJpeg(baseBlob);
      if(jpeg){
        const name=(file.name||'image').replace(/\.[^.]+$/, '')+'.jpg';
        return new File([jpeg], name, {type:'image/jpeg', lastModified:Date.now()});
      }
    }catch(e){}
    return file;
  }

  async function prepareFiles(list){
    const src=Array.from(list||[]);
    const out=[];
    for(const f of src){ out.push(await convertFile(f)); }
    return out;
  }

  document.addEventListener('DOMContentLoaded', ()=>{
    const form=document.querySelector('form');
    const input=document.querySelector('input[type="file"]');
    if(!form || !input) return;
    if(!/multipart\/form-data/i.test(form.enctype||'')) form.enctype='multipart/form-data';
    if(!/post/i.test(form.method||'')) form.method='post';

    const acc=input.getAttribute('accept')||'';
    if(!/heic|heif/i.test(acc)){ input.setAttribute('accept',(acc?acc+',':'')+'image/*,.heic,.heif,image/heic,image/heif'); }
    if(!input.hasAttribute('name')) input.setAttribute('name','photos[]');
    if(!input.hasAttribute('multiple')) input.setAttribute('multiple','');

    const handler = async (e)=>{
      if(!input.files || input.files.length===0) return;
      e.preventDefault();
      try{
        const files=await prepareFiles(input.files);
        const dt=new DataTransfer();
        files.forEach(f=>dt.items.add(f));
        input.files=dt.files;
        form.removeEventListener('submit', handler);
        form.submit();
      }catch(err){
        alert('Ошибка при подготовке файлов. Разрешены JPG/PNG/HEIC/HEIF.');
      }
    };
    form.addEventListener('submit', handler, false);
  });
})();