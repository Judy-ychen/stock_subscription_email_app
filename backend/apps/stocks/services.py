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
import re

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
    source : str   # "yfinance" | "mock" | "invalid"
    note: str | None    

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
        hist = _fetch_history(ticker, period="5d")
        if hist.empty:
            logger.warning("yfinance history empty for %s", ticker)
            return None

        price = float(hist["Close"].iloc[-1])
        logger.info("Price fetched from yfinance for %s: %s", ticker, price)
        return price
    except Exception as exc:
        logger.warning("yfinance error for %s: %s", ticker, exc)
        return None

def _fetch_history(ticker: str, period: str = "5d"):
    """
    Centralized yfinance fetch helper so logging/debugging is consistent.
    """
    obj = yf.Ticker(ticker)
    return obj.history(period=period, auto_adjust=False)


def _mock_price(ticker: str) -> float:
    """
    Deterministic-ish mock price so the same ticker always returns a
    similar value within a session (makes demo screenshots look sane).
    """
    base = sum(ord(c) for c in ticker.upper()) * 1.5
    jitter = random.uniform(-2.0, 2.0)
    return round(base + jitter, 2)


# ── Public API ────────────────────────────────────────────────────────────────
def validate_ticker(ticker: str) -> dict:
    ticker = ticker.upper().strip()

    if not re.match(r"^[A-Z]{1,5}$", ticker):
        return {
            "ticker": ticker,
            "valid": False,
            "reason": "invalid",
        }

    if _is_mock_mode():
        return {
            "ticker": ticker,
            "valid": True,
            "reason": "mock_mode",
        }

    cache_key = _cache_key_valid(ticker)
    cached = cache.get(cache_key)
    if cached is not None:
        return cached

    try:
        hist = _fetch_history(ticker, period="5d")
        is_valid = not hist.empty

        result = {
            "ticker": ticker,
            "valid": is_valid,
            "reason": None if is_valid else "invalid",
        }

        ttl = TICKER_VALID_TTL if is_valid else TICKER_INVALID_TTL
        cache.set(cache_key, result, ttl)
        return result

    except Exception as exc:
        logger.warning("validate_ticker failed for %s: %s", ticker, exc)
        return {
            "ticker": ticker,
            "valid": False,
            "reason": "provider_unavailable",
        }


def get_stock_price(ticker: str) -> StockPrice:
    validation = validate_ticker(ticker)

    if not validation["valid"]:
        if validation["reason"] == "provider_unavailable":
            logger.warning("Ticker validation unavailable for %s — using mock fallback", ticker)
            return {
                "ticker": ticker,
                "price": _mock_price(ticker),
                "source": "mock",
                "note": "Validation unavailable; using mock fallback.",
            }

        return {
            "ticker": ticker,
            "price": None,
            "source": "invalid",
            "note": "Ticker could not be validated against Yahoo Finance.",
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
            "note" : None,
        }
        cache.set(cache_key, result, PRICE_TTL)   # only cache real data
        return result
    
    
    # Network failure or yfinance down → use mock, but don't cache
    # so the next request tries yfinance again
    logger.warning("yfinance unavailable for %s — using mock fallback", ticker)
    result: StockPrice = {
        "ticker": ticker,
        "price": _mock_price(ticker),
        "source": "mock",
        "note": "Yahoo Finance unavailable, using mock fallback.",
    }
    return result


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
            "note": "Mock mode enabled.",
        }

    try:
        hist = _fetch_history(ticker, period="5d")
        if hist.empty:
            raise ValueError("No historical data returned")

        current_price = float(hist["Close"].iloc[-1])
        previous_close = float(hist["Close"].iloc[-2]) if len(hist) >= 2 else current_price

        return {
            "ticker": ticker,
            "price": current_price,
            "previous_close": previous_close,
            "source": "yfinance",
            "note": None,
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
            "note": "Yahoo Finance unavailable, using mock fallback.",
        }