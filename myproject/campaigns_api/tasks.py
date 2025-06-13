from celery import shared_task
from django.apps import apps
import time
from django.utils import timezone
# from django.core.mail import send_mail
# from django.conf import settings
from django.template import Template, Context # For Django templating
from .models import CampaignAnalytics # Import CampaignAnalytics model

@shared_task(bind=True, name='send_campaign_task')
def send_campaign_task(self, campaign_id):
    """
    Celery task to send an email campaign.
    Handles fetching campaign, template, recipients, rendering, and mock sending.
    """
    Campaign = apps.get_model('campaigns_api', 'Campaign')
    Contact = apps.get_model('contacts_api', 'Contact')
    # EmailTemplate model is already imported by Campaign model, but explicit is fine if needed elsewhere
    # EmailTemplate = apps.get_model('templates_api', 'EmailTemplate')

    try:
        campaign = Campaign.objects.get(id=campaign_id)

        # Check initial status. If it's scheduled and not yet time, task could reschedule itself or simply exit.
        # For this MVP, we assume if the task is called, it's intended to run or start running.
        if campaign.status == 'scheduled':
            if campaign.scheduled_at and campaign.scheduled_at > timezone.now():
                # This case should ideally be handled by Celery's ETA.
                # If called prematurely, reschedule or log. For now, we'll proceed as if it's time.
                print(f"Campaign {campaign_id} is scheduled for the future ({campaign.scheduled_at}), but task called. Proceeding.")
        elif campaign.status not in ['draft', 'failed', 'sent_with_errors', 'queued']: # Valid states to start sending from
             print(f"Campaign {campaign_id} is in status '{campaign.status}' and cannot be sent by this task directly without intervention.")
             # Could raise an error or return a specific status.
             # For now, let's allow it to proceed but log this.
             # If it was 'sending' already, it might be a retry, which is complex. Let's assume fresh send.

        # Mark as 'sending'
        campaign.status = 'sending'
        campaign.sent_at = timezone.now() # Record when processing starts
        campaign.save(update_fields=['status', 'sent_at'])

        if not campaign.template:
            campaign.status = 'failed'
            campaign.save(update_fields=['status'])
            print(f"Campaign {campaign_id} failed: No template associated.")
            return f"Campaign {campaign_id} failed: No template."

        email_template_obj = campaign.template
        django_template = Template(email_template_obj.body_html)
        subject_template = Template(email_template_obj.subject)

        # Fetch recipients based on campaign.recipient_group
        recipients = []
        # Simplified recipient fetching logic for MVP
        if isinstance(campaign.recipient_group, dict):
            recipient_type = campaign.recipient_group.get("type")
            if recipient_type == "all_contacts":
                recipients = Contact.objects.filter(owner=campaign.owner)
            elif recipient_type == "specific_ids":
                contact_ids = campaign.recipient_group.get("ids", [])
                if not isinstance(contact_ids, list): # Basic validation
                     raise ValueError("contact_ids must be a list.")
                recipients = Contact.objects.filter(owner=campaign.owner, id__in=contact_ids)
            else: # Unknown type
                raise ValueError(f"Invalid recipient_group type: {recipient_type}")
        elif campaign.recipient_group == "all_contacts": # Legacy or simpler format
             recipients = Contact.objects.filter(owner=campaign.owner)
        else:
            raise ValueError(f"Unsupported recipient_group format: {campaign.recipient_group}")


        if not recipients.exists(): # Querysets are lazy, check existence
            campaign.status = 'failed'
            campaign.save(update_fields=['status'])
            print(f"Campaign {campaign_id} failed: No recipients found for criteria {campaign.recipient_group}.")
            return f"Campaign {campaign_id} failed: No recipients found."

        successful_sends = 0
        failed_sends = 0

        for contact in recipients:
            try:
                # Ensure custom_fields is a dict, even if null/None from DB
                contact_custom_fields = contact.custom_fields if isinstance(contact.custom_fields, dict) else {}

                context_data = {
                    'first_name': contact.first_name or "", # Ensure no None in template context
                    'last_name': contact.last_name or "",
                    'email': contact.email,
                    'custom_fields': contact_custom_fields
                }
                # For accessing custom fields like {{ custom_fields.phone }}
                # Ensure your Template context handles dot notation for dicts or use a custom context object.
                # Django's default Context handles this.
                context = Context(context_data)

                html_content = django_template.render(context)
                subject_content = subject_template.render(context).strip() # Remove leading/trailing whitespace/newlines

                # MOCK EMAIL SENDING:
                print(f"Mock Sending Email to: {contact.email} for Campaign ID: {campaign.id}")
                print(f"Owner: {campaign.owner.username}")
                print(f"Subject: {subject_content}")
                # print(f"Rendered Body (first 100 chars): {html_content[:100]}...") # Keep log concise

                # Placeholder for actual email sending:
                # send_mail(
                #     subject_content,
                #     "", # Plain text version - could be generated or omitted
                #     settings.DEFAULT_FROM_EMAIL, # From email
                #     [contact.email], # To email
                #     html_message=html_content
                # )

                # MOCK SES Message ID - in a real scenario, this comes from SES response
                mock_ses_message_id = f"mock_ses_{campaign.id}_{contact.id}_{int(time.time())}"

                CampaignAnalytics.objects.create(
                    campaign=campaign,
                    contact=contact,
                    ses_message_id=mock_ses_message_id,
                    event_type='sent', # This is our internal 'sent to SES' event
                    event_timestamp=timezone.now(), # Timestamp of this event
                    details={'info': 'Email processed by Celery task and mock sent to SES.', 'subject': subject_content}
                )
                print(f"Mock sent email to {contact.email} for campaign {campaign_id} with mock_ses_message_id: {mock_ses_message_id}")
                successful_sends += 1

                # In a real scenario, add a small delay or use batching if send_mail is synchronous
                # time.sleep(0.05) # 50ms per email, 20 emails/sec

            except Exception as e:
                print(f"Failed to process or mock send to {contact.email} for campaign {campaign_id}: {str(e)}")
                # Log internal failure before SES
                CampaignAnalytics.objects.create(
                    campaign=campaign,
                    contact=contact,
                    event_type='failed_to_send',
                    event_timestamp=timezone.now(),
                    details={'error': str(e), 'subject': subject_content if 'subject_content' in locals() else 'N/A'}
                )
                failed_sends += 1

        # Update campaign status based on outcomes
        if failed_sends > 0 and successful_sends > 0:
            campaign.status = 'sent_with_errors'
        elif successful_sends > 0 and failed_sends == 0:
            campaign.status = 'sent'
        else: # All failed or no recipients processed successfully
            campaign.status = 'failed'

        # sent_at was already set when 'sending' status began.
        # If you want to record completion time, add another field e.g., `completed_at`.
        campaign.save(update_fields=['status'])

        summary_msg = f"Campaign {campaign_id} processing complete. Successful: {successful_sends}, Failed: {failed_sends}"
        print(summary_msg)
        return summary_msg

    except Campaign.DoesNotExist:
        print(f"Campaign {campaign_id} not found during task execution.")
        # No re-raise here, as the task itself completed, but the target was gone.
        return f"Campaign {campaign_id} not found."
    except ValueError as ve: # Catch specific validation errors like bad recipient_group
        print(f"ValueError in send_campaign_task for campaign {campaign_id}: {str(ve)}")
        if 'campaign' in locals() and campaign:
            campaign.status = 'failed'
            campaign.save(update_fields=['status'])
        # Don't update Celery state to FAILURE for data validation issues, let it be SUCCESS with error message.
        return f"Campaign {campaign_id} failed due to data error: {str(ve)}"
    except Exception as e:
        print(f"General error in send_campaign_task for campaign {campaign_id}: {str(e)}")
        if 'campaign' in locals() and campaign:
            campaign.status = 'failed'
            campaign.save(update_fields=['status'])
        # Update Celery task state for unexpected errors
        self.update_state(state='FAILURE', meta={'exc_type': type(e).__name__, 'exc_message': str(e)})
        raise # Re-raise for Celery to mark as retryable or failed based on task settings.
