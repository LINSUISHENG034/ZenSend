from django.db import models
from django.contrib.auth.models import User
from django.utils import timezone

class EmailTemplate(models.Model):
    owner = models.ForeignKey(User, on_delete=models.CASCADE, related_name='email_templates')
    name = models.CharField(max_length=255)
    subject = models.CharField(max_length=255)
    body_html = models.TextField() # Stores HTML content, possibly with template variables
    created_at = models.DateTimeField(auto_now_add=True)
    # updated_at = models.DateTimeField(auto_now=True) # Optional

    def __str__(self):
        return f"{self.name} (Owner: {self.owner.username})"

    class Meta:
        ordering = ['-created_at']
        unique_together = [['owner', 'name']] # Template name should be unique per owner
        verbose_name = "Email Template"
        verbose_name_plural = "Email Templates"
