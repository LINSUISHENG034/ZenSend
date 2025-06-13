from django.contrib import admin
from .models import EmailTemplate

@admin.register(EmailTemplate)
class EmailTemplateAdmin(admin.ModelAdmin):
    list_display = ('name', 'subject', 'owner', 'created_at')
    list_filter = ('owner', 'created_at')
    search_fields = ('name', 'subject', 'owner__username', 'body_html')
    readonly_fields = ('created_at',)

    fieldsets = (
        (None, {
            'fields': ('owner', 'name', 'subject')
        }),
        ('Content', {
            'fields': ('body_html',)
        }),
        ('Timestamps', {
            'fields': ('created_at',),
        }),
    )

    # If owner is automatically set (e.g. by perform_create in ViewSet),
    # you might want to make it readonly or pre-fill it in the admin.
    def get_form(self, request, obj=None, **kwargs):
        form = super().get_form(request, obj, **kwargs)
        if not obj and request.user: # For new objects, default owner to current user
             form.base_fields['owner'].initial = request.user
        return form

    def get_readonly_fields(self, request, obj=None):
        if obj: # Editing an existing object
            return self.readonly_fields + ('owner',) # Make owner readonly after creation
        return self.readonly_fields
