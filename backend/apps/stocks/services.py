"""
Stock price service.

Primary path : yfinance (real Yahoo Finance data)
Fallback     : mock data (when yfinance is unavailable or ticker lookup fails)
Cache        : Django cache framework
  - validate_ticker : 24 hours  (symbol validity rarely changes)
  - get_stock_price : 5 minutes (balance between freshness and API limits)
"""

import logging
import random
from typing import TypedDict

from django.core.cache import cache
from django.conf import settings

import yfinance as yf

def _is_mock_mode() -> bool:
    return getattr(settings, "STOCK_PROVIDER", "yfinance") == "mock"

logger = logging.getLogger(__name__)

# ── Cache TTLs ────────────────────────────────────────────────────────────────
TICKER_VALID_TTL   = 60 * 60 * 24   # 24 hours  — ticker existence
TICKER_INVALID_TTL = 60 * 60 * 6    # 6 hours   — invalid ticker (shorter so
                                     #             new listings aren't blocked)
PRICE_TTL          = 60 * 5         # 5 minutes — stock price

# ── Return type ───────────────────────────────────────────────────────────────
class StockPrice(TypedDict):
    ticker : str
    price  : float | None
    source : str   # "yfinance" | "mock"


# ── Internal helpers ──────────────────────────────────────────────────────────
def _cache_key_valid(ticker: str) -> str:
    return f"stock:valid:{ticker.upper()}"

def _cache_key_price(ticker: str) -> str:
    return f"stock:price:{ticker.upper()}"


def _fetch_from_yfinance(ticker: str) -> float | None:
    """
    Return the latest closing price from Yahoo Finance, or None on failure.
    Kept in its own function so it's easy to mock in tests.
    """
    try:

        info = yf.Ticker(ticker).fast_info
        price = getattr(info, "last_price", None)

        if price is None:
            # fast_info may not have last_price for all tickers; fall back
            hist = yf.Ticker(ticker).history(period="1d")
            if hist.empty:
                return None
            price = float(hist["Close"].iloc[-1])

        return float(price)
    except Exception as exc:
        logger.warning("yfinance error for %s: %s", ticker, exc)
        return None


def _mock_price(ticker: str) -> float:
    """
    Deterministic-ish mock price so the same ticker always returns a
    similar value within a session (makes demo screenshots look sane).
    """
    base = sum(ord(c) for c in ticker.upper()) * 1.5
    jitter = random.uniform(-2.0, 2.0)
    return round(base + jitter, 2)


# ── Public API ────────────────────────────────────────────────────────────────
def validate_ticker(ticker: str) -> bool:
    if _is_mock_mode():
        # In mock mode, accept any reasonable-looking ticker (1-5 uppercase letters)
        import re
        return bool(re.match(r'^[A-Z]{1,5}$', ticker.upper().strip()))
    
    ticker = ticker.upper().strip()
    cache_key = _cache_key_valid(ticker)

    cached = cache.get(cache_key)
    if cached is not None:
        return cached

    try:
        

        info = yf.Ticker(ticker).fast_info
        is_valid = getattr(info, "last_price", None) is not None

        # if not is_valid:
        #     full_info = yf.Ticker(ticker).info
        #     is_valid = bool(
        #         full_info.get("regularMarketPrice")
        #         or full_info.get("currentPrice")
        #         or full_info.get("navPrice")
        #     )

        ttl = TICKER_VALID_TTL if is_valid else TICKER_INVALID_TTL
        cache.set(cache_key, is_valid, ttl)
        return is_valid

    except Exception as exc:
        logger.warning("validate_ticker failed for %s: %s", ticker, exc)
        # ── KEY CHANGE ──────────────────────────────────────────────────────
        # Network error ≠ invalid ticker.
        # Return True optimistically so the user isn't blocked by infra issues.
        # Do NOT cache this result — retry next time.
        return True


def get_stock_price(ticker: str) -> StockPrice:
    ticker = ticker.upper().strip()

    is_valid = validate_ticker(ticker)
    if not is_valid:
        return {
            "ticker": ticker,
            "price": None,
            "source": "invalid",
        }
    
    if _is_mock_mode():
        return {
            "ticker": ticker,
            "price":  _mock_price(ticker),
            "source": "mock",
        }
    
    cache_key = _cache_key_price(ticker)
    cached = cache.get(cache_key)
    if cached is not None:
        return cached

    price = _fetch_from_yfinance(ticker)

    if price is not None:
        result: StockPrice = {
            "ticker": ticker,
            "price":  price,
            "source": "yfinance",
        }
        cache.set(cache_key, result, PRICE_TTL)   # only cache real data
        return result
    
    
    # Network failure or yfinance down → use mock, but don't cache
    # so the next request tries yfinance again
    logger.warning("yfinance unavailable for %s — using mock fallback", ticker)
    result = {
        "ticker": ticker,
        "price":  _mock_price(ticker),
        "source": "mock",
    }


def get_stock_prices(tickers: list[str]) -> list[StockPrice]:
    """
    Convenience wrapper — fetch prices for multiple tickers at once.
    Used by the Celery email task to avoid repeated single calls.
    """
    return [get_stock_price(t) for t in tickers]


def get_stock_snapshot(ticker: str) -> dict:
    ticker = ticker.upper().strip()

    if _is_mock_mode():
        price = _mock_price(ticker)
        previous_close = round(price / 1.01, 2)
        return {
            "ticker": ticker,
            "price": price,
            "previous_close": previous_close,
            "source": "mock",
        }

    try:
        import yfinance as yf

        obj = yf.Ticker(ticker)
        fast = obj.fast_info

        current_price = getattr(fast, "last_price", None) or getattr(fast, "lastPrice", None)
        previous_close = getattr(fast, "previous_close", None) or getattr(fast, "previousClose", None)

        if current_price is None or previous_close is None:
            hist = obj.history(period="5d")
            if hist.empty:
                raise ValueError("No historical data returned")
            current_price = float(hist["Close"].iloc[-1])
            previous_close = float(hist["Close"].iloc[-2]) if len(hist) >= 2 else current_price

        return {
            "ticker": ticker,
            "price": float(current_price),
            "previous_close": float(previous_close),
            "source": "yfinance",
        }

    except Exception as exc:
        logger.warning("get_stock_snapshot failed for %s: %s", ticker, exc)
        price = _mock_price(ticker)
        previous_close = round(price / 1.01, 2)
        return {
            "ticker": ticker,
            "price": price,
            "previous_close": previous_close,
            "source": "mock",
        }