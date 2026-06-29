// Convert YYYY-MM-DD → MM-DD-YYYY for ForeUp API
function toForeUpDate(date) {
  const [y, m, d] = date.split('-');
  return `${m}-${d}-${y}`;
}

function getHHMM(timeStr) {
  return timeStr.includes(' ') ? timeStr.split(' ')[1] : timeStr;
}

export async function fetchForeUp(facilityId, scheduleId, date, players, holes = 18) {
  const url = new URL('https://foreupsoftware.com/index.php/api/booking/times');
  url.searchParams.set('time', 'all');
  url.searchParams.set('date', toForeUpDate(date));
  url.searchParams.set('holes', String(holes));
  url.searchParams.set('players', players);
  url.searchParams.set('schedule_id', scheduleId);
  url.searchParams.append('schedule_ids[]', scheduleId);
  url.searchParams.set('api_key', 'no_limits');
  url.searchParams.set('booking_class_id', facilityId);

  const res = await fetch(url.toString(), {
    headers: {
      'Referer': `https://foreupsoftware.com/index.php/booking/${facilityId}/${scheduleId}`,
      'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
    },
  });
  if (!res.ok) return [];
  const data = await res.json();
  return Array.isArray(data)
    ? data.map(slot => ({
        time: getHHMM(slot.time),
        availableSpots: slot.available_spots,
        holes: slot.holes ?? 18,
        greenFee: (slot.green_fee ?? 0) + (slot.cart_fee ?? 0),
      }))
    : [];
}

export function filterForeUp(slots, { earliestTime, latestTime, minPlayers }) {
  return slots.filter(s =>
    s.time >= earliestTime &&
    s.time <= latestTime &&
    s.availableSpots >= minPlayers
  );
}
