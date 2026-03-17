from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from .models import Subscription
from .permissions import IsOwnerOrAdmin
from .serializers import SubscriptionSerializer


class SubscriptionViewSet(viewsets.ModelViewSet):
    """
    list   GET  /api/subscriptions/          → own (or all for admin)
    create POST /api/subscriptions/          → create for current user
    delete DELETE /api/subscriptions/{id}/   → own only (or admin)

    send_now POST /api/subscriptions/{id}/send_now/
        → sends ONE merged email containing ALL subscriptions
          that share the same recipient email as this subscription.
          This respects the "merge emails" requirement.
    """

    serializer_class   = SubscriptionSerializer
    permission_classes = [IsAuthenticated, IsOwnerOrAdmin]
    http_method_names  = ["get", "post", "delete", "head", "options"]

    def get_queryset(self):
        user = self.request.user
        if user.is_staff:
            return Subscription.objects.select_related("user").all()
        return Subscription.objects.filter(user=user)

    def perform_create(self, serializer):
        serializer.save(user=self.request.user)

    # ── send_now ──────────────────────────────────────────────────────────────
    @action(detail=True, methods=["post"], url_path="send_now")
    def send_now(self, request, pk=None):
        """
        Trigger an immediate merged email for the recipient email of this
        subscription.  All subscriptions belonging to this user with the same
        recipient email are included in a single email — not just the one
        clicked.
        """
        subscription = self.get_object()   # also enforces object permission

        recipient_email = subscription.email

        # Collect ALL tickers the same user has mapped to this recipient email.
        # This is the merge-email logic for send_now.
        tickers = list(
            Subscription.objects
            .filter(user=request.user, email=recipient_email)
            .values_list("ticker", flat=True)
            .distinct()
        )

        # Import here to avoid circular imports at module level
        from apps.notifications.tasks import send_stock_email_task

        send_stock_email_task.delay(
            recipient_email=recipient_email,
            tickers=tickers,
            triggered_by="send_now",
        )

        return Response(
            {
                "detail": f"Email queued for {recipient_email}.",
                "tickers": tickers,
            },
            status=status.HTTP_202_ACCEPTED,
        )