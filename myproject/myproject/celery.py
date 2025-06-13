import os
from celery import Celery

# Set the default Django settings module for the 'celery' program.
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'myproject.settings')

app = Celery('myproject')

# Using a string here means the worker doesn't have to serialize
# the configuration object to child processes.
# - namespace='CELERY' means all celery-related configuration keys
#   should have a `CELERY_` prefix.
app.config_from_object('django.conf:settings', namespace='CELERY')

# Load task modules from all registered Django app configs.
app.autodiscover_tasks()


@app.task(bind=True, name='debug_task') # Explicitly naming the task
def debug_task(self):
    print(f'Request: {self.request!r}')
    # Example: Accessing settings
    # from django.conf import settings
    # print(f'Broker URL: {settings.CELERY_BROKER_URL}')
    return "Debug task executed successfully."
