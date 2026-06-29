import { describe, it, expect, vi, beforeEach } from 'vitest';
import { fetchGolfNow, filterGolfNow } from '../golfnow.js';

// ---------------------------------------------------------------------------
// filterGolfNow
// ---------------------------------------------------------------------------
describe('filterGolfNow', () => {
  // GolfNow pre-filters by players and holes server-side, so the local
  // filter only checks the time window.
  const base = { earliestTime: '07:00', latestTime: '10:00' };

  const slot = (time) => ({ time, availableSpots: 4, greenFee: 45 });

  it('includes a slot within the time window', () => {
    expect(filterGolfNow([slot('08:00')], base)).toHaveLength(1);
  });

  it('excludes a slot before the earliest time', () => {
    expect(filterGolfNow([slot('06:59')], base)).toHaveLength(0);
  });

  it('excludes a slot after the latest time', () => {
    expect(filterGolfNow([slot('10:01')], base)).toHaveLength(0);
  });

  it('includes slots exactly on the boundary times', () => {
    expect(filterGolfNow([slot('07:00'), slot('10:00')], base)).toHaveLength(2);
  });

  it('returns empty array when given no slots', () => {
    expect(filterGolfNow([], base)).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// fetchGolfNow — mocked fetch
// ---------------------------------------------------------------------------
describe('fetchGolfNow', () => {
  beforeEach(() => { vi.restoreAllMocks(); });

  function mockFetch(status, body) {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: status >= 200 && status < 300,
      status,
      json: () => Promise.resolve(body),
    }));
  }

  // GolfNow returns the course's LOCAL wall-clock tee time but tags it with a
  // bogus "+00:00" offset. The clock portion is the real local time and must be
  // read literally — NOT converted as a UTC instant.
  const WINTER_LOCAL = '2025-11-15T07:00:00+00:00';
  const SUMMER_LOCAL = '2025-06-15T07:00:00+00:00';

  const golfNowResponse = (dateStr, overrides = {}) => ({
    ttResults: {
      teeTimes: [{
        time: { date: dateStr },
        minTeeTimeRate: { value: 45 },
        detailUrl: '/tee-times/details/999',
        ...overrides,
      }],
    },
  });

  it('reads the local wall-clock time without timezone conversion (winter)', async () => {
    mockFetch(200, golfNowResponse(WINTER_LOCAL));
    const slots = await fetchGolfNow('12345', '2025-11-15', 2, 18);
    expect(slots[0].time).toBe('07:00');
  });

  it('reads the local wall-clock time without timezone conversion (summer)', async () => {
    mockFetch(200, golfNowResponse(SUMMER_LOCAL));
    const slots = await fetchGolfNow('12345', '2025-06-15', 2, 18);
    expect(slots[0].time).toBe('07:00');
  });

  it('does NOT shift an early-morning tee time onto the previous day (regression)', async () => {
    // Real GolfNow payload: 6:20 AM local tagged as +00:00. The old code parsed
    // this as 06:20 UTC and reported "23:20" on the previous date.
    mockFetch(200, golfNowResponse('2026-07-06T06:20:00+00:00'));
    const slots = await fetchGolfNow('12345', '2026-07-06', 2, 18);
    expect(slots).toHaveLength(1);
    expect(slots[0].time).toBe('06:20');
    expect(slots[0].date).toBe('2026-07-06');
  });

  it('drops slots that fall on a different date than requested', async () => {
    mockFetch(200, {
      ttResults: {
        teeTimes: [
          { time: { date: '2026-07-06T06:20:00+00:00' }, minTeeTimeRate: { value: 45 }, detailUrl: '/a' },
          { time: { date: '2026-07-07T06:20:00+00:00' }, minTeeTimeRate: { value: 45 }, detailUrl: '/b' },
        ],
      },
    });
    const slots = await fetchGolfNow('12345', '2026-07-06', 2, 18);
    expect(slots).toHaveLength(1);
    expect(slots[0].date).toBe('2026-07-06');
  });

  it('reads greenFee from minTeeTimeRate.value', async () => {
    mockFetch(200, golfNowResponse(WINTER_LOCAL));
    const slots = await fetchGolfNow('12345', '2025-11-15', 2, 18);
    expect(slots[0].greenFee).toBe(45);
  });

  it('sets availableSpots equal to the requested minPlayers (server pre-filtered)', async () => {
    mockFetch(200, golfNowResponse(WINTER_LOCAL));
    const slots = await fetchGolfNow('12345', '2025-11-15', 3, 18);
    expect(slots[0].availableSpots).toBe(3);
  });

  it('sends holes=1 for 9-hole requests', async () => {
    mockFetch(200, { ttResults: { teeTimes: [] } });
    await fetchGolfNow('12345', '2025-11-15', 2, 9);
    const body = JSON.parse(vi.mocked(fetch).mock.calls[0][1].body);
    expect(body.Holes).toBe(1);
  });

  it('sends holes=2 for 18-hole requests', async () => {
    mockFetch(200, { ttResults: { teeTimes: [] } });
    await fetchGolfNow('12345', '2025-11-15', 2, 18);
    const body = JSON.parse(vi.mocked(fetch).mock.calls[0][1].body);
    expect(body.Holes).toBe(2);
  });

  it('returns empty array on HTTP error', async () => {
    mockFetch(500, {});
    const slots = await fetchGolfNow('12345', '2025-11-15', 2, 18);
    expect(slots).toEqual([]);
  });

  it('returns empty array when ttResults is missing', async () => {
    mockFetch(200, {});
    const slots = await fetchGolfNow('12345', '2025-11-15', 2, 18);
    expect(slots).toEqual([]);
  });

  it('handles missing minTeeTimeRate gracefully (defaults greenFee to 0)', async () => {
    mockFetch(200, {
      ttResults: {
        teeTimes: [{ time: { date: WINTER_LOCAL }, detailUrl: '/x' }],
      },
    });
    const slots = await fetchGolfNow('12345', '2025-11-15', 2, 18);
    expect(slots[0].greenFee).toBe(0);
  });
});
