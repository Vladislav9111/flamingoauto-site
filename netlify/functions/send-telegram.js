// netlify/functions/send-telegram.js
import Busboy from 'busboy';

const MAX_TOTAL_BYTES = 5 * 1024 * 1024; // 5 MB

export const handler = async (event) => {
  try {
    if (event.httpMethod !== 'POST') {
      return { statusCode: 405, body: 'Method Not Allowed' };
    }

    const rawLen = event.body ? event.body.length : 0;
    const approxBytes = event.isBase64Encoded
      ? Math.floor(rawLen * 3 / 4)
      : Buffer.byteLength(event.body || '', 'utf8');
    if (approxBytes > MAX_TOTAL_BYTES) {
      return json(413, { ok:false, code:'PAYLOAD_TOO_LARGE', message:'Total attachments size exceeds 5 MB.' });
    }

    const contentType = event.headers['content-type'] || event.headers['Content-Type'] || '';
    if (!contentType || !contentType.toLowerCase().includes('multipart/form-data')) {
      const fields = parseNonMultipart(event);
      const text = buildLeadText(fields, []);
      await tgSendMessage(text);
      return json(200, { ok:true });
    }

    const files = [];
    const fields = {};

    await new Promise((resolve, reject) => {
      const bb = Busboy({ headers: { 'content-type': contentType } });
      let acc = 0;

      bb.on('file', (name, file, info) => {
        const chunks = [];
        file.on('data', (d) => {
          acc += d.length;
          if (acc > MAX_TOTAL_BYTES) {
            bb.removeAllListeners();
            file.removeAllListeners();
            reject(new Error('PAYLOAD_TOO_LARGE'));
            return;
          }
          chunks.push(d);
        });
        file.on('end', () => {
          const buffer = Buffer.concat(chunks);
          files.push({ field:name, filename:info.filename, mime:info.mimeType, buffer });
        });
      });

      bb.on('field', (name, val) => { fields[name] = val; });
      bb.on('error', reject);
      bb.on('finish', resolve);

      const buf = event.isBase64Encoded ? Buffer.from(event.body, 'base64') : Buffer.from(event.body || '', 'utf8');
      bb.end(buf);
    }).catch(err => {
      if (String(err).includes('PAYLOAD_TOO_LARGE')) {
        throw Object.assign(new Error('PAYLOAD_TOO_LARGE'), { statusCode: 413 });
      }
      throw err;
    });

    const totalBytes = files.reduce((s,f)=>s+(f.buffer?.length||0),0);
    if (totalBytes > MAX_TOTAL_BYTES) {
      return json(413, { ok:false, code:'PAYLOAD_TOO_LARGE', message:'Total attachments size exceeds 5 MB.' });
    }

    const text = buildLeadText(fields, files.map(f => f.filename));
    await tgSendMessage(text);

    for (const f of files) {
      await tgSendDocument(f.buffer, f.filename, f.mime || 'application/octet-stream');
    }

    return json(200, { ok:true });

  } catch (e) {
    if (e && (e.statusCode === 413 || String(e).includes('PAYLOAD_TOO_LARGE'))) {
      return json(413, { ok:false, code:'PAYLOAD_TOO_LARGE', message:'Total attachments size exceeds 5 MB.' });
    }
    console.error('send-telegram error', e);
    return json(500, { ok:false, message:'Internal Server Error' });
  }
};

function parseNonMultipart(event) {
  try {
    const ct = (event.headers['content-type'] || event.headers['Content-Type'] || '').toLowerCase();
    if (ct.includes('application/json')) return JSON.parse(event.body || '{}');
    if (ct.includes('application/x-www-form-urlencoded')) {
      const params = new URLSearchParams(event.body || '');
      const obj = {};
      for (const [k, v] of params.entries()) obj[k] = v;
      return obj;
    }
  } catch {}
  return {};
}

function buildLeadText(fields, filenames) {
  const { name, phone, message } = fields;
  return [
    '🔥 Новая заявка с сайта',
    name ? `Имя: ${name}` : '',
    phone ? `Телефон: ${phone}` : '',
    message ? `Комментарий: ${message}` : '',
    filenames && filenames.length ? `Вложения: ${filenames.length} шт.\n${filenames.map(n => `• ${n}`).join('\n')}` : ''
  ].filter(Boolean).join('\n');
}

async function tgSendMessage(text) {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chat  = process.env.TELEGRAM_CHAT_ID;
  const url = `https://api.telegram.org/bot${token}/sendMessage`;
  await fetch(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ chat_id: chat, text })
  });
}

async function tgSendDocument(buffer, filename, mime) {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chat  = process.env.TELEGRAM_CHAT_ID;
  const url = `https://api.telegram.org/bot${token}/sendDocument`;

  const form = new FormData();
  form.append('chat_id', chat);
  form.append('document', new Blob([buffer], { type: mime }), filename);

  await fetch(url, { method: 'POST', body: form });
}

function json(statusCode, obj) {
  return { statusCode, headers:{ 'content-type':'application/json; charset=utf-8' }, body: JSON.stringify(obj) };
}
