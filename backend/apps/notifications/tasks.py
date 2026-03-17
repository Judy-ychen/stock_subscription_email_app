"""
Celery tasks for stock email notifications.

send_scheduled_emails  — called by Celery Beat every hour Mon-Fri 9-17 ET
send_stock_email_task  — called directly by the send_now API action
"""

import logging
from collections import defaultdict

from celery import shared_task
from django.utils import timezone

logger = logging.getLogger(__name__)


# ── Shared core logic ─────────────────────────────────────────────────────────

def _build_recipient_map(subscriptions):
    """
    Group subscriptions by recipient email, deduplicating tickers.

    Returns:
        { "user@example.com": ["AAPL", "TSLA"], ... }
    """
    recipient_map = defaultdict(set)
    for sub in subscriptions:
        recipient_map[sub.email].add(sub.ticker.upper())

    # Convert sets to sorted lists for deterministic email content
    return {email: sorted(tickers) for email, tickers in recipient_map.items()}


def _send_to_recipient(recipient_email: str, tickers: list[str], triggered_by: str = "scheduled"):
    """
    Fetch prices + AI recommendations, render HTML email, send it, log result.
    This is the core logic shared by both scheduled and send_now paths.
    """
    from apps.stocks.services import get_stock_prices
    from apps.ai_recommendations.services import get_recommendation
    from apps.notifications.email import render_and_send_email
    from apps.subscriptions.models import EmailLog

    try:
        # 1. Fetch prices for all tickers
        price_data = get_stock_prices(tickers)

        # 2. Get AI recommendation for each ticker
        stock_updates = []
        for item in price_data:
            ticker = item["ticker"]
            price  = item["price"]
            source = item["source"]

            rec = get_recommendation(ticker=ticker, price=price)

            stock_updates.append({
                "ticker":         ticker,
                "price":          price,
                "source":         source,
                "recommendation": rec["recommendation"],
                "reason":         rec["reason"],
                "rec_source":     rec["source"],
            })

        # 3. Render and send the merged HTML email
        render_and_send_email(
            recipient_email=recipient_email,
            stock_updates=stock_updates,
        )

        # 4. Log success
        EmailLog.objects.create(
            recipient    = recipient_email,
            tickers      = tickers,
            status       = EmailLog.Status.SUCCESS,
            triggered_by = triggered_by,
        )

        logger.info(
            "Email sent to %s | tickers=%s | triggered_by=%s",
            recipient_email, tickers, triggered_by,
        )

    except Exception as exc:
        # 5. Log failure — never let one recipient crash the whole batch
        EmailLog.objects.create(
            recipient    = recipient_email,
            tickers      = tickers,
            status       = EmailLog.Status.FAILED,
            error        = str(exc),
            triggered_by = triggered_by,
        )
        logger.error(
            "Failed to send email to %s: %s",
            recipient_email, exc, exc_info=True,
        )


# ── Celery tasks ──────────────────────────────────────────────────────────────

@shared_task(name="notifications.send_scheduled_emails")
def send_scheduled_emails():
    """
    Scheduled task: runs every hour Mon-Fri 9-17 ET via Celery Beat.
    Groups all subscriptions by recipient email and sends one merged email each.
    """
    from apps.subscriptions.models import Subscription

    subscriptions = Subscription.objects.all()

    if not subscriptions.exists():
        logger.info("send_scheduled_emails: no subscriptions found, skipping.")
        return

    recipient_map = _build_recipient_map(subscriptions)
    logger.info(
        "send_scheduled_emails: sending to %d recipients", len(recipient_map)
    )

    for recipient_email, tickers in recipient_map.items():
        _send_to_recipient(
            recipient_email=recipient_email,
            tickers=tickers,
            triggered_by="scheduled",
        )


@shared_task(name="notifications.send_stock_email_task")
def send_stock_email_task(recipient_email: str, tickers: list[str], triggered_by: str = "send_now"):
    """
    On-demand task: triggered by the send_now API action.
    Sends a merged email for the given recipient and tickers immediately.
    """
    logger.info(
        "send_stock_email_task: recipient=%s tickers=%s",
        recipient_email, tickers,
    )
    _send_to_recipient(
        recipient_email=recipient_email,
        tickers=tickers,
        triggered_by=triggered_by,
    )