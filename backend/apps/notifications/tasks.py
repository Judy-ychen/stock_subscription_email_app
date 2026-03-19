"""
Celery tasks for stock email notifications.

send_scheduled_emails  — called by Celery Beat every hour Mon-Fri 9-17 ET
send_stock_email_task  — called directly by the send_now API action
"""

import logging
from collections import defaultdict

from celery import shared_task
from django.utils import timezone
from apps.stocks.services import get_stock_snapshot, get_stock_price
from apps.ai_recommendations.services import get_recommendation
from apps.subscriptions.models import Subscription, EmailLog
from apps.notifications.email import render_and_send_price_alert_email

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
    from apps.notifications.email import render_and_send_email
    from apps.subscriptions.models import EmailLog

    try:
        # 1. Fetch stock snapshot + AI recommendation for each ticker
        stock_updates = []

        for ticker in tickers:
            snapshot = get_stock_snapshot(ticker)

            rec = get_recommendation(
                ticker=ticker,
                current_price=snapshot["price"],
                previous_close=snapshot["previous_close"],
            )

            stock_updates.append({
                "ticker": ticker,
                "price": snapshot["price"],
                "source": snapshot["source"],              # price source
                "previous_close": snapshot["previous_close"],
                "recommendation": rec["recommendation"],
                "reason": rec["reason"],
                "rec_source": rec["source"],              # recommendation source
            })

        # 2. Render and send the merged HTML email
        render_and_send_email(
            recipient_email=recipient_email,
            stock_updates=stock_updates,
        )

        # 3. Log success
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

# Bonus Feature: Price Alerts
@shared_task(name="notifications.send_scheduled_stock_alerts")
def send_scheduled_grouped_stock_emails():
    """
    Batch scheduled task:
    - read all subscriptions
    - group by recipient email
    - deduplicate tickers
    - enqueue one email task per recipient
    """
    subscriptions = Subscription.objects.select_related("user").all()

    grouped = defaultdict(set)

    for sub in subscriptions:
        grouped[sub.email].add(sub.ticker.upper().strip())

    dispatched = 0

    for recipient_email, ticker_set in grouped.items():
        tickers = sorted(ticker_set)

        send_stock_email_task.delay(
            recipient_email,
            tickers,
            triggered_by="scheduled",
        )
        dispatched += 1

    logger.info(
        "Scheduled stock alerts dispatched for %s recipients",
        dispatched,
    )

    return {
        "recipients": dispatched,
        "subscriptions": subscriptions.count(),
    }

@shared_task(name="notifications.check_price_alerts")
def check_price_alerts():
    candidates = Subscription.objects.filter(alert_triggered=False)

    for sub in candidates:
        price_data = get_stock_price(sub.ticker)
        current_price = price_data["price"]

        if current_price is None:
            continue

        triggered = False
        direction = None
        threshold = None

        if (
            sub.target_price_above is not None
            and current_price >= float(sub.target_price_above)
        ):
            triggered = True
            direction = "above"
            threshold = float(sub.target_price_above)

        if (
            sub.target_price_below is not None
            and current_price <= float(sub.target_price_below)
        ):
            triggered = True
            direction = "below"
            threshold = float(sub.target_price_below)

        if not triggered:
            continue

        try:
            render_and_send_price_alert_email(
                recipient_email=sub.email,
                ticker=sub.ticker,
                current_price=current_price,
                threshold=threshold,
                direction=direction,
                price_source=price_data["source"],
            )

            sub.alert_triggered = True
            sub.alert_triggered_at = timezone.now()
            sub.save(update_fields=["alert_triggered", "alert_triggered_at"])

            EmailLog.objects.create(
                recipient=sub.email,
                tickers=[sub.ticker],
                status=EmailLog.Status.SUCCESS,
                error="",
                triggered_by="price_alert",
            )

        except Exception as exc:
            EmailLog.objects.create(
                recipient=sub.email,
                tickers=[sub.ticker],
                status=EmailLog.Status.FAILED,
                error=str(exc),
                triggered_by="price_alert",
            )

        sub.alert_triggered = True
        sub.alert_triggered_at = timezone.now()
        sub.save(update_fields=["alert_triggered", "alert_triggered_at"])