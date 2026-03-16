# DESIGN.md

## Assumptions

- **Ticker validation** — a symbol is valid if `yfinance.Ticker(symbol).fast_info` returns without raising and yields a non-null price. No static symbol list is maintained.
- **Email merging scope** — subscriptions are grouped by `recipient_email` at send time, not by `User`. Two users subscribing AAPL to the same address receive one merged email.
- **Market hours gate** — the hourly scheduler checks weekday < 5 and 9 ≤ hour < 17 US/Eastern inside the task body. The Beat schedule itself fires every hour; the guard exits early outside trading hours.
- **Tickers stored uppercase** — enforced via `save()` override and a DB-level `CHECK (ticker = upper(ticker))` constraint. `aapl` and `AAPL` are the same subscription.
- **`recipient_email` ≠ `User.email`** — a user may route alerts to any address. This is intentional; the field is named `recipient_email` (not `email`) to make this explicit.
- **AI recommendations are for demo purposes only** — every outbound email carries a disclaimer. OpenRouter is the primary provider; a rule-based fallback (change > +1% → Buy, < −1% → Sell, else Hold) ensures delivery when the API is unavailable.
- **UTC storage, ET conversion at task boundary** — all `DateTimeField` values are UTC. Eastern Time is applied only in the scheduler guard using `pytz`.
- **SendGrid free tier** (100 emails/day) is sufficient for the demo period.
- **`is_staff` serves as the admin flag** — `AbstractUser.is_staff` integrates with Django Admin, DRF `IsAdminUser`, and all permission decorators. No custom `is_admin` field is added.
- **Price alert checks run every minute** — acceptable latency for a demo; production would use a tighter loop or event-driven price feed.

---

## Tradeoffs

### Redis as Celery broker (vs RabbitMQ / Kafka)

Redis is already required for caching. Adding RabbitMQ would mean a fourth infrastructure service for 0.3 tasks/second peak throughput — Redis handles 100k+/s. Kafka solves event sourcing and replay at 100k+ users; neither problem exists here. `CELERY_TASK_ACKS_LATE = True` and AOF persistence close the main reliability gap between Redis and a dedicated broker for this workload.

### Polling-based price alerts (vs WebSocket / streaming feed)

A Celery task running every 60 seconds polls yfinance for each watched ticker. This is simple, observable, and requires no additional infrastructure. The tradeoff is up to 60-second alert latency. A production system would use a streaming price feed (Alpaca, Polygon.io) with a persistent connection, but that adds significant complexity and cost that isn't justified for a demo.

### `EmailLogItem` table (vs JSON column)

`tickers_included JSON` was the initial design. It was replaced with a normalised `EmailLogItem` table to enable per-ticker queries ("how many times did AAPL trigger a Buy?"), preserve the exact price and AI signal that was sent, and avoid JSON parsing in application code. The cost is one extra join on history views — acceptable at this scale.

### `DecimalField` for price (vs `FloatField`)

Float arithmetic introduces rounding errors on financial figures (`182.50` can become `182.49999999`). `DecimalField(max_digits=12, decimal_places=4)` adds negligible storage overhead and eliminates this class of bug entirely.

### Vite SPA (vs Next.js)

The spec requires a Django backend. Next.js introduces a second server (Node.js) alongside Django, creating ambiguous responsibility for data fetching and API routes. The app is entirely behind a login — SSR's primary benefit (SEO) is irrelevant. Vite SPA deploys as static files to Vercel with a single `VITE_API_URL` env var pointing at Railway.

### `SET_NULL` on `EmailLog.owner` (vs `CASCADE`)

Deleting a user should not erase the audit trail of emails sent under their account. `SET_NULL` preserves log rows with a null owner; `CASCADE` would silently destroy send history.

### shadcn/ui (vs Ant Design)

The spec explicitly requires Tailwind CSS. Ant Design uses CSS-in-JS and conflicts with Tailwind's `preflight` reset, requiring `!important` overrides throughout. shadcn components are copied into the repo as plain Tailwind JSX — no runtime dependency, no specificity conflicts, full ownership of every component.

---

## Considered & Rejected

