export async function logSlotSnapshot(historyKV, courseKey, date, slots, timestamp = new Date()) {
  if (slots.length === 0) return;

  const ts = timestamp.toISOString();
  const stateKey = `state:${courseKey}:${date}`;

  // One read to get the last-recorded availableSpots for each slot
  const lastState = (await historyKV.get(stateKey, 'json')) ?? {};

  // History keys expire 90 days after the tee date for long-term analytics
  const historyExpiry = new Date(date + 'T12:00:00Z');
  historyExpiry.setDate(historyExpiry.getDate() + 90);
  const historyTtl = Math.max(60, Math.floor((historyExpiry - Date.now()) / 1000));

  const promises = [];
  const newState = { ...lastState };
  let stateChanged = false;

  for (const slot of slots) {
    if (lastState[slot.time] === slot.availableSpots) continue;

    const key = `history:${courseKey}:${date}:${slot.time}:${ts}`;
    promises.push(historyKV.put(key, JSON.stringify({
      courseKey,
      date,
      time: slot.time,
      availableSpots: slot.availableSpots,
      greenFee: slot.greenFee ?? null,
      timestamp: ts,
    }), { expirationTtl: historyTtl }));

    newState[slot.time] = slot.availableSpots;
    stateChanged = true;
  }

  if (stateChanged) {
    // Expire state 2 days after the tee date
    const expiry = new Date(date + 'T12:00:00Z');
    expiry.setDate(expiry.getDate() + 2);
    const stateTtl = Math.max(60, Math.floor((expiry - Date.now()) / 1000));
    promises.push(historyKV.put(stateKey, JSON.stringify(newState), { expirationTtl: stateTtl }));
  }

  if (promises.length > 0) {
    await Promise.all(promises);
  }
}

export async function listKeysWithPrefix(kv, prefix) {
  const keys = [];
  let cursor;
  do {
    const result = await kv.list({ prefix, cursor });
    keys.push(...result.keys);
    cursor = result.list_complete ? undefined : result.cursor;
  } while (cursor);
  return keys;
}

export async function getSlotTimeline(historyKV, courseKey, date, time) {
  const prefix = `history:${courseKey}:${date}:${time}:`;
  const keys = await listKeysWithPrefix(historyKV, prefix);
  const snapshots = (await Promise.all(
    keys.map(k => historyKV.get(k.name, 'json'))
  )).filter(Boolean);

  return snapshots.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
}

export async function getCourseTimeline(historyKV, courseKey, date) {
  const prefix = `history:${courseKey}:${date}:`;
  const keys = await listKeysWithPrefix(historyKV, prefix);
  const snapshots = (await Promise.all(
    keys.map(k => historyKV.get(k.name, 'json'))
  )).filter(Boolean);

  // Group by time and sort chronologically
  const byTime = {};
  for (const snap of snapshots) {
    if (!byTime[snap.time]) byTime[snap.time] = [];
    byTime[snap.time].push(snap);
  }

  for (const time in byTime) {
    byTime[time].sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
  }

  return byTime;
}

export async function getBookOutTimeline(historyKV, courseKey, date) {
  const timeline = await getCourseTimeline(historyKV, courseKey, date);
  const bookOuts = {};

  for (const [time, snapshots] of Object.entries(timeline)) {
    // Find when this slot went from available (>0) to booked (0)
    let availableAt = null;
    let bookedAt = null;

    for (const snap of snapshots) {
      if (snap.availableSpots > 0 && !availableAt) {
        availableAt = snap.timestamp;
      }
      if (snap.availableSpots === 0 && availableAt && !bookedAt) {
        bookedAt = snap.timestamp;
        break;
      }
    }

    if (bookedAt) {
      bookOuts[time] = {
        time,
        availableAt,
        bookedAt,
        minutesToBookOut: (new Date(bookedAt) - new Date(availableAt)) / (1000 * 60),
      };
    }
  }

  return bookOuts;
}

