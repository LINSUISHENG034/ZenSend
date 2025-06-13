from rest_framework import serializers
from .models import Campaign
from templates_api.models import EmailTemplate # For validating template ID
from django.contrib.auth.models import User

class CampaignSerializer(serializers.ModelSerializer):
    owner = serializers.ReadOnlyField(source='owner.username')
    status_display = serializers.CharField(source='get_status_display', read_only=True)
    template_name = serializers.CharField(source='template.name', read_only=True, allow_null=True)

    # Allow setting template by ID, but represent it as an object on read if needed later
    # For now, template_id is write-only, template_name is read-only.
    template_id = serializers.PrimaryKeyRelatedField(
        queryset=EmailTemplate.objects.all(), # Queryset can be further filtered by owner in validate
        source='template',
        write_only=True,
        allow_null=True, # Allow template to be unset
        required=False   # Allow template to be optional during creation/update
    )

    class Meta:
        model = Campaign
        fields = [
            'id', 'owner', 'name', 'template', 'template_id', 'template_name',
            'recipient_group', 'status', 'status_display',
            'scheduled_at', 'sent_at', 'created_at'
        ]
        read_only_fields = ['status', 'sent_at', 'created_at', 'template']
        # 'template' is read_only here because we use 'template_id' for writing.
        # 'status' is read-only because it should be updated via specific actions (like 'send' or 'schedule').

    def validate_template_id(self, value):
        """
        Check that the template belongs to the current user.
        """
        request = self.context.get('request', None)
        if value and request and hasattr(request, 'user') and request.user.is_authenticated:
            if value.owner != request.user:
                raise serializers.ValidationError("The selected template does not belong to you.")
        return value

    def validate(self, data):
        """
        Custom validation for the whole object.
        Example: If scheduled_at is provided, ensure it's in the future.
        """
        # Note: 'status' is read-only in serializer, so we don't set it directly.
        # If we were allowing status changes via serializer, we'd validate here.
        # For instance, if status is 'scheduled', scheduled_at must be present.

        # scheduled_at = data.get('scheduled_at')
        # if scheduled_at and scheduled_at < timezone.now():
        #     raise serializers.ValidationError({"scheduled_at": "Scheduled time must be in the future."})

        # If 'template' (via template_id) is not provided, it's allowed to be null.
        # If specific logic is needed (e.g., template required for certain statuses),
        # it would be handled here or in model's clean/save method, or view actions.

        return super().validate(data)
