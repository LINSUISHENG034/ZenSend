from django.urls import reverse
from django.utils import timezone
from rest_framework import status
from rest_framework.test import APITestCase, APIClient
from django.contrib.auth.models import User
from django.conf import settings
from unittest.mock import patch, MagicMock, ANY
import json
from botocore.exceptions import ClientError

from .models import Campaign, EmailTemplate, CampaignAnalytics
from contacts_api.models import Contact # Assuming Contact model is in contacts_api
from .tasks import send_campaign_task

class SendCampaignTaskTests(APITestCase):
    def setUp(self):
        self.owner = User.objects.create_user(username='taskuser', password='password123')
        self.template = EmailTemplate.objects.create(
            owner=self.owner,
            name='Test Template',
            subject='Test Subject {{first_name}}',
            body_html='<p>Hello {{first_name}} {{last_name}}, your email is {{email}}.</p><p>Custom: {{custom_fields.test_key}}</p>'
        )
        self.contact1 = Contact.objects.create(
            owner=self.owner,
            email='contact1@example.com',
            first_name='Contact',
            last_name='One',
            custom_fields={'test_key': 'value1'}
        )
        self.contact2 = Contact.objects.create(
            owner=self.owner,
            email='contact2@example.com',
            first_name='Contact',
            last_name='Two',
            custom_fields={'test_key': 'value2'}
        )
        self.campaign = Campaign.objects.create(
            owner=self.owner,
            name='Test Campaign Task',
            template=self.template,
            recipient_group={"type": "all_contacts"}, # Simplified for test
            status='draft'
        )

        # Ensure AWS settings are present for the task
        settings.AWS_SES_REGION_NAME = 'us-east-1'
        settings.AWS_ACCESS_KEY_ID = 'test_access_key'
        settings.AWS_SECRET_ACCESS_KEY = 'test_secret_key'
        settings.DEFAULT_FROM_EMAIL = 'test@example.com'


    @patch('campaigns_api.tasks.boto3.client')
    def test_send_campaign_task_success(self, mock_boto_client):
        mock_ses_instance = MagicMock()
        mock_ses_instance.send_email.return_value = {'MessageId': 'test-ses-id-123'}
        mock_boto_client.return_value = mock_ses_instance

        send_campaign_task(self.campaign.id)

        self.campaign.refresh_from_db()
        self.assertIn(self.campaign.status, ['sent', 'sent_with_errors']) # Task sets to 'sent' or 'sent_with_errors'

        self.assertEqual(mock_ses_instance.send_email.call_count, 2) # Two contacts

        # Check analytics for each contact
        self.assertTrue(CampaignAnalytics.objects.filter(campaign=self.campaign, contact=self.contact1, event_type='sent', ses_message_id='test-ses-id-123').exists())
        self.assertTrue(CampaignAnalytics.objects.filter(campaign=self.campaign, contact=self.contact2, event_type='sent', ses_message_id='test-ses-id-123').exists())

        # Verify email content for one call (example)
        first_call_args = mock_ses_instance.send_email.call_args_list[0][1] # keyword args of first call
        self.assertEqual(first_call_args['Source'], settings.DEFAULT_FROM_EMAIL)
        self.assertIn(self.contact1.email, first_call_args['Destination']['ToAddresses'])
        self.assertEqual(first_call_args['Message']['Subject']['Data'], f'Test Subject {self.contact1.first_name}')
        self.assertIn(f'<p>Hello {self.contact1.first_name} {self.contact1.last_name}, your email is {self.contact1.email}.</p>', first_call_args['Message']['Body']['Html']['Data'])
        self.assertIn(f'<p>Custom: {self.contact1.custom_fields["test_key"]}</p>', first_call_args['Message']['Body']['Html']['Data'])


    @patch('campaigns_api.tasks.boto3.client')
    def test_send_campaign_task_ses_client_error(self, mock_boto_client):
        mock_ses_instance = MagicMock()
        # Simulate ClientError for the first email, success for the second to test mixed results
        mock_ses_instance.send_email.side_effect = [
            ClientError({'Error': {'Code': 'MessageRejected', 'Message': 'Email address is blacklisted.'}}, 'send_email'),
            {'MessageId': 'test-ses-id-456'}
        ]
        mock_boto_client.return_value = mock_ses_instance

        send_campaign_task(self.campaign.id)

        self.campaign.refresh_from_db()
        self.assertEqual(self.campaign.status, 'sent_with_errors')

        self.assertEqual(mock_ses_instance.send_email.call_count, 2)

        # Check analytics for failure and success
        self.assertTrue(CampaignAnalytics.objects.filter(campaign=self.campaign, contact=self.contact1, event_type='failed_to_send_ses').exists())
        self.assertTrue(CampaignAnalytics.objects.filter(campaign=self.campaign, contact=self.contact2, event_type='sent', ses_message_id='test-ses-id-456').exists())


