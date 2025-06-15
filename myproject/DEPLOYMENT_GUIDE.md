# Deployment Guide: Intelligent Personalized Email Marketing System MVP

This guide provides basic instructions for deploying the MVP version of this application using Docker.

## Prerequisites

*   Docker installed ([https://docs.docker.com/get-docker/](https://docs.docker.com/get-docker/))
*   Docker Compose installed ([https://docs.docker.com/compose/install/](https://docs.docker.com/compose/install/))
*   Git installed (for cloning the repository)
*   A configured AWS SES account (for actual email sending, if moving beyond mock sending and implementing real SES calls).
*   An OpenAI API key (for actual AI content generation, if moving beyond mock generation and implementing real OpenAI calls).

## Local Development Deployment (using Docker Compose)

This setup is suitable for local testing and development, utilizing Docker to orchestrate the application services.

1.  **Clone the Repository:**
    ```bash
    # Replace <your-repository-url> with the actual URL of your repository
    git clone <your-repository-url>
    # Navigate into the project's root directory that contains docker-compose.yml
    cd <repository-directory>/myproject
    ```

2.  **Environment Variables:**
    *   The application relies on environment variables for crucial configurations. These are essential for both local Docker-based development and production deployments. For local Docker development, you can add these to the `environment` section of the relevant services in `docker-compose.yml` or use an `.env` file referenced by Docker Compose. For production, these should be managed via your deployment platform's secret management tools.
    *   The Django `settings.py` is configured to read these variables using `os.environ.get()`. The following variables are expected for V1.1 functionality:

    *   **Django Core:**
        *   `SECRET_KEY`: Django's secret key. **Required for production.**
        *   `DEBUG`: Set to `False` for production, `True` for development.
        *   `ALLOWED_HOSTS`: Comma-separated list of allowed hostnames for production (e.g., `yourdomain.com,www.yourdomain.com`).
    *   **Database:** (Assuming default SQLite for local Docker, but for production these would be needed)
        *   `DB_ENGINE` (e.g., `django.db.backends.postgresql`)
        *   `DB_NAME`
        *   `DB_USER`
        *   `DB_PASSWORD`
        *   `DB_HOST`
        *   `DB_PORT`
    *   **CORS:**
        *   `CORS_ALLOWED_ORIGINS`: Comma-separated list of frontend origins allowed to make requests (e.g., `http://localhost:3001,https://yourfrontenddomain.com`). Or `CORS_ALLOW_ALL_ORIGINS=True` for local development (less secure).
    *   **Celery:**
        *   `CELERY_BROKER_URL`: URL for the Celery message broker (e.g., `redis://redis:6379/0`).
        *   `CELERY_RESULT_BACKEND`: URL for the Celery result backend (e.g., `redis://redis:6379/0`).
    *   **OpenAI API:**
        *   `OPENAI_API_KEY`: Your API key for OpenAI. **Required for AI features.**
        *   `OPENAI_MODEL_NAME`: (Optional) The OpenAI model to use (e.g., `gpt-3.5-turbo`). Defaults to `gpt-3.5-turbo` in the code if not set.
        *   `OPENAI_MAX_TOKENS`: (Optional) Max tokens for AI generation. Defaults to `150` in the code if not set.
    *   **AWS SES:**
        *   `AWS_ACCESS_KEY_ID`: Your AWS Access Key ID. **Required for email sending.**
        *   `AWS_SECRET_ACCESS_KEY`: Your AWS Secret Access Key. **Required for email sending.**
        *   `AWS_SES_REGION_NAME`: The AWS region where your SES service is configured (e.g., `us-east-1`). **Required for email sending.**
        *   `DEFAULT_FROM_EMAIL`: The verified email address to send emails from via SES. **Required for email sending.**
    *   **AWS SNS Webhook Security:**
        *   `ALLOWED_SNS_TOPIC_ARN`: (Optional, but highly recommended for security) The specific SNS Topic ARN that this webhook should process messages from.

3.  **Build and Run with Docker Compose:**
    From the directory containing `docker-compose.yml` (`myproject/`):
    ```bash
    docker-compose up --build
    ```
    This command will:
    *   Build the Docker image for the Django application as defined in `Dockerfile` (if not already built or if `Dockerfile` or related files have changed).
    *   Start the `web` (Django app), `redis`, and `celery_worker` services in detached mode (`-d` can be added if you want them to run in the background).

4.  **Apply Database Migrations:**
    *   Once the `web` container is running (you'll see logs in the `docker-compose up` output, or check with `docker-compose ps`), you may need to apply database migrations. This is especially true for the first run or after model changes.
    *   Open a new terminal window, navigate to the same `myproject/` directory, and run:
        ```bash
        docker-compose exec web python manage.py migrate
        ```

5.  **Create a Superuser (Optional, for Admin Access):**
    To access the Django admin interface, create a superuser:
    ```bash
    docker-compose exec web python manage.py createsuperuser
    ```
    Follow the prompts to set a username, email (optional), and password.

6.  **Accessing the Application:**
    *   **Web Application (Django Dev Server):** `http://localhost:8000/`
    *   **API Documentation (Swagger UI):** `http://localhost:8000/swagger/`
    *   **API Documentation (ReDoc):** `http://localhost:8000/redoc/`
    *   **Admin Interface:** `http://localhost:8000/admin/` (use the superuser credentials created in the previous step).

## Production Deployment Considerations (Beyond MVP)

This MVP's Docker setup uses Django's development server and SQLite (by default, if no other database is configured), which are not suitable for production environments. For a production deployment, you would need to consider:

*   **WSGI Server:** Replace Django's development server with a production-grade WSGI server like Gunicorn or uWSGI. This involves updating the `CMD` or `ENTRYPOINT` in your `Dockerfile` and potentially `docker-compose.yml` for the `web` service.
*   **Database:** Switch to a more robust database system (e.g., PostgreSQL, MySQL). This would involve:
    *   Adding a database service (e.g., `postgres`) to `docker-compose.yml`.
    *   Installing the appropriate database client library in your `Dockerfile` (e.g., `psycopg2-binary` for PostgreSQL).
    *   Updating `DATABASES` setting in `myproject/myproject/settings.py` to connect to the production database, likely using environment variables for connection parameters.
*   **Static Files & Media:** Configure a robust strategy for serving static files (CSS, JS, images for Django admin) and user-uploaded media files. This often involves using a service like Nginx in front of your Django application or using cloud storage (e.g., AWS S3) with a CDN.
*   **HTTPS:** Ensure your application is served over HTTPS. This is typically handled by a reverse proxy (like Nginx) or a load balancer.
*   **Security:**
    *   Thoroughly review Django's deployment checklist: [https://docs.djangoproject.com/en/stable/howto/deployment/checklist/](https://docs.djangoproject.com/en/stable/howto/deployment/checklist/)
    *   Set `DEBUG = False` in `settings.py`.
    *   Securely manage `SECRET_KEY` (e.g., via environment variables or secrets management).
    *   Configure `ALLOWED_HOSTS` in `settings.py`.
    *   Ensure the `cryptography` Python library is installed, as it's used for secure verification of AWS SNS webhook signatures.
*   **Scalability & Reliability:** For scaling and high availability, deploy your application services on platforms like Kubernetes, AWS ECS, Google Cloud Run, Azure App Service, or Heroku.
*   **Monitoring & Logging:** Implement comprehensive logging, monitoring, and alerting for your application and infrastructure.
*   **SES Webhook Security:** For a production SES webhook, ensure it's properly secured. This includes validating the SNS message signature (if using SNS) and ensuring the endpoint is robust against abuse. The `ALLOWED_SNS_TOPIC_ARN` environment variable should be set.
*   **Celery in Production:** Consider Celery Beat for scheduled tasks if needed, Flower for monitoring Celery, and more robust worker configurations.

### Frontend Deployment Note:

The React frontend (in the `/frontend` directory) needs to be built into static assets for deployment.
```bash
cd frontend
npm run build
```
These static files (in `frontend/build`) can then be served by a web server like Nginx, or deployed to a static hosting service (e.g., Vercel, Netlify, AWS S3/CloudFront). Ensure your backend's CORS configuration allows requests from the domain where the frontend is hosted.

## Stopping the Application (Local Docker Compose)

To stop all services defined in `docker-compose.yml`:
```bash
docker-compose down
```
If you want to remove any named volumes (e.g., `redis_data` if you uncommented it and used it for Redis persistence), you can add the `-v` flag:
```bash
docker-compose down -v
```

This guide provides a starting point. Real-world deployments will require more detailed planning based on specific needs and the chosen infrastructure.
