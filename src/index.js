import { COURSES } from './courses.js';
import { handleTelegramWebhook, sendTelegram } from './telegram.js';
import { runCron } from './cron.js';
import { incrementStat } from './stats.js';
import { getBookOutTimeline, getCoursePatterns, getMidnightDumps } from './analytics.js';
import { fetchGolfNow } from './golfnow.js';
import { fetchTeeItUp } from './teeitup.js';
import { fetchForeUp } from './foreup.js';
import { fetchOttoGolf } from './ottogolf.js';

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    },
  });
}

function uuid() {
  return crypto.randomUUID();
}

async function listAllKeys(env, prefix) {
  const keys = [];
  let cursor;
  do {
    const result = await env.KV.list({ prefix, cursor });
    keys.push(...result.keys);
    cursor = result.list_complete ? undefined : result.cursor;
  } while (cursor);
  return keys;
}

function isAdminAuthorized(req, env) {
  const auth = req.headers.get('Authorization') ?? '';
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : '';
  return env.ADMIN_SECRET && token === env.ADMIN_SECRET;
}


async function handleRequest(req, env) {
  const url = new URL(req.url);
  const path = url.pathname;

  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type, Authorization' } });

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

    await incrementStat(env, 'stats:total_subscriptions');

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

  // POST /feedback — submit feedback/request
  if (req.method === 'POST' && path === '/feedback') {
    const body = await req.json();
    const { type, message, courseName, courseUrl, contact } = body;

    const validTypes = ['course', 'bug', 'feedback', 'feature'];
    if (!validTypes.includes(type)) return json({ error: 'Invalid type' }, 400);
    if (!message?.trim()) return json({ error: 'message required' }, 400);

    const id = uuid();
    await env.KV.put(`feedback:${id}`, JSON.stringify({
      id,
      type,
      message: message.trim(),
      courseName: courseName?.trim() || null,
      courseUrl: courseUrl?.trim() || null,
      contact: contact?.trim() || null,
      createdAt: new Date().toISOString(),
      resolved: false,
    }));

    return json({ id, message: 'Submitted — thank you!' });
  }

  // GET /admin/feedback?secret=xxx — list all submissions
  if (req.method === 'GET' && path === '/admin/feedback') {
    if (!isAdminAuthorized(req, env)) return json({ error: 'Unauthorized' }, 401);

    const keys = await listAllKeys(env, 'feedback:');
    const submissions = (await Promise.all(keys.map(k => env.KV.get(k.name, 'json'))))
      .filter(Boolean)
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

    return json(submissions);
  }

  // POST /admin/feedback/:id/resolve?secret=xxx — toggle resolved
  if (req.method === 'POST' && /^\/admin\/feedback\/[^/]+\/resolve$/.test(path)) {
    if (!isAdminAuthorized(req, env)) return json({ error: 'Unauthorized' }, 401);

    const id = path.split('/')[3];
    const item = await env.KV.get(`feedback:${id}`, 'json');
    if (!item) return json({ error: 'Not found' }, 404);

    item.resolved = !item.resolved;
    await env.KV.put(`feedback:${id}`, JSON.stringify(item));
    return json({ resolved: item.resolved });
  }

  // DELETE /admin/feedback/:id?secret=xxx — delete submission
  if (req.method === 'DELETE' && /^\/admin\/feedback\/[^/]+$/.test(path)) {
    if (!isAdminAuthorized(req, env)) return json({ error: 'Unauthorized' }, 401);

    await env.KV.delete(`feedback:${path.split('/').pop()}`);
    return json({ message: 'Deleted' });
  }

  // GET /admin/stats?secret=xxx — admin dashboard data
  if (req.method === 'GET' && path === '/admin/stats') {
    if (!isAdminAuthorized(req, env)) return json({ error: 'Unauthorized' }, 401);

    const [userKeys, subKeys] = await Promise.all([
      listAllKeys(env, 'user:'),
      listAllKeys(env, 'sub:'),
    ]);

    const [totalSubscriptions, totalAlertsSent, totalSlotMatches] = await Promise.all([
      env.KV.get('stats:total_subscriptions'),
      env.KV.get('stats:total_alerts_sent'),
      env.KV.get('stats:total_slot_matches'),
    ]);

    // Fetch active subscription details for breakdown stats
    const activeSubs = (await Promise.all(
      subKeys.map(k => env.KV.get(k.name, 'json'))
    )).filter(Boolean);

    const courseCounts = {};
    const apiCounts = { teeitup: 0, foreup: 0, golfnow: 0 };
    for (const sub of activeSubs) {
      courseCounts[sub.courseName] = (courseCounts[sub.courseName] ?? 0) + 1;
      if (sub.api in apiCounts) apiCounts[sub.api]++;
    }
    const topCourses = Object.entries(courseCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([name, count]) => ({ name, count }));

    return json({
      uniqueUsers: userKeys.length,
      activeSubscriptions: activeSubs.length,
      totalSubscriptions: Number(totalSubscriptions ?? 0),
      totalAlertsSent: Number(totalAlertsSent ?? 0),
      totalSlotMatches: Number(totalSlotMatches ?? 0),
      topCourses,
      apiBreakdown: apiCounts,
      generatedAt: new Date().toISOString(),
    });
  }

  // GET /analytics/course/:courseKey?secret=xxx — patterns for a specific course
  if (req.method === 'GET' && /^\/analytics\/course\/[^/]+$/.test(path)) {
    if (!isAdminAuthorized(req, env)) return json({ error: 'Unauthorized' }, 401);

    const courseKey = path.split('/')[3];
    const patterns = await getCoursePatterns(env.HISTORY, courseKey);
    return json(patterns);
  }

  // GET /analytics/course/:courseKey/date/:date?secret=xxx — timeline for specific date
  if (req.method === 'GET' && /^\/analytics\/course\/[^/]+\/date\/\d{4}-\d{2}-\d{2}$/.test(path)) {
    if (!isAdminAuthorized(req, env)) return json({ error: 'Unauthorized' }, 401);

    const parts = path.split('/');
    const courseKey = parts[3];
    const date = parts[5];

    const timeline = await getBookOutTimeline(env.HISTORY, courseKey, date);
    return json({
      courseKey,
      date,
      slots: Object.values(timeline).sort((a, b) => a.minutesToBookOut - b.minutesToBookOut),
    });
  }

  // GET /analytics/midnight-dumps?secret=xxx&days=7 — detect unusual activity patterns
  if (req.method === 'GET' && path === '/analytics/midnight-dumps') {
    if (!isAdminAuthorized(req, env)) return json({ error: 'Unauthorized' }, 401);

    const days = Number(url.searchParams.get('days') ?? 7);
    const courseKey = url.searchParams.get('course');

    if (!courseKey) {
      return json({ error: 'course parameter required' }, 400);
    }

    const dumps = await getMidnightDumps(env.HISTORY, courseKey, days);
    return json(dumps);
  }

  // GET /search?region=...&date=...&earliest=...&latest=...&players=...&holes=...
  if (req.method === 'GET' && path === '/search') {
    const region = url.searchParams.get('region');
    const date = url.searchParams.get('date');
    const earliest = url.searchParams.get('earliest') ?? '06:00';
    const latest = url.searchParams.get('latest') ?? '18:00';
    const players = Number(url.searchParams.get('players') ?? 2);
    const holes = Number(url.searchParams.get('holes') ?? 18);

    if (!region || !date) return json({ error: 'region and date required' }, 400);

    const coursesInRegion = COURSES.filter(c => c.region === region);
    const withTimeout = (p, ms = 10000) => Promise.race([
      p,
      new Promise((_, rej) => setTimeout(() => rej(new Error('timeout')), ms)),
    ]);

    const items = await Promise.all(coursesInRegion.map(async course => {
      const courseKey = course.alias ?? String(course.facilityId);
      const bookingUrl = course.api === 'foreup'
        ? `https://foreupsoftware.com/index.php/booking/${course.facilityId}/${course.scheduleId}`
        : course.api === 'golfnow'
        ? `https://www.golfnow.com/tee-times/facility/${course.facilityId}/search`
        : course.api === 'ottogolf'
        ? `https://${course.facilityId}.ottogolf.com/booking/${course.scheduleId}/index.asp`
        : (course.teeItUpOrigin ?? `https://${courseKey}.book.teeitup.com`);

      try {
        let raw = [];
        if (course.api === 'teeitup') {
          const alias = course.teeItUpAlias ?? courseKey;
          raw = await withTimeout(fetchTeeItUp(alias, date, course.teeItUpCourseId ?? null, course.teeItUpOrigin ?? null));
          raw = raw.filter(s => s.holes === holes && s.availableSpots >= players);
        } else if (course.api === 'golfnow') {
          raw = await withTimeout(fetchGolfNow(course.facilityId, date, players, holes));
        } else if (course.api === 'foreup') {
          raw = await withTimeout(fetchForeUp(course.facilityId, course.scheduleId, date, players, holes));
        } else if (course.api === 'ottogolf') {
          raw = await withTimeout(fetchOttoGolf(course.facilityId, course.scheduleId, date));
          raw = raw.filter(s => s.availableSpots >= players);
        }

        const matching = raw.filter(s => s.time >= earliest && s.time <= latest);
        return {
          name: course.name,
          courseKey,
          bookingUrl,
          slots: matching.map(s => ({ time: s.time, players: s.availableSpots, fee: s.greenFee ?? null })),
        };
      } catch {
        return { name: course.name, courseKey, bookingUrl, slots: [], error: true };
      }
    }));

    return json({
      region,
      date,
      results: items.filter(i => i.slots.length > 0),
      empty: items.filter(i => i.slots.length === 0 && !i.error),
      errors: items.filter(i => i.error).map(i => i.name),
    });
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
