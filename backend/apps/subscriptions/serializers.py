from rest_framework import serializers
from .models import Subscription


class SubscriptionSerializer(serializers.ModelSerializer):
    class Meta:
        model  = Subscription
        fields = ["id", "ticker", "email", "created_at"]
        read_only_fields = ["id", "created_at"]

    def validate_ticker(self, value):
        return value.upper().strip()