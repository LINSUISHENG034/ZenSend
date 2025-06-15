# Intelligent Personalized Email Marketing System

This project is an intelligent email marketing system designed to help users create, manage, send, and track personalized email campaigns. It leverages AI for content assistance and integrates with AWS SES for email delivery.

## Project Structure

*   `/frontend`: Contains the React single-page application (SPA) for the user interface. See `frontend/README.md` for frontend-specific setup and development instructions.
*   `/myproject`: Contains the Django backend application, including APIs, Celery workers for asynchronous tasks, and database models. See `myproject/DEPLOYMENT_GUIDE.md` for backend deployment instructions.
*   `/docs`: Contains design documents and other project-related documentation.

## Core Features (V1.1)

*   User Authentication (Login, Registration)
*   Contact Management (CRUD, CSV/Excel Import)
*   Email Template Editor (TinyMCE, AI Content Assistant, Variable Insertion)
*   Campaign Creation & Management (Multi-step wizard, Send Now, Schedule)
*   Campaign Analytics (Statistics and Visualizations)
*   Real AWS SES integration for email sending and event tracking (via webhooks).
*   Real OpenAI integration for AI-assisted content generation.

## Getting Started

### Quick Start (Recommended)

1. **Clone the repository**
   ```bash
   git clone https://github.com/LINSUISHENG034/ZenSend.git
   cd ZenSend
   ```

2. **Backend Setup**
   ```bash
   cd myproject

   # Create virtual environment
   python -m venv zendev
   source zendev/bin/activate  # On Windows: zendev\Scripts\activate

   # Install dependencies
   pip install -r requirements.txt

   # Set up environment variables
   cp .env.example .env
   # Edit .env with your configuration

   # Run migrations
   python manage.py migrate

   # Create demo data
   python manage.py setup_demo_data

   # Start Redis (required for Celery)
   docker run -d --name redis-server -p 6379:6379 redis:7-alpine

   # Start Django server
   python manage.py runserver 127.0.0.1:9999
   ```

3. **Test Core Functionality**
   ```bash
   # Test the email campaign system
   python tests/test_campaign_functionality.py

   # Run demo campaign creation
   python tests/demo_campaign_creation.py
   ```

4. **Frontend Setup** (Optional - requires Node.js 18+)
   ```bash
   cd frontend
   cp .env.example .env
   # Edit .env with your configuration
   npm install
   npm start
   ```

### Access Points

- **API Documentation**: http://127.0.0.1:9999/swagger/
- **Admin Interface**: http://127.0.0.1:9999/admin/
- **Frontend** (if running): http://localhost:3000

### Environment Configuration

Copy the example environment files and configure them:
- Backend: `myproject/.env.example` → `myproject/.env`
- Frontend: `frontend/.env.example` → `frontend/.env`

For detailed setup instructions, see:
- **Backend:** `myproject/DEPLOYMENT_GUIDE.md`
- **Frontend:** `frontend/README.md`
- **Testing:** `myproject/tests/README.md`
