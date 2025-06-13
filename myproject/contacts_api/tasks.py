from celery import shared_task
import time

@shared_task
def add(x, y):
    """Simulates a short-running task that adds two numbers."""
    time.sleep(5) # Simulate a delay
    result = x + y
    print(f"Task 'add({x}, {y})' executed. Result: {result}")
    return result

@shared_task
def simple_test_task(message: str):
    """A simple test task that prints a message and returns a processed string."""
    print(f"Celery task 'simple_test_task' received: {message}")
    # Simulate some work
    processed_message = f"Successfully processed: '{message}' by Celery."
    print(f"Celery task 'simple_test_task' finished. Returning: {processed_message}")
    return processed_message

# Example of a task that might interact with Django models (conceptual)
# from .models import Contact # Assuming you have a Contact model
# @shared_task
# def count_contacts_for_user(user_id):
#     from django.contrib.auth.models import User
#     try:
#         user = User.objects.get(id=user_id)
#         count = Contact.objects.filter(owner=user).count()
#         print(f"Found {count} contacts for user {user.username}")
#         return count
#     except User.DoesNotExist:
#         print(f"User with id {user_id} not found.")
#         return 0
