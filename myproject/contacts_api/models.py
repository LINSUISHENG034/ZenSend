from django.db import models
from django.contrib.auth.models import User
from django.utils import timezone

class Contact(models.Model):
    owner = models.ForeignKey(User, on_delete=models.CASCADE, related_name='contacts')
    email = models.CharField(max_length=255, unique=True)
    first_name = models.CharField(max_length=100, blank=True, null=True)
    last_name = models.CharField(max_length=100, blank=True, null=True)
    # For databases that don't support JSONField natively (like SQLite before 3.37 or MySQL < 5.7.8)
    # consider using TextField with json.dumps/loads or a third-party package.
    # However, modern Django with PostgreSQL or newer SQLite/MySQL versions supports JSONField directly.
    custom_fields = models.JSONField(blank=True, null=True)
    created_at = models.DateTimeField(auto_now_add=True)
    # updated_at = models.DateTimeField(auto_now=True) # Optional: if you want to track updates

    def __str__(self):
        return f"{self.first_name} {self.last_name}" if self.first_name and self.last_name else self.email

    class Meta:
        ordering = ['-created_at']
        # Add any other meta options if needed, e.g., unique_together constraints
        # unique_together = [['owner', 'email']] # If email should be unique per owner instead of globally
        pass
