"""
URL configuration for myproject project.

The `urlpatterns` list routes URLs to views. For more information please see:
    https://docs.djangoproject.com/en/5.2/topics/http/urls/
Examples:
Function views
    1. Add an import:  from my_app import views
    2. Add a URL to urlpatterns:  path('', views.home, name='home')
Class-based views
    1. Add an import:  from other_app.views import Home
    2. Add a URL to urlpatterns:  path('', Home.as_view(), name='home')
Including another URLconf
    1. Import the include() function: from django.urls import include, path
    2. Add a URL to urlpatterns:  path('blog/', include('blog.urls'))
"""
from django.contrib import admin
from django.urls import path, include
from rest_framework import permissions
from drf_yasg.views import get_schema_view
from drf_yasg import openapi

schema_view = get_schema_view(
   openapi.Info(
      title="Intelligent Personalized Email Marketing API",
      default_version='v1.0',
      description="API documentation for the Email Marketing System MVP",
      # terms_of_service="https://www.example.com/policies/terms/", # Optional
      # contact=openapi.Contact(email="contact@example.com"), # Optional
      # license=openapi.License(name="BSD License"), # Optional
   ),
   public=True, # Set to False if you want to restrict access to logged-in users
   permission_classes=(permissions.AllowAny,), # Or permissions.IsAuthenticated for restricted access
)

urlpatterns = [
    path('admin/', admin.site.urls),
    path('api-auth/', include('rest_framework.urls', namespace='rest_framework')),

    # Application API URLs
    path('api/contacts/', include('contacts_api.urls')),
    path('api/templates/', include('templates_api.urls')),
    path('api/ai/', include('ai_proxy.urls')),
    path('api/campaigns/', include('campaigns_api.urls')),

    # API Documentation URLs
    path('swagger<format>/', schema_view.without_ui(cache_timeout=0), name='schema-json'), # .json, .yaml
    path('swagger/', schema_view.with_ui('swagger', cache_timeout=0), name='schema-swagger-ui'),
    path('redoc/', schema_view.with_ui('redoc', cache_timeout=0), name='schema-redoc'),
]
