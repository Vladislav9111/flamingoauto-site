// Read-only build checks. Never log provider bodies or credentials.
// This script is excluded from the public output directory.
if (!['production', 'deploy-preview'].includes(process.env.CONTEXT)) {
  console.log('FLAMINGO_SERVICE_CHECK ' + JSON.stringify({ skipped: true }));
} else {
  const result = { bot_identity: false, recipient_access: false, turnstile_secret: false };
  async function telegram(method, data) {
    const response = await fetch(`https://api.telegram.org/bot${process.env.FLAMINGO_TELEGRAM_BOT_TOKEN}/${method}`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data),
      signal: AbortSignal.timeout(12000)
    });
    return { status: response.status, body: await response.json() };
  }
  try {
    const identity = await telegram('getMe', {});
    result.bot_status = identity.status;
    result.bot_identity = identity.body.ok === true && identity.body.result?.is_bot === true &&
      identity.body.result?.username?.toLowerCase() === 'flamingoauto_bot';
    if (result.bot_identity) {
      const chat = await telegram('getChat', { chat_id: process.env.FLAMINGO_TELEGRAM_CHAT_ID });
      result.recipient_status = chat.status;
      result.recipient_access = chat.body.ok === true;
    }
  } catch { result.telegram_check_unavailable = true; }
  try {
    const response = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
      method: 'POST', signal: AbortSignal.timeout(12000),
      body: new URLSearchParams({ secret: process.env.FLAMINGO_TURNSTILE_SECRET_KEY || '', response: 'invalid-synthetic-token' })
    });
    result.turnstile_status = response.status;
    const validation = await response.json();
    // An invalid synthetic challenge is expected. Invalid/missing secrets fail.
    result.turnstile_secret = response.ok && validation.success === false &&
      validation['error-codes']?.includes('invalid-input-response') === true &&
      !validation['error-codes']?.some(code => ['invalid-input-secret', 'missing-input-secret'].includes(code));
  } catch { result.turnstile_check_unavailable = true; }
  console.log('FLAMINGO_SERVICE_CHECK ' + JSON.stringify(result));
  if (!result.bot_identity || !result.recipient_access || !result.turnstile_secret) process.exitCode = 1;
}
