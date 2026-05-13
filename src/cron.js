import { fetchTeeItUp, filterTeeItUp } from './teeitup.js';
import { fetchForeUp, filterForeUp } from './foreup.js';
import { fetchGolfNow, filterGolfNow } from './golfnow.js';
import { sendTelegram } from './telegram.js';

export async function runCron(env) {
  console.log(`Cron running — ${new Date().toISOString()}`);

  // Load all active subscriptions
  const keys = await env.KV.list({ prefix: 'sub:' });
  console.log(`Found ${keys.keys.length} subscription key(s) in KV`);
  if (!keys.keys.length) return;

  const subs = (await Promise.all(
    keys.keys.map(k => env.KV.get(k.name, 'json'))
  )).filter(s => s?.active);
  console.log(`Active subscriptions: ${subs.length}`);

  // Group by course+date so we only hit each API once per unique pair
  const groups = {};
  for (const sub of subs) {
    const key = `${sub.courseKey}::${sub.date}`;
    if (!groups[key]) groups[key] = { course: sub, subs: [] };
    groups[key].subs.push(sub);
  }

  for (const { course, subs: groupSubs } of Object.values(groups)) {
    try {
      let allSlots = [];

      if (course.api === 'teeitup') {
        allSlots = await fetchTeeItUp(course.courseKey, course.date);
      } else if (course.api === 'foreup') {
        const minP = Math.min(...groupSubs.map(s => s.minPlayers));
        allSlots = await fetchForeUp(course.facilityId, course.scheduleId, course.date, minP);
      } else if (course.api === 'golfnow') {
        const minP = Math.min(...groupSubs.map(s => s.minPlayers));
        const holes = groupSubs[0].holes;
        allSlots = await fetchGolfNow(course.facilityId, course.date, minP, holes);
      }

      console.log(`${course.courseKey ?? course.facilityId} on ${course.date}: ${allSlots.length} raw slot(s) from API`);

      for (const sub of groupSubs) {
        const matches = course.api === 'teeitup'
          ? filterTeeItUp(allSlots, sub)
          : course.api === 'foreup'
          ? filterForeUp(allSlots, sub)
          : filterGolfNow(allSlots, sub);

        console.log(`Sub ${sub.id} (${sub.earliestTime}–${sub.latestTime}, ${sub.minPlayers}p, ${sub.holes}h): ${matches.length} match(es)`);

        // Filter to only slots not yet notified
        const newSlots = [];
        for (const slot of matches) {
          const dedupeKey = `notified:${sub.id}:${course.date}:${slot.time}`;
          const already = await env.KV.get(dedupeKey);
          if (already) {
            console.log(`Skipping ${slot.time} — already notified`);
          } else {
            newSlots.push(slot);
          }
        }

        if (!newSlots.length) continue;

        // Mark all new slots as notified
        await Promise.all(newSlots.map(slot =>
          env.KV.put(`notified:${sub.id}:${course.date}:${slot.time}`, '1', { expirationTtl: 90000 })
        ));

        const bookUrl = course.api === 'foreup'
          ? `https://foreupsoftware.com/index.php/booking/${course.facilityId}/${course.scheduleId}`
          : course.api === 'golfnow'
          ? `https://www.golfnow.com/tee-times/facility/${course.facilityId}/search`
          : `https://${course.courseKey}.book.teeitup.com`;

        const lines = newSlots.map(slot => {
          const priceStr = slot.greenFee ? ` — $${slot.greenFee}/pp` : '';
          return `• ${slot.time} — ${slot.availableSpots} spot(s)${priceStr}`;
        }).join('\n');

        await sendTelegram(
          env.TELEGRAM_BOT_TOKEN,
          sub.telegramChatId,
          `⛳ *Tee Times Available — ${sub.courseName}*\n` +
          `${sub.date}\n\n` +
          `${lines}\n\n` +
          `[Book now](${bookUrl})`
        );
      }

      // Polite delay between course API calls
      await new Promise(r => setTimeout(r, 500));
    } catch (err) {
      console.error(`Error checking ${course.courseKey ?? course.facilityId} on ${course.date}:`, err.message);
    }
  }
}
