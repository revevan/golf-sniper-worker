import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { runCron } from '../cron.js';
import { sendTelegram } from '../telegram.js';

// Hoist vi.mock — Vitest moves this before any imports automatically
vi.mock('../telegram.js', () => ({
  sendTelegram: vi.fn().mockResolvedValue(undefined),
  handleTelegramWebhook: vi.fn(),
}));

// ---------------------------------------------------------------------------
// In-memory KV mock
// ---------------------------------------------------------------------------
function makeKV(initial = {}) {
  // Normalise initial values: objects → JSON strings
  const store = Object.fromEntries(
    Object.entries(initial).map(([k, v]) => [k, typeof v === 'string' ? v : JSON.stringify(v)])
  );
  return {
    get: vi.fn(async (key, type) => {
      const val = store[key] ?? null;
      if (val === null) return null;
      return type === 'json' ? JSON.parse(val) : val;
    }),
    put: vi.fn(async (key, value) => { store[key] = value; }),
    delete: vi.fn(async (key) => { delete store[key]; }),
    list: vi.fn(async ({ prefix = '' } = {}) => ({
      keys: Object.keys(store).filter(k => k.startsWith(prefix)).map(name => ({ name })),
      list_complete: true,
    })),
    _store: store,
  };
}

function makeEnv(kvData = {}) {
  return { KV: makeKV(kvData), HISTORY: makeKV({}), TELEGRAM_BOT_TOKEN: 'test-token' };
}

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------
function makeSub(overrides = {}) {
  return {
    id: 'sub-1',
    courseKey: 'el-dorado',
    courseName: 'El Dorado Park',
    api: 'teeitup',
    facilityId: null,
    scheduleId: null,
    date: '2025-11-15',
    earliestTime: '07:00',
    latestTime: '10:00',
    minPlayers: 2,
    holes: 18,
    telegramChatId: '999',
    active: true,
    createdAt: '2025-11-01T00:00:00Z',
    ...overrides,
  };
}

// All UTC times are on 2025-11-15 (PST = UTC-8)
const UTC = {
  '06:00': '2025-11-15T14:00:00Z',  // 06:00 PST — before window
  '07:00': '2025-11-15T15:00:00Z',  // 07:00 PST — window start
  '08:00': '2025-11-15T16:00:00Z',  // 08:00 PST — within window
  '10:30': '2025-11-15T18:30:00Z',  // 10:30 PST — after window
};

function teeItUpResponse(slots) {
  return [{
    teetimes: slots.map(({ time, maxPlayers = 4, bookedPlayers = 0, holes = 18 }) => ({
      teetime: UTC[time],
      maxPlayers,
      bookedPlayers,
      rates: [{ holes, greenFeeCart: 5000 }],
    })),
  }];
}

function mockFetch(body, status = 200) {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
    ok: status >= 200 && status < 300,
    status,
    json: () => Promise.resolve(body),
    text: () => Promise.resolve(JSON.stringify(body)),
  }));
}

