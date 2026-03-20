from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework import status

from .services import get_stock_price, validate_ticker


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def validate_ticker_view(request, ticker: str):
    """
    GET /api/stocks/validate/<ticker>/
    Returns { ticker, valid }
    """
    result = validate_ticker(ticker)
    return Response(result)


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def stock_price_view(request, ticker: str):
    """
    GET /api/stocks/price/<ticker>/
    Returns { ticker, price, source }
    """
    result = get_stock_price(ticker)
    return Response(result)