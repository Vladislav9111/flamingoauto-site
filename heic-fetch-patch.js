// heic-fetch-patch.js
(() => {
  const JPEG_QUALITY = 0.9;
  const FORM_ENDPOINT_FALLBACK = '/.netlify/functions/send-form';

  const isImage = (f) =>
    (!!f) && (((f.type || '').toLowerCase().startsWith('image/')) ||
              /\.(png|jpe?g|heic|heif|webp)$/i.test(f.name || ''));

  const isHeic = (f) => {
    const n = (f?.name || '').toLowerCase();
    const t = (f?.type || '').toLowerCase();
    return t.includes('heic') || t.includes('heif') || /\.hei[cf]$/.test(n);
  };

  async function heicToJpeg(file) {
    if (typeof window.heic2any !== 'function') return null;
    try {
      const blob = await window.heic2any({ blob: file, toType: 'image/jpeg', quality: JPEG_QUALITY });
      const name = (file.name || 'photo').replace(/\.(heic|heif)$/i, '') + '.jpg';
      return new File([blob], name, { type: 'image/jpeg', lastModified: Date.now() });
    } catch (e) {
      console.warn('heic->jpeg failed', e);
      return null;
    }
  }

  async function prepareFiles(list) {
    const src = Array.from(list || []);
    const out = [];
    for (const f of src) {
      if (isImage(f) && isHeic(f)) {
        const conv = await heicToJpeg(f);
        out.push(conv || f);
      } else {
        out.push(f);
      }
    }
    return out;
  }

  function showMsg(txt) { try { alert(txt); } catch(_) {} }

  document.addEventListener('DOMContentLoaded', () => {
    const form = document.querySelector('form');
    if (!form) return;

    if (!/post/i.test(form.method || '')) form.method = 'post';
    if (!/multipart\/form-data/i.test(form.enctype || '')) form.enctype = 'multipart/form-data';

    const input = form.querySelector('input[type="file"]');
    if (input) {
      const acc = input.getAttribute('accept') || '';
      if (!/heic|heif/i.test(acc)) {
        input.setAttribute('accept', (acc ? acc + ',' : '') + 'image/*,.heic,.heif,image/heic,image/heif');
      }
      if (!input.hasAttribute('name')) input.setAttribute('name', 'photos[]');
      if (!input.hasAttribute('multiple')) input.setAttribute('multiple', '');
    }

    form.addEventListener('submit', async (e) => {
      const hasFiles = !!(input && input.files && input.files.length);
      if (!hasFiles) return;

      e.preventDefault();
      try {
        const files = await prepareFiles(input.files);
        const fd = new FormData(form);

        ['photos[]','photo[]','photos','photo','images[]','files[]','files'].forEach(k => fd.delete(k));
        files.forEach(f => fd.append('photos[]', f, f.name));

        let url = (form.getAttribute('action') || '').trim();
        if (!url) url = FORM_ENDPOINT_FALLBACK;

        const resp = await fetch(url, { method: 'POST', body: fd });
        if (!resp.ok) {
          let msg = 'Ошибка сервера ' + resp.status + '.';
          try { msg += ' ' + (await resp.text()).slice(0,500); } catch(_){}
          console.error('submit failed', msg);
          showMsg('Не удалось отправить форму. ' + msg);
          return;
        }
        showMsg('Ваше сообщение отправлено!');
        try { form.reset(); } catch(_) {}
      } catch (err) {
        console.error('submit exception', err);
        try { form.submit(); } catch(e2){ showMsg('Не удалось отправить форму. Попробуйте ещё раз.'); }
      }
    }, false);
  });
})();