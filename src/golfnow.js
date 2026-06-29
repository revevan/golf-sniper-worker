// Convert YYYY-MM-DD → "May 14 2026" (GolfNow date format)
// Uses UTC to ensure consistent date interpretation across timezones
function toGolfNowDate(date) {
  const [y, m, d] = date.split('-');
  const dateObj = new Date(date + 'T12:00:00Z');
  const month = dateObj.toLocaleString('en-US', { month: 'long', timeZone: 'UTC' });
  const day = dateObj.toLocaleString('en-US', { day: 'numeric', timeZone: 'UTC' });
  return `${month} ${day} ${y}`;
}

// Extract the local wall-clock date and time from a GolfNow tee-time string.
//
// GolfNow returns each tee time as e.g. "2026-07-06T06:20:00+00:00", but the
// "+00:00" offset is bogus — the clock portion (06:20) is the course's LOCAL
// tee time, which is also what GolfNow's own UI displays (slot.time.formatted).
// We must NOT parse this as a real UTC instant: doing so shifts every time by
// the timezone offset (e.g. a real 1:00 PM slot gets reported as 6:00 AM and a
// 6:20 AM slot rolls back to 11:20 PM the previous day), which surfaces tee
// times that don't actually exist at the requested hour. So read the literal
// wall-clock fields straight from the string instead.
function parseLocalDateTime(str) {
  const m = String(str).match(/^(\d{4}-\d{2}-\d{2})T(\d{2}:\d{2})/);
  return m ? { date: m[1], time: m[2] } : null;
}

export async function fetchGolfNow(facilityId, date, minPlayers, holes) {
  const today = new Date().toISOString().split('T')[0] + 'T00:00:00.000Z';

  // Holes encoding: 1=9-hole, 2=18-hole, 3=any
  const holesParam = holes === 9 ? 1 : holes === 18 ? 2 : 3;

  const body = {
    Radius: 25,
    Latitude: 34.05,
    Longitude: -118.25,
    PageSize: 50,
    PageNumber: 0,
    SearchType: 1,
    SortBy: 'Date',
    SortDirection: 0,
    Date: toGolfNowDate(date),
    BestDealsOnly: false,
    PriceMin: 0,
    PriceMax: 10000,
    Players: minPlayers,
    Holes: holesParam,
    RateType: 'all',
    TimeMin: 10,
    TimeMax: 42,
    FacilityId: facilityId,
    SortByRollup: 'Date.MinDate',
    View: 'Grouping',
    ExcludeFeaturedFacilities: true,
    TeeTimeCount: 50,
    CurrentClientDate: today,
  };

  const res = await fetch('https://www.golfnow.com/api/tee-times/tee-time-results', {
    method: 'POST',
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/85.0.4183.83 Safari/537.36',
      'Accept': 'application/json, text/javascript, */*; q=0.01',
      'Content-Type': 'application/json; charset=utf-8',
      'X-Requested-With': 'XMLHttpRequest',
      'Referer': `https://www.golfnow.com/tee-times/facility/${facilityId}/search`,
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) return [];
  const data = await res.json();
  return (data.ttResults?.teeTimes ?? [])
    .map(slot => {
      const local = parseLocalDateTime(slot.time?.date);
      if (!local) return null;
      return {
        date: local.date,
        time: local.time,
        availableSpots: minPlayers, // server already filtered by minPlayers
        greenFee: slot.minTeeTimeRate?.value ?? 0,
        detailUrl: slot.detailUrl,
      };
    })
    // GolfNow sometimes pads results with adjacent-day "next available" slots —
    // keep only tee times that actually fall on the requested date.
    .filter(slot => slot && slot.date === date);
}

export function filterGolfNow(slots, { earliestTime, latestTime }) {
  return slots.filter(s => s.time >= earliestTime && s.time <= latestTime);
}
