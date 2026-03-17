from django.urls import path
from rest_framework_simplejwt.views import (
    TokenObtainPairView,   # POST email+password → access+refresh
    TokenRefreshView,      # POST refresh → new access
    TokenVerifyView,       # POST token → 200 if valid
)
from .views import RegisterView, MeView

urlpatterns = [
    path("register/", RegisterView.as_view()),
    path("login/",    TokenObtainPairView.as_view()),   # built-in ✓
    path("refresh/",  TokenRefreshView.as_view()),       # built-in ✓
    path("verify/",   TokenVerifyView.as_view()),        # built-in ✓
    path("me/",       MeView.as_view()),
]