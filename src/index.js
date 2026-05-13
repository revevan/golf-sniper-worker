import { COURSES } from './courses.js';
import { handleTelegramWebhook, sendTelegram } from './telegram.js';
import { runCron } from './cron.js';

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    },
  });
}

function uuid() {
  return crypto.randomUUID();
}

async function handleRequest(req, env) {
  const url = new URL(req.url);
  const path = url.pathname;

  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type' } });

  // GET /courses — course list for the landing page
  if (req.method === 'GET' && path === '/courses') {
    return json(COURSES);
  }

  // POST /resolve-code — exchange link code for chatId (so frontend can load alerts)
  if (req.method === 'POST' && path === '/resolve-code') {
    const { linkCode } = await req.json();
    if (!linkCode) return json({ error: 'linkCode required' }, 400);
    const chatId = await env.KV.get(`code:${linkCode.toUpperCase()}`);
    if (!chatId) return json({ error: 'Invalid or expired code' }, 400);
    return json({ chatId });
  }

  // POST /telegram-webhook — incoming Telegram messages
  if (req.method === 'POST' && path === '/telegram-webhook') {
    return handleTelegramWebhook(req, env);
  }

  // POST /subscribe — create a new alert
  if (req.method === 'POST' && path === '/subscribe') {
    const body = await req.json();
    const { linkCode, chatId: providedChatId, courseKey, date, earliestTime, latestTime, minPlayers, holes } = body;

    if (!courseKey || !date || !earliestTime || !latestTime || !minPlayers) {
      return json({ error: 'Missing required fields' }, 400);
    }

    // Resolve chatId — prefer stored chatId, fall back to link code
    let telegramChatId = providedChatId || null;
    if (!telegramChatId) {
      if (!linkCode) return json({ error: 'linkCode or chatId required' }, 400);
      telegramChatId = await env.KV.get(`code:${linkCode.toUpperCase()}`);
      if (!telegramChatId) {
        return json({ error: 'Invalid or expired link code. Message the bot /start to get a new one.' }, 400);
      }
    }

    const course = COURSES.find(c => String(c.alias || c.facilityId) === String(courseKey));
    if (!course) return json({ error: 'Unknown course' }, 400);

    const id = uuid();
    const sub = {
      id,
      courseKey: course.alias ?? course.facilityId,
      courseName: course.name,
      api: course.api,
      facilityId: course.facilityId ?? null,
      scheduleId: course.scheduleId ?? null,
      date,
      earliestTime,
      latestTime,
      minPlayers: Number(minPlayers),
      holes: Number(holes ?? course.holes[0]),
      telegramChatId,
      active: true,
      createdAt: new Date().toISOString(),
    };

    // Auto-expire 1 day after target date
    const expiry = new Date(date);
    expiry.setDate(expiry.getDate() + 1);
    const ttl = Math.max(60, Math.floor((expiry - Date.now()) / 1000));

    await env.KV.put(`sub:${id}`, JSON.stringify(sub), { expirationTtl: ttl });

    // Add to user index
    const userKey = `user:${telegramChatId}`;
    const existing = await env.KV.get(userKey, 'json') ?? [];
    await env.KV.put(userKey, JSON.stringify([...existing, id]));

    // Confirm via Telegram
    await sendTelegram(env.TELEGRAM_BOT_TOKEN, telegramChatId,
      `✅ *Alert set!*\n${course.name} on ${date}\n${earliestTime}–${latestTime} · ${minPlayers}+ players`
    );

    return json({ id, chatId: telegramChatId, message: 'Alert created' });
  }

  // GET /subscriptions?chatId=xxx — list a user's alerts
  if (req.method === 'GET' && path === '/subscriptions') {
    const chatId = url.searchParams.get('chatId');
    if (!chatId) return json({ error: 'chatId required' }, 400);

    const ids = await env.KV.get(`user:${chatId}`, 'json') ?? [];
    const subs = (await Promise.all(ids.map(id => env.KV.get(`sub:${id}`, 'json')))).filter(Boolean);
    return json(subs);
  }

  // DELETE /subscription/:id — cancel an alert
  if (req.method === 'DELETE' && path.startsWith('/subscription/')) {
    const id = path.split('/').pop();
    const sub = await env.KV.get(`sub:${id}`, 'json');
    if (!sub) return json({ error: 'Not found' }, 404);

    await env.KV.delete(`sub:${id}`);

    // Remove from user index
    const userKey = `user:${sub.telegramChatId}`;
    const existing = await env.KV.get(userKey, 'json') ?? [];
    await env.KV.put(userKey, JSON.stringify(existing.filter(i => i !== id)));

    return json({ message: 'Alert cancelled' });
  }

  return json({ error: 'Not found' }, 404);
}

export default {
  async fetch(req, env) {
    try {
      return await handleRequest(req, env);
    } catch (err) {
      console.error(err);
      return new Response('Internal error', { status: 500 });
    }
  },

  async scheduled(event, env) {
    await runCron(env);
  },
};
