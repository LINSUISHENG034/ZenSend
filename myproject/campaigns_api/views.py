from rest_framework import viewsets, permissions, status
from rest_framework.views import APIView # Import APIView for the webhook
from rest_framework.decorators import action
from rest_framework.response import Response
import json # For parsing request body if it's raw JSON
import logging # For logging webhook requests
from django.utils import timezone
from django.conf import settings
import requests
import base64
from urllib.parse import urlparse
# Imports for cryptography based RSA signature verification
from cryptography import x509
from cryptography.hazmat.primitives import hashes
from cryptography.hazmat.primitives.asymmetric import padding
from cryptography.hazmat.backends import default_backend
from cryptography.exceptions import InvalidSignature
import binascii # For base64 decoding error handling

from .models import Campaign, CampaignAnalytics # Import CampaignAnalytics
from contacts_api.models import Contact # Import Contact model
from .serializers import CampaignSerializer
# from ..templates_api.models import EmailTemplate # If needed
from django.db.models import Count, Q # For campaign_stats action

from .tasks import send_campaign_task # Import the Celery task

logger = logging.getLogger(__name__) # Standard Python logger

class CampaignViewSet(viewsets.ModelViewSet):
    """
    API endpoint that allows campaigns to be viewed or edited.
    """
    serializer_class = CampaignSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        """
        This view should return a list of all the campaigns
        for the currently authenticated user.
        """
        return Campaign.objects.filter(owner=self.request.user).order_by('-created_at')

    def perform_create(self, serializer):
        """
        Save the owner of the campaign as the current logged-in user.
        """
        # You can add more logic here, e.g., validating recipient_group,
        # or ensuring template exists and belongs to user if template_id is passed.
        # The serializer's validate_template_id already handles template ownership.
        serializer.save(owner=self.request.user)

    @action(detail=True, methods=['post'], url_path='send-now', permission_classes=[permissions.IsAuthenticated])
    def send_now(self, request, pk=None):
        """
        Custom action to trigger sending a campaign immediately.
        (Later, this will enqueue a Celery task)
        """
        campaign = self.get_object()

        # Define permissible statuses for immediate sending
        # 'scheduled' is included if user wants to send a scheduled campaign *now* instead of waiting.
        # 'sent_with_errors' could be a valid state for retrying.
        permissible_statuses = ['draft', 'failed', 'sent_with_errors', 'scheduled']

        if campaign.status not in permissible_statuses:
            return Response(
                {'error': f'Campaign in status "{campaign.get_status_display()}" cannot be sent immediately.'},
                status=status.HTTP_400_BAD_REQUEST
            )

        if not campaign.template:
            return Response(
                {'error': 'Campaign must have an associated email template before sending.'},
                status=status.HTTP_400_BAD_REQUEST
            )

        # Enqueue the Celery task
        send_campaign_task.delay(campaign.id)

        # Update campaign status to 'queued' or 'sending'
        # 'queued' indicates it's in the Celery queue. The task itself will set it to 'sending'.
        campaign.status = 'queued'
        # If it was previously scheduled, clear scheduled_at as it's being sent now.
        if campaign.scheduled_at:
            campaign.scheduled_at = None
        campaign.save(update_fields=['status', 'scheduled_at'])

        return Response(
            {'message': f"Campaign '{campaign.name}' has been queued for sending."},
            status=status.HTTP_200_OK
        )

    @action(detail=True, methods=['post'], url_path='schedule', permission_classes=[permissions.IsAuthenticated])
    def schedule_campaign(self, request, pk=None):
        """
        Custom action to schedule a campaign for a specific time.
        """
        campaign = self.get_object()
        scheduled_at_str = request.data.get('scheduled_at')

        if not scheduled_at_str:
            return Response({'error': 'scheduled_at is required.'}, status=status.HTTP_400_BAD_REQUEST)

        try:
            # Attempt to parse the datetime string. Frontend should send ISO format.
            scheduled_time = timezone.datetime.fromisoformat(scheduled_at_str)
            if scheduled_time.tzinfo is None: # Ensure it's timezone-aware
                 scheduled_time = timezone.make_aware(scheduled_time, timezone.get_current_timezone())

        except ValueError:
            return Response({'error': 'Invalid datetime format for scheduled_at. Use ISO format.'}, status=status.HTTP_400_BAD_REQUEST)

        if scheduled_time <= timezone.now():
            return Response({'error': 'Scheduled time must be in the future.'}, status=status.HTTP_400_BAD_REQUEST)

        if campaign.status not in ['draft', 'failed']:
             return Response(
                {'error': f'Campaign in status "{campaign.get_status_display()}" cannot be scheduled.'},
                status=status.HTTP_400_BAD_REQUEST
            )

        if not campaign.template:
            return Response(
                {'error': 'Campaign must have an associated email template before scheduling.'},
                status=status.HTTP_400_BAD_REQUEST
            )

        campaign.scheduled_at = scheduled_time
        campaign.status = 'scheduled'
        campaign.save(update_fields=['scheduled_at', 'status'])

        # Schedule the Celery task with ETA
        send_campaign_task.apply_async((campaign.id,), eta=scheduled_time)

        return Response(
            {'message': f"Campaign '{campaign.name}' has been scheduled for {campaign.scheduled_at} and task enqueued with ETA."},
            status=status.HTTP_200_OK
        )

    # Add other actions as needed, e.g., cancel_scheduled_campaign, clone_campaign
    @action(detail=True, methods=['post'], url_path='cancel-schedule', permission_classes=[permissions.IsAuthenticated])
    def cancel_schedule(self, request, pk=None):
        campaign = self.get_object()
        if campaign.status != 'scheduled': # Only scheduled campaigns can be unscheduled
            return Response({'error': 'Campaign is not currently in a scheduled state.'}, status=status.HTTP_400_BAD_REQUEST)

        # To revoke a task scheduled with ETA, you need its task ID.
        # This requires storing the task ID when the campaign is scheduled.
        # For simplicity in this MVP, we are not revoking the Celery task.
        # In a real system, you would:
        # 1. Store `task_id = send_campaign_task.apply_async(...).id` on the campaign model.
        # 2. When cancelling, retrieve this `task_id` and call `celery_app.control.revoke(task_id)`.
        # For now, we'll just change the status and clear scheduled_at. The task might still run
        # but could check the campaign status at execution time and abort if not 'scheduled'.
        # The send_campaign_task was modified to check status.

        campaign.scheduled_at = None
        campaign.status = 'draft' # Revert to draft (or original status before scheduling)
        campaign.save(update_fields=['scheduled_at', 'status'])

        # Note: Revoking task is not implemented here for simplicity.
        # If task runs, it should check campaign status.
        return Response({'message': 'Campaign schedule has been cancelled. (Note: Celery task revocation not implemented for this MVP)'}, status=status.HTTP_200_OK)

    @action(detail=True, methods=['get'], url_path='stats')
    def campaign_stats(self, request, pk=None):
        campaign = self.get_object()

        # Total emails for which a 'sent' event was recorded by our system.
        # This counts unique contacts to whom the email was marked as 'sent' by our task.
        total_sent_contacts_qs = CampaignAnalytics.objects.filter(
            campaign=campaign,
            event_type='sent' # 'sent' by our system to SES (or mock)
        ).values('contact_id').distinct()
        total_sent_count = total_sent_contacts_qs.count()

        if total_sent_count == 0:
            return Response({
                'campaign_id': campaign.id,
                'campaign_name': campaign.name,
                'total_sent': 0,
                'total_delivered': 0,
                'total_opened': 0,
                'total_clicked': 0,
                'total_bounced': 0,
                'open_rate_on_sent': 0,
                'click_rate_on_sent': 0,
                'click_rate_on_opened': 0,
                'bounce_rate_on_sent': 0,
                'message': 'No emails recorded as sent for this campaign.'
            }, status=status.HTTP_200_OK) # Still 200 OK, just no data.

        # Total unique contacts for whom a 'delivered' event was recorded by SES
        total_delivered_contacts_qs = CampaignAnalytics.objects.filter(
            campaign=campaign,
            event_type='delivered'
        ).values('contact_id').distinct()
        total_delivered_count = total_delivered_contacts_qs.count()

        # Total unique contacts who opened for this campaign
        total_opened_contacts_qs = CampaignAnalytics.objects.filter(
            campaign=campaign,
            event_type='opened'
        ).values('contact_id').distinct()
        total_opened_count = total_opened_contacts_qs.count()

        # Total unique contacts who clicked for this campaign
        total_clicked_contacts_qs = CampaignAnalytics.objects.filter(
            campaign=campaign,
            event_type='clicked'
        ).values('contact_id').distinct()
        total_clicked_count = total_clicked_contacts_qs.count()

        # Total unique contacts who bounced
        total_bounced_count = CampaignAnalytics.objects.filter(
            campaign=campaign,
            event_type='bounced'
        ).values('contact_id').distinct().count()

        # Calculate rates
        # Base for open/click rates can be 'sent' or 'delivered'.
        # Using 'sent' (our system's attempt to send) as the primary base for now.
        base_for_rates = total_sent_count

        open_rate_on_sent = (total_opened_count / base_for_rates) * 100 if base_for_rates > 0 else 0
        click_rate_on_sent = (total_clicked_count / base_for_rates) * 100 if base_for_rates > 0 else 0

        # Click rate based on opens (CTR of those who opened)
        click_rate_on_opened = (total_clicked_count / total_opened_count) * 100 if total_opened_count > 0 else 0

        bounce_rate_on_sent = (total_bounced_count / base_for_rates) * 100 if base_for_rates > 0 else 0

        # Delivery rate based on sent (optional, good to show)
        delivery_rate_on_sent = (total_delivered_count / base_for_rates) * 100 if base_for_rates > 0 else 0


        return Response({
            'campaign_id': campaign.id,
            'campaign_name': campaign.name,
            'total_sent': total_sent_count,          # Emails our system attempted to send via Celery task
            'total_delivered': total_delivered_count,  # Confirmed deliveries from SES
            'total_opened': total_opened_count,        # Unique opens
            'total_clicked': total_clicked_count,      # Unique clicks
            'total_bounced': total_bounced_count,      # Unique bounces
            'delivery_rate_on_sent': round(delivery_rate_on_sent, 2),
            'open_rate_on_sent': round(open_rate_on_sent, 2),
            'click_rate_on_sent': round(click_rate_on_sent, 2),
            'click_rate_on_opened': round(click_rate_on_opened, 2), # Often called Click-to-Open Rate (CTOR)
            'bounce_rate_on_sent': round(bounce_rate_on_sent, 2),
        }, status=status.HTTP_200_OK)


