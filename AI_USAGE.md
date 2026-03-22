## Phase 1: Design & Planning

### Tech Stack Decision: shadcn vs Ant Design
- **Prompt**: "Compare shadcn/ui vs Ant Design for a React + Tailwind project..."
- **Result**: AI recommended shadcn — Tailwind-native, 10-20KB vs antd 150-300KB
- **My verification**: Checked Ant Design docs, confirmed it uses Less/CSS-in-JS and is less aligned with Tailwind workflow
- **Decision**: Adopted shadcn/ui for better performance and composability

---

### Tech Stack Decision: OpenRouter vs OpenAI
- **Prompt**: "Compare OpenRouter vs direct OpenAI for AI recommendations..."
- **Result**: AI suggested OpenRouter for flexibility across models
- **My addition**: 
  - Added **rule-based fallback** when LLM fails
  - Designed system to **never block email sending due to AI failure**
- **Final Design**:
  - Primary: OpenRouter
  - Fallback: deterministic rule-based recommendation

---

## Phase 2: Implementation

### What AI Did Well
- DRF ViewSet + Serializer boilerplate: ~95% correct
- Zustand auth store structure: solid baseline
- Axios interceptor idea: correct direction (token attach + refresh)
- Docker Compose setup: usable with minor fixes

---

### What I Corrected (Critical Engineering Fixes)

#### 1. CORS Blocking Frontend Requests
- **AI gap**: Did not mention Django CORS setup
- **Issue**: Frontend requests blocked (`No 'Access-Control-Allow-Origin'`)
- **Fix**:
  - Installed `django-cors-headers`
  - Added middleware + allowed origins
- **Impact**: Enabled frontend ↔ backend communication

---

#### 2. JWT Token Handling Improvement (Frontend)
- **AI suggestion**:
  - Basic interceptor for attaching tokens
- **Issue observed**:
  - Potential for duplicate refresh requests during concurrent API calls
- **Fix**:
  - Introduced request queueing during token refresh
  - Ensured only one refresh request is executed at a time
- **Impact**:
  - Prevented race conditions and redundant API calls

---

#### 3. Celery Task Not Registered
- **Error**: Received unregistered task of type 'notifications.check_price_alerts'
- **AI gap**: Did not ensure proper task discovery
- **Fix**:
- Verified `autodiscover_tasks()`
- Ensured correct import path: `apps.notifications.tasks`
- **Impact**: Enabled scheduled alert system

---

#### 4. yfinance Integration Reliability Issue
- **Observed issue**:
  - yfinance frequently failed (network / provider instability)
  - Returned `None` or raised exceptions
- **AI gap**:
  - Did not consider external API unreliability
- **Fix**:
  - Implemented safe wrapper around yfinance calls
  - Added fallback logic when price fetch fails
- **My improvement**:
  - Introduced **mock price fallback system**
  - Avoid caching fallback values (so real data can recover later)
- **Impact**:
  - System remains functional even when external API is down
  - Enables local development without internet dependency

---

#### 5. Added Full Fallback System (Major Improvement)
- **AI suggestion**: direct API usage only
- **My implementation**:
- yfinance failure → mock price
- OpenRouter failure → rule-based AI
- **Impact**:
- System works even with **no external APIs**
- Enables reliable testing + deployment

---

#### 6. Duplicate Subscription Validation
- **Issue**:
  - Duplicate subscriptions were not properly handled at validation layer
- **Fix**:
  - Added serializer-level validation for (user, ticker, email)
- **Impact**:
  - Prevented duplicate entries
  - Returned clean API error for frontend handling

---

#### 7. Fake Ticker Always Returning Price
- **Issue**:
- Invalid tickers still returned mock price → misleading
- **Fix**:
- Added `validate_ticker()` check before fallback
- Return `price=None` for invalid tickers
- **Impact**:
- Correct business logic
- Frontend shows "Invalid ticker"

---

#### 8. PATCH Method Not Allowed (405)
- **Error**:
  - PATCH requests returned 405 Method Not Allowed
- **Root cause**:
  - ViewSet configuration did not support partial updates
- **Fix**:
  - Enabled PATCH in ViewSet (partial_update)
  - Verified router configuration
- **Impact**:
  - Enabled alert editing functionality
---

#### 9. 401 Unauthorized Issues (Token Handling)
- **Issue**:
- Requests failed after refresh / page reload
- **Fix**:
- Ensured access token is attached in interceptor
- Synced Zustand persisted state
- **Impact**:
- Stable authenticated requests

---

#### 10. API Route Mismatch (404 Errors)
- **Issue**:
  - Frontend endpoints did not match Django routes
- **Examples**:
  - `send_now` vs `send`
  - incorrect subscription ID paths
- **Fix**:
  - Aligned frontend API layer with backend URL patterns
- **Impact**:
  - Eliminated 404 errors
---

#### 11. Email Logging + Failure Tracking
- **AI gap**: no observability
- **My addition**:
- Created `EmailLog` model
- Stored:
  - recipient
  - tickers
  - status (success / failed)
  - error message
  - trigger source (send_now / scheduled / price_alert)
- **Impact**:
- Debuggable system
- Production-ready logging

---

#### 12. Price Alert Trigger Timing
- **Issue**:
  - Alerts only triggered via scheduled tasks
  - Newly created alerts might miss immediate trigger condition
- **Fix**:
  - Added immediate evaluation after create/update
- **Impact**:
  - Ensured no missed alerts

---

#### 13. UI / UX Fixes (Frontend)
- Fixed:
- persistent success messages not clearing
- form inputs not resetting
- button alignment + layout issues
- Added:
- debounced ticker validation
- inline error handling
- loading skeletons
- **Impact**:
- Production-quality UX

---

## Summary

AI accelerated development by providing:

- initial architecture
- boilerplate code
- integration patterns

However, key production-ready features required manual fixes:

- reliability (fallback systems)
- correctness (API + validation)
- stability (auth + Celery)
- usability (frontend UX)

The final system is **significantly more robust than the AI-generated baseline**.
