from rest_framework import serializers
from apps.stocks.services import validate_ticker
from .models import Subscription


class SubscriptionSerializer(serializers.ModelSerializer):
    user_email = serializers.EmailField(source="user.email", read_only=True)

    class Meta:
        model  = Subscription
        fields = ["id", "ticker", "email", "created_at", "user_email", "target_price_above", 
                  "target_price_below", "alert_triggered", "alert_triggered_at",]
        read_only_fields = ["id", "created_at", "user_email", "alert_triggered", "alert_triggered_at",]

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

        target_price_above = attrs.get("target_price_above")
        target_price_below = attrs.get("target_price_below")

        if target_price_above is None and target_price_below is None:
            # allow no price alerts
            pass

        if target_price_above is not None and target_price_above <= 0:
            raise serializers.ValidationError(
                {"target_price_above": ["Upper alert price must be greater than 0."]}
            )

        if target_price_below is not None and target_price_below <= 0:
            raise serializers.ValidationError(
                {"target_price_below": ["Lower alert price must be greater than 0."]}
            )

        if (
            target_price_above is not None
            and target_price_below is not None
            and target_price_below >= target_price_above
        ):
            raise serializers.ValidationError(
                {
                    "non_field_errors": [
                        "Lower alert price must be less than upper alert price."
                    ]
                }
            )

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
                        "You already have a subscription for this ticker and recipient. Update it instead of creating another one."
                    ]
                }
            )

        attrs["ticker"] = ticker
        attrs["email"] = email
        return attrs
    
    def update(self, instance, validated_data):
        old_above = instance.target_price_above
        old_below = instance.target_price_below

        new_above = validated_data.get("target_price_above", old_above)
        new_below = validated_data.get("target_price_below", old_below)

        threshold_changed = (old_above != new_above) or (old_below != new_below)

        for attr, value in validated_data.items():
            setattr(instance, attr, value)

        if threshold_changed:
            instance.alert_triggered = False
            instance.alert_triggered_at = None

        instance.save()
        return instance
        
