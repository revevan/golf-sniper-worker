function toOttoGolfDate(date) {
  const [y, m, d] = date.split('-');
  return `${parseInt(m)}/${parseInt(d)}/${y}`;
}

function parseTime(h, m, period) {
  h = parseInt(h);
  m = parseInt(m);
  if (period === 'PM' && h !== 12) h += 12;
  if (period === 'AM' && h === 12) h = 0;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

function parseMaxPlayers(str) {
  const parts = str.trim().split('-');
  return parseInt(parts[parts.length - 1]) || 0;
}

function parseOttoGolfHtml(html) {
  const slots = [];
  const seen = new Set();

  // Each tee time is wrapped in a div with class containing "tee-time-row"
  const rows = html.split(/class="tee-time-row/);

  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];

    const timeMatch = row.match(/class="tee-time">(\d+):(\d+)<span>(AM|PM)<\/span>/i);
    if (!timeMatch) continue;
    const time = parseTime(timeMatch[1], timeMatch[2], timeMatch[3].toUpperCase());

    // Deduplicate — multiple rate tiers can share the same time; keep first (Public)
    if (seen.has(time)) continue;
    seen.add(time);

    const playersMatch = row.match(/class="players-no">([\d\-]+)</);
    const availableSpots = playersMatch ? parseMaxPlayers(playersMatch[1]) : 4;

    const priceMatch = row.match(/class="price">\$?([\d.]+)</);
    const greenFee = priceMatch ? parseFloat(priceMatch[1]) : 0;

    slots.push({ time, availableSpots, greenFee, holes: 18 });
  }

  return slots;
}

export async function fetchOttoGolf(subdomain, bookingId, date) {
  const baseUrl = `https://${subdomain}.ottogolf.com/booking/${bookingId}/index.asp`;

  // GET first to obtain session cookie
  const initRes = await fetch(baseUrl, {
    headers: { 'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36' },
  });
  const setCookie = initRes.headers.get('set-cookie') ?? '';
  const cookie = setCookie.match(/ASPSESSIONID\w+=\w+/)?.[0] ?? '';

  // POST with date to get tee times
  const res = await fetch(baseUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
      'Referer': baseUrl,
      ...(cookie ? { 'Cookie': cookie } : {}),
    },
    body: `da=${encodeURIComponent(toOttoGolfDate(date))}`,
  });

  if (!res.ok) return [];
  const html = await res.text();
  return parseOttoGolfHtml(html);
}

export function filterOttoGolf(slots, { earliestTime, latestTime, minPlayers }) {
  return slots.filter(s =>
    s.time >= earliestTime &&
    s.time <= latestTime &&
    s.availableSpots >= minPlayers
  );
}
