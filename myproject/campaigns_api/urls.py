from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import CampaignViewSet, SESWebhookView # Import SESWebhookView

# Create a router and register our viewsets with it.
router = DefaultRouter()
router.register(r'campaigns', CampaignViewSet, basename='campaign')

# The API URLs are now determined automatically by the router.
# Add the webhook URL separately.
urlpatterns = [
    path('', include(router.urls)),
    path('webhooks/ses/', SESWebhookView.as_view(), name='ses_webhook'),
]
