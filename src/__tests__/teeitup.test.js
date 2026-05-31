import { describe, it, expect, vi, beforeEach } from 'vitest';
import { fetchTeeItUp, filterTeeItUp, bookTeeItUp } from '../teeitup.js';

// ---------------------------------------------------------------------------
// filterTeeItUp
// ---------------------------------------------------------------------------
describe('filterTeeItUp', () => {
  const base = { earliestTime: '07:00', latestTime: '10:00', minPlayers: 2, holes: 18 };

  const slot = (time, spots, holes = 18) => ({ time, availableSpots: spots, holes, greenFee: 40 });

  it('includes a slot that matches all criteria', () => {
    expect(filterTeeItUp([slot('08:00', 2)], base)).toHaveLength(1);
  });

  it('excludes a slot before the earliest time', () => {
    expect(filterTeeItUp([slot('06:50', 4)], base)).toHaveLength(0);
  });

  it('excludes a slot after the latest time', () => {
    expect(filterTeeItUp([slot('10:10', 4)], base)).toHaveLength(0);
  });

  it('includes a slot exactly on the boundary times', () => {
    expect(filterTeeItUp([slot('07:00', 2), slot('10:00', 2)], base)).toHaveLength(2);
  });

  it('excludes a slot with fewer available spots than minPlayers', () => {
    expect(filterTeeItUp([slot('08:00', 1)], base)).toHaveLength(0);
  });

  it('includes a slot with more available spots than minPlayers', () => {
    expect(filterTeeItUp([slot('08:00', 4)], base)).toHaveLength(1);
  });

  it('excludes a slot with wrong number of holes', () => {
    expect(filterTeeItUp([slot('08:00', 4, 9)], base)).toHaveLength(0);
  });

  it('filters correctly across a mixed list', () => {
    const slots = [
      slot('06:00', 4),       // too early
      slot('08:00', 2),       // ✓
      slot('09:30', 1),       // too few players
      slot('09:30', 3, 9),    // wrong holes
      slot('10:00', 4),       // ✓ on boundary
      slot('10:01', 4),       // too late
    ];
    expect(filterTeeItUp(slots, base)).toHaveLength(2);
  });

  it('returns empty array when given no slots', () => {
    expect(filterTeeItUp([], base)).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// fetchTeeItUp — mocked fetch
// ---------------------------------------------------------------------------
describe('fetchTeeItUp', () => {
  beforeEach(() => { vi.restoreAllMocks(); });

  function mockFetch(status, body) {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: status >= 200 && status < 300,
      status,
      json: () => Promise.resolve(body),
      text: () => Promise.resolve(JSON.stringify(body)),
    }));
  }

  // A slot at 2025-11-15T15:00:00Z → 07:00 PST (UTC-8)
  const WINTER_UTC = '2025-11-15T15:00:00Z';
  // A slot at 2025-06-15T14:00:00Z → 07:00 PDT (UTC-7)
  const SUMMER_UTC = '2025-06-15T14:00:00Z';

  const kennaResponse = (teetime, extraProps = {}) => ([{
    teetimes: [{
      teetime,
      maxPlayers: 4,
      bookedPlayers: 1,
      rates: [{ holes: 18, greenFeeCart: 5000 }],
      ...extraProps,
    }],
  }]);

  it('converts a winter UTC tee time to Pacific Standard Time', async () => {
    mockFetch(200, kennaResponse(WINTER_UTC));
    const slots = await fetchTeeItUp('el-dorado', '2025-11-15');
    expect(slots[0].time).toBe('07:00');
  });

  it('converts a summer UTC tee time to Pacific Daylight Time', async () => {
    mockFetch(200, kennaResponse(SUMMER_UTC));
    const slots = await fetchTeeItUp('el-dorado', '2025-06-15');
    expect(slots[0].time).toBe('07:00');
  });

  it('calculates availableSpots as maxPlayers minus bookedPlayers', async () => {
    mockFetch(200, kennaResponse(WINTER_UTC));
    const slots = await fetchTeeItUp('el-dorado', '2025-11-15');
    expect(slots[0].availableSpots).toBe(3); // 4 - 1
  });

  it('converts greenFeeCart from cents to dollars', async () => {
    mockFetch(200, kennaResponse(WINTER_UTC));
    const slots = await fetchTeeItUp('el-dorado', '2025-11-15');
    expect(slots[0].greenFee).toBe(50); // 5000 cents → $50
  });

  it('reads holes from rates array', async () => {
    mockFetch(200, kennaResponse(WINTER_UTC));
    const slots = await fetchTeeItUp('el-dorado', '2025-11-15');
    expect(slots[0].holes).toBe(18);
  });

  it('returns empty array on HTTP error', async () => {
    mockFetch(500, {});
    const slots = await fetchTeeItUp('el-dorado', '2025-11-15');
    expect(slots).toEqual([]);
  });

  it('filters by teeItUpCourseId when provided', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: () => Promise.resolve([
        { courseId: 'A', teetimes: [{ teetime: WINTER_UTC, maxPlayers: 4, bookedPlayers: 0, rates: [{ holes: 18, greenFeeCart: 0 }] }] },
        { courseId: 'B', teetimes: [{ teetime: WINTER_UTC, maxPlayers: 4, bookedPlayers: 0, rates: [{ holes: 18, greenFeeCart: 0 }] }] },
      ]),
    }));
    const slots = await fetchTeeItUp('portal', '2025-11-15', 'A');
    expect(slots).toHaveLength(1);
  });

  it('handles missing rates gracefully (defaults holes to 18, greenFee to 0)', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: () => Promise.resolve([{
        teetimes: [{ teetime: WINTER_UTC, maxPlayers: 4, bookedPlayers: 0, rates: [] }],
      }]),
    }));
    const slots = await fetchTeeItUp('el-dorado', '2025-11-15');
    expect(slots[0].holes).toBe(18);
    expect(slots[0].greenFee).toBe(0);
  });

  it('includes teeTimeId in returned slot objects (from slot.id)', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: () => Promise.resolve([{
        teetimes: [{ id: 'abc-123', teetime: WINTER_UTC, maxPlayers: 4, bookedPlayers: 0, rates: [{ holes: 18, greenFeeCart: 0 }] }],
      }]),
    }));
    const slots = await fetchTeeItUp('el-dorado', '2025-11-15');
    expect(slots[0].teeTimeId).toBe('abc-123');
  });

  it('teeTimeId is null when no ID field is present in the API response', async () => {
    mockFetch(200, kennaResponse(WINTER_UTC));
    const slots = await fetchTeeItUp('el-dorado', '2025-11-15');
    expect(slots[0].teeTimeId).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// bookTeeItUp
// ---------------------------------------------------------------------------
describe('bookTeeItUp', () => {
  beforeEach(() => { vi.restoreAllMocks(); });

  const params = {
    alias: 'el-dorado-park-golf-course',
    origin: 'https://el-dorado-park-golf-course.book.teeitup.com',
    username: 'user@example.com',
    password: 'password123',
    slot: { teeTimeId: 'slot-42', time: '08:00' },
    players: 2,
    holes: 18,
  };

  function mockSequentialFetch(...responses) {
    let call = 0;
    vi.stubGlobal('fetch', vi.fn().mockImplementation(() => {
      const r = responses[call++] ?? responses[responses.length - 1];
      return Promise.resolve({
        ok: r.status >= 200 && r.status < 300,
        status: r.status,
        json: () => Promise.resolve(r.body),
        text: () => Promise.resolve(JSON.stringify(r.body)),
      });
    }));
  }

  it('returns success with bookingId on a full auth → reserve → confirm flow', async () => {
    mockSequentialFetch(
      { status: 200, body: { token: 'jwt-token' } },
      { status: 200, body: { id: 'res-99' } },
      { status: 200, body: { id: 'book-77' } },
    );
    const result = await bookTeeItUp(params);
    expect(result.success).toBe(true);
    expect(result.bookingId).toBe('book-77');
  });

  it('returns failure when auth returns 401', async () => {
    mockSequentialFetch({ status: 401, body: { error: 'Invalid credentials' } });
    const result = await bookTeeItUp(params);
    expect(result.success).toBe(false);
    expect(result.error).toContain('Auth failed');
  });

  it('returns failure when auth response has no token', async () => {
    mockSequentialFetch({ status: 200, body: { user: 'someone' } });
    const result = await bookTeeItUp(params);
    expect(result.success).toBe(false);
    expect(result.error).toContain('missing token');
  });

  it('returns failure when reserve returns 409 (already taken)', async () => {
    mockSequentialFetch(
      { status: 200, body: { token: 'jwt-token' } },
      { status: 409, body: { error: 'Tee time already booked' } },
    );
    const result = await bookTeeItUp(params);
    expect(result.success).toBe(false);
    expect(result.error).toContain('Reserve failed');
  });

  it('returns failure when reserve response is missing reservation ID', async () => {
    mockSequentialFetch(
      { status: 200, body: { token: 'jwt-token' } },
      { status: 200, body: { status: 'ok' } }, // no id field
    );
    const result = await bookTeeItUp(params);
    expect(result.success).toBe(false);
    expect(result.error).toContain('missing reservation ID');
  });

  it('returns failure when confirm returns an error', async () => {
    mockSequentialFetch(
      { status: 200, body: { token: 'jwt-token' } },
      { status: 200, body: { id: 'res-99' } },
      { status: 500, body: { error: 'Server error' } },
    );
    const result = await bookTeeItUp(params);
    expect(result.success).toBe(false);
    expect(result.error).toContain('Confirm failed');
  });

  it('returns failure immediately when slot has no teeTimeId', async () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal('fetch', fetchSpy);
    const result = await bookTeeItUp({ ...params, slot: { teeTimeId: null, time: '08:00' } });
    expect(result.success).toBe(false);
    expect(result.error).toContain('missing teeTimeId');
    // Should not have made any network calls for a slot without an ID
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('falls back to reservationId when confirm response has no id', async () => {
    mockSequentialFetch(
      { status: 200, body: { token: 'jwt-token' } },
      { status: 200, body: { id: 'res-99' } },
      { status: 200, body: {} }, // no id in confirm response
    );
    const result = await bookTeeItUp(params);
    expect(result.success).toBe(true);
    expect(result.bookingId).toBe('res-99');
  });
});
