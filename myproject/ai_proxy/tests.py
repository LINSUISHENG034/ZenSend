from django.urls import reverse
from rest_framework import status
from rest_framework.test import APITestCase, APIClient
from django.contrib.auth.models import User
from django.conf import settings # To check if OPENAI_API_KEY is set
from unittest.mock import patch, MagicMock
import openai # To mock its exceptions and classes like APIError, RateLimitError

class AIGenerateViewTests(APITestCase):
    def setUp(self):
        self.user = User.objects.create_user(username='testuser', password='testpassword123')
        self.client = APIClient()
        # Ensure the test client is authenticated
        self.client.force_authenticate(user=self.user)
        self.url = reverse('ai-generate') # Name from ai_proxy/urls.py

        # It's good practice to ensure the API key is set for tests that would make real calls,
        # or to mock this check if the view relies on it.
        # For these tests, we're mocking the OpenAI client, so real key isn't strictly needed for the test itself.
        # However, the view might check settings.OPENAI_API_KEY.
        # Let's assume the view checks it:
        self.original_openai_api_key = getattr(settings, 'OPENAI_API_KEY', None)
        settings.OPENAI_API_KEY = 'test_dummy_key' # Ensure it's set for the view's check


    def tearDown(self):
        # Restore original OPENAI_API_KEY setting if it was changed
        if self.original_openai_api_key is not None:
            settings.OPENAI_API_KEY = self.original_openai_api_key
        else:
            if hasattr(settings, 'OPENAI_API_KEY'):
                del settings.OPENAI_API_KEY


    @patch('ai_proxy.views.openai.OpenAI')
    def test_ai_generate_success(self, MockOpenAI):
        # Configure mock client and its response object structure
        mock_openai_instance = MockOpenAI.return_value
        mock_completion_response = MagicMock()
        mock_message = MagicMock()
        mock_message.content = 'Test AI response'
        mock_choice = MagicMock()
        mock_choice.message = mock_message
        mock_completion_response.choices = [mock_choice]
        mock_openai_instance.chat.completions.create.return_value = mock_completion_response

        payload = {'prompt': 'Test prompt'}
        response = self.client.post(self.url, payload, format='json')

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn('generated_text', response.data)
        self.assertEqual(response.data['generated_text'], 'Test AI response')
        mock_openai_instance.chat.completions.create.assert_called_once()
        # Check call arguments if needed, e.g.
        # mock_openai_instance.chat.completions.create.assert_called_once_with(
        #     model=getattr(settings, 'OPENAI_MODEL_NAME', "gpt-3.5-turbo"),
        #     messages=[
        #         {"role": "system", "content": "You are a helpful assistant for writing email content."},
        #         {"role": "user", "content": "Test prompt"}
        #     ],
        #     max_tokens=getattr(settings, 'OPENAI_MAX_TOKENS', 150)
        # )


    def test_ai_generate_no_prompt(self):
        response = self.client.post(self.url, {}, format='json')
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('error', response.data)
        self.assertEqual(response.data['error'], 'Prompt is required.')

    def test_ai_generate_prompt_not_string(self):
        response = self.client.post(self.url, {'prompt': 123}, format='json')
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('error', response.data)
        self.assertEqual(response.data['error'], 'Prompt must be a string.')

    @patch('ai_proxy.views.openai.OpenAI')
    def test_ai_generate_openai_api_connection_error(self, MockOpenAI):
        MockOpenAI.return_value.chat.completions.create.side_effect = openai.APIConnectionError(request=MagicMock())
        response = self.client.post(self.url, {'prompt': 'Test APIConnectionError'}, format='json')
        self.assertEqual(response.status_code, status.HTTP_503_SERVICE_UNAVAILABLE)
        self.assertIn('error', response.data)
        self.assertEqual(response.data['error'], 'Failed to connect to OpenAI API.')

    @patch('myproject.ai_proxy.views.openai.OpenAI')
    def test_ai_generate_openai_rate_limit_error(self, MockOpenAI):
        MockOpenAI.return_value.chat.completions.create.side_effect = openai.RateLimitError("Rate limit exceeded", response=MagicMock(), body=None)
        response = self.client.post(self.url, {'prompt': 'Test RateLimitError'}, format='json')
        self.assertEqual(response.status_code, status.HTTP_429_TOO_MANY_REQUESTS)
        self.assertIn('error', response.data)
        self.assertEqual(response.data['error'], 'Rate limit exceeded. Please try again later.')

    @patch('myproject.ai_proxy.views.openai.OpenAI')
    def test_ai_generate_openai_authentication_error(self, MockOpenAI):
        MockOpenAI.return_value.chat.completions.create.side_effect = openai.AuthenticationError("Auth error", response=MagicMock(), body=None)
        response = self.client.post(self.url, {'prompt': 'Test AuthenticationError'}, format='json')
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)
        self.assertIn('error', response.data)
        self.assertEqual(response.data['error'], 'OpenAI API authentication failed. Check your API key.')

    @patch('myproject.ai_proxy.views.openai.OpenAI')
    def test_ai_generate_openai_api_status_error(self, MockOpenAI):
        # Simulate an APIStatusError (like a 400 from OpenAI, or other non-specific 5xx)
        mock_response = MagicMock()
        mock_response.status_code = 400 # Example status code
        MockOpenAI.return_value.chat.completions.create.side_effect = openai.APIStatusError("Simulated API Status Error", response=mock_response, body=None)
        response = self.client.post(self.url, {'prompt': 'Test APIStatusError'}, format='json')
        self.assertEqual(response.status_code, status.HTTP_500_INTERNAL_SERVER_ERROR) # As per current view handling
        self.assertIn('error', response.data)
        # The error message in view is f"OpenAI API error: {e.status_code} {e.message}"
        # This part of the test might need to be more specific based on how e.message is structured.
        # For now, just checking 'error' key exists is fine.

    @patch('myproject.ai_proxy.views.openai.OpenAI')
    def test_ai_generate_generic_exception(self, MockOpenAI):
        MockOpenAI.return_value.chat.completions.create.side_effect = Exception("Generic test error")
        response = self.client.post(self.url, {'prompt': 'Test generic error'}, format='json')
        self.assertEqual(response.status_code, status.HTTP_500_INTERNAL_SERVER_ERROR)
        self.assertIn('error', response.data)
        self.assertEqual(response.data['error'], 'An unexpected error occurred while processing your request with AI service.')

    def test_ai_generate_no_api_key_configured(self):
        # Temporarily remove the API key setting for this test
        original_key = settings.OPENAI_API_KEY
        del settings.OPENAI_API_KEY # Or set to None

        response = self.client.post(self.url, {'prompt': 'Test no key'}, format='json')
        self.assertEqual(response.status_code, status.HTTP_500_INTERNAL_SERVER_ERROR)
        self.assertIn('error', response.data)
        self.assertEqual(response.data['error'], 'OpenAI API key is not configured.')

        # Restore for other tests
        settings.OPENAI_API_KEY = original_key
