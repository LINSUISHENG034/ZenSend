from django.core.management.base import BaseCommand
from django.contrib.auth.models import User
from contacts_api.models import Contact
from templates_api.models import EmailTemplate
from campaigns_api.models import Campaign


class Command(BaseCommand):
    help = 'Create demo data for testing ZenSend functionality'

    def add_arguments(self, parser):
        parser.add_argument(
            '--user',
            type=str,
            help='Username to create demo data for (will create if not exists)',
            default='demo_user'
        )

    def handle(self, *args, **options):
        username = options['user']
        
        # Create or get user
        user, created = User.objects.get_or_create(
            username=username,
            defaults={
                'email': f'{username}@example.com',
                'first_name': 'Demo',
                'last_name': 'User'
            }
        )
        if created:
            user.set_password('demo123')
            user.save()
            self.stdout.write(f"Created user: {username} (password: demo123)")
        else:
            self.stdout.write(f"Using existing user: {username}")

        # Create demo contacts
        contacts_data = [
            {
                'email': 'john.doe@example.com',
                'first_name': 'John',
                'last_name': 'Doe',
                'custom_fields': {
                    'company': 'Tech Corp',
                    'phone': '+1-555-0101',
                    'industry': 'Technology'
                }
            },
            {
                'email': 'jane.smith@example.com',
                'first_name': 'Jane',
                'last_name': 'Smith',
                'custom_fields': {
                    'company': 'Marketing Inc',
                    'phone': '+1-555-0102',
                    'industry': 'Marketing'
                }
            },
            {
                'email': 'bob.wilson@example.com',
                'first_name': 'Bob',
                'last_name': 'Wilson',
                'custom_fields': {
                    'company': 'Sales Solutions',
                    'phone': '+1-555-0103',
                    'industry': 'Sales'
                }
            }
        ]

        created_contacts = []
        for contact_data in contacts_data:
            contact, created = Contact.objects.get_or_create(
                email=contact_data['email'],
                defaults={
                    'owner': user,
                    'first_name': contact_data['first_name'],
                    'last_name': contact_data['last_name'],
                    'custom_fields': contact_data['custom_fields']
                }
            )
            created_contacts.append(contact)
            if created:
                self.stdout.write(f"Created contact: {contact.email}")

        # Create demo email template
        template, created = EmailTemplate.objects.get_or_create(
            name='Welcome Campaign Template',
            owner=user,
            defaults={
                'subject': 'Welcome {{first_name}}! Special offer for {{custom_fields.company}}',
                'body_html': '''
                <html>
                <body>
                    <h2>Hello {{first_name}} {{last_name}}!</h2>
                    <p>We're excited to welcome you from <strong>{{custom_fields.company}}</strong> to our platform.</p>
                    <p>As a professional in the {{custom_fields.industry}} industry, we have a special offer just for you!</p>
                    <p>Contact us at {{custom_fields.phone}} or reply to this email at {{email}}.</p>
                    <p>Best regards,<br>The ZenSend Team</p>
                </body>
                </html>
                '''
            }
        )
        if created:
            self.stdout.write(f"Created template: {template.name}")

        # Create demo campaign
        campaign, created = Campaign.objects.get_or_create(
            name='Demo Welcome Campaign',
            owner=user,
            defaults={
                'template': template,
                'recipient_group': {'type': 'all_contacts'},
                'status': 'draft'
            }
        )
        if created:
            self.stdout.write(f"Created campaign: {campaign.name}")

        self.stdout.write(
            self.style.SUCCESS(
                f'\nDemo data setup complete!\n'
                f'User: {username}\n'
                f'Contacts: {len(created_contacts)}\n'
                f'Template: {template.name}\n'
                f'Campaign: {campaign.name}\n'
                f'\nYou can now test the email sending functionality!'
            )
        )
