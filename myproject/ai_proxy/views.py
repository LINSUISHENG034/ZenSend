from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import permissions, status
import openai
from django.conf import settings

class AIGenerateView(APIView):
    """
    API view to proxy requests to an AI content generation service (e.g., OpenAI).
    """
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, *args, **kwargs):
        prompt = request.data.get('prompt', None)

        if not prompt:
            return Response(
                {"error": "Prompt is required."},
                status=status.HTTP_400_BAD_REQUEST
            )

        if not isinstance(prompt, str):
            return Response(
                {"error": "Prompt must be a string."},
                status=status.HTTP_400_BAD_REQUEST
            )

        if not getattr(settings, 'OPENAI_API_KEY', None):
            return Response(
                {"error": "OpenAI API key is not configured."},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )

        client = openai.OpenAI(api_key=settings.OPENAI_API_KEY)

        try:
            # Using ChatCompletion is more current
            response = client.chat.completions.create(
                model=getattr(settings, 'OPENAI_MODEL_NAME', "gpt-3.5-turbo"), # Configurable model
                messages=[
                    {"role": "system", "content": "You are a helpful assistant for writing email content."},
                    {"role": "user", "content": prompt}
                ],
                max_tokens=getattr(settings, 'OPENAI_MAX_TOKENS', 150) # Configurable max_tokens
            )
            generated_text = response.choices[0].message.content.strip()

            return Response(
                {"generated_text": generated_text},
                status=status.HTTP_200_OK
            )

        # Specific OpenAI errors
        except openai.APIConnectionError as e:
            # Handle connection error here
            print(f"OpenAI API request failed to connect: {e}")
            return Response({"error": "Failed to connect to OpenAI API."}, status=status.HTTP_503_SERVICE_UNAVAILABLE)
        except openai.RateLimitError as e:
            # Handle rate limit error
            print(f"OpenAI API request exceeded rate limit: {e}")
            return Response({"error": "Rate limit exceeded. Please try again later."}, status=status.HTTP_429_TOO_MANY_REQUESTS)
        except openai.AuthenticationError as e:
            # Handle authentication error
            print(f"OpenAI API authentication failed: {e}")
            return Response({"error": "OpenAI API authentication failed. Check your API key."}, status=status.HTTP_401_UNAUTHORIZED)
        except openai.APIStatusError as e: # General catch-all for other API errors
            print(f"OpenAI API returned an API Status Error: {e}")
            return Response({"error": f"OpenAI API error: {e.status_code} {e.message}"}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
        except Exception as e:
            # Catch any other unexpected errors
            print(f"An unexpected error occurred while calling OpenAI API: {str(e)}")
            return Response(
                {"error": "An unexpected error occurred while processing your request with AI service."},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )
