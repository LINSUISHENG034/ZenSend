from rest_framework import serializers
from .models import EmailTemplate
from django.contrib.auth.models import User

class EmailTemplateSerializer(serializers.ModelSerializer):
    owner = serializers.ReadOnlyField(source='owner.username')
    # Alternatively, to show owner's ID:
    # owner = serializers.PrimaryKeyRelatedField(read_only=True)

    class Meta:
        model = EmailTemplate
        fields = ['id', 'owner', 'name', 'subject', 'body_html', 'created_at']
        read_only_fields = ['created_at']

    def validate_name(self, value):
        """
        Check that the template name is unique for the current user.
        The model's `unique_together` constraint handles this at the DB level,
        but this provides a friendlier validation message at the serializer level.
        """
        request = self.context.get('request', None)
        if request and hasattr(request, 'user') and request.user.is_authenticated:
            # If updating, exclude the current instance from the check
            instance = self.instance
            queryset = EmailTemplate.objects.filter(owner=request.user, name=value)
            if instance:
                queryset = queryset.exclude(pk=instance.pk)
            if queryset.exists():
                raise serializers.ValidationError("You already have a template with this name.")
        return value
