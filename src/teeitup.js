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

// alias: x-be-alias to send (may be a portal alias for multi-course sites)
// teeItUpCourseId: if set, filter the multi-course response to this specific course
// teeItUpOrigin: override the Origin header (needed for portal-based courses)
export async function fetchTeeItUp(alias, date, teeItUpCourseId = null, teeItUpOrigin = null) {
  const url = `${KENNA_BASE}/v2/tee-times?date=${date}`;
  const origin = teeItUpOrigin ?? `https://${alias}.book.teeitup.com`;
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
  const entries = teeItUpCourseId
    ? data.filter(e => e.courseId === teeItUpCourseId)
    : data;
  return (entries[0]?.teetimes ?? [])
    .filter(slot => slot.rates?.some(r => r.acceptCreditCard))
    .map(slot => ({
      // TODO: confirm the ID field name from actual Kenna API response (likely slot.id)
      teeTimeId: slot.id ?? slot.teeTimeId ?? null,
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

/**
 * Attempt to book a tee time on TeeItUp/Kenna.io.
 * Endpoint details require verification via browser DevTools on a live book.teeitup.com site.
 *
 * @param {object} params
 * @param {string} params.alias     - x-be-alias for the course
 * @param {string} params.origin    - Origin header value
 * @param {string} params.username  - TeeItUp account email
 * @param {string} params.password  - TeeItUp account password
 * @param {object} params.slot      - Slot object from fetchTeeItUp() (must include teeTimeId)
 * @param {number} params.players   - Number of players to book
 * @param {number} params.holes     - 9 or 18
 * @returns {{ success: boolean, bookingId?: string, error?: string }}
 */
export async function bookTeeItUp({ alias, origin, username, password, slot, players, holes }) {
  if (!slot.teeTimeId) return { success: false, error: 'Slot is missing teeTimeId — cannot book' };

  const headers = {
    'Origin': origin,
    'x-be-alias': alias,
    'Content-Type': 'application/json',
  };

  // Step 1: Authenticate
  // TODO: Verify endpoint URL and request/response shape via DevTools on book.teeitup.com
  const authRes = await fetch(`${KENNA_BASE}/v2/users/login`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ username, password }),
  });
  if (!authRes.ok) {
    const msg = await authRes.text().catch(() => '');
    return { success: false, error: `Auth failed: HTTP ${authRes.status} — ${msg.slice(0, 100)}` };
  }
  const authData = await authRes.json();
  // TODO: Confirm token field name from actual API response
  const token = authData.token ?? authData.access_token ?? authData.jwt;
  if (!token) return { success: false, error: 'Auth response missing token' };

  const authedHeaders = { ...headers, 'Authorization': `Bearer ${token}` };

  // Step 2: Reserve the tee time
  // TODO: Verify endpoint URL and request body shape via DevTools on book.teeitup.com
  const reserveRes = await fetch(`${KENNA_BASE}/v2/tee-times/${slot.teeTimeId}/reserve`, {
    method: 'POST',
    headers: authedHeaders,
    body: JSON.stringify({ players, holes }),
  });
  if (!reserveRes.ok) {
    const msg = await reserveRes.text().catch(() => '');
    return { success: false, error: `Reserve failed: HTTP ${reserveRes.status} — ${msg.slice(0, 100)}` };
  }
  const reserveData = await reserveRes.json();
  // TODO: Confirm reservation ID field name from actual API response
  const reservationId = reserveData.id ?? reserveData.reservationId ?? reserveData.reservation_id;
  if (!reservationId) return { success: false, error: 'Reserve response missing reservation ID' };

  // Step 3: Confirm the reservation
  // TODO: Verify if this step is needed — some municipal courses complete booking in step 2
  const confirmRes = await fetch(`${KENNA_BASE}/v2/reservations/${reservationId}/confirm`, {
    method: 'POST',
    headers: authedHeaders,
    body: JSON.stringify({}),
  });
  if (!confirmRes.ok) {
    const msg = await confirmRes.text().catch(() => '');
    return { success: false, error: `Confirm failed: HTTP ${confirmRes.status} — ${msg.slice(0, 100)}` };
  }
  const confirmData = await confirmRes.json();
  const bookingId = confirmData.id ?? confirmData.bookingId ?? reservationId;

  return { success: true, bookingId: String(bookingId) };
}
