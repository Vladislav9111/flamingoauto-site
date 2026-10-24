import { enforceRateLimit } from '../lib/rate-limit.mjs';
import { json, limitedBody, sameOrigin } from '../lib/security.mjs';

const botUsername = 'flamingoauto_bot';
const maximumBody = 5 * 1024 * 1024;
function rejected(status, error, code) {
  // Fixed categories only: never log form data, identities, URLs or provider bodies.
  console.warn('FLAMINGO_LEAD_REJECTED ' + code);
  return json(status, { error });
}
const fields = {
  regNumber: ['Регистрационный номер', 20, true], make: ['Марка', 80], model: ['Модель', 80],
  year: ['Год', 4], mileage: ['Пробег', 12], transmission: ['Коробка', 40], engine: ['Двигатель', 80],
  price: ['Желаемая цена', 20], name: ['Имя', 80, true], email: ['Email', 254, true],
  phone: ['Телефон', 30, true], city: ['Город', 100, true], note: ['Комментарий', 1200]
};
function imageType(bytes) {
  if (bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255) return 'image/jpeg';
  if (Buffer.from(bytes.subarray(0, 8)).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))) return 'image/png';
  if (Buffer.from(bytes.subarray(0, 4)).toString() === 'RIFF' && Buffer.from(bytes.subarray(8, 12)).toString() === 'WEBP') return 'image/webp';
  return null;
}
async function telegram(method, body, multipart = false) {
  const response = await fetch(`https://api.telegram.org/bot${process.env.FLAMINGO_TELEGRAM_BOT_TOKEN}/${method}`, {
    method: 'POST', ...(multipart ? {} : { headers: { 'Content-Type': 'application/json' } }),
    body: multipart ? body : JSON.stringify(body), signal: AbortSignal.timeout(15000)
  });
  const result = await response.json();
  if (!response.ok || result.ok !== true) {
    const failure = new Error('TELEGRAM_UNAVAILABLE');
    failure.telegramMethod = method;
    throw failure;
  }
  return result.result;
}
export function createHandler({ limit = enforceRateLimit } = {}) {
return async function handler(request, context) {
  if (new URL(request.url).pathname !== '/api/lead') return json(404, { error: 'Not found' });
  const refusal = await limit(request, context, 'lead');
  if (refusal) return refusal;
  if (request.method !== 'POST') return json(405, { error: 'Method not allowed' }, { Allow: 'POST' });
  if (!sameOrigin(request)) return json(403, { error: 'Origin rejected' });
  const contentType = request.headers.get('content-type') || '';
  if (!contentType.startsWith('multipart/form-data;')) return json(415, { error: 'Multipart form required' });
  if (!process.env.FLAMINGO_TELEGRAM_BOT_TOKEN || !process.env.FLAMINGO_TELEGRAM_CHAT_ID ||
      !process.env.FLAMINGO_TURNSTILE_SECRET_KEY) return rejected(503, 'Form temporarily unavailable', 'configuration_incomplete');
  let form;
  try {
    const body = await limitedBody(request, maximumBody);
    form = await new Response(body, { headers: { 'Content-Type': contentType } }).formData();
  } catch (error) { return rejected(error.message === 'BODY_LIMIT' ? 413 : 400, 'Invalid form data', 'invalid_form_body'); }
  try {
    if (form.get('website')) return rejected(400, 'Request rejected', 'honeypot');
    const elapsed = Date.now() - Number(form.get('startedAt'));
    if (!form.get('startedAt') || !Number.isFinite(elapsed) || elapsed < 2000 || elapsed > 3600000) {
      return rejected(400, 'Please refresh the form and try again', 'form_timestamp');
    }
    const values = {};
    for (const [key, [, maximum, required]] of Object.entries(fields)) {
      if (form.getAll(key).length > 1) return rejected(400, 'Duplicate field', 'duplicate_field');
      const raw = form.get(key) ?? '';
      if (typeof raw !== 'string') return rejected(400, 'Invalid field', 'invalid_field');
      const value = raw.trim();
      if (value.length > maximum || (required && !value) || /[\u0000-\u0008\u000b\u000c\u000e-\u001f]/.test(value)) return rejected(400, 'Invalid field', 'invalid_field');
      values[key] = value;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(values.email) || !/^\+?[\d ()-]{6,30}$/.test(values.phone)) return rejected(400, 'Invalid contact details', 'contact_format');
    const photos = [];
    for (const [key, file] of form.entries()) {
      if (typeof file === 'string') continue;
      if (!/^photo[0-5]$/.test(key) || file.size === 0 || file.size > 3 * 1024 * 1024) return rejected(400, 'Invalid photo', 'photo_size');
      const bytes = new Uint8Array(await file.arrayBuffer());
      const type = imageType(bytes);
      if (!type || type !== file.type || photos.length >= 6) return rejected(400, 'Use up to six JPEG, PNG or WebP photos', 'photo_type_or_count');
      photos.push({ bytes, type });
    }
    const challenge = form.get('turnstileToken');
    if (typeof challenge !== 'string' || !challenge || challenge.length > 2048) return rejected(400, 'Verification required', 'verification_missing');
    const check = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
      method: 'POST', body: new URLSearchParams({ secret: process.env.FLAMINGO_TURNSTILE_SECRET_KEY, response: challenge }),
      signal: AbortSignal.timeout(10000)
    });
    if (!check.ok) return rejected(503, 'Verification unavailable', 'verification_unavailable');
    const validation = await check.json();
    if (validation.success !== true) return rejected(400, 'Verification failed', 'verification_rejected');
    if (validation.action !== 'flamingo-lead') return rejected(400, 'Verification failed', 'verification_action');
    if (validation.hostname !== new URL(request.headers.get('origin')).hostname) return rejected(400, 'Verification failed', 'verification_hostname');
    // Fail closed if someone accidentally configures a financial or AllCars bot token.
    const identity = await telegram('getMe', {});
    if (identity.is_bot !== true || identity.username?.toLowerCase() !== botUsername) return rejected(503, 'Form temporarily unavailable', 'wrong_bot');
    const message = 'Заявка Flamingo Auto\n\n' + Object.entries(fields).filter(([key]) => values[key])
      .map(([key, [label]]) => `${label}: ${values[key]}`).join('\n');
    // Plain text: user input cannot inject Telegram HTML or Markdown.
    await telegram('sendMessage', { chat_id: process.env.FLAMINGO_TELEGRAM_CHAT_ID, text: message });
    let photosSent = photos.length === 0;
    if (photos.length) {
      try {
        const data = new FormData();
        data.set('chat_id', process.env.FLAMINGO_TELEGRAM_CHAT_ID);
        if (photos.length === 1) {
          data.set('photo', new Blob([photos[0].bytes], { type: photos[0].type }), 'photo.' + photos[0].type.split('/')[1]);
          await telegram('sendPhoto', data, true);
        } else {
          data.set('media', JSON.stringify(photos.map((_, index) => ({ type: 'photo', media: `attach://photo${index}` }))));
          photos.forEach((photo, index) => data.set(`photo${index}`, new Blob([photo.bytes], { type: photo.type }), `photo${index}.` + photo.type.split('/')[1]));
          await telegram('sendMediaGroup', data, true);
        }
        photosSent = true;
      } catch { /* Lead text was delivered; report photo failure without duplicating it. */ }
    }
    return json(200, { success: true, photosSent });
  } catch (error) {
    // Never log request bodies, token-bearing URLs, Telegram responses or stack traces.
    const method = ['getMe', 'sendMessage', 'sendPhoto', 'sendMediaGroup'].includes(error?.telegramMethod) ? error.telegramMethod : 'upstream';
    return rejected(503, 'Could not send the request; please try again later', 'service_' + method);
  }
};
}
export default createHandler();
export const config = { path: '/api/lead', rateLimit: {
  windowLimit: 5, windowSize: 60, aggregateBy: ['ip', 'domain']
} };
