from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import ContactViewSet, ContactUploadView # Import the new view

# Create a router and register our viewsets with it.
router = DefaultRouter()
router.register(r'contacts', ContactViewSet, basename='contact')

# The API URLs are now determined automatically by the router.
# For custom views like ContactUploadView, we add them separately.
urlpatterns = [
    path('', include(router.urls)),
    path('contacts/upload/', ContactUploadView.as_view(), name='contact-upload'),
]
