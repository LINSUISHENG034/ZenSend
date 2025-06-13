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

1.  **Backend:** Follow the instructions in `myproject/DEPLOYMENT_GUIDE.md` to set up and run the Django backend services using Docker.
2.  **Frontend:** Follow the instructions in `frontend/README.md` to set up and run the React frontend application.

Ensure all required environment variables (for both backend and frontend) are configured as specified in their respective documentation.