export async function getCoursePatterns(historyKV, courseKey) {
  const prefix = `history:${courseKey}:`;
  const keys = await listKeysWithPrefix(historyKV, prefix);
  const snapshots = (await Promise.all(
    keys.map(k => historyKV.get(k.name, 'json'))
  )).filter(Boolean);

  // Group by date
  const byDate = {};
  for (const snap of snapshots) {
    if (!byDate[snap.date]) byDate[snap.date] = [];
    byDate[snap.date].push(snap);
  }

  // Compute pattern stats
  const patterns = {
    courseKey,
    totalDatesTracked: Object.keys(byDate).length,
    avgBookOutTime: null,
    bookOutsByDayOfWeek: {},
    timeSlotPopularity: {},
  };

  const allBookOutTimes = [];

  for (const [date, dateSnapshots] of Object.entries(byDate)) {
    const dateObj = new Date(date);
    const dayOfWeek = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][dateObj.getDay()];

    const byTime = {};
    for (const snap of dateSnapshots) {
      if (!byTime[snap.time]) byTime[snap.time] = [];
      byTime[snap.time].push(snap);
    }

    for (const [time, timeSnapshots] of Object.entries(byTime)) {
      timeSnapshots.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));

      let availableAt = null;
      let bookedAt = null;

      for (const snap of timeSnapshots) {
        if (snap.availableSpots > 0 && !availableAt) {
          availableAt = snap.timestamp;
        }
        if (snap.availableSpots === 0 && availableAt && !bookedAt) {
          bookedAt = snap.timestamp;
          break;
        }
      }

      if (bookedAt) {
        const minutesToBookOut = (new Date(bookedAt) - new Date(availableAt)) / (1000 * 60);
        allBookOutTimes.push(minutesToBookOut);

        patterns.bookOutsByDayOfWeek[dayOfWeek] = (patterns.bookOutsByDayOfWeek[dayOfWeek] ?? []);
        patterns.bookOutsByDayOfWeek[dayOfWeek].push(minutesToBookOut);

        patterns.timeSlotPopularity[time] = (patterns.timeSlotPopularity[time] ?? []);
        patterns.timeSlotPopularity[time].push(minutesToBookOut);
      }
    }
  }

  // Compute averages
  if (allBookOutTimes.length > 0) {
    patterns.avgBookOutTime = allBookOutTimes.reduce((a, b) => a + b) / allBookOutTimes.length;
  }

  for (const day in patterns.bookOutsByDayOfWeek) {
    const times = patterns.bookOutsByDayOfWeek[day];
    patterns.bookOutsByDayOfWeek[day] = {
      count: times.length,
      avgMinutes: times.reduce((a, b) => a + b) / times.length,
    };
  }

  for (const time in patterns.timeSlotPopularity) {
    const times = patterns.timeSlotPopularity[time];
    patterns.timeSlotPopularity[time] = {
      count: times.length,
      avgMinutes: times.reduce((a, b) => a + b) / times.length,
    };
  }

  return patterns;
}

export async function getMidnightDumps(historyKV, courseKey, days = 7) {
  const prefix = `history:${courseKey}:`;
  const keys = await listKeysWithPrefix(historyKV, prefix);
  const snapshots = (await Promise.all(
    keys.map(k => historyKV.get(k.name, 'json'))
  )).filter(Boolean);

  const dumpsByTime = {};
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - days);

  for (const snap of snapshots) {
    if (new Date(snap.timestamp) < cutoff) continue;

    const hour = new Date(snap.timestamp).getHours();
    const key = `${hour}:00`;

    if (!dumpsByTime[key]) dumpsByTime[key] = { hour, slots: [], count: 0 };
    dumpsByTime[key].slots.push(snap);
    dumpsByTime[key].count++;
  }

  // Find hours with unusual activity (potential dumps)
  const hourCounts = Object.entries(dumpsByTime).map(([time, data]) => ({
    time,
    hour: data.hour,
    snapshotCount: data.count,
  }));

  return {
    courseKey,
    period: `Last ${days} days`,
    snapshots: hourCounts.sort((a, b) => b.snapshotCount - a.snapshotCount),
  };
}
