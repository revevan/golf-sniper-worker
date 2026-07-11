# Golf Sniper

Tee time alert bot for 60+ public golf courses in LA, OC, Long Beach, Ventura, Inland Empire, and Atlanta. Set a search window and get a Telegram message the moment a slot opens.

## Course descriptors (open regions)

`GET /search` also accepts caller-described courses — any region works if you
know the booking-platform IDs:

```
/search?date=2026-07-12&courses=[{"api":"golfnow","facilityId":5043,"name":"Van Cortlandt (Bronx)"}]
```

Descriptor shapes (validated server-side; max 15 per request):
- `{ api: "golfnow", facilityId }`
- `{ api: "teeitup", alias, teeItUpAlias?, teeItUpOrigin?, teeItUpCourseId? }`
- `{ api: "foreup", facilityId, scheduleId }`
- `{ api: "ottogolf", facilityId, scheduleId }`

This is what lets a remixed [brikz](https://buildbrikz.com) brik serve New
York against this same worker. Alert subscriptions remain limited to the
built-in course list.

## How it works

1. Message the Telegram bot `/start` to get a link code
2. Open the web app, enter your code, pick a course, date, and time window
3. The worker polls every 10 minutes and fires a Telegram alert when a match appears
4. Alerts auto-expire the day after your target date — no manual cleanup needed

## Stack

- **Runtime**: Cloudflare Worker (cron every 10 min)
- **Storage**: Cloudflare KV — subscriptions (`KV`) and slot history for analytics (`HISTORY`)
- **Booking APIs**: GolfNow, TeeItUp, ForeUp, OttoGolf
- **Notifications**: Telegram Bot API
- **Frontend**: Static HTML/JS in `docs/` (served via GitHub Pages)

## Project structure

```
src/
  index.js        # HTTP routes (subscribe, list, delete, admin, analytics)
  cron.js         # Scheduled handler — polls APIs, matches subs, sends alerts
  courses.js      # Master course list with API routing per course
  golfnow.js      # GolfNow adapter
  teeitup.js      # TeeItUp adapter
  foreup.js       # ForeUp adapter
  ottogolf.js     # OttoGolf adapter
  analytics.js    # Slot history queries (patterns, book-out timelines)
  telegram.js     # Bot webhook + message helpers
  stats.js        # KV-backed counters for admin dashboard
docs/
  index.html      # Subscriber-facing UI
  admin.html      # Admin dashboard (stats, feedback)
  feedback.html   # Feedback/request form
```

## Setup

### Prerequisites

- [Cloudflare account](https://cloudflare.com) with Workers enabled
- [Wrangler CLI](https://developers.cloudflare.com/workers/wrangler/) (`npm install -g wrangler`)
- Telegram bot token from [@BotFather](https://t.me/BotFather)

### Deploy

```bash
# Create KV namespaces
wrangler kv namespace create golf-sniper-kv
wrangler kv namespace create golf-sniper-history

# Add the IDs to wrangler.toml under [[kv_namespaces]]

# Set secrets
wrangler secret put TELEGRAM_BOT_TOKEN
wrangler secret put ADMIN_SECRET

# Deploy
wrangler deploy
```

### Register the Telegram webhook

```
https://api.telegram.org/bot<TOKEN>/setWebhook?url=https://<your-worker>.workers.dev/telegram-webhook
```

## API

| Method | Path | Description |
|--------|------|-------------|
| GET | `/courses` | All supported courses |
| POST | `/subscribe` | Create an alert |
| GET | `/subscriptions?chatId=` | List a user's alerts |
| DELETE | `/subscription/:id` | Cancel an alert |
| GET | `/admin/stats` | Dashboard stats (Bearer auth) |
| GET | `/analytics/course/:key` | Slot availability patterns (Bearer auth) |
| GET | `/analytics/midnight-dumps` | Detect unusual bulk-release events (Bearer auth) |

## Development

```bash
npm install
npm test                        # Vitest unit tests
wrangler dev                    # Local dev server
wrangler dev --remote           # Dev against real KV bindings
```

The test suite covers all four booking API adapters and the cron pipeline. Three ForeUp boundary-condition tests are known failures unrelated to current functionality.

## Adding a course

Add an entry to `src/courses.js`:

```js
{ name: 'My Course', region: 'Orange County', city: 'Irvine', holes: [18], api: 'golfnow', facilityId: 12345 }
```

Supported `api` values: `golfnow`, `teeitup`, `foreup`, `ottogolf`. ForeUp and OttoGolf also require `scheduleId`.
