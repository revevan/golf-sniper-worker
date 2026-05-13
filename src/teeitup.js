const KENNA_BASE = 'https://phx-api-be-east-1b.kenna.io';

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
  // Intl can return '24:xx' for midnight — normalize to '00:xx'
  return `${h === '24' ? '00' : h}:${m}`;
}

export async function fetchTeeItUp(alias, date) {
  const url = `${KENNA_BASE}/v2/tee-times?date=${date}`;
  const origin = `https://${alias}.book.teeitup.com`;
  const res = await fetch(url, {
    headers: {
      'Origin': origin,
      'x-be-alias': alias,
    },
  });
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    console.error(`TeeItUp fetch failed for ${alias}: HTTP ${res.status} — ${body.slice(0, 200)}`);
    return [];
  }
  const data = await res.json();
  return (data[0]?.teetimes ?? []).map(slot => ({
    time: toPacificHHMM(slot.teetime),
    availableSpots: slot.maxPlayers - slot.bookedPlayers,
    holes: slot.rates?.[0]?.holes ?? 18,
    greenFee: Math.round((slot.rates?.[0]?.greenFeeCart ?? 0) / 100),
  }));
}

export function filterTeeItUp(slots, { earliestTime, latestTime, minPlayers, holes }) {
  return slots.filter(s =>
    s.time >= earliestTime &&
    s.time <= latestTime &&
    s.availableSpots >= minPlayers &&
    s.holes === holes
  );
}
