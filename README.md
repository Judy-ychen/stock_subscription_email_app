# Stock Subscription App

Stock price alerts and AI-powered Buy / Hold / Sell recommendations, delivered by email.

Supports external data providers (yfinance) with automatic fallback to mock data when unavailable.

---

## Quick Start

**Prerequisites:** Docker Desktop, Node.js 20+

```bash
# 1. Clone and configure
git clone https://github.com/your-handle/stock-subscription-app
cd stock-subscription-app
cp .env.example .env          # fill in API keys (see .env.example)

# 2. Start all six services
docker compose up --build

# 3. Create an admin user (separate terminal)
docker compose exec api python manage.py createsuperuser
```

| Service | URL |
|---|---|
| React frontend | http://localhost:5173 |
| Django API | http://localhost:8000 |
| Django Admin | http://localhost:8000/admin |
| PostgreSQL | localhost:5432 |
| Redis | localhost:6379 |

### First use

1. Register at `http://localhost:5173/register`
2. Add a subscription: enter a ticker (e.g. `AAPL`) and a recipient email
3. Click **Send Now** to trigger an immediate price + AI recommendation email
4. Set a **Price Alert** — enter upper/lower thresholds; the alert fires within 60 seconds when crossed

---

## Architecture

```
┌─────────────────────────────────────────────────┐
│              Vercel (CDN)                        │
│   React 19 + Vite 6 + shadcn/ui + TypeScript    │
│   Zustand state  ·  Tailwind CSS                │
└────────────────────┬────────────────────────────┘
                     │  HTTPS · JWT
┌────────────────────▼────────────────────────────┐
│           Railway Docker                         │
│   Django 5 + DRF + Gunicorn                     │
│   SimpleJWT · django-celery-beat                │
└──────┬──────────────┬──────────────┬────────────┘
       │              │              │
┌──────▼──────┐ ┌─────▼──────┐ ┌───▼────────────┐
│ PostgreSQL  │ │  Redis 7   │ │ External APIs  │
│     16      │ │ broker +   │ │ yfinance       │
│ primary DB  │ │ cache      │ │ OpenRouter AI  │
└─────────────┘ └─────┬──────┘ └────────────────┘
                      │
┌─────────────────────▼───────────────────────────┐
│           Railway Docker                         │
│   Celery Worker  ·  Celery Beat                 │
│   send_scheduled_emails  (hourly, M–F 9–5 ET)  │
│   check_price_alerts     (every 60 seconds)     │
└─────────────────────────────────────────────────┘
```

**Data flow — hourly send:**
Beat fires → worker queries active subscriptions → groups by `recipient_email` → fetches price (yfinance; falls back to mock data if unavailable; cached 5 min) → AI recommendation (Redis cache, 1 hr) → one merged email per recipient → writes `EmailLog` + `EmailLogItem`

**Data flow — price alert:**
Beat fires every 60s → worker fetches prices (via yfinance; falls back to mock when provider unavailable) → compares against alert thresholds → on breach: sends immediate email + marks alert as triggered (one-time alert) 

---

## Tech Stack

| Layer | Choice | Why |
|---|---|---|
| Frontend build | Vite 6 | Fastest HMR; native ESM; static output to Vercel |
| UI components | shadcn/ui | Tailwind-native; copy-owned source; zero runtime |
| Language | TypeScript | Strict mode; typed API contracts |
| State | Zustand | Minimal boilerplate; sufficient for auth + subscription state |
| Backend | Django 5 + DRF | ModelViewSet + SimpleRouter = CRUD in ~30 lines |
| Auth | SimpleJWT | Stateless JWT; 15-min access / 7-day refresh |
| Task queue | Celery 5 + Redis 7 | Redis already required for cache; handles this workload with 300× headroom |
| Scheduler | django-celery-beat | DatabaseScheduler survives restarts; editable from Admin |
| AI | OpenRouter API | Single endpoint for 200+ models; swap model via env var |
| AI fallback | Rule-based heuristic | Ensures email delivery when OpenRouter is unavailable |
| Containers | Docker Compose | One `docker compose up` starts all 6 services |
| Backend deploy | Railway | Supports Django + PostgreSQL + Redis + Celery in one project |
| Frontend deploy | Vercel | Static deploy; free tier; global CDN |
| Stock data | yfinance + fallback | Uses yfinance when available; falls back to mock data for reliability |

