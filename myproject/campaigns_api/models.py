from django.db import models
from django.contrib.auth.models import User
# Corrected import for EmailTemplate, assuming it's in templates_api.models
from templates_api.models import EmailTemplate
from contacts_api.models import Contact # Corrected import for Contact
from django.utils import timezone


class Campaign(models.Model):
    STATUS_CHOICES = [
        ('draft', 'Draft'),
        ('queued', 'Queued'), # Added Queued status
        ('sending', 'Sending'),
        ('sent', 'Sent'),
        ('sent_with_errors', 'Sent with Errors'), # Added for partial success
        ('failed', 'Failed'),
        ('scheduled', 'Scheduled'),
    ]

    owner = models.ForeignKey(User, on_delete=models.CASCADE, related_name='campaigns')
    name = models.CharField(max_length=255)
    template = models.ForeignKey(
        EmailTemplate,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='campaigns'
    )
    recipient_group = models.JSONField(default=dict, blank=True, null=True)
    status = models.CharField(
        max_length=20,
        choices=STATUS_CHOICES,
        default='draft'
    )
    scheduled_at = models.DateTimeField(null=True, blank=True)
    sent_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"{self.name} ({self.get_status_display()}) - Owner: {self.owner.username}"

    class Meta:
        ordering = ['-created_at']
        unique_together = [['owner', 'name']]
        verbose_name = "Campaign"
        verbose_name_plural = "Campaigns"

    def clean(self):
        if self.status == 'scheduled' and not self.scheduled_at:
            from django.core.exceptions import ValidationError
            raise ValidationError({'scheduled_at': 'Scheduled time must be set for scheduled campaigns.'})
        super().clean()


class CampaignAnalytics(models.Model):
    EVENT_TYPES = [
        ('sent', 'Sent'), # This would be an internal event when we hand off to SES
        ('delivered', 'Delivered'),
        ('bounced', 'Bounced'),
        ('opened', 'Opened'),
        ('clicked', 'Clicked'),
        ('complaint', 'Complaint'),
        ('rejected', 'Rejected'), # SES can reject before sending
        ('failed_to_send', 'Failed to Send'), # Our internal failure before SES attempt
    ]
    campaign = models.ForeignKey(Campaign, on_delete=models.CASCADE, related_name='analytics_events') # Changed related_name
    contact = models.ForeignKey(Contact, on_delete=models.CASCADE, related_name='campaign_interactions')
    ses_message_id = models.CharField(max_length=255, null=True, blank=True, db_index=True)
    event_type = models.CharField(max_length=20, choices=EVENT_TYPES)
    event_timestamp = models.DateTimeField(default=timezone.now) # Use default=timezone.now for flexibility
    details = models.JSONField(null=True, blank=True)

    # Specific timestamp fields for key positive events for easier querying, if needed.
    # These could also be derived from event_timestamp and event_type if details are always parsed.
    # opened_at = models.DateTimeField(null=True, blank=True)
    # clicked_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        # unique_together might be too restrictive if a contact can click multiple times (though event_type + ses_message_id should be unique for SES events)
        # A unique 'click' event might be defined by campaign, contact, and a specific URL in details.
        # For SES events, (ses_message_id, event_type) should be unique if ses_message_id is present.
        # Let's simplify for now, can be refined based on exact SES event structure.
        # unique_together = [['campaign', 'contact', 'event_type', 'ses_message_id']]
        indexes = [
            models.Index(fields=['campaign', 'contact', 'event_type']),
            models.Index(fields=['ses_message_id', 'event_type']),
        ]
        ordering = ['-event_timestamp']
        verbose_name = "Campaign Analytic Event"
        verbose_name_plural = "Campaign Analytic Events"

    def __str__(self):
        return f"{self.campaign.name} - {self.contact.email} - {self.get_event_type_display()}"