class SESWebhookView(APIView):
    """
    Handles incoming webhook notifications from AWS SES.
    This typically involves:
    1. SNS Subscription Confirmation (if using SNS for notifications).
    2. Receiving event data (bounce, complaint, delivery, open, click).
    """
    permission_classes = [permissions.AllowAny] # Webhook must be publicly accessible
    _cert_cache = {} # Simple in-memory cache for certificates

    def _build_canonical_message(self, payload):
        """
        Builds the canonical message string for SNS signature verification.
        Order of keys and inclusion of fields depends on the message type.
        """
        message_type = payload.get('Type')
        if not message_type:
            logger.error("SNS Webhook: 'Type' missing in payload for canonical message construction.")
            return None

        fields_to_sign = []
        if message_type == 'Notification':
            # Order for Notification: Message, MessageId, Subject (if present), Timestamp, TopicArn, Type
            keys_in_order = ['Message', 'MessageId', 'Subject', 'Timestamp', 'TopicArn', 'Type']
        elif message_type in ['SubscriptionConfirmation', 'UnsubscribeConfirmation']:
            # Order for SubscriptionConfirmation/UnsubscribeConfirmation:
            # Message, MessageId, SubscribeURL, Timestamp, Token, TopicArn, Type
            keys_in_order = ['Message', 'MessageId', 'SubscribeURL', 'Timestamp', 'Token', 'TopicArn', 'Type']
        else:
            logger.error(f"SNS Webhook: Unknown message type '{message_type}' for canonical message construction.")
            return None

        canonical_parts = []
        for key in keys_in_order:
            if key in payload and payload[key] is not None:
                if key == 'Subject' and message_type != 'Notification': # Subject only for Notification
                    continue
                canonical_parts.append(f"{key}\n{payload[key]}\n")
            elif key not in ['Subject', 'Token']: # These fields can be optional
                logger.warning(f"SNS Webhook: Key '{key}' missing in payload for canonical message construction of type '{message_type}'.")
                # Depending on strictness, might return None here if a required key is missing.
                # For now, we allow optional fields like Subject or Token to be missing.
                # If a truly required field (e.g. MessageId, TopicArn) is missing, SNS likely wouldn't send it or it's malformed.

        return "".join(canonical_parts)

    def _verify_sns_message_signature(self, payload):
        cert_url = payload.get('SigningCertURL')
        if not cert_url:
            logger.error("SNS Webhook: No SigningCertURL in payload.")
            return False

        parsed_url = urlparse(cert_url)
        # Validate domain and path more strictly
        if not (parsed_url.scheme == 'https' and
                parsed_url.hostname.endswith('.amazonaws.com') and
                # Example: sns.us-west-2.amazonaws.com or sns-regional.amazonaws.com
                # Ensure it's a valid SNS domain pattern. A simple check for .amazonaws.com and .pem is a start.
                # More specific regex could be used: r"sns\.[a-zA-Z0-9\-]+\.amazonaws\.com(\.cn)?"
                # For now, keeping it simple:
                parsed_url.hostname.startswith('sns.') and
                parsed_url.path.endswith('.pem')):
            logger.error(f"SNS Webhook: Invalid SigningCertURL: {cert_url}")
            return False

        topic_arn = payload.get('TopicArn')
        allowed_topic_arn = getattr(settings, 'ALLOWED_SNS_TOPIC_ARN', None)
        if allowed_topic_arn and topic_arn != allowed_topic_arn:
            logger.error(f"SNS Webhook: Message from unexpected TopicArn '{topic_arn}'. Expected '{allowed_topic_arn}'.")
            return False

        try:
            if cert_url in self._cert_cache:
                cert_pem = self._cert_cache[cert_url]
                logger.debug(f"SNS Webhook: Using cached certificate for {cert_url}")
            else:
                logger.debug(f"SNS Webhook: Fetching certificate from {cert_url}")
                response = requests.get(cert_url, timeout=5)
                response.raise_for_status()
                cert_pem = response.text
                self._cert_cache[cert_url] = cert_pem

            # Load the PEM certificate
            cert = x509.load_pem_x509_certificate(cert_pem.encode('utf-8'), default_backend())

            # Get the public key from the certificate
            public_key = cert.public_key()

            # Construct the canonical message
            canonical_message = self._build_canonical_message(payload)
            if canonical_message is None: # If _build_canonical_message returned None due to missing fields
                logger.error("SNS Webhook: Failed to build canonical message for signature verification.")
                return False

            # Decode the Base64-encoded signature
            signature_base64 = payload.get('Signature')
            if not signature_base64:
                logger.error("SNS Webhook: No Signature in payload.")
                return False
            try:
                signature_decoded = base64.b64decode(signature_base64)
            except binascii.Error as e: # More specific exception for base64 decoding
                logger.error(f"SNS Webhook: Failed to Base64 decode signature: {str(e)}")
                return False

            # Verify the signature
            signature_verified = False
            algorithms_to_try = [
                (hashes.SHA256(), "SHA256withRSA"), # Try SHA256 first as it's more secure
                (hashes.SHA1(), "SHA1withRSA")      # Fallback to SHA1
            ]

            for hash_algorithm, algo_name in algorithms_to_try:
                try:
                    public_key.verify(
                        signature_decoded,
                        canonical_message.encode('utf-8'),
                        padding.PKCS1v15(),
                        hash_algorithm
                    )
                    signature_verified = True
                    logger.info(f"SNS Webhook: Signature verified successfully using {algo_name}.")
                    break # Exit loop on successful verification
                except InvalidSignature:
                    logger.warning(f"SNS Webhook: {algo_name} signature verification failed.")
                except Exception as e: # Other crypto-related errors
                    logger.error(f"SNS Webhook: Unexpected error during {algo_name} signature verification: {str(e)}")
                    # Depending on the error, might want to stop or try next algo. For now, continue.

            if not signature_verified:
                logger.error("SNS Webhook: Signature verification failed for all attempted algorithms.")
            return signature_verified

        except requests.exceptions.RequestException as e:
            logger.error(f"SNS Webhook: Failed to fetch SigningCertURL {cert_url}: {str(e)}")
            return False
        except ValueError as e: # Catches errors from load_pem_x509_certificate if cert is malformed
            logger.error(f"SNS Webhook: Failed to load certificate from {cert_url}: {str(e)}")
            return False
        except Exception as e:
            logger.error(f"SNS Webhook: Unexpected error during signature verification process: {str(e)}")
            return False


    def post(self, request, *args, **kwargs):
        try:
            # SNS usually sends JSON as text/plain, so we decode and parse.
            payload = json.loads(request.body.decode('utf-8'))
        except json.JSONDecodeError:
            logger.error("SES Webhook: Invalid JSON in request body.")
            return Response({"error": "Invalid JSON format."}, status=status.HTTP_400_BAD_REQUEST)
        except Exception as e: # Catch other potential errors during body decoding
            logger.error(f"SES Webhook: Error decoding request body: {str(e)}")
            return Response({"error": "Error decoding request body."}, status=status.HTTP_400_BAD_REQUEST)

        # Log raw payload after successful parsing for debugging if needed
        # logger.debug(f"SES Webhook Payload (parsed): {payload}")

        # Verify SNS message signature
        if not self._verify_sns_message_signature(payload):
            logger.error("SES Webhook: SNS message signature verification failed. Rejecting request.")
            return Response({"error": "SNS signature verification failed. Message rejected."}, status=status.HTTP_403_FORBIDDEN) # 403 Forbidden is appropriate

        logger.info("SES Webhook: SNS message signature verified successfully.")
        message_type = payload.get('Type')

        if message_type == 'SubscriptionConfirmation':
            subscribe_url = payload.get('SubscribeURL')
            if not subscribe_url:
                logger.error("SNS Webhook: No SubscribeURL in SubscriptionConfirmation.")
                return Response({"error": "No SubscribeURL found."}, status=status.HTTP_400_BAD_REQUEST)

            parsed_subscribe_url = urlparse(subscribe_url)
            if not (parsed_subscribe_url.scheme == 'https' and parsed_subscribe_url.hostname.endswith('.amazonaws.com')):
                logger.error(f"SNS Webhook: Invalid SubscribeURL domain: {subscribe_url}")
                return Response({"error": "Invalid SubscribeURL domain."}, status=status.HTTP_400_BAD_REQUEST)

            logger.info(f"SES Webhook: Received SNS SubscriptionConfirmation. Attempting to confirm: {subscribe_url}")
            try:
                response = requests.get(subscribe_url, timeout=10) # Increased timeout slightly
                response.raise_for_status() # Raise an exception for HTTP errors (4xx or 5xx)
                logger.info(f"SNS Subscription successfully confirmed. Status: {response.status_code}, Content: {response.text[:200]}")
                return Response({'message': 'SNS SubscriptionConfirmation received and confirmed.'}, status=status.HTTP_200_OK)
            except requests.exceptions.RequestException as e:
                logger.error(f"SNS Subscription confirmation failed for {subscribe_url}: {str(e)}")
                # Return 500 as it's an issue on our side (failing to confirm) or AWS side.
                return Response({'message': f'SNS SubscriptionConfirmation received but confirmation request failed: {str(e)}'}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

        elif message_type == 'Notification':
            # This is an actual event notification (bounce, delivery, etc.)
                # The actual event data is typically in a JSON string within payload['Message']
                try:
                    message_data_str = payload.get('Message', '{}')
                    message_data = json.loads(message_data_str)

                    event_type_ses = message_data.get('eventType') # e.g., "Bounce", "Delivery", "Open", "Click"
                    mail_data = message_data.get('mail', {})
                    ses_message_id = mail_data.get('messageId')

                    logger.info(f"SES Webhook: Received SNS Notification. Type: {event_type_ses}, SES Message ID: {ses_message_id}")
                    # Log the full message_data for now. Processing will be in Task 4.2.
                    logger.debug(f"Full SES Event Data: {message_data}")

                    # Placeholder for actual processing (Task 4.2)
                    # process_ses_event.delay(event_type_ses, ses_message_id, message_data) # This would be a Celery task
                    self.process_ses_event(message_data) # Direct call for now

                except json.JSONDecodeError:
                    logger.error("SES Webhook: Invalid JSON in SNS Message field.")
                    return Response({"error": "Invalid JSON in SNS Message."}, status=status.HTTP_400_BAD_REQUEST)
                except Exception as e: # Catch other errors during Message processing
                    logger.error(f"SES Webhook: Error processing SNS Message: {str(e)}")
                    return Response({"error": f"Error processing SNS Message: {str(e)}"}, status=status.HTTP_400_BAD_REQUEST)

                return Response({'message': 'SNS Notification received and processed.'}, status=status.HTTP_200_OK)

        else:
            # This might be a direct SES event (not via SNS) or an unknown type
            # Direct SES events (e.g. via Configuration Set -> HTTPS endpoint) have a different structure
            # and don't use the SNS 'Type' or 'Message' fields in the same way.
            # For this MVP, we'll assume SNS notifications as they are common.
            # If direct HTTPS, the payload itself is the event data.
            logger.warning(f"SES Webhook: Received unknown message type or direct SES event: {payload}")
            # Log the payload for now. Processing will be in Task 4.2.
            # process_direct_ses_event.delay(payload)
            try:
                return Response({'message': 'Payload received and logged (type unknown or direct SES event).'}, status=status.HTTP_200_OK)

            except Exception as e:
                logger.error(f"SES Webhook: Unhandled error: {str(e)}")
                return Response({"error": "An unexpected error occurred."}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

    def process_ses_event(self, event_data):
        """
        Processes the content of an SES event notification (from the 'Message' field of an SNS notification).
        Creates or updates CampaignAnalytics records.
        """
        ses_event_type = event_data.get('eventType')
        mail_data = event_data.get('mail', {})
        ses_message_id = mail_data.get('messageId')
        ses_timestamp_str = mail_data.get('timestamp') # SES timestamp for the event

        if not ses_message_id:
            logger.error("SES Event Processing: No ses_message_id found in event_data.")
            return

        # Convert SES event type to our internal event_type
        # This mapping needs to be robust.
        internal_event_type_map = {
            'Send': 'sent', # Note: Our 'sent' is pre-SES. SES 'Send' is actual attempt by SES.
                            # We might not use SES 'Send' if we create our 'sent' record from the task.
            'Delivery': 'delivered',
            'Bounce': 'bounced',
            'Open': 'opened',
            'Click': 'clicked',
            'Complaint': 'complaint',
            'Reject': 'rejected',
            # Add any other SES event types you handle
        }
        internal_event_type = internal_event_type_map.get(ses_event_type)

        if not internal_event_type:
            logger.warning(f"SES Event Processing: Unknown SES eventType '{ses_event_type}'. Skipping.")
            return

        try:
            # Try to find the original 'sent' record to link campaign and contact
            # This assumes 'send_campaign_task' created a 'sent' event with this ses_message_id
            original_sent_event = CampaignAnalytics.objects.filter(
                ses_message_id=ses_message_id,
                # event_type='sent' # Or, if SES 'Send' is the first event we rely on from webhook
            ).first() # Get the first one if multiple (should not happen for 'sent' with unique ses_message_id)


            if not original_sent_event:
                # This case means SES sent an event for a messageId we don't have a 'sent' record for.
                # This could happen if:
                # 1. Our 'send_campaign_task' failed to record the 'sent' event.
                # 2. The messageId is from a source outside our app (e.g., direct SES console send).
                # 3. There's a significant delay and the webhook arrives before our task commits. (Less likely with Celery)
                # For now, we log this. In a more complex system, you might try to deduce campaign/contact
                # from custom headers in mail_data.commonHeaders if you set them.
                logger.warning(f"SES Event Processing: No initial 'sent' record found for ses_message_id '{ses_message_id}'. Cannot associate event '{internal_event_type}'.")
                # Potentially create an orphaned event if necessary for auditing, but it lacks context.
                return

            campaign_obj = original_sent_event.campaign
            contact_obj = original_sent_event.contact

            # Prepare details for the new analytics event
            event_details = {'ses_event': event_data} # Store the raw SES event for audit/details
            event_time = timezone.now() # Default to now
            if ses_timestamp_str:
                try:
                    # SES timestamp is like "2023-10-27T10:30:00.123Z"
                    event_time = timezone.datetime.fromisoformat(ses_timestamp_str.replace('Z', '+00:00'))
                except ValueError:
                    logger.warning(f"SES Event Processing: Could not parse SES timestamp '{ses_timestamp_str}'. Using current time.")

            # Create a new analytics record for this specific event type
            # The unique_together constraint in CampaignAnalytics model might need adjustment
            # if we expect multiple clicks for the same messageId, for example.
            # For now, assuming ('campaign', 'contact', 'event_type', 'ses_message_id') handles this.
            # If event_type + ses_message_id should be unique, then this create_or_update is better.

            analytics_event, created = CampaignAnalytics.objects.update_or_create(
                campaign=campaign_obj,
                contact=contact_obj,
                ses_message_id=ses_message_id,
                event_type=internal_event_type, # This makes a new record for each event type
                defaults={
                    'event_timestamp': event_time,
                    'details': event_data # Store the full event_data from SES
                }
            )

            if created:
                logger.info(f"SES Event Processing: Created new CampaignAnalytics record for event '{internal_event_type}', campaign '{campaign_obj.id}', contact '{contact_obj.id}'.")
            else:
                logger.info(f"SES Event Processing: Updated existing CampaignAnalytics record for event '{internal_event_type}', campaign '{campaign_obj.id}', contact '{contact_obj.id}'.")

            # Further actions based on event type (e.g., update contact's bounce status)
            if internal_event_type in ['bounced', 'complaint']:
                # Assuming Contact model has a field like `allow_email` (boolean) or `email_status` (char/int)
                # For this example, let's assume `allow_email` and set it to False.
                # This is a generic way to handle it. Specific fields like `is_bounced` or `has_complained`
                # could also be used if they exist on the Contact model.
                if hasattr(contact_obj, 'allow_email'):
                    contact_obj.allow_email = False
                    contact_obj.save(update_fields=['allow_email'])
                    logger.info(f"Contact {contact_obj.id} marked as allow_email=False due to {internal_event_type} event.")
                # else:
                #     logger.warning(f"Contact model does not have 'allow_email' field. Cannot update for {internal_event_type}.")

                # If you have specific fields:
                # if internal_event_type == 'bounced' and hasattr(contact_obj, 'is_bounced'):
                #     contact_obj.is_bounced = True
                #     contact_obj.save(update_fields=['is_bounced'])
                # if internal_event_type == 'complaint' and hasattr(contact_obj, 'has_complained'):
                #      contact_obj.has_complained = True
                #      contact_obj.save(update_fields=['has_complained'])


        except Exception as e:
            logger.error(f"SES Event Processing: Error processing event for ses_message_id '{ses_message_id}': {str(e)}", exc_info=True)
