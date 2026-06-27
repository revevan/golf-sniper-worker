import { COURSES } from './courses.js';
import { fetchTeeItUp, filterTeeItUp } from './teeitup.js';
import { fetchForeUp, filterForeUp } from './foreup.js';
import { fetchGolfNow, filterGolfNow } from './golfnow.js';
import { fetchOttoGolf, filterOttoGolf } from './ottogolf.js';
import { sendTelegram } from './telegram.js';
import { incrementStat } from './stats.js';
import { logSlotSnapshot } from './analytics.js';

export async function runCron(env) {
  console.log(`Cron running — ${new Date().toISOString()}`);
  const statDeltas = {};
  const summary = { subsChecked: 0, alertsSent: 0, errors: 0 };

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
      // Look up course metadata for portal-specific overrides (teeItUpAlias, teeItUpCourseId, teeItUpOrigin)
      const courseMeta = COURSES.find(c => (c.alias ?? String(c.facilityId)) === course.courseKey) ?? {};

      let allSlots = [];

      if (course.api === 'teeitup') {
        const alias = courseMeta.teeItUpAlias ?? course.courseKey;
        allSlots = await fetchTeeItUp(alias, course.date, courseMeta.teeItUpCourseId ?? null, courseMeta.teeItUpOrigin ?? null);
      } else if (course.api === 'foreup') {
        const minP = Math.min(...groupSubs.map(s => s.minPlayers));
        const uniqueHoles = [...new Set(groupSubs.map(s => s.holes))];
        const slotArrays = await Promise.all(uniqueHoles.map(h => fetchForeUp(course.facilityId, course.scheduleId, course.date, minP, h)));
        allSlots = slotArrays.flat();
      } else if (course.api === 'golfnow') {
        const minP = Math.min(...groupSubs.map(s => s.minPlayers));
        const holes = groupSubs[0].holes;
        allSlots = await fetchGolfNow(course.facilityId, course.date, minP, holes);
      } else if (course.api === 'ottogolf') {
        allSlots = await fetchOttoGolf(course.facilityId, course.scheduleId, course.date);
      }

      console.log(`${course.courseKey ?? course.facilityId} on ${course.date}: ${allSlots.length} raw slot(s) from API`);

      // Log slot snapshot to history for pattern analysis
      await logSlotSnapshot(env.HISTORY, course.courseKey ?? course.facilityId, course.date, allSlots);

      for (const sub of groupSubs) {
        summary.subsChecked++;
        const matches = course.api === 'teeitup'
          ? filterTeeItUp(allSlots, sub)
          : course.api === 'foreup'
          ? filterForeUp(allSlots, sub)
          : course.api === 'ottogolf'
          ? filterOttoGolf(allSlots, sub)
          : filterGolfNow(allSlots, sub);

        console.log(`Sub ${sub.id} (${sub.earliestTime}–${sub.latestTime}, ${sub.minPlayers}p, ${sub.holes}h): ${matches.length} match(es)`);

        // Filter to only slots not yet notified (parallel KV reads)
        const dedupeKeys = matches.map(slot => `notified:${sub.id}:${course.date}:${slot.time}`);
        const alreadyFlags = await Promise.all(dedupeKeys.map(k => env.KV.get(k)));
        const newSlots = matches.filter((_, i) => {
          if (alreadyFlags[i]) { console.log(`Skipping ${matches[i].time} — already notified`); return false; }
          return true;
        });

        if (!newSlots.length) continue;

        const bookUrl = course.api === 'foreup'
          ? `https://foreupsoftware.com/index.php/booking/${course.facilityId}/${course.scheduleId}`
          : course.api === 'golfnow'
          ? `https://www.golfnow.com/tee-times/facility/${course.facilityId}/search`
          : course.api === 'ottogolf'
          ? `https://${course.facilityId}.ottogolf.com/booking/${course.scheduleId}/index.asp`
          : (courseMeta.teeItUpOrigin ?? `https://${course.courseKey}.book.teeitup.com`);

        const lines = newSlots.map(slot => {
          const priceStr = slot.greenFee ? ` — $${slot.greenFee}/pp` : '';
          return `• ${slot.time} — ${slot.availableSpots} spot(s)${priceStr}`;
        }).join('\n');

        // Send first — only mark as notified after a successful send
        await sendTelegram(
          env.TELEGRAM_BOT_TOKEN,
          sub.telegramChatId,
          `⛳ *Tee Times Available — ${sub.courseName}*\n` +
          `${sub.date}\n\n` +
          `${lines}\n\n` +
          `[Book now](${bookUrl})`
        );
        console.log(`Alert sent — sub ${sub.id} (${sub.courseName} ${course.date}): ${newSlots.map(s => s.time).join(', ')}`);

        // Mark slots as notified only after Telegram succeeds
        await Promise.all(newSlots.map(slot =>
          env.KV.put(`notified:${sub.id}:${course.date}:${slot.time}`, '1', { expirationTtl: 90000 })
        ));

        summary.alertsSent++;
        statDeltas['stats:total_slot_matches'] = (statDeltas['stats:total_slot_matches'] ?? 0) + newSlots.length;
        statDeltas['stats:total_alerts_sent'] = (statDeltas['stats:total_alerts_sent'] ?? 0) + 1;
      }

      // Polite delay between course API calls
      await new Promise(r => setTimeout(r, 500));
    } catch (err) {
      summary.errors++;
      console.error(`Error checking ${course.courseKey ?? course.facilityId} on ${course.date}:`, err.message);
    }
  }

  // Flush accumulated stat increments in parallel (one read+write per key)
  await Promise.all(
    Object.entries(statDeltas).map(async ([key, delta]) => {
      await incrementStat(env, key, delta);
    })
  );

  console.log(`Cron complete — checked: ${summary.subsChecked}, alerts sent: ${summary.alertsSent}, errors: ${summary.errors}`);
}
