import { encrypt } from './crypto.js';

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
  // Keep original text for commands that need to preserve case (e.g. passwords)
  const originalText = (message.text || '').trim();
  const text = originalText.toLowerCase();
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
  } else if (text.startsWith('/setcreds')) {
    // Use originalText so passwords with mixed case are preserved
    const parts = originalText.split(/\s+/);
    const username = parts[1];
    const password = parts[2];
    if (!username || !password) {
      await sendTelegram(env.TELEGRAM_BOT_TOKEN, chatId,
        '⚠️ Usage: `/setcreds your@email.com yourpassword`\n\nSend this as a *private message* to the bot — never in a group chat.'
      );
    } else {
      if (!env.ENCRYPTION_KEY) {
        await sendTelegram(env.TELEGRAM_BOT_TOKEN, chatId,
          '❌ Auto-booking is not configured on this server. Contact the administrator.'
        );
        return new Response('ok');
      }
      // Warn if sent in a group chat
      if (message.chat.type !== 'private') {
        await sendTelegram(env.TELEGRAM_BOT_TOKEN, chatId,
          '⚠️ Your credentials were received, but you sent this in a group chat. *Delete that message immediately* and use the bot in a private DM next time.'
        );
      }
      const encrypted = await encrypt(JSON.stringify({ username, password }), env.ENCRYPTION_KEY);
      await env.KV.put(`creds:${chatId}`, encrypted);
      await sendTelegram(env.TELEGRAM_BOT_TOKEN, chatId,
        `🔐 Credentials saved for *${username}*\nYour password is encrypted at rest. Use /removecreds to clear them.`
      );
    }
  } else if (text === '/removecreds') {
    await env.KV.delete(`creds:${chatId}`);
    await sendTelegram(env.TELEGRAM_BOT_TOKEN, chatId,
      '🗑 Credentials removed. Auto-booking is now disabled for your account.'
    );
  }

  return new Response('ok');
}
