from django.contrib import admin
from .models import Contact

@admin.register(Contact)
class ContactAdmin(admin.ModelAdmin):
    list_display = ('email', 'first_name', 'last_name', 'allow_email', 'owner', 'created_at')
    list_filter = ('owner', 'allow_email', 'created_at')
    search_fields = ('email', 'first_name', 'last_name', 'owner__username')
    readonly_fields = ('created_at',) # 'owner' could also be here if set automatically

    fieldsets = (
        (None, {
            'fields': ('owner', 'email', 'first_name', 'last_name', 'allow_email')
        }),
        ('Additional Information', {
            'fields': ('custom_fields',),
            'classes': ('collapse',) # Makes this section collapsible
        }),
        ('Timestamps', {
            'fields': ('created_at',),
        }),
    )

    # If you don't set owner automatically in the model or view,
    # you might want to default it or filter choices in the admin.
    # def formfield_for_foreignkey(self, db_field, request, **kwargs):
    #     if db_field.name == "owner":
    #         kwargs["initial"] = request.user.id
    #         # Optionally, limit choices if non-superusers should only assign to themselves
    #         # if not request.user.is_superuser:
    #         #     kwargs["queryset"] = User.objects.filter(id=request.user.id)
    #     return super().formfield_for_foreignkey(db_field, request, **kwargs)

    # If owner is set by perform_create in ViewSet, it might not be needed in admin create
    # or you might want to make it readonly in admin for existing objects.
    # def get_readonly_fields(self, request, obj=None):
    #     if obj: # Editing an existing object
    #         return self.readonly_fields + ('owner',)
    #     return self.readonly_fields
