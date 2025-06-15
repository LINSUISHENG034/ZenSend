from rest_framework import serializers
from .models import Contact
from django.contrib.auth.models import User

class ContactSerializer(serializers.ModelSerializer):
    owner = serializers.ReadOnlyField(source='owner.username')
    # Or, if you want to show the owner's ID:
    # owner = serializers.PrimaryKeyRelatedField(read_only=True)

    class Meta:
        model = Contact
        fields = ['id', 'owner', 'email', 'first_name', 'last_name', 'custom_fields', 'allow_email', 'created_at']
        # You can make some fields read-only if they shouldn't be updated via API, e.g., 'created_at'
        read_only_fields = ['created_at']

    def validate_email(self, value):
        """
        Check that the email is unique.
        Note: The model's `unique=True` on email field already handles this at DB level,
        but DRF serializers also provide a place for such validations.
        If you want email to be unique *per owner* instead of globally,
        you'd need a custom validator here or a `UniqueTogetherValidator` in Meta.
        """
        # Example for uniqueness check (though model handles it)
        # if Contact.objects.filter(email=value).exists():
        #     raise serializers.ValidationError("Email already exists.")
        return value

    # If you had custom logic for creating or updating, you'd override create/update methods:
    # def create(self, validated_data):
    #     # Example: automatically set owner if not already handled by view
    #     # validated_data['owner'] = self.context['request'].user
    #     return super().create(validated_data)