beforeEach(() => {
  vi.clearAllMocks();
  // Skip the 500ms polite delay between course API calls
  vi.stubGlobal('setTimeout', (fn) => { fn(); return 0; });
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

// ---------------------------------------------------------------------------
// Basic alert flow
// ---------------------------------------------------------------------------
describe('runCron — alert fires', () => {
  it('calls sendTelegram when a slot matches the subscription', async () => {
    const env = makeEnv({ 'sub:sub-1': makeSub() });
    mockFetch(teeItUpResponse([{ time: '07:00' }]));

    await runCron(env);

    expect(sendTelegram).toHaveBeenCalledOnce();
  });

  it('sends to the correct Telegram chat with the course name and date', async () => {
    const env = makeEnv({ 'sub:sub-1': makeSub() });
    mockFetch(teeItUpResponse([{ time: '07:00' }]));

    await runCron(env);

    const [token, chatId, msg] = sendTelegram.mock.calls[0];
    expect(token).toBe('test-token');
    expect(chatId).toBe('999');
    expect(msg).toContain('El Dorado Park');
    expect(msg).toContain('2025-11-15');
    expect(msg).toContain('07:00');
  });

  it('writes the dedup key to KV with a TTL after alerting', async () => {
    const env = makeEnv({ 'sub:sub-1': makeSub() });
    mockFetch(teeItUpResponse([{ time: '07:00' }]));

    await runCron(env);

    expect(env.KV.put).toHaveBeenCalledWith(
      'notified:sub-1:2025-11-15:07:00',
      '1',
      expect.objectContaining({ expirationTtl: expect.any(Number) })
    );
  });

  it('includes all matching slots in a single Telegram message', async () => {
    const env = makeEnv({ 'sub:sub-1': makeSub() });
    mockFetch(teeItUpResponse([{ time: '07:00' }, { time: '08:00' }]));

    await runCron(env);

    expect(sendTelegram).toHaveBeenCalledOnce();
    const msg = sendTelegram.mock.calls[0][2];
    expect(msg).toContain('07:00');
    expect(msg).toContain('08:00');
  });
});

// ---------------------------------------------------------------------------
// No subscriptions
// ---------------------------------------------------------------------------
describe('runCron — no subscriptions', () => {
  it('does not call the tee time API when KV is empty', async () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal('fetch', fetchSpy);

    await runCron(makeEnv());

    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('does not send any Telegram message when KV is empty', async () => {
    await runCron(makeEnv());
    expect(sendTelegram).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// Deduplication
// ---------------------------------------------------------------------------
describe('runCron — deduplication', () => {
  it('suppresses an alert when the notified key already exists in KV', async () => {
    const env = makeEnv({
      'sub:sub-1': makeSub(),
      'notified:sub-1:2025-11-15:07:00': '1',
    });
    mockFetch(teeItUpResponse([{ time: '07:00' }]));

    await runCron(env);

    expect(sendTelegram).not.toHaveBeenCalled();
  });

  it('sends only the new slot when one is already notified and another is not', async () => {
    const env = makeEnv({
      'sub:sub-1': makeSub(),
      'notified:sub-1:2025-11-15:07:00': '1', // already sent
      // 08:00 is NOT in KV — should fire
    });
    mockFetch(teeItUpResponse([{ time: '07:00' }, { time: '08:00' }]));

    await runCron(env);

    expect(sendTelegram).toHaveBeenCalledOnce();
    const msg = sendTelegram.mock.calls[0][2];
    expect(msg).toContain('08:00');
    expect(msg).not.toContain('07:00');
  });

  it('writes dedup keys for new slots but not for already-notified slots', async () => {
    const env = makeEnv({
      'sub:sub-1': makeSub(),
      'notified:sub-1:2025-11-15:07:00': '1',
    });
    mockFetch(teeItUpResponse([{ time: '07:00' }, { time: '08:00' }]));

    await runCron(env);

    const putCalls = env.KV.put.mock.calls.map(c => c[0]);
    expect(putCalls).toContain('notified:sub-1:2025-11-15:08:00');
    expect(putCalls).not.toContain('notified:sub-1:2025-11-15:07:00');
  });
});

// ---------------------------------------------------------------------------
// Filtering
// ---------------------------------------------------------------------------
describe('runCron — filtering', () => {
  it('does not alert when the slot is before the earliest time', async () => {
    const env = makeEnv({ 'sub:sub-1': makeSub() }); // window 07:00–10:00
    mockFetch(teeItUpResponse([{ time: '06:00' }]));

    await runCron(env);

    expect(sendTelegram).not.toHaveBeenCalled();
  });

  it('does not alert when the slot is after the latest time', async () => {
    const env = makeEnv({ 'sub:sub-1': makeSub() });
    mockFetch(teeItUpResponse([{ time: '10:30' }]));

    await runCron(env);

    expect(sendTelegram).not.toHaveBeenCalled();
  });

  it('does not alert when available spots are fewer than minPlayers', async () => {
    const env = makeEnv({ 'sub:sub-1': makeSub({ minPlayers: 3 }) });
    // maxPlayers=4, bookedPlayers=3 → 1 available
    mockFetch(teeItUpResponse([{ time: '07:00', maxPlayers: 4, bookedPlayers: 3 }]));

    await runCron(env);

    expect(sendTelegram).not.toHaveBeenCalled();
  });

  it('does not alert when the slot holes do not match the subscription', async () => {
    const env = makeEnv({ 'sub:sub-1': makeSub({ holes: 18 }) });
    mockFetch(teeItUpResponse([{ time: '07:00', holes: 9 }]));

    await runCron(env);

    expect(sendTelegram).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// API call grouping
// ---------------------------------------------------------------------------
describe('runCron — grouping by course+date', () => {
  it('calls the external API once for two subscriptions on the same course and date', async () => {
    // Two subs, same courseKey + date, different time windows
    const sub1 = makeSub({ id: 'sub-1', earliestTime: '07:00', latestTime: '08:00' });
    const sub2 = makeSub({ id: 'sub-2', earliestTime: '09:00', latestTime: '10:00' });
    const env = makeEnv({ 'sub:sub-1': sub1, 'sub:sub-2': sub2 });
    const fetchSpy = vi.fn().mockResolvedValue({
      ok: true, status: 200,
      json: () => Promise.resolve(teeItUpResponse([])),
      text: () => Promise.resolve(''),
    });
    vi.stubGlobal('fetch', fetchSpy);

    await runCron(env);

    const apiCalls = fetchSpy.mock.calls.filter(([url]) => url.includes('kenna.io'));
    expect(apiCalls).toHaveLength(1);
  });

  it('sends separate alerts to two subscribers when both have matching slots', async () => {
    const sub1 = makeSub({ id: 'sub-1', telegramChatId: '111', earliestTime: '07:00', latestTime: '08:00' });
    const sub2 = makeSub({ id: 'sub-2', telegramChatId: '222', earliestTime: '07:00', latestTime: '08:00' });
    const env = makeEnv({ 'sub:sub-1': sub1, 'sub:sub-2': sub2 });
    mockFetch(teeItUpResponse([{ time: '07:00' }]));

    await runCron(env);

    expect(sendTelegram).toHaveBeenCalledTimes(2);
    const chatIds = sendTelegram.mock.calls.map(c => c[1]);
    expect(chatIds).toContain('111');
    expect(chatIds).toContain('222');
  });
});

// ---------------------------------------------------------------------------
// Error resilience
// ---------------------------------------------------------------------------
describe('runCron — error resilience', () => {
  it('does not throw when a course API call returns an error', async () => {
    const env = makeEnv({ 'sub:sub-1': makeSub() });
    mockFetch({}, 500);

    await expect(runCron(env)).resolves.toBeUndefined();
  });

  it('continues alerting on the second course when the first API call fails', async () => {
    const sub1 = makeSub({ id: 'sub-1', courseKey: 'el-dorado' });
    const sub2 = makeSub({ id: 'sub-2', courseKey: 'heartwell', courseName: 'Heartwell' });
    const env = makeEnv({ 'sub:sub-1': sub1, 'sub:sub-2': sub2 });

    let call = 0;
    vi.stubGlobal('fetch', vi.fn().mockImplementation(() => {
      call++;
      if (call === 1) {
        // First course fails
        return Promise.resolve({ ok: false, status: 500, text: () => Promise.resolve('err') });
      }
      // Second course succeeds with a matching slot
      return Promise.resolve({
        ok: true, status: 200,
        json: () => Promise.resolve(teeItUpResponse([{ time: '07:00' }])),
      });
    }));

    await runCron(env);

    expect(sendTelegram).toHaveBeenCalledOnce();
    expect(sendTelegram.mock.calls[0][2]).toContain('Heartwell');
  });
});

// ---------------------------------------------------------------------------
// ForeUp backend
// ---------------------------------------------------------------------------
describe('runCron — ForeUp', () => {
  it('sends an alert for a matching ForeUp slot', async () => {
    const sub = makeSub({
      api: 'foreup',
      courseKey: '123',
      courseName: 'Rancho San Joaquin',
      facilityId: '123',
      scheduleId: '456',
    });
    const env = makeEnv({ 'sub:sub-1': sub });
    mockFetch([{ time: '08:30', available_spots: 3, holes: 18, green_fee: 25, cart_fee: 15 }]);

    await runCron(env);

    expect(sendTelegram).toHaveBeenCalledOnce();
    expect(sendTelegram.mock.calls[0][2]).toContain('08:30');
  });

  it('does not alert for a ForeUp slot outside the time window', async () => {
    const sub = makeSub({
      api: 'foreup', courseKey: '123', facilityId: '123', scheduleId: '456',
      earliestTime: '09:00', latestTime: '10:00',
    });
    const env = makeEnv({ 'sub:sub-1': sub });
    mockFetch([{ time: '07:00', available_spots: 4, holes: 18, green_fee: 0, cart_fee: 0 }]);

    await runCron(env);

    expect(sendTelegram).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// GolfNow backend
// ---------------------------------------------------------------------------
describe('runCron — GolfNow', () => {
  // GolfNow reports the course's LOCAL wall-clock time tagged with a bogus
  // "+00:00" offset, on the sub's date (2025-11-15).
  const golfNowSlot = (localTime) => ({
    ttResults: {
      teeTimes: [{ time: { date: `2025-11-15T${localTime}:00+00:00` }, minTeeTimeRate: { value: 45 }, detailUrl: '/x' }],
    },
  });

  it('sends an alert for a matching GolfNow slot', async () => {
    const sub = makeSub({
      api: 'golfnow', courseKey: '99999', courseName: 'Anaheim Hills', facilityId: '99999',
    });
    const env = makeEnv({ 'sub:sub-1': sub });
    mockFetch(golfNowSlot('07:00'));

    await runCron(env);

    expect(sendTelegram).toHaveBeenCalledOnce();
    expect(sendTelegram.mock.calls[0][2]).toContain('07:00');
  });

  it('does not alert for a GolfNow slot outside the time window', async () => {
    const sub = makeSub({
      api: 'golfnow', courseKey: '99999', facilityId: '99999',
      earliestTime: '09:00', latestTime: '10:00',
    });
    const env = makeEnv({ 'sub:sub-1': sub });
    mockFetch(golfNowSlot('07:00'));

    await runCron(env);

    expect(sendTelegram).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// Stat counters
// ---------------------------------------------------------------------------
describe('runCron — stat counters', () => {
  it('increments total_slot_matches by the number of new slots found', async () => {
    const env = makeEnv({ 'sub:sub-1': makeSub() });
    mockFetch(teeItUpResponse([{ time: '07:00' }, { time: '08:00' }]));

    await runCron(env);

    expect(env.KV.put).toHaveBeenCalledWith('stats:total_slot_matches', '2');
  });

  it('increments total_alerts_sent by 1 per Telegram message sent', async () => {
    const env = makeEnv({ 'sub:sub-1': makeSub() });
    mockFetch(teeItUpResponse([{ time: '07:00' }]));

    await runCron(env);

    expect(env.KV.put).toHaveBeenCalledWith('stats:total_alerts_sent', '1');
  });

  it('does not increment stats when all slots are already notified', async () => {
    const env = makeEnv({
      'sub:sub-1': makeSub(),
      'notified:sub-1:2025-11-15:07:00': '1',
    });
    mockFetch(teeItUpResponse([{ time: '07:00' }]));

    await runCron(env);

    const statPuts = env.KV.put.mock.calls.map(c => c[0]).filter(k => k.startsWith('stats:'));
    expect(statPuts).toHaveLength(0);
  });
});
