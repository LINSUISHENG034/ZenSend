from rest_framework import viewsets, permissions
from .models import EmailTemplate
from .serializers import EmailTemplateSerializer

class EmailTemplateViewSet(viewsets.ModelViewSet):
    """
    API endpoint that allows email templates to be viewed or edited.
    """
    serializer_class = EmailTemplateSerializer
    permission_classes = [permissions.IsAuthenticated] # Only authenticated users can access

    def get_queryset(self):
        """
        This view should return a list of all the email templates
        for the currently authenticated user.
        """
        return EmailTemplate.objects.filter(owner=self.request.user).order_by('-created_at')

    def perform_create(self, serializer):
        """
        Save the owner of the email template as the current logged-in user.
        """
        serializer.save(owner=self.request.user)

    # perform_update and perform_destroy can be left as default
    # as they will correctly update/delete instances owned by the user
    # due to the queryset filtering and model's unique_together constraint on (owner, name).
    # Overriding perform_update might be needed if you want to prevent changing the 'name'
    # or have other specific update logic.
    #
    # Example (if name shouldn't be updatable):
    # def perform_update(self, serializer):
    #     if 'name' in serializer.validated_data and serializer.instance.name != serializer.validated_data['name']:
    #         raise serializers.ValidationError({"name": "Template name cannot be changed after creation."})
    #     serializer.save()
