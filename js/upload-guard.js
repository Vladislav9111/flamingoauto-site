
/**
 * Upload Guard & Image Compressor
 * - Validates total file size (default 5 MB)
 * - Attempts to auto-compress image files to fit under the limit
 * Usage:
 *   <form data-upload-guard="on"> ... <input type="file" multiple> ... </form>
 */
(function () {
  async function normalizeHeic(file) {
    const name = (file.name || '').toLowerCase();
    const type = (file.type || '').toLowerCase();
    const isHeic = type.includes('heic') || type.includes('heif') || name.endsWith('.heic') || name.endsWith('.heif');
    if (!isHeic) return file;
    if (typeof window.heic2any !== 'function') {
      console.warn('heic2any not loaded; keeping original file');
      return file;
    }
    try {
      const jpegBlob = await window.heic2any({ blob: file, toType: 'image/jpeg', quality: 0.86 });
      const fname = (file.name || 'photo').replace(/\.(heic|heif)$/i, '') + '.jpg';
      return new File([jpegBlob], fname, { type: 'image/jpeg' });
    } catch (e) {
      console.error('HEIC→JPEG convert failed', e);
      return file; // не блокируем
    }
  }

  const BYTES_MB = 1024 * 1024;
  const LIMIT_MB = 5;           // hard limit to target
  const SOFT_LIMIT = 4.8 * BYTES_MB; // try to compress to under this
  const HARD_LIMIT = 5 * BYTES_MB;   // block above this after compression

  function bytesTotal(files) {
    let total = 0;
    for (const f of files) total += f.size || 0;
    return total;
  }

  function isImage(file) {
    return /^image\/(png|jpe?g|webp)$/i.test(file.type);
  }

  async function readImageBitmap(file) {
    return await createImageBitmap(file);
  }

  async function compressImage(file, quality = 0.8, maxW = 1920, maxH = 1920) {
    try {
      const bmp = await readImageBitmap(file);
      const ratio = Math.min(1, maxW / bmp.width, maxH / bmp.height);
      const targetW = Math.max(1, Math.round(bmp.width * ratio));
      const targetH = Math.max(1, Math.round(bmp.height * ratio));
      const canvas = document.createElement('canvas');
      canvas.width = targetW;
      canvas.height = targetH;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(bmp, 0, 0, targetW, targetH);
      const type = file.type === 'image/png' ? 'image/jpeg' : (file.type || 'image/jpeg');
      const blob = await new Promise(res => canvas.toBlob(res, type, quality));
      const name = file.name.replace(/\.(png|jpg|jpeg|webp)$/i, '.jpg');
      return new File([blob], name, { type: blob.type, lastModified: Date.now() });
    } catch (e) {
      console.warn('Compression failed, passing original file:', e);
      return file;
    }
  }

  async function compressToBudget(files, budgetBytes) {
    // Compress images progressively until under budget or out of options
    let list = Array.from(files);
    let total = bytesTotal(list);
    if (total <= budgetBytes) return list;

    // sort images by size desc
    const imgs = list.filter(isImage).sort((a, b) => b.size - a.size);
    let quality = 0.8;
    let dims = 1920;
    for (let round = 0; round < 3 && total > budgetBytes && imgs.length; round++) {
      for (let i = 0; i < imgs.length && total > budgetBytes; i++) {
        const idx = list.indexOf(imgs[i]);
        const compressed = await compressImage(imgs[i], quality, dims, dims);
        total += (compressed.size - imgs[i].size);
        list[idx] = compressed;
        imgs[i] = compressed;
      }
      quality = Math.max(0.5, quality - 0.15);
      dims = Math.max(1024, Math.round(dims * 0.75));
    }
    return list;
  }

  function replaceInputFiles(input, files) {
    const dt = new DataTransfer();
    files.forEach(f => dt.items.add(f));
    input.files = dt.files;
  }

  async function handleForm(form) {
    const fileInputs = Array.from(form.querySelectorAll('input[type="file"]'));
    if (!fileInputs.length) return true;

    const allFiles = fileInputs.flatMap(inp => Array.from(inp.files || []));
    const initialTotal = bytesTotal(allFiles);

    if (initialTotal <= SOFT_LIMIT) return true;

    // Try compression
    const confirmMsg = 'Прикреплённые файлы весят более ' + LIMIT_MB +
      ' МБ. Я попробую автоматически уменьшить изображения. Продолжить?';
    if (!window.confirm(confirmMsg)) return false;

    let idx = 0;
    for (const input of fileInputs) {
      const filesArr = Array.from(input.files || []);
      const compressed = await compressToBudget(filesArr, SOFT_LIMIT);
      replaceInputFiles(input, compressed);
      idx++;
    }

    const afterFiles = fileInputs.flatMap(inp => Array.from(inp.files || []));
    const afterTotal = bytesTotal(afterFiles);

    if (afterTotal > HARD_LIMIT) {
      alert('Суммарный размер прикреплённых файлов всё ещё превышает ' + LIMIT_MB +
        ' МБ. Пожалуйста, удалите некоторые файлы или загрузите меньшего размера.');
      return false;
    }
    return true;
  }

  function enhance(form) {
    if (form.__uploadGuardBound) return;
    form.__uploadGuardBound = true;
    form.addEventListener('submit', function (e) {
      // Support async by using Promise and preventing default
      if (form.dataset.uploadGuard !== 'on') return;
      e.preventDefault();
      (async () => {
        const ok = await handleForm(form);
        if (ok) form.submit();
      })();
    }, { passive: false });
  }

  function init() {
    const forms = document.querySelectorAll('form[data-upload-guard="on"]');
    forms.forEach(enhance);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
