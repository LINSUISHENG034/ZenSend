# ZenSend Project Structure

This document describes the organization and structure of the ZenSend email marketing platform.

## 📁 Root Directory Structure

```
ZenSend/
├── README.md                    # Main project documentation
├── PROJECT_STRUCTURE.md         # This file
├── .gitignore                   # Git ignore rules
├── docs/                        # Project documentation
├── frontend/                    # React frontend application
├── frontend_html/               # Static HTML prototypes
├── myproject/                   # Django backend application
└── scripts/                     # Utility scripts
```

## 🖥️ Backend Structure (`myproject/`)

```
myproject/
├── manage.py                    # Django management script
├── requirements.txt             # Python dependencies
├── .env.example                 # Environment variables template
├── DEPLOYMENT_GUIDE.md          # Deployment instructions
├── docker-compose.yml           # Docker configuration
├── Dockerfile                   # Docker image definition
├── tests/                       # Test scripts and utilities
│   ├── __init__.py
│   ├── README.md                # Testing documentation
│   ├── test_campaign_functionality.py
│   └── demo_campaign_creation.py
├── myproject/                   # Django project settings
│   ├── __init__.py
│   ├── settings.py              # Django configuration
│   ├── urls.py                  # URL routing
│   ├── wsgi.py                  # WSGI configuration
│   ├── asgi.py                  # ASGI configuration
│   └── celery.py                # Celery configuration
├── contacts_api/                # Contact management app
│   ├── models.py                # Contact data models
│   ├── views.py                 # API views
│   ├── serializers.py           # Data serializers
│   ├── urls.py                  # URL patterns
│   ├── admin.py                 # Admin interface
│   ├── tasks.py                 # Background tasks
│   ├── tests.py                 # Unit tests
│   └── migrations/              # Database migrations
├── templates_api/               # Email template management
│   ├── models.py                # Template data models
│   ├── views.py                 # API views
│   ├── serializers.py           # Data serializers
│   ├── urls.py                  # URL patterns
│   ├── admin.py                 # Admin interface
│   ├── tests.py                 # Unit tests
│   └── migrations/              # Database migrations
├── campaigns_api/               # Campaign management app
│   ├── models.py                # Campaign data models
│   ├── views.py                 # API views
│   ├── serializers.py           # Data serializers
│   ├── urls.py                  # URL patterns
│   ├── admin.py                 # Admin interface
│   ├── tasks.py                 # Email sending tasks
│   ├── tests.py                 # Unit tests
│   ├── migrations/              # Database migrations
│   └── management/              # Management commands
│       └── commands/
│           └── setup_demo_data.py
└── ai_proxy/                    # AI integration app
    ├── models.py                # AI-related models
    ├── views.py                 # AI API views
    ├── urls.py                  # URL patterns
    ├── tests.py                 # Unit tests
    └── migrations/              # Database migrations
```

## 🌐 Frontend Structure (`frontend/`)

```
frontend/
├── package.json                 # Node.js dependencies
├── package-lock.json            # Dependency lock file
├── .env.example                 # Environment variables template
├── README.md                    # Frontend documentation
├── public/                      # Static assets
└── src/                         # React source code
    ├── components/              # Reusable components
    ├── pages/                   # Page components
    ├── store/                   # Redux store
    ├── services/                # API services
    └── utils/                   # Utility functions
```

## 🛠️ Utility Scripts (`scripts/`)

```
scripts/
├── security_check.py           # Security vulnerability scanner
└── pre_commit_check.py          # Pre-commit validation script
```

## 📚 Documentation (`docs/`)

```
docs/
└── design/                      # Design documents and specifications
```

## 🎨 Static Prototypes (`frontend_html/`)

```
frontend_html/
├── index.html                   # Landing page
├── login.html                   # Login page
├── register.html                # Registration page
├── contacts.html                # Contact management
├── contact_form.html            # Contact form
├── email_editor.html            # Email template editor
├── campaign_wizard.html         # Campaign creation wizard
├── campaign_report.html         # Campaign analytics
└── styles.css                   # Shared styles
```

## 🔧 Configuration Files

### Environment Variables
- `myproject/.env.example` - Backend environment template
- `frontend/.env.example` - Frontend environment template

### Docker Configuration
- `myproject/docker-compose.yml` - Multi-service Docker setup
- `myproject/Dockerfile` - Django application container

### Git Configuration
- `.gitignore` - Comprehensive ignore rules for security and cleanliness

## 🗄️ Database Models

### Contact Model (`contacts_api/models.py`)
- User contact information
- Custom fields support
- Email permission tracking

### EmailTemplate Model (`templates_api/models.py`)
- HTML email templates
- Variable substitution support
- Template versioning

### Campaign Model (`campaigns_api/models.py`)
- Email campaign configuration
- Recipient targeting
- Status tracking

### CampaignAnalytics Model (`campaigns_api/models.py`)
- Email delivery tracking
- Event analytics (sent, delivered, bounced, etc.)
- Performance metrics

## 🚀 Key Features

### Core Functionality
- ✅ Contact management with custom fields
- ✅ HTML email template editor with variables
- ✅ Batch email sending with personalization
- ✅ Campaign analytics and tracking
- ✅ AWS SES integration
- ✅ Webhook event processing

### Security Features
- ✅ Environment variable configuration
- ✅ Sensitive data protection
- ✅ Security scanning scripts
- ✅ Production-ready settings

### Development Tools
- ✅ Demo data setup commands
- ✅ Comprehensive testing scripts
- ✅ Pre-commit validation
- ✅ Docker development environment

## 📋 Getting Started

1. **Setup**: Follow instructions in `README.md`
2. **Testing**: Use scripts in `myproject/tests/`
3. **Development**: See `myproject/DEPLOYMENT_GUIDE.md`
4. **Security**: Run `scripts/security_check.py` before commits

## 🔒 Security Considerations

- All sensitive data uses environment variables
- No hardcoded credentials in source code
- Comprehensive .gitignore rules
- Security scanning automation
- Production-ready Django settings
