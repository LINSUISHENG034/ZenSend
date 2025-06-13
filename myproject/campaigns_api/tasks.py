from celery import shared_task
from django.apps import apps
import time
from django.utils import timezone
# from django.core.mail import send_mail
from django.conf import settings
from django.template import Template, Context # For Django templating
from .models import CampaignAnalytics # Import CampaignAnalytics model
import boto3
from botocore.exceptions import ClientError

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

        ses_client = boto3.client(
            'ses',
            region_name=settings.AWS_SES_REGION_NAME,
            aws_access_key_id=settings.AWS_ACCESS_KEY_ID,
            aws_secret_access_key=settings.AWS_SECRET_ACCESS_KEY
        )
        source_email = settings.DEFAULT_FROM_EMAIL # Or a campaign-specific from email if available

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

                try:
                    response = ses_client.send_email(
                        Source=source_email,
                        Destination={'ToAddresses': [contact.email]},
                        Message={
                            'Subject': {'Data': subject_content, 'Charset': 'UTF-8'},
                            'Body': {
                                'Html': {'Data': html_content, 'Charset': 'UTF-8'},
                                # Optionally, add a Text part:
                                # 'Text': {'Data': text_content, 'Charset': 'UTF-8'}
                            }
                        }
                        # Optionally, add ConfigurationSetName if using SES Configuration Sets
                        # ConfigurationSetName='your-config-set-name'
                    )
                    ses_message_id = response['MessageId']
                    # Create CampaignAnalytics record for 'sent'
                    CampaignAnalytics.objects.create(
                        campaign=campaign,
                        contact=contact,
                        ses_message_id=ses_message_id,
                        event_type='sent',
                        event_timestamp=timezone.now(),
                        details={'info': 'Email sent via AWS SES.', 'subject': subject_content, 'ses_response': response}
                    )
                    successful_sends += 1
                    print(f"Successfully sent email to {contact.email} for campaign {campaign.id} via SES. Message ID: {ses_message_id}")

                except ClientError as e:
                    error_message = e.response.get('Error', {}).get('Message', str(e))
                    error_code = e.response.get('Error', {}).get('Code', 'UnknownError')
                    print(f"Failed to send email to {contact.email} via SES: {error_code} - {error_message}")
                    # Log SES failure specifically
                    CampaignAnalytics.objects.create(
                        campaign=campaign,
                        contact=contact,
                        event_type='failed_to_send_ses', # More specific error type
                        event_timestamp=timezone.now(),
                        details={'error': error_message, 'error_code': error_code, 'subject': subject_content}
                    )
                    failed_sends += 1
                except Exception as e: # Catch other unexpected errors during SES call or analytics creation
                    print(f"General error sending to {contact.email} or logging analytics: {str(e)}")
                    # Log internal failure before SES or if analytics creation failed post-send
                    CampaignAnalytics.objects.create(
                        campaign=campaign,
                        contact=contact,
                        event_type='failed_to_send', # General pre-SES or post-SES failure
                        event_timestamp=timezone.now(),
                        details={'error': str(e), 'subject': subject_content}
                    )
                    failed_sends += 1

            except Exception as e: # This outer exception block now primarily catches template rendering errors
                print(f"Failed to process or send to {contact.email} for campaign {campaign_id}: {str(e)}")
                # Log internal failure (e.g. template rendering)
                CampaignAnalytics.objects.create(
                    campaign=campaign,
                    contact=contact, # contact might not be defined if error is before loop
                    event_type='failed_to_send', # General pre-SES failure
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
