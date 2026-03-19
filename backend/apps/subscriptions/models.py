from django.conf import settings
from django.db import models


class Subscription(models.Model):
    user       = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="subscriptions",
    )
    ticker     = models.CharField(max_length=10)
    email      = models.EmailField()              # recipient — may differ from login email
    created_at = models.DateTimeField(auto_now_add=True)

    # Price alert fields
    target_price_above = models.DecimalField(
        max_digits=10,
        decimal_places=2,
        null=True,
        blank=True,
    )
    target_price_below = models.DecimalField(
        max_digits=10,
        decimal_places=2,
        null=True,
        blank=True,
    )
    alert_triggered = models.BooleanField(default=False)
    alert_triggered_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ["-created_at"]
        # one user cannot subscribe the same ticker to the same email twice
        unique_together = [("user", "ticker", "email")]

    def __str__(self):
        return f"{self.user} → {self.ticker} → {self.email}"


class EmailLog(models.Model):
    class Status(models.TextChoices):
        SUCCESS = "success", "Success"
        FAILED  = "failed",  "Failed"

    recipient   = models.EmailField()
    tickers     = models.JSONField()              # e.g. ["AAPL", "TSLA"]
    status      = models.CharField(max_length=10, choices=Status.choices)
    error       = models.TextField(blank=True, default="")
    sent_at     = models.DateTimeField(auto_now_add=True)
    triggered_by = models.CharField(
        max_length=20,
        default="scheduled",                      # "scheduled" | "send_now" | "price alert"
    )

    def __str__(self):
        return f"{self.recipient} | {self.tickers} | {self.status}"