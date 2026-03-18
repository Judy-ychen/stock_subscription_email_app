import logging
from django.conf import settings
from openai import OpenAI

logger = logging.getLogger(__name__)


def _rule_based(percent_change: float) -> dict:
    if percent_change > 2:
        return {
            "recommendation": "BUY",
            "reason": f"Price rose {percent_change:.2f}% vs previous close.",
            "source": "rule",
        }

    if percent_change < -2:
        return {
            "recommendation": "SELL",
            "reason": f"Price fell {percent_change:.2f}% vs previous close.",
            "source": "rule",
        }

    return {
        "recommendation": "HOLD",
        "reason": f"Price moved {percent_change:.2f}% vs previous close.",
        "source": "rule",
    }


def get_recommendation(
    ticker: str,
    current_price: float,
    previous_close: float,
) -> dict:

    percent_change = ((current_price - previous_close) / previous_close) * 100

    api_key = getattr(settings, "OPENROUTER_API_KEY", None)

    if not api_key:
        return _rule_based(percent_change)

    try:
        client = OpenAI(
            api_key=api_key,
            base_url=settings.AI_BASE_URL,
        )

        prompt = f"""
Ticker: {ticker}
Current price: {current_price}
Previous close: {previous_close}
Percent change: {percent_change:.2f}%

Return JSON:
{{
 "recommendation": "BUY | HOLD | SELL",
 "reason": "short explanation"
}}
"""

        resp = client.chat.completions.create(
            model=settings.AI_MODEL,
            messages=[
                {"role": "system", "content": "You are a concise stock email assistant. This is not financial advice."},
                {"role": "user", "content": prompt},
            ],
            temperature=0.2,
        )

        import json

        content = resp.choices[0].message.content
        parsed = json.loads(content)

        return {
            "recommendation": parsed["recommendation"],
            "reason": parsed["reason"],
            "source": "openrouter",
        }

    except Exception as e:
        logger.warning("AI failed, fallback rule: %s", e)
        return _rule_based(percent_change)