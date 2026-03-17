"""
AI recommendation service — stub for testing.
Real implementation comes next.
"""

def get_recommendation(ticker: str, price: float) -> dict:
    """Temporary stub — returns mock recommendation."""
    return {
        "recommendation": "HOLD",
        "reason":         "AI service not yet configured.",
        "source":         "stub",
    }