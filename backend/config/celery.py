import os
from celery import Celery
from celery.schedules import crontab


os.environ.setdefault("DJANGO_SETTINGS_MODULE", "config.settings")

app = Celery("config")
app.config_from_object("django.conf:settings", namespace="CELERY")
app.autodiscover_tasks([
    "apps.notifications",
    "apps.subscriptions",
])

app.conf.beat_schedule = {
    "send-scheduled-stock-emails": {
        "task": "notifications.send_scheduled_emails",
        # Every hour at :00, Monday–Friday, 9 AM – 5 PM Eastern
        # Cron runs in UTC — ET is UTC-4 (EDT) or UTC-5 (EST)
        # 9 AM ET = 13:00 UTC (EDT) / 14:00 UTC (EST)
        # 5 PM ET = 21:00 UTC (EDT) / 22:00 UTC (EST)
        # Using EDT (UTC-4) as the base — covers daylight saving time

        "schedule": crontab(
            minute="0",
            hour="9,10,11,12,13,14,15,16,17",   # 9 AM–5 PM EST
            day_of_week="1,2,3,4,5",              # Mon–Fri
        ),
        
        # For test: Send every minute
        # "schedule": crontab(),
    },
}

# Suppress the broker_connection_retry deprecation warning
app.conf.broker_connection_retry_on_startup = True