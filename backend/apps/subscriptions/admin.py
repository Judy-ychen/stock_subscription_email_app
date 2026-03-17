from django.contrib import admin
from .models import EmailLog, Subscription


@admin.register(Subscription)
class SubscriptionAdmin(admin.ModelAdmin):
    list_display  = ["user", "ticker", "email", "created_at"]
    list_filter   = ["ticker"]
    search_fields = ["user__email", "ticker", "email"]


@admin.register(EmailLog)
class EmailLogAdmin(admin.ModelAdmin):
    list_display  = ["recipient", "tickers", "status", "triggered_by", "sent_at"]
    list_filter   = ["status", "triggered_by"]
    search_fields = ["recipient"]