
(function(){
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
  function init(){
    const form = document.querySelector('#car-form'); // проверьте id
    if (!form) { console.warn('Form not found: #car-form'); return; }

    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      try {
        const nativeFD = new FormData(form);
        const fd = new FormData();

        const fileInput = form.querySelector('input[type="file"][name="photos[]"]') || form.querySelector('input[type="file"]');
        const fieldName = (fileInput && fileInput.name) || 'photos[]';

        nativeFD.forEach((v,k)=>{ if(k!==fieldName) fd.append(k,v); });

        const files = fileInput?.files ? Array.from(fileInput.files) : [];
        if (files.length > 6) { alert('Maksimaalselt 6 fotot'); return; }

        for (const file of files) {
          const name = file.name || 'photo';
          const isHeicByType = /heic|heif/i.test(file.type || '');
          const isHeicByExt  = /\.(heic|heif)$/i.test(name);
          const isHeic = isHeicByType || isHeicByExt;

          if (!isHeic) { fd.append(fieldName, file, name); continue; }

          if (typeof heic2any !== 'function') {
            console.error('heic2any is not loaded');
            alert('Не удалось обработать HEIC. Добавьте JPEG/PNG или повторите позже.');
            return;
          }
          let blob = await heic2any({ blob:file, toType:'image/jpeg', quality:0.82 });
          const base = name.replace(/\.(heic|heif)$/i, '') || 'photo';
          const jpgName = base + '.jpg';
          let jpg;
          try { jpg = new File([blob], jpgName, { type:'image/jpeg', lastModified: Date.now() }); }
          catch(e){ blob = blob instanceof Blob ? blob : new Blob([blob], {type:'image/jpeg'}); blob.name = jpgName; jpg = blob; }
          fd.append(fieldName, jpg, jpgName);
        }

        const url = form.action || '/api/form';
        const method = (form.method || 'POST').toUpperCase();
        const resp = await fetch(url, { method, body: fd, credentials: 'same-origin' });
        if (!resp.ok) {
          const t = await resp.text().catch(()=>'');
          throw new Error(`HTTP ${resp.status} ${resp.statusText}${t ? ' — ' + t : ''}`);
        }
        form.reset();
        console.log('Форма успешно отправлена');
      } catch (err) {
        console.error('Ошибка при отправке формы', err);
        alert('Не удалось отправить форму. Попробуйте ещё раз.');
      }
    });
  }
})();
