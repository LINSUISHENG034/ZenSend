from django.contrib import admin
from .models import Campaign, CampaignAnalytics # Import CampaignAnalytics

@admin.register(Campaign)
class CampaignAdmin(admin.ModelAdmin):
    list_display = ('name', 'owner', 'status_display', 'template_name', 'scheduled_at', 'sent_at', 'created_at')
    list_filter = ('status', 'owner', 'created_at', 'scheduled_at', 'sent_at')
    search_fields = ('name', 'owner__username', 'template__name', 'status')
    readonly_fields = ('created_at', 'sent_at') # status is often managed by actions

    fieldsets = (
        (None, {
            'fields': ('owner', 'name', 'template')
        }),
        ('Configuration', {
            'fields': ('recipient_group', 'scheduled_at')
        }),
        ('Status & Timestamps', {
            'fields': ('status', 'sent_at', 'created_at'),
            # Making status readonly if it's primarily controlled by actions
            # 'classes': ('collapse',), # Optional: if you want this section collapsed
        }),
    )

    def status_display(self, obj):
        return obj.get_status_display()
    status_display.short_description = 'Status'

    def template_name(self, obj):
        return obj.template.name if obj.template else '-'
    template_name.short_description = 'Email Template'

    # Default owner to current user for new campaigns in admin
    def get_form(self, request, obj=None, **kwargs):
        form = super().get_form(request, obj, **kwargs)
        if not obj and request.user and 'owner' in form.base_fields:
            form.base_fields['owner'].initial = request.user
        return form

    # Make owner readonly after creation to prevent changing it
    def get_readonly_fields(self, request, obj=None):
        if obj: # Editing an existing object
            return self.readonly_fields + ('owner', 'status') # Make owner and status readonly after creation
        return self.readonly_fields + ('status',) # Status is generally readonly from direct edit

    # Optionally, filter template choices to those owned by the campaign owner
    # This is more complex if owner can change or is not set yet.
    # For simplicity, relying on serializer/view validation for now.
    # def formfield_for_foreignkey(self, db_field, request, **kwargs):
    #     if db_field.name == "template":
    #         # Get the current campaign object if editing, or None if adding
    #         obj_id = request.resolver_match.kwargs.get('object_id')
    #         campaign_owner = None
    #         if obj_id:
    #             campaign = self.get_object(request, obj_id)
    #             if campaign:
    #                 campaign_owner = campaign.owner
    #         elif 'owner' in request.POST: # If owner is being set in the form
    #             try:
    #                 campaign_owner = User.objects.get(pk=request.POST['owner'])
    #             except User.DoesNotExist:
    #                 pass
    #         elif request.user.is_authenticated : # Default to current user if adding
    #              campaign_owner = request.user

    #         if campaign_owner:
    #             kwargs["queryset"] = EmailTemplate.objects.filter(owner=campaign_owner)
    #         else: # No owner context, show all or none
    #             kwargs["queryset"] = EmailTemplate.objects.none()

    #     return super().formfield_for_foreignkey(db_field, request, **kwargs)

@admin.register(CampaignAnalytics)
class CampaignAnalyticsAdmin(admin.ModelAdmin):
    list_display = ('campaign_name', 'contact_email', 'event_type_display', 'event_timestamp', 'ses_message_id')
    list_filter = ('event_type', 'campaign__name', 'event_timestamp') # Filter by campaign name
    search_fields = ('campaign__name', 'contact__email', 'ses_message_id', 'details')
    readonly_fields = ('event_timestamp',) # Assuming event_timestamp is auto_now_add or default=now

    fieldsets = (
        (None, {
            'fields': ('campaign', 'contact', 'event_type', 'ses_message_id')
        }),
        ('Event Details', {
            'fields': ('details', 'event_timestamp')
        }),
    )

    def campaign_name(self, obj):
        return obj.campaign.name
    campaign_name.short_description = 'Campaign'
    campaign_name.admin_order_field = 'campaign__name'


    def contact_email(self, obj):
        return obj.contact.email
    contact_email.short_description = 'Contact Email'
    contact_email.admin_order_field = 'contact__email'

    def event_type_display(self, obj):
        return obj.get_event_type_display()
    event_type_display.short_description = 'Event Type'
    event_type_display.admin_order_field = 'event_type'

    # Make related fields like campaign and contact raw_id_fields for performance if there are many.
    raw_id_fields = ('campaign', 'contact')
