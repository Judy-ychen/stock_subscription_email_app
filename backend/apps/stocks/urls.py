from django.urls import path
from .views import validate_ticker_view, stock_price_view

urlpatterns = [
    path("stocks/validate/<str:ticker>/", validate_ticker_view),
    path("stocks/price/<str:ticker>/",    stock_price_view),
]