# Start with an official Python runtime as a parent image
FROM python:3.10-slim-buster

# Set environment variables
ENV PYTHONDONTWRITEBYTECODE 1
ENV PYTHONUNBUFFERED 1

# Set work directory
WORKDIR /app

# Install system dependencies (if any, e.g., for psycopg2 if using PostgreSQL later)
# Example: RUN apt-get update && apt-get install -y libpq-dev gcc && rm -rf /var/lib/apt/lists/*
# For this project, no specific system dependencies beyond what python:3.10-slim-buster provides are immediately obvious
# unless a library in requirements.txt needs them.

# Copy requirements file and install dependencies
COPY requirements.txt /app/
RUN pip install --no-cache-dir -r requirements.txt

# Copy project code into the container
# The .dockerignore file will control what gets copied from the build context.
COPY . /app/

# Expose port for the Django development server (or Gunicorn/uWSGI in production)
EXPOSE 8000

# Command to run the application
# For development, Django's runserver can be used.
# For production, this should be replaced with a Gunicorn or uWSGI command.
# An entrypoint script could also be used to run migrations before starting the server.
# CMD ["python", "manage.py", "runserver", "0.0.0.0:8000"]
# Leaving CMD commented out as docker-compose.yml will specify the command.
# If running `docker run` directly, a CMD or entrypoint would be essential here.
