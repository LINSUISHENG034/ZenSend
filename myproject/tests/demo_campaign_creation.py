#!/usr/bin/env python
"""
Demo script for creating and testing a new marketing campaign.

This script demonstrates the complete workflow of:
1. Creating a new email template with advanced personalization
2. Creating a marketing campaign
3. Sending the campaign to all contacts
4. Viewing analytics results

Usage:
    python tests/demo_campaign_creation.py

Requirements:
    - Demo data must be set up first: python manage.py setup_demo_data
"""

import os
import sys
import django

# Setup Django environment
project_root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.append(project_root)
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'myproject.settings')
django.setup()

from django.contrib.auth.models import User
from contacts_api.models import Contact
from templates_api.models import EmailTemplate
from campaigns_api.models import Campaign
from campaigns_api.tasks import send_campaign_task


def create_and_test_campaign():
    """Create and test a new marketing campaign."""
    print("🎯 Creating New Marketing Campaign Demo")
    print("=" * 50)
    
    # Get demo user
    try:
        user = User.objects.get(username='demo_user')
    except User.DoesNotExist:
        print("❌ Demo user not found.")
        print("💡 Please run: python manage.py setup_demo_data")
        return False
    
    # Create a new template for product promotion
    template = EmailTemplate.objects.create(
        name='Product Launch Campaign Demo',
        owner=user,
        subject='🚀 {{first_name}}, {{custom_fields.company}} needs this new product!',
        body_html='''
        <html>
        <head>
            <style>
                body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
                .header { background: #007bff; color: white; padding: 20px; text-align: center; }
                .content { padding: 20px; }
                .highlight { background: #f8f9fa; padding: 15px; border-left: 4px solid #007bff; }
                .cta { background: #28a745; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; }
            </style>
        </head>
        <body>
            <div class="header">
                <h1>🚀 Exciting Product Launch!</h1>
            </div>
            <div class="content">
                <h2>Hello {{first_name}} {{last_name}}!</h2>
                <p>We hope this email finds you well at <strong>{{custom_fields.company}}</strong>.</p>
                
                <div class="highlight">
                    <h3>Perfect for {{custom_fields.industry}} professionals like you!</h3>
                    <p>Our new product is specifically designed to help companies in the {{custom_fields.industry}} industry streamline their operations.</p>
                </div>
                
                <p><strong>Why {{custom_fields.company}} should be interested:</strong></p>
                <ul>
                    <li>✅ Increase efficiency by 40%</li>
                    <li>✅ Reduce costs significantly</li>
                    <li>✅ Perfect for {{custom_fields.industry}} sector</li>
                    <li>✅ Easy integration with existing systems</li>
                </ul>
                
                <p>We'd love to schedule a personalized demo for {{custom_fields.company}}.</p>
                <p>You can reach us at {{custom_fields.phone}} or simply reply to this email at {{email}}.</p>
                
                <p style="text-align: center; margin: 30px 0;">
                    <a href="#" class="cta">Schedule Demo for {{custom_fields.company}}</a>
                </p>
                
                <p>Best regards,<br>
                <strong>The ZenSend Team</strong><br>
                Your Partner in {{custom_fields.industry}} Innovation</p>
            </div>
        </body>
        </html>
        '''
    )
    
    print(f"📝 Created template: {template.name}")
    
    # Create a new campaign
    campaign = Campaign.objects.create(
        name='Q1 Product Launch Demo Campaign',
        owner=user,
        template=template,
        recipient_group={'type': 'all_contacts'},
        status='draft'
    )
    
    print(f"📧 Created campaign: {campaign.name}")
    
    # Show preview for each contact
    contacts = Contact.objects.filter(owner=user)
    print(f"\n🎨 Email Previews:")
    print("-" * 30)
    
    from django.template import Template, Context
    
    for contact in contacts:
        print(f"\n👤 {contact.first_name} {contact.last_name} ({contact.email})")
        print(f"🏢 {contact.custom_fields.get('company', 'N/A')}")
        
        subject_template = Template(template.subject)
        context_data = {
            'first_name': contact.first_name or "",
            'last_name': contact.last_name or "",
            'email': contact.email,
            'custom_fields': contact.custom_fields or {}
        }
        context = Context(context_data)
        rendered_subject = subject_template.render(context)
        print(f"📧 Subject: {rendered_subject}")
    
    # Send the campaign
    print(f"\n🚀 Sending Campaign...")
    print("-" * 30)
    
    try:
        result = send_campaign_task(campaign.id)
        print(f"✅ Result: {result}")
        
        # Show final analytics
        campaign.refresh_from_db()
        print(f"\n📊 Final Campaign Status: {campaign.status}")
        
        from campaigns_api.models import CampaignAnalytics
        analytics = CampaignAnalytics.objects.filter(campaign=campaign)
        print(f"📈 Analytics Records: {analytics.count()}")
        
        for record in analytics:
            print(f"   ✉️  {record.contact.email}: {record.event_type}")
        
        print(f"\n🎉 Demo campaign '{campaign.name}' completed successfully!")
        return True
        
    except Exception as e:
        print(f"❌ Error during campaign creation/send: {str(e)}")
        import traceback
        traceback.print_exc()
        return False


if __name__ == "__main__":
    success = create_and_test_campaign()
    sys.exit(0 if success else 1)