---

## API Reference

### Auth

| Method | Endpoint | Description |
|---|---|---|
| POST | `/api/auth/register/` | Register new user, returns JWT pair |
| POST | `/api/auth/login/` | Authenticate, returns JWT pair |
| POST | `/api/auth/refresh/` | Exchange refresh token for new access token |
| GET | `/api/auth/me/` | Current user profile |

### Subscriptions (includes price alerts)

| Method | Endpoint | Description |
|---|---|---|
| GET | `/api/subscriptions/` | List subscriptions (own only; admins see all) |
| POST | `/api/subscriptions/` | Create subscription (optionally include alert thresholds) |
| PATCH | `/api/subscriptions/:id/` | Update alert thresholds |
| DELETE | `/api/subscriptions/:id/` | Delete subscription |
| POST | `/api/subscriptions/:id/send/` | Send Now — immediate price + AI email |

### Stock Data

| Method | Endpoint | Description |
|---|---|---|
| GET | `/api/stocks/validate/:ticker/` | Validate ticker symbol |
| GET | `/api/stocks/price/:ticker/` | Current price + 5-day change (cached 5 min) |

---

## Environment Variables

Copy `.env.example` to `.env` and fill in:

```bash
# Database
POSTGRES_DB=stockapp
POSTGRES_USER=stockapp
POSTGRES_PASSWORD=changeme

# Django
SECRET_KEY=your-long-random-string
DEBUG=True
ALLOWED_HOSTS=localhost,127.0.0.1

# AI (OpenRouter — https://openrouter.ai)
AI_PROVIDER=openrouter
AI_API_KEY=sk-or-...
AI_MODEL=google/gemini-flash-1.5

# Email (console backend for local dev)
EMAIL_BACKEND=django.core.mail.backends.console.EmailBackend
SENDGRID_API_KEY=

# Frontend
VITE_API_URL=http://localhost:8000
```

---

## Project Structure

```
.
├── backend/
│   ├── config/              # Django settings, urls, celery, wsgi
│   ├── apps/
│   │   ├── users/           # User model, auth endpoints
│   │   ├── subscriptions/   # Subscription model, CRUD, Send Now + price alerts + email logs
│   │   ├── stocks/          # yfinance integration + mock fallback
│   │   ├── notifications/   # email sending + Celery tasks
│   │   └── ai_recommendations/    # OpenRouterProvider + rule-based fallback
│   ├── Dockerfile.dev
│   └── Dockerfile.prod
├── frontend/
│   ├── src/
│   │   ├── pages/           # LoginPage, RegisterPage, SubscriptionsPage
│   │   ├── components/      # SubscriptionTable, SubscriptionForm, AlertForm
│   │   ├── store/           # useAuthStore, useSubscriptionStore
│   │   └── api/             # Typed fetch wrappers
│   └── Dockerfile.dev
├── docker-compose.yml
└── .env.example
```

---

## Tests

```bash
docker compose exec api python manage.py test
```

| Test | Covers |
|---|---|
| `test_subscription_unique_constraint` | Duplicate (owner, ticker, recipient_email) raises IntegrityError |
| `test_merge_email_groups_by_recipient` | 3 subs across 2 recipients → 2 outbound emails |
| `test_admin_sees_all_subscriptions` | is_staff user gets all rows; regular user gets own only |
| `test_ai_fallback_on_provider_failure` | Rule-based signal returned when OpenRouter raises |
| `test_ticker_normalised_to_uppercase` | Saving `aapl` stores `AAPL` |

---

## Resilience & Fallback Strategy

External APIs (yfinance, OpenRouter) may be unreliable in certain environments.

This system is designed with graceful degradation:

- If yfinance fails → fallback to deterministic mock prices
- If OpenRouter AI provider fails → fallback to rule-based recommendation
- Emails are still delivered even when external services are unavailable

This ensures core functionality (alerts and notifications) remains operational.

> For architecture decisions, tradeoffs, and scalability notes see [DESIGN.md](./DESIGN.md).
