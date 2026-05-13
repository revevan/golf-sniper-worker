export async function sendTelegram(token, chatId, text) {
  await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: chatId, text, parse_mode: 'Markdown' }),
  });
}

export function generateCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  return Array.from({ length: 6 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
}

// Handle incoming Telegram webhook messages
export async function handleTelegramWebhook(req, env) {
  const body = await req.json();
  const message = body?.message;
  if (!message) return new Response('ok');

  const chatId = String(message.chat.id);
  const text = (message.text || '').trim().toLowerCase();
  const firstName = message.from?.first_name || 'there';

  if (text === '/start' || text.startsWith('/start ')) {
    const code = generateCode();
    // Store code → chatId with 15 min TTL
    await env.KV.put(`code:${code}`, chatId, { expirationTtl: 900 });
    await sendTelegram(env.TELEGRAM_BOT_TOKEN, chatId,
      `👋 Hey ${firstName}! Your link code is:\n\n` +
      `*${code}*\n\n` +
      `Enter this on the website to start receiving tee time alerts. ` +
      `The code expires in 15 minutes.`
    );
  }

  return new Response('ok');
}