| Option | Considered for | Rejection reason |
|---|---|---|
| Custom `is_admin` field | Admin role flag | Duplicates `AbstractUser.is_staff`; breaks DRF `IsAdminUser` and Django Admin integration |
| `tickers_included` JSON | Email log | Can't query per-ticker; can't filter by signal; requires app-side JSON parsing |
| `FloatField` for price | Stock price storage | Float rounding errors on financial values (e.g. `182.5` → `182.49999999`) |
| APScheduler (in-process) | Scheduled sends | Breaks with multiple dynos — duplicate sends if two instances run simultaneously |
| Cron + management command | Scheduled sends | Not portable to Railway/Docker without host cron access |
| Next.js | Frontend framework | Adds a Node server alongside Django; SSR irrelevant for authenticated dashboard |
| Ant Design | UI component library | CSS-in-JS conflicts with Tailwind preflight; requires `!important` overrides |
| RabbitMQ | Celery broker | Extra service for 0.3 tasks/sec; Redis already required for caching |
| Kafka | Message queue | Designed for event sourcing and 100k+ users; overkill for this workload |
| Rule-based heuristic only | AI recommendation | Doesn't satisfy requirement 7 ("AI-generated recommendation"); used only as fallback |
| WebSocket price feed | Price alerts | Requires persistent connection infrastructure; 60-second polling is sufficient for demo |
| Hard-delete on subscription | Delete action | Destroys audit trail; soft-delete (`is_active=False`) preserves history |

---

## Bonus Feature: Price Alerts

### What it is

Users set an upper and/or lower price threshold per ticker. A Celery task polls prices every minute; when a threshold is crossed, an immediate email is sent and the alert is marked triggered.

### Why this feature

It directly addresses Hextom's trigger-based notification business model: condition evaluation → asynchronous delivery, independent of the scheduled hourly send. It also showcases the part of the stack that is hardest to fake in an interview — a real background worker responding to real-world data in near-real-time.

### Data model additions

**`PriceAlert`**

| Field | Type | Notes |
|---|---|---|
| `id` | AutoField PK | |
| `subscription` | FK → Subscription, CASCADE | Ties alert to a specific ticker + user |
| `upper_threshold` | DecimalField, null | Email when price rises above this |
| `lower_threshold` | DecimalField, null | Email when price falls below this |
| `is_active` | BooleanField, default True | Deactivated after trigger or manually |
| `triggered_at` | DateTimeField, null | Set on first trigger |
| `created_at` | DateTimeField, auto | |

Constraint: at least one of `upper_threshold` / `lower_threshold` must be non-null (enforced via `clean()` and a `CheckConstraint`).

### API additions

| Method | Endpoint | Description |
|---|---|---|
| GET | `/api/alerts/` | List user's active price alerts |
| POST | `/api/alerts/` | Create a price alert on a subscription |
| DELETE | `/api/alerts/:id/` | Delete an alert |

### Celery task

```
check_price_alerts()  — runs every 60 seconds (Beat crontab)

1. Fetch all PriceAlert rows where is_active=True, select_related subscription
2. Deduplicate tickers → one yfinance call per unique ticker (cached 60s)
3. For each alert:
     if upper_threshold and price >= upper_threshold → trigger
     if lower_threshold and price <= lower_threshold → trigger
4. On trigger:
     send immediate email (same template as Send Now)
     set is_active=False, triggered_at=now()
     write EmailLog(trigger='alert')
```

One-shot semantics: an alert fires once and deactivates. The user must re-enable or create a new alert. This avoids an email storm if price oscillates around the threshold.

### Key constraint: no interaction with the hourly scheduler

The alert checker is a completely independent Beat task. It does not share code paths, locks, or queues with `send_scheduled_emails`. This makes both tasks independently observable and testable.

---

## Scalability Notes

The current design is intentionally sized for a demo (≤1,000 users). The following notes document where the architecture would need to change at each scale tier.

### 1,000 users (current target) — no changes needed

Redis as broker handles the load. Single Celery worker with `--concurrency 2`. PostgreSQL on Railway free tier. Price alert polling at 60-second intervals is imperceptible cost.

### 10,000 users

- Increase Celery worker `--concurrency` or add a second worker service
- Add `SELECT FOR UPDATE SKIP LOCKED` to the alert checker to allow multiple worker replicas without double-sending
- Consider Redis cluster for cache if memory pressure appears
- Price alert polling becomes expensive: 10k active alerts × 60s = sustained yfinance load. Introduce ticker deduplication aggressively (already in the design) and consider a 5-minute polling interval

### 100,000+ users

- Replace yfinance with a paid streaming feed (Alpaca, Polygon.io) — event-driven rather than polling
- Migrate Celery broker from Redis to RabbitMQ for dead-letter queue support and per-queue priority
- Shard `Subscription` and `PriceAlert` tables by `user_id` or move to a read replica for list queries
- Replace SendGrid free tier with a transactional email provider at volume (AWS SES: $0.10/1,000 emails)
- Celery Beat singleton becomes a reliability concern at this scale — migrate to a distributed scheduler (Redbeat) or AWS EventBridge
