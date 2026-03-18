## Assumptions

- **Ticker validation is runtime-based (no static list)**  
  A ticker is considered valid if `yfinance` returns a price. This avoids maintaining a symbol database but depends on external API availability.

- **Email grouping is based on `recipient_email`, not `user_id`**  
  Multiple subscriptions across users targeting the same email will be merged into a single email. This reduces duplicate sends and aligns with notification-product patterns.

- **Subscription email is decoupled from user email**  
  `recipient_email` can differ from `User.email`, allowing flexible routing (e.g., sending alerts to team/shared inboxes).

- **Frontend is a SPA (no SSR needed)**  
  All pages are behind authentication; SEO is not required. A Vite-based SPA is sufficient.

- **AI recommendation is best-effort**  
  OpenRouter is the primary provider. If unavailable, a deterministic rule-based fallback ensures system reliability.

- **System designed for demo-scale (≤ 1,000 users)**  
  Architecture prioritizes simplicity and clarity over distributed complexity.

- **Celery tasks are idempotent at business level**  
  Duplicate execution is tolerated; deduplication occurs at grouping stage (email merging).

- **Admin role uses Django built-in `is_staff`**  
  No custom role system to avoid duplication and maintain DRF compatibility.


  ## Tradeoffs

| Decision | Alternative | Why chosen | Tradeoff |
|--------|-----------|-----------|----------|
| Redis as Celery broker | RabbitMQ / Kafka | Already required for caching; simple setup | Less durable than RabbitMQ for high reliability |
| Polling (60s) for price alerts | WebSocket / streaming feed | Minimal infra, easy to debug | Up to 60s latency |
| Vite SPA | Next.js SSR | No SEO requirement, simpler deployment | No server-side rendering |
| Zustand | Redux Toolkit | Lightweight, minimal boilerplate | Less ecosystem tooling |
| shadcn/ui + Tailwind | Ant Design | No CSS conflict, full control | Requires manual composition |
| OpenRouter + fallback | Pure rule-based | Meets AI requirement while staying resilient | External dependency |
| Email grouping by recipient | Group by user | Reduces duplicate emails | Cross-user coupling |
| DecimalField for price | FloatField | Avoids precision errors | Slightly heavier storage |


## Considered But Rejected

| Option | Why not used |
|------|-------------|
| Next.js (BFF) | Adds Node.js layer on top of Django; overlaps with DRF API responsibility |
| Kafka | Designed for event streaming at large scale; unnecessary for low-frequency email tasks |
| RabbitMQ | Extra infrastructure with minimal benefit at current scale |
| AWS ECS | Slower setup (VPC, ALB, IAM); Railway enables faster iteration within 5-day scope |
| Redux Toolkit | Overkill for small state (auth + few entities) |
| Ant Design | CSS-in-JS conflicts with Tailwind preflight |
| APScheduler | Not safe in multi-instance deployment |
| Cron jobs | Not portable in Docker / Railway environment |
| Pure AI (no fallback) | Risk of API failure breaking core functionality |

## Key Design Decisions

- **Authentication strategy**  
  Chose system login (JWT) over Google/GitHub OAuth to reduce setup complexity and focus on core backend logic.

- **Email aggregation strategy**  
  Emails are grouped by `recipient_email` rather than `user_id` to minimize duplicate sends and match real-world notification systems.

- **Flexible email routing**  
  Subscription email field is independent from user account email, enabling multi-recipient workflows.

- **Async-first architecture**  
  All email sending and AI inference run in Celery workers to avoid blocking API requests.

- **Fallback-first design**  
  Both stock data (yfinance) and AI recommendation include fallback logic to ensure system availability.

## Bonus Feature: Price Alerts

### What it is

Users set an upper and/or lower price threshold per ticker. A Celery task polls prices every minute; when a threshold is crossed, an immediate email is sent and the alert is marked triggered.

### Why this feature

It directly addresses the trigger-based notification business model: condition evaluation → asynchronous delivery, independent of the scheduled hourly send. It also showcases the part of the stack that is hardest to fake in an interview — a real background worker responding to real-world data in near-real-time.

## Scalability Path

### Current (≤ 1,000 users)
- Single Celery worker
- Redis as broker + cache
- PostgreSQL (Railway)
- Polling-based price alerts (60s interval)
