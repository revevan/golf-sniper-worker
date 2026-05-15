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

  // 2025-11-15T15:00:00Z → 07:00 PST (UTC-8)
  const WINTER_UTC = '2025-11-15T15:00:00Z';
  // 2025-06-15T14:00:00Z → 07:00 PDT (UTC-7)
  const SUMMER_UTC = '2025-06-15T14:00:00Z';

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

  it('converts a winter UTC tee time to Pacific Standard Time', async () => {
    mockFetch(200, golfNowResponse(WINTER_UTC));
    const slots = await fetchGolfNow('12345', '2025-11-15', 2, 18);
    expect(slots[0].time).toBe('07:00');
  });

  it('converts a summer UTC tee time to Pacific Daylight Time', async () => {
    mockFetch(200, golfNowResponse(SUMMER_UTC));
    const slots = await fetchGolfNow('12345', '2025-06-15', 2, 18);
    expect(slots[0].time).toBe('07:00');
  });

  it('reads greenFee from minTeeTimeRate.value', async () => {
    mockFetch(200, golfNowResponse(WINTER_UTC));
    const slots = await fetchGolfNow('12345', '2025-11-15', 2, 18);
    expect(slots[0].greenFee).toBe(45);
  });

  it('sets availableSpots equal to the requested minPlayers (server pre-filtered)', async () => {
    mockFetch(200, golfNowResponse(WINTER_UTC));
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
        teeTimes: [{ time: { date: WINTER_UTC }, detailUrl: '/x' }],
      },
    });
    const slots = await fetchGolfNow('12345', '2025-11-15', 2, 18);
    expect(slots[0].greenFee).toBe(0);
  });
});
