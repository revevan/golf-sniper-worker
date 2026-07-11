import { COURSES } from './courses.js';
import { handleTelegramWebhook, sendTelegram } from './telegram.js';
import { runCron } from './cron.js';
import { incrementStat } from './stats.js';
import { getBookOutTimeline, getCoursePatterns, getMidnightDumps } from './analytics.js';
import { fetchGolfNow } from './golfnow.js';
import { fetchTeeItUp } from './teeitup.js';
import { fetchForeUp } from './foreup.js';
import { fetchOttoGolf } from './ottogolf.js';
import { sendConfirmationEmail } from './email.js';

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

/**
 * Course descriptors: /search accepts courses the caller describes, not just
 * the built-in list — any region works if you know the booking-platform IDs
 * (this is what lets a remixed brik do New York against this same worker).
 * Strict validation because these values feed our upstream fetches: only the
 * four known platforms, and teeItUpOrigin locked to real TeeItUp hosts.
 */
const API_KINDS = new Set(['teeitup', 'golfnow', 'foreup', 'ottogolf']);

function sanitizeCourseDescriptor(d) {
  if (!d || typeof d !== 'object') return null;
  const api = String(d.api ?? '');
  if (!API_KINDS.has(api)) return null;
  const slug = v =>
    typeof v === 'string' && /^[a-z0-9-]{1,80}$/i.test(v) ? v : null;
  const num = v => (/^\d{1,10}$/.test(String(v)) ? String(v) : null);
  const out = {
    api,
    name: typeof d.name === 'string' ? d.name.slice(0, 80) : 'Course',
  };
  if (typeof d.bookingUrl === 'string' && /^https:\/\/[^\s"'<>]{1,300}$/.test(d.bookingUrl)) {
    out.bookingUrl = d.bookingUrl;
  }
  if (api === 'teeitup') {
    out.alias = slug(d.alias);
    if (!out.alias) return null;
    if (d.teeItUpAlias != null) {
      out.teeItUpAlias = slug(d.teeItUpAlias);
      if (!out.teeItUpAlias) return null;
    }
    if (d.teeItUpOrigin != null) {
      const o = String(d.teeItUpOrigin);
      if (!/^https:\/\/[a-z0-9-]{1,80}\.book\.teeitup\.com$/i.test(o)) return null;
      out.teeItUpOrigin = o;
    }
    if (d.teeItUpCourseId != null) {
      out.teeItUpCourseId = slug(String(d.teeItUpCourseId));
      if (!out.teeItUpCourseId) return null;
    }
  } else if (api === 'golfnow') {
    out.facilityId = num(d.facilityId);
    if (!out.facilityId) return null;
  } else if (api === 'foreup') {
    out.facilityId = num(d.facilityId);
    out.scheduleId = num(d.scheduleId);
    if (!out.facilityId || !out.scheduleId) return null;
  } else if (api === 'ottogolf') {
    out.facilityId = slug(d.facilityId);
    out.scheduleId = num(d.scheduleId);
    if (!out.facilityId || !out.scheduleId) return null;
  }
  return out;
}

/** One course's open slots for the day — shared by region and descriptor search. */
async function searchCourse(course, { date, earliest, latest, players, holes }) {
  const withTimeout = (p, ms = 10000) =>
    Promise.race([
      p,
      new Promise((_, rej) => setTimeout(() => rej(new Error('timeout')), ms)),
    ]);
  const courseKey = course.alias ?? String(course.facilityId);
  const bookingUrl = course.bookingUrl ?? (
    course.api === 'foreup'
      ? `https://foreupsoftware.com/index.php/booking/${course.facilityId}/${course.scheduleId}`
      : course.api === 'golfnow'
        ? `https://www.golfnow.com/tee-times/facility/${course.facilityId}/search?date=${date}`
        : course.api === 'ottogolf'
          ? `https://${course.facilityId}.ottogolf.com/booking/${course.scheduleId}/index.asp`
          : (course.teeItUpOrigin ?? `https://${courseKey}.book.teeitup.com`)
  );

  try {
    let raw = [];
    if (course.api === 'teeitup') {
      const alias = course.teeItUpAlias ?? courseKey;
      raw = await withTimeout(
        fetchTeeItUp(alias, date, course.teeItUpCourseId ?? null, course.teeItUpOrigin ?? null),
      );
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
}

function confirmPage(title, message, success) {
  const icon = success ? '✅' : '❌';
  const color = success ? '#2e7d32' : '#c62828';
  return `<!DOCTYPE html>
<html><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${title} — Golf Sniper</title></head>
<body style="margin:0;padding:0;background:#f0f4f0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif">
  <div style="max-width:480px;margin:60px auto;background:white;border-radius:14px;padding:40px 32px;text-align:center;box-shadow:0 2px 8px rgba(0,0,0,0.08)">
    <div style="font-size:3rem;margin-bottom:16px">${icon}</div>
    <h1 style="margin:0 0 12px;font-size:1.4rem;color:${color}">${title}</h1>
    <p style="margin:0 0 28px;color:#555;font-size:0.95rem;line-height:1.6">${message}</p>
    <a href="https://golf-sniper.evanwkennedy.workers.dev" style="display:inline-block;background:#4caf50;color:white;text-decoration:none;padding:12px 28px;border-radius:9px;font-weight:700">
      Back to Golf Sniper
    </a>
  </div>
</body></html>`;
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

  // POST /subscribe-email — create alert with email confirmation
  if (req.method === 'POST' && path === '/subscribe-email') {
    const body = await req.json();
    const { email, courseKey, date, earliestTime, latestTime, minPlayers, holes } = body;

    if (!email || !courseKey || !date || !earliestTime || !latestTime || !minPlayers) {
      return json({ error: 'Missing required fields' }, 400);
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return json({ error: 'Invalid email address' }, 400);
    }

    const course = COURSES.find(c => String(c.alias || c.facilityId) === String(courseKey));
    if (!course) return json({ error: 'Unknown course' }, 400);

    const token = uuid();
    const pending = {
      email,
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
      createdAt: new Date().toISOString(),
    };

    await env.KV.put(`pending:${token}`, JSON.stringify(pending), { expirationTtl: 86400 });

    await sendConfirmationEmail(env.RESEND_API_KEY, {
      to: email,
      token,
      courseName: course.name,
      date,
      earliestTime,
      latestTime,
      minPlayers: pending.minPlayers,
      holes: pending.holes,
    });

    return json({ message: 'Check your email to confirm your alert' });
  }

  // GET /confirm-email?token=xxx — activate a pending email subscription
  if (req.method === 'GET' && path === '/confirm-email') {
    const token = url.searchParams.get('token');
    if (!token) return new Response('Missing token', { status: 400 });

    const pending = await env.KV.get(`pending:${token}`, 'json');
    if (!pending) {
      return new Response(confirmPage('Link expired', 'This confirmation link has expired or already been used. Please set up your alert again.', false), {
        status: 410, headers: { 'Content-Type': 'text/html' },
      });
    }

    const id = uuid();
    const sub = { id, ...pending, active: true, notificationType: 'email' };

    const expiry = new Date(pending.date);
    expiry.setDate(expiry.getDate() + 1);
    const ttl = Math.max(60, Math.floor((expiry - Date.now()) / 1000));

    await Promise.all([
      env.KV.put(`sub:${id}`, JSON.stringify(sub), { expirationTtl: ttl }),
      env.KV.delete(`pending:${token}`),
      incrementStat(env, 'stats:total_subscriptions'),
    ]);

    const displayDate = new Date(pending.date + 'T12:00:00Z').toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', timeZone: 'UTC' });
    return new Response(confirmPage(
      'Alert confirmed!',
      `You're all set. We'll email <strong>${pending.email}</strong> the moment a tee time opens at <strong>${pending.courseName}</strong> on <strong>${displayDate}</strong> (${pending.earliestTime}–${pending.latestTime} · ${pending.minPlayers}+ players).`,
      true
    ), { headers: { 'Content-Type': 'text/html' } });
  }

  // GET /search — two shapes:
  //   ?region=LA City&date=...                    → the built-in course list
  //   ?courses=<JSON descriptor array>&date=...   → caller-described courses,
  //     any region in the country (see sanitizeCourseDescriptor)
  // Shared filters: earliest, latest, players, holes.
  if (req.method === 'GET' && path === '/search') {
    const region = url.searchParams.get('region');
    const date = url.searchParams.get('date');
    const earliest = url.searchParams.get('earliest') ?? '06:00';
    const latest = url.searchParams.get('latest') ?? '18:00';
    const players = Number(url.searchParams.get('players') ?? 2);
    const holes = Number(url.searchParams.get('holes') ?? 18);
    if (!date) return json({ error: 'date required' }, 400);

    let courses;
    const coursesParam = url.searchParams.get('courses');
    if (coursesParam) {
      let parsed;
      try {
        parsed = JSON.parse(coursesParam);
      } catch {
        return json({ error: 'courses must be a JSON array of descriptors' }, 400);
      }
      if (!Array.isArray(parsed)) {
        return json({ error: 'courses must be a JSON array of descriptors' }, 400);
      }
      courses = parsed.slice(0, 15).map(sanitizeCourseDescriptor).filter(Boolean);
      if (courses.length === 0) {
        return json({ error: 'no valid course descriptors', hint: 'each needs api + platform ids; see README' }, 400);
      }
    } else {
      if (!region) return json({ error: 'region or courses required' }, 400);
      courses = COURSES.filter(c => c.region === region);
    }

    const items = await Promise.all(
      courses.map(course => searchCourse(course, { date, earliest, latest, players, holes })),
    );

    return json({
      region: region ?? null,
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
