// Convert YYYY-MM-DD → "May 14 2026" (GolfNow date format)
// Uses UTC to ensure consistent date interpretation across timezones
function toGolfNowDate(date) {
  const [y, m, d] = date.split('-');
  const dateObj = new Date(date + 'T12:00:00Z');
  const month = dateObj.toLocaleString('en-US', { month: 'long', timeZone: 'UTC' });
  const day = dateObj.toLocaleString('en-US', { day: 'numeric', timeZone: 'UTC' });
  return `${month} ${day} ${y}`;
}

// Convert UTC ISO string to Pacific HH:MM
function toPacificHHMM(utcStr) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/Los_Angeles',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).formatToParts(new Date(utcStr));
  const h = parts.find(p => p.type === 'hour').value.padStart(2, '0');
  const m = parts.find(p => p.type === 'minute').value.padStart(2, '0');
  return `${h === '24' ? '00' : h}:${m}`;
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
  return (data.ttResults?.teeTimes ?? []).map(slot => ({
    time: toPacificHHMM(slot.time.date),
    availableSpots: minPlayers, // server already filtered by minPlayers
    greenFee: slot.minTeeTimeRate?.value ?? 0,
    detailUrl: slot.detailUrl,
  }));
}

export function filterGolfNow(slots, { earliestTime, latestTime }) {
  return slots.filter(s => s.time >= earliestTime && s.time <= latestTime);
}
