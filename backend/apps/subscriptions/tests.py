from unittest.mock import Mock, patch

from django.contrib.auth import get_user_model
from django.test import RequestFactory, TestCase, override_settings

from apps.ai_recommendations.services import get_recommendation
from apps.stocks.services import get_stock_price
from apps.subscriptions.models import Subscription
from apps.subscriptions.serializers import SubscriptionSerializer


User = get_user_model()


class CoreAppTests(TestCase):
    def setUp(self):
        self.factory = RequestFactory()
        self.user = User.objects.create_user(
            email="user@example.com",
            password="12345678",
        )

    # 1. Duplicate subscription should be rejected gracefully (400-style serializer error)
    def test_duplicate_subscription_rejected(self):
        Subscription.objects.create(
            user=self.user,
            ticker="AAPL",
            email="user@example.com",
        )

        request = self.factory.post("/api/subscriptions/")
        request.user = self.user

        serializer = SubscriptionSerializer(
            data={
                "ticker": "AAPL",
                "email": "user@example.com",
            },
            context={"request": request},
        )

        self.assertFalse(serializer.is_valid())
        self.assertIn("non_field_errors", serializer.errors)
        self.assertIn(
            "You already subscribed to this ticker for this email.",
            serializer.errors["non_field_errors"],
        )

    # 2. Invalid ticker should be rejected by serializer
    @patch("apps.subscriptions.serializers.validate_ticker", return_value=False)
    def test_invalid_ticker_rejected(self, mock_validate_ticker):
        request = self.factory.post("/api/subscriptions/")
        request.user = self.user

        serializer = SubscriptionSerializer(
            data={
                "ticker": "FAKE123",
                "email": "user@example.com",
            },
            context={"request": request},
        )

        self.assertFalse(serializer.is_valid())
        self.assertIn("ticker", serializer.errors)
        self.assertIn("Invalid ticker symbol.", serializer.errors["ticker"])

    # 3. get_stock_price should return invalid instead of mock for invalid ticker
    @patch("apps.stocks.services.validate_ticker", return_value=False)
    def test_get_stock_price_returns_invalid_for_invalid_ticker(self, mock_validate):
        result = get_stock_price("FAKE123")

        self.assertEqual(result["ticker"], "FAKE123")
        self.assertIsNone(result["price"])
        self.assertEqual(result["source"], "invalid")

    # 4. get_stock_price should fall back to mock when provider fails for a valid ticker
    @patch("apps.stocks.services._mock_price", return_value=123.45)
    @patch("apps.stocks.services._fetch_from_yfinance", return_value=None)
    @patch("apps.stocks.services.validate_ticker", return_value=True)
    def test_get_stock_price_mock_fallback_when_provider_fails(
        self,
        mock_validate,
        mock_fetch,
        mock_mock_price,
    ):
        result = get_stock_price("AAPL")

        self.assertIsNotNone(result)
        self.assertEqual(result["ticker"], "AAPL")
        self.assertEqual(result["price"], 123.45)
        self.assertEqual(result["source"], "mock")  # mock fallback should not be cached

    # 5. AI service should fall back to rule-based recommendation when OpenRouter fails
    @override_settings(
        OPENROUTER_API_KEY="fake-key",
        AI_MODEL="fake-model",
        AI_BASE_URL="https://openrouter.ai/api/v1",
    )
    @patch("apps.ai_recommendations.services.OpenAI")
    def test_ai_fallback_on_api_error(self, mock_openai_cls):
        mock_client = Mock()
        mock_client.chat.completions.create.side_effect = Exception("OpenRouter down")
        mock_openai_cls.return_value = mock_client

        result = get_recommendation(
            ticker="AAPL",
            current_price=105.0,
            previous_close=100.0,
        )

        self.assertEqual(result["source"], "rule")
        self.assertEqual(result["recommendation"], "BUY")
        self.assertIn("5.00%", result["reason"])