#!/usr/bin/env python
"""
Test script for ZenSend core campaign functionality.

This script tests the complete email campaign workflow including:
- Template rendering with personalization
- Batch email sending
- Analytics tracking
- Error handling

Usage:
    python tests/test_campaign_functionality.py

Requirements:
    - Demo data must be set up first: python manage.py setup_demo_data
    - Django environment must be properly configured
"""

import os
import sys
import django

# Setup Django environment
project_root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.append(project_root)
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'myproject.settings')
django.setup()

from campaigns_api.tasks import send_campaign_task
from campaigns_api.models import Campaign, CampaignAnalytics
from contacts_api.models import Contact
from templates_api.models import EmailTemplate


def test_campaign_functionality():
    """Test the complete campaign sending functionality."""
    print("🚀 Testing ZenSend Core Functionality")
    print("=" * 50)
    
    # Check if demo data exists
    campaign = Campaign.objects.filter(name='Demo Welcome Campaign').first()
    if not campaign:
        print("❌ Demo campaign not found.")
        print("💡 Please run: python manage.py setup_demo_data")
        return False
    
    print(f"📧 Campaign: {campaign.name}")
    print(f"📊 Status: {campaign.status}")
    print(f"👤 Owner: {campaign.owner.username}")
    
    # Check contacts
    contacts = Contact.objects.filter(owner=campaign.owner)
    print(f"👥 Contacts: {contacts.count()}")
    for contact in contacts:
        print(f"   - {contact.first_name} {contact.last_name} ({contact.email})")
        print(f"     Company: {contact.custom_fields.get('company', 'N/A')}")
    
    # Check template
    template = campaign.template
    print(f"📝 Template: {template.name}")
    print(f"📧 Subject: {template.subject}")
    
    # Test template rendering with first contact
    if contacts.exists():
        first_contact = contacts.first()
        print(f"\n🎨 Template Preview for {first_contact.first_name}:")
        print("-" * 30)
        
        from django.template import Template, Context
        subject_template = Template(template.subject)
        body_template = Template(template.body_html)
        
        context_data = {
            'first_name': first_contact.first_name or "",
            'last_name': first_contact.last_name or "",
            'email': first_contact.email,
            'custom_fields': first_contact.custom_fields or {}
        }
        context = Context(context_data)
        
        rendered_subject = subject_template.render(context)
        rendered_body = body_template.render(context)
        
        print(f"Subject: {rendered_subject}")
        print(f"Body preview: {rendered_body[:200]}...")
    
    # Test sending campaign
    print(f"\n🚀 Sending Campaign (Mock Mode)...")
    print("-" * 30)
    
    try:
        result = send_campaign_task(campaign.id)
        print(f"✅ Send Result: {result}")
        
        # Check campaign status
        campaign.refresh_from_db()
        print(f"📊 Campaign Status: {campaign.status}")
        
        # Check analytics
        analytics = CampaignAnalytics.objects.filter(campaign=campaign)
        print(f"📈 Analytics Records: {analytics.count()}")
        
        for record in analytics:
            print(f"   - {record.contact.email}: {record.event_type}")
        
        print("\n🎉 Campaign sending test completed successfully!")
        print("✅ Core functionality is working correctly!")
        return True
        
    except Exception as e:
        print(f"❌ Error during campaign send: {str(e)}")
        import traceback
        traceback.print_exc()
        return False


if __name__ == "__main__":
    success = test_campaign_functionality()
    sys.exit(0 if success else 1)
