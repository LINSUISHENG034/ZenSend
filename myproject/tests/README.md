# ZenSend Testing Guide

This directory contains test scripts and utilities for the ZenSend email marketing platform.

## Test Scripts

### 1. Core Functionality Test
**File:** `test_campaign_functionality.py`

Tests the complete email campaign workflow including template rendering, batch sending, and analytics tracking.

```bash
# Run the test
python tests/test_campaign_functionality.py
```

**Prerequisites:**
- Demo data must be set up: `python manage.py setup_demo_data`
- Django server should be running
- Redis should be running for Celery

### 2. Demo Campaign Creation
**File:** `demo_campaign_creation.py`

Demonstrates creating a new marketing campaign with advanced personalization features.

```bash
# Run the demo
python tests/demo_campaign_creation.py
```

**What it does:**
- Creates a new email template with HTML styling
- Creates a marketing campaign
- Sends personalized emails to all demo contacts
- Shows analytics results

## Setup Demo Data

Before running tests, set up demo data:

```bash
python manage.py setup_demo_data
```

This creates:
- Demo user account (username: `demo_user`, password: `demo123`)
- 3 sample contacts with custom fields
- Welcome email template
- Demo marketing campaign

## Test Environment

All tests run in **Mock SES mode** by default, which means:
- No real emails are sent
- Mock SES responses are generated
- All functionality is tested safely
- Analytics are still recorded

To test with real AWS SES:
1. Configure AWS credentials in `.env`
2. Set `USE_MOCK_SES=False`
3. Ensure your email addresses are verified in SES

## Expected Results

### Successful Test Output
```
🚀 Testing ZenSend Core Functionality
==================================================
📧 Campaign: Demo Welcome Campaign
📊 Status: draft
👤 Owner: demo_user
👥 Contacts: 3
📝 Template: Welcome Campaign Template
🎨 Template Preview for John:
Subject: Welcome John! Special offer for Tech Corp
🚀 Sending Campaign (Mock Mode)...
✅ Send Result: Campaign 1 processing complete. Successful: 3, Failed: 0
📊 Campaign Status: sent
📈 Analytics Records: 3
🎉 Campaign sending test completed successfully!
✅ Core functionality is working correctly!
```

## Troubleshooting

### Common Issues

1. **"Demo campaign not found"**
   - Run: `python manage.py setup_demo_data`

2. **Django settings not configured**
   - Ensure you're running from the project root
   - Check DJANGO_SETTINGS_MODULE environment variable

3. **Redis connection error**
   - Start Redis server: `redis-server`
   - Or use Docker: `docker run -d -p 6379:6379 redis:7-alpine`

4. **Import errors**
   - Ensure all dependencies are installed: `pip install -r requirements.txt`
   - Activate virtual environment if using one

## Test Data

The demo data includes:

**Contacts:**
- John Doe (john.doe@example.com) - Tech Corp, Technology
- Jane Smith (jane.smith@example.com) - Marketing Inc, Marketing  
- Bob Wilson (bob.wilson@example.com) - Sales Solutions, Sales

**Template Variables:**
- `{{first_name}}`, `{{last_name}}`, `{{email}}`
- `{{custom_fields.company}}`
- `{{custom_fields.industry}}`
- `{{custom_fields.phone}}`

## Security Notes

- All test scripts use mock data and safe operations
- No real emails are sent in test mode
- Database operations are limited to test data
- AWS credentials are not required for testing