class SESWebhookViewTests(APITestCase):
    def setUp(self):
        self.client = APIClient()
        self.url = reverse('ses_webhook')
        self.owner = User.objects.create_user(username='webhookuser', password='password123')
        self.template = EmailTemplate.objects.create(owner=self.owner, name='Webhook Test Template', subject='Subject', body_html='Body')
        self.contact = Contact.objects.create(owner=self.owner, email='recipient@example.com')
        self.campaign = Campaign.objects.create(owner=self.owner, name='Webhook Test Campaign', template=self.template, recipient_group={'type': 'all_contacts'})
        self.ses_message_id = "test_ses_webhook_id_123"

        # Create an initial 'sent' record which webhook events will try to find
        CampaignAnalytics.objects.create(
            campaign=self.campaign,
            contact=self.contact,
            event_type='sent',
            ses_message_id=self.ses_message_id,
            details={'info': 'Initial sent record for webhook test'}
        )

    @patch('campaigns_api.views.SESWebhookView._verify_sns_message_signature', return_value=True)
    @patch('campaigns_api.views.requests.get')
    def test_subscription_confirmation_success(self, mock_requests_get, mock_verify_sig):
        mock_response = MagicMock()
        mock_response.status_code = 200
        mock_response.text = "Successfully confirmed subscription"
        mock_requests_get.return_value = mock_response

        payload = {
            "Type": "SubscriptionConfirmation",
            "TopicArn": "arn:aws:sns:us-east-1:123456789012:MyTopic",
            "Token": "some_token",
            "SubscribeURL": "https://sns.us-east-1.amazonaws.com/?Action=ConfirmSubscription&TopicArn=...&Token=...",
            "Message": "You have chosen to subscribe to the topic...",
            "MessageId": "unique_message_id_subscription",
            "Timestamp": timezone.now().isoformat()
        }
        response = self.client.post(self.url, json.dumps(payload), content_type='text/plain; charset=UTF-8')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        mock_requests_get.assert_called_once_with(payload['SubscribeURL'], timeout=10)

    @patch('campaigns_api.views.SESWebhookView._verify_sns_message_signature', return_value=True)
    def test_notification_processing_delivery(self, mock_verify_sig):
        event_payload = {
            "eventType": "Delivery",
            "mail": {
                "messageId": self.ses_message_id,
                "timestamp": timezone.now().isoformat(),
                "source": "test@example.com",
                "destination": [self.contact.email],
            },
            "delivery": {
                "timestamp": timezone.now().isoformat(),
                "processingTimeMillis": 1000,
                "recipients": [self.contact.email],
                "smtpResponse": "250 OK",
            }
        }
        sns_payload = {
            "Type": "Notification",
            "MessageId": "notification_message_id_delivery",
            "TopicArn": "arn:aws:sns:us-east-1:123456789012:MyTopic",
            "Message": json.dumps(event_payload),
            "Timestamp": timezone.now().isoformat(),
            "SignatureVersion": "1", # Required for canonical message
            # Signature and SigningCertURL are mocked by _verify_sns_message_signature
        }

        response = self.client.post(self.url, json.dumps(sns_payload), content_type='text/plain; charset=UTF-8')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertTrue(CampaignAnalytics.objects.filter(
            campaign=self.campaign,
            contact=self.contact,
            ses_message_id=self.ses_message_id,
            event_type='delivered'
        ).exists())

    @patch('campaigns_api.views.SESWebhookView._verify_sns_message_signature', return_value=True)
    def test_notification_processing_bounce(self, mock_verify_sig):
        event_payload = {
            "eventType": "Bounce",
            "bounce": {
                "bounceType": "Permanent",
                "bounceSubType": "General",
                "bouncedRecipients": [{"emailAddress": self.contact.email}],
                "timestamp": timezone.now().isoformat(),
            },
            "mail": {"messageId": self.ses_message_id, "timestamp": timezone.now().isoformat()}
        }
        sns_payload = {
            "Type": "Notification", "MessageId": "notification_bounce", "TopicArn": "topic",
            "Message": json.dumps(event_payload), "Timestamp": timezone.now().isoformat(), "SignatureVersion": "1",
        }
        response = self.client.post(self.url, json.dumps(sns_payload), content_type='text/plain; charset=UTF-8')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertTrue(CampaignAnalytics.objects.filter(ses_message_id=self.ses_message_id, event_type='bounced').exists())
        # Check if contact was marked (e.g., allow_email = False)
        self.contact.refresh_from_db()
        self.assertFalse(self.contact.allow_email) # Based on current webhook logic

    @patch('campaigns_api.views.SESWebhookView._verify_sns_message_signature', return_value=False)
    def test_webhook_signature_failure(self, mock_verify_sig):
        payload = {"Type": "Notification", "Message": "{}", "MessageId": "x", "TopicArn": "y", "Timestamp": "z"} # Min valid for canonical
        response = self.client.post(self.url, json.dumps(payload), content_type='text/plain; charset=UTF-8')
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)
        self.assertIn("SNS signature verification failed", response.data['error'])
