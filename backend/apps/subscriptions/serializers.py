from rest_framework import serializers
from apps.stocks.services import validate_ticker
from .models import Subscription


class SubscriptionSerializer(serializers.ModelSerializer):
    class Meta:
        model  = Subscription
        fields = ["id", "ticker", "email", "created_at"]
        read_only_fields = ["id", "created_at"]

    def validate_ticker(self, value):
        ticker = value.upper().strip()

        if not validate_ticker(ticker):
            raise serializers.ValidationError("Invalid ticker symbol.")

        return ticker
    
    def validate_email(self, value):
        return value.strip().lower()
    
    def validate(self, attrs):
        user = self.context["request"].user
        ticker = attrs.get("ticker", "").upper().strip()
        email = attrs.get("email", "").strip().lower()

        qs = Subscription.objects.filter(
            user=user,
            ticker=ticker,
            email=email,
        )

        # avoid repeating
        if self.instance is not None:
            qs = qs.exclude(pk=self.instance.pk)

        if qs.exists():
            raise serializers.ValidationError(
                {
                    "non_field_errors": [
                        "You already subscribed to this ticker for this email."
                    ]
                }
            )

        attrs["ticker"] = ticker
        attrs["email"] = email
        return attrs