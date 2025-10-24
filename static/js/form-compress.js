
  async function normalizeHeic(file) {
    try {
      const name = (file.name || '').toLowerCase();
      const type = (file.type || '').toLowerCase();
      const isHeic = type.includes('heic') || type.includes('heif') || name.endsWith('.heic') || name.endsWith('.heif');
      if (!isHeic) return file;
      if (!window.heic2any) return file;
      const jpegBlob = await window.heic2any({ blob: file, toType: 'image/jpeg', quality: 0.9 });
      const outName = (file.name || 'photo').replace(/\.(heic|heif)$/i, '') + '.jpg';
      return new File([jpegBlob], outName, { type: 'image/jpeg' });
    } catch(e){ console.warn('HEIC normalize failed', e); return file; }
  }
// static/js/form-compress.js
(() => {
  async function normalizeHeic(file) {
    try {
      const name = (file.name || '').toLowerCase();
      const type = (file.type || '').toLowerCase();
      const isHeic = type.includes('heic') || type.includes('heif') || name.endsWith('.heic') || name.endsWith('.heif');
      if (!isHeic) return file;
      if (!window.heic2any) return file;
      const jpegBlob = await window.heic2any({ blob: file, toType: 'image/jpeg', quality: 0.9 });
      const outName = (file.name || 'photo').replace(/\.(heic|heif)$/i, '') + '.jpg';
      return new File([jpegBlob], outName, { type: 'image/jpeg' });
    } catch(e){ console.warn('HEIC normalize failed', e); return file; }
  }

  const MAX_TOTAL = 5 * 1024 * 1024; // 5 MB
  const MAX_FILES = 15;
  const ALLOWED_TYPES = ['image/jpeg','image/png','image/heic','image/heif'];

  function $(sel, root = document) { return root.querySelector(sel); }
  function showError(box, msg) { if (box) { box.textContent = msg; box.style.display = 'block'; } }
  function filterUnsupported(files){ return files.filter(f=> ALLOWED_TYPES.includes((f.type||'').toLowerCase()) || /\.(jpe?g|png|heic|heif)$/i.test(f.name||'')); }

  function clearError(box) { if (box) { box.textContent = ''; box.style.display = 'none'; } }

  async function fileToImage(file) {
    const url = URL.createObjectURL(file);
    const img = new Image();
    await new Promise((res, rej) => { img.onload = () => { URL.revokeObjectURL(url); res(); }; img.onerror = rej; img.src = url; });
    return img;
  }
  function drawScaled(img, maxSide) {
    const scale = Math.min(1, maxSide / Math.max(img.width, img.height));
    const w = Math.max(1, Math.round(img.width * scale));
    const h = Math.max(1, Math.round(img.height * scale));
    const c = document.createElement('canvas');
    c.width = w; c.height = h;
    c.getContext('2d').drawImage(img, 0, 0, w, h);
    return c;
  }
  function canvasToBlob(canvas, mime, quality) {
    return new Promise(res => canvas.toBlob(res, 'image/jpeg', quality));
  }

  async function compressImagesToBudget(files, budgetBytes) {
    const out = [];
    let used = 0;
    const steps = [
      { side: 2000, qs: [0.82, 0.75, 0.68] },
      { side: 1600, qs: [0.62, 0.55, 0.5] },
      { side: 1280, qs: [0.5, 0.45, 0.4] },
    ];
    for (let i = 0; i < files.length; i++) {
      const f = files[i];
      // non-images go as-is (if they fit)
      if (!/^image\//i.test(f.type)) {
        if (used + f.size > budgetBytes) throw new Error('OVER_BUDGET');
        out.push(f); used += f.size; continue;
      }
      const img = await fileToImage(f);
      const targetMime = 'image/jpeg';

      let best = null;
      for (const s of steps) {
        const c = drawScaled(img, s.side);
        for (const q of s.qs) {
          const b = await canvasToBlob(c, targetMime, q);
          const remainFiles = (files.length - i) || 1;
          const perBudget = Math.max(200 * 1024, Math.floor((budgetBytes - used) / remainFiles));
          if (b.size <= perBudget) { best = b; break; }
          best = b;
        }
        if (best && used + best.size <= budgetBytes) break;
      }
      if (!best) throw new Error('ENCODE_FAIL');
      if (used + best.size > budgetBytes) throw new Error('OVER_BUDGET');

      const ext = targetMime.includes('webp') ? 'webp' : 'jpg';
      const name = f.name.replace(/\.(heic|heif|png|gif|jpeg|jpg|webp)$/i, '') + '.' + ext;
      out.push(new File([best], name, { type: targetMime }));
      used += best.size;
    }
    return out;
  }

  async function handleFormSubmit(e) {
    const form = e.target;
    const errBox = $('.form-error', form) || $('#files-error') || null;
    clearError(errBox);

    const fileInput = form.querySelector('input[type="file"]');
    if (!fileInput) return;

    const files = Array.from(fileInput.files || []);
      for (let i=0;i<files.length;i++) { files[i] = await normalizeHeic(files[i]); }
    if (files.length > MAX_FILES) {
      e.preventDefault();
      showError(errBox, `Слишком много файлов (${files.length}). Допустимо до ${MAX_FILES}.`);
      return;
    }

    try {
      e.preventDefault();

      const compressed = await compressImagesToBudget(files, MAX_TOTAL);
      const total = compressed.reduce((s, f) => s + f.size, 0);
      if (total > MAX_TOTAL) throw new Error('OVER_BUDGET');

      const fd = new FormData(form);
      fd.delete(fileInput.name);
      compressed.forEach(f => fd.append(fileInput.name, f, f.name));

      const action = form.getAttribute('action') || '/.netlify/functions/send-telegram';
      const method = (form.getAttribute('method') || 'POST').toUpperCase();

      const res = await fetch(action, { method, body: fd });
      if (res.status === 413) {
        showError(errBox, 'Слишком большой объём вложений. Ограничение — 5 МБ.');
        return;
      }
      if (!res.ok) {
        showError(errBox, 'Не удалось отправить заявку. Попробуйте ещё раз.');
        return;
      }
      form.reset();
      alert('Заявка отправлена! Мы свяжемся с вами.');
    } catch (err) {
      showError($('.form-error', e.target) || null,
        err && err.message === 'OVER_BUDGET'
          ? 'Даже после сжатия файлы превышают 5 МБ. Уберите один-два файла или уменьшите качество фото.'
          : 'Ошибка при подготовке файлов.');
      console.error(err);
    }
  }

  window.addEventListener('DOMContentLoaded', () => {
    document.querySelectorAll('form[data-compress="on"]').forEach(form => {
      form.addEventListener('submit', handleFormSubmit);
    });
  });
})();
