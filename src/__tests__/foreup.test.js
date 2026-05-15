import { describe, it, expect, vi, beforeEach } from 'vitest';
import { fetchForeUp, filterForeUp } from '../foreup.js';

// ---------------------------------------------------------------------------
// filterForeUp
// ---------------------------------------------------------------------------
describe('filterForeUp', () => {
  const base = { earliestTime: '07:00', latestTime: '10:00', minPlayers: 2 };

  const slot = (time, spots) => ({ time, availableSpots: spots, holes: 18, greenFee: 40 });

  it('includes a slot that matches all criteria', () => {
    expect(filterForeUp([slot('08:00', 2)], base)).toHaveLength(1);
  });

  it('excludes a slot before the earliest time', () => {
    expect(filterForeUp([slot('06:59', 4)], base)).toHaveLength(0);
  });

  it('excludes a slot after the latest time', () => {
    expect(filterForeUp([slot('10:01', 4)], base)).toHaveLength(0);
  });

  it('includes slots exactly on the boundary times', () => {
    expect(filterForeUp([slot('07:00', 2), slot('10:00', 2)], base)).toHaveLength(2);
  });

  it('excludes a slot with fewer available spots than minPlayers', () => {
    expect(filterForeUp([slot('08:00', 1)], base)).toHaveLength(0);
  });

  it('does not filter by holes (ForeUp pre-filters server-side)', () => {
    // ForeUp doesn't filter by holes — filterForeUp has no holes check
    const sub = { ...base, holes: 9 };
    expect(filterForeUp([slot('08:00', 2)], sub)).toHaveLength(1);
  });

  it('returns empty array when given no slots', () => {
    expect(filterForeUp([], base)).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// fetchForeUp — mocked fetch
// ---------------------------------------------------------------------------
describe('fetchForeUp', () => {
  beforeEach(() => { vi.restoreAllMocks(); });

  function mockFetch(status, body) {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: status >= 200 && status < 300,
      status,
      json: () => Promise.resolve(body),
    }));
  }

  const foreUpSlot = (time, overrides = {}) => ({
    time,
    available_spots: 3,
    holes: 18,
    green_fee: 25,
    cart_fee: 15,
    ...overrides,
  });

  it('parses a slot with the "MM-DD-YYYY HH:MM" time format', async () => {
    mockFetch(200, [foreUpSlot('06-15-2025 08:30')]);
    const slots = await fetchForeUp('123', '456', '2025-06-15', 1);
    expect(slots[0].time).toBe('08:30');
  });

  it('parses a slot with a bare "HH:MM" time format', async () => {
    mockFetch(200, [foreUpSlot('09:00')]);
    const slots = await fetchForeUp('123', '456', '2025-06-15', 1);
    expect(slots[0].time).toBe('09:00');
  });

  it('sums green_fee and cart_fee into greenFee', async () => {
    mockFetch(200, [foreUpSlot('09:00')]);
    const slots = await fetchForeUp('123', '456', '2025-06-15', 1);
    expect(slots[0].greenFee).toBe(40); // 25 + 15
  });

  it('passes available_spots through as availableSpots', async () => {
    mockFetch(200, [foreUpSlot('09:00', { available_spots: 2 })]);
    const slots = await fetchForeUp('123', '456', '2025-06-15', 1);
    expect(slots[0].availableSpots).toBe(2);
  });

  it('returns empty array on HTTP error', async () => {
    mockFetch(403, {});
    const slots = await fetchForeUp('123', '456', '2025-06-15', 1);
    expect(slots).toEqual([]);
  });

  it('returns empty array when response is not an array', async () => {
    mockFetch(200, { error: 'no times' });
    const slots = await fetchForeUp('123', '456', '2025-06-15', 1);
    expect(slots).toEqual([]);
  });

  it('handles missing green_fee/cart_fee (defaults to 0)', async () => {
    mockFetch(200, [{ time: '09:00', available_spots: 3, holes: 18 }]);
    const slots = await fetchForeUp('123', '456', '2025-06-15', 1);
    expect(slots[0].greenFee).toBe(0);
  });
});
