import { createCipheriv, createDecipheriv, createHmac, randomBytes, timingSafeEqual } from 'node:crypto';

const lifetime = 60 * 60 * 1000;
function key(context) {
  return createHmac('sha256', process.env.FLAMINGO_TELEGRAM_BOT_TOKEN)
    .update('flamingo-auto/lead-receipt/v1/' + context).digest();
}
function binding(values, origin) {
  // Contact data never appears in the receipt. A separate keyed digest also
  // binds it to the configured destination and requesting site.
  const contact = JSON.stringify([
    values.regNumber.toUpperCase().replace(/\s+/g, ' '),
    values.phone.replace(/[ ()-]/g, ''),
    process.env.FLAMINGO_TELEGRAM_CHAT_ID, origin
  ]);
  return createHmac('sha256', key('contact-binding')).update(contact).digest('base64url');
}
export function createReceipt(messageId, values, origin, now = Date.now()) {
  if (!Number.isSafeInteger(messageId) || messageId < 1) throw new Error('INVALID_DELIVERY_RECEIPT');
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', key('encryption'), iv);
  cipher.setAAD(Buffer.from('flamingo-lead-receipt-v1'));
  const payload = JSON.stringify({ v: 1, id: messageId, issued: now, expires: now + lifetime, binding: binding(values, origin) });
  const encrypted = Buffer.concat([cipher.update(payload, 'utf8'), cipher.final()]);
  return Buffer.concat([iv, cipher.getAuthTag(), encrypted]).toString('base64url');
}
export function readReceipt(receipt, values, origin, now = Date.now()) {
  try {
    if (typeof receipt !== 'string' || receipt.length < 80 || receipt.length > 600 || !/^[A-Za-z0-9_-]+$/.test(receipt)) return null;
    const bytes = Buffer.from(receipt, 'base64url');
    if (bytes.toString('base64url') !== receipt) return null;
    const decipher = createDecipheriv('aes-256-gcm', key('encryption'), bytes.subarray(0, 12));
    decipher.setAAD(Buffer.from('flamingo-lead-receipt-v1'));
    decipher.setAuthTag(bytes.subarray(12, 28));
    const decoded = JSON.parse(Buffer.concat([decipher.update(bytes.subarray(28)), decipher.final()]).toString('utf8'));
    if (decoded.v !== 1 || !Number.isSafeInteger(decoded.id) || decoded.id < 1 ||
        !Number.isSafeInteger(decoded.issued) || !Number.isSafeInteger(decoded.expires) ||
        decoded.issued > now || decoded.expires <= now || decoded.expires - decoded.issued !== lifetime) return null;
    const actual = Buffer.from(decoded.binding || '');
    const expected = Buffer.from(binding(values, origin));
    if (actual.length !== expected.length || !timingSafeEqual(actual, expected)) return null;
    return { messageId: decoded.id };
  } catch { return null; }
}
