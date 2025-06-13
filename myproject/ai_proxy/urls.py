from django.urls import path
from .views import AIGenerateView

urlpatterns = [
    path('generate/', AIGenerateView.as_view(), name='ai-generate'),
]
