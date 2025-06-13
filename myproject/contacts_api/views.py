from rest_framework import viewsets, permissions, status
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.parsers import FileUploadParser, MultiPartParser
from .models import Contact
from .serializers import ContactSerializer
import pandas as pd
from django.db import IntegrityError
from django.contrib.auth.models import User # Required if we create user instances

class ContactViewSet(viewsets.ModelViewSet):
    """
    API endpoint that allows contacts to be viewed or edited.
    """
    serializer_class = ContactSerializer
    permission_classes = [permissions.IsAuthenticated] # Only authenticated users can access

    def get_queryset(self):
        """
        This view should return a list of all the contacts
        for the currently authenticated user.
        """
        return Contact.objects.filter(owner=self.request.user).order_by('-created_at')

    def perform_create(self, serializer):
        """
        Save the owner of the contact as the current logged-in user.
        """
        serializer.save(owner=self.request.user)

    # perform_update and perform_destroy can be left as default
    # as they will correctly update/delete instances owned by the user
    # due to the queryset filtering.
    # If you had more complex logic, like preventing updates to certain fields
    # or custom deletion logic, you would override them.
    #
    # Example:
    # def perform_update(self, serializer):
    #     # instance = serializer.instance
    #     # if instance.owner != self.request.user:
    #     #     raise PermissionDenied("You do not have permission to edit this contact.")
    #     serializer.save()
    #
    # def perform_destroy(self, instance):
    #     # if instance.owner != self.request.user:
    #     #     raise PermissionDenied("You do not have permission to delete this contact.")
    #     instance.delete()


class ContactUploadView(APIView):
    parser_classes = (MultiPartParser, FileUploadParser) # Allow file uploads
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, *args, **kwargs):
        file_obj = request.FILES.get('file', None) # 'file' is the name of the field in the form

        if not file_obj:
            return Response({"error": "No file provided."}, status=status.HTTP_400_BAD_REQUEST)

        filename = file_obj.name.lower()
        df = None

        try:
            if filename.endswith('.csv'):
                df = pd.read_csv(file_obj)
            elif filename.endswith('.xlsx') or filename.endswith('.xls'):
                df = pd.read_excel(file_obj)
            else:
                return Response({"error": "Unsupported file format. Please upload CSV or Excel files."},
                                status=status.HTTP_400_BAD_REQUEST)
        except Exception as e:
            return Response({"error": f"Error reading file: {str(e)}"}, status=status.HTTP_400_BAD_REQUEST)

        if df is None:
             return Response({"error": "Could not parse the file."}, status=status.HTTP_400_BAD_REQUEST)

        # Define expected columns and custom fields prefix/logic
        expected_columns = ['email', 'first_name', 'last_name']
        # Convert all dataframe column names to lowercase for case-insensitive matching
        df.columns = [col.lower() for col in df.columns]

        # Check for mandatory 'email' column (after lowercasing)
        if 'email' not in df.columns:
            return Response({"error": "Required column 'email' not found in the file."}, status=status.HTTP_400_BAD_REQUEST)

        contacts_created = 0
        errors = []

        for index, row in df.iterrows():
            email = row.get('email')
            if not email or pd.isna(email): # Check for empty or NaN email
                errors.append({"row": index + 2, "error": "Email is missing."})
                continue

            # Prepare data for Contact model
            contact_data = {
                'owner': request.user,
                'email': str(email).strip(),
                'first_name': str(row.get('first_name', '')).strip() if pd.notna(row.get('first_name')) else None,
                'last_name': str(row.get('last_name', '')).strip() if pd.notna(row.get('last_name')) else None,
            }

            # Collect custom fields: any column not in expected_columns
            custom_data = {}
            for col_name in df.columns:
                if col_name not in expected_columns:
                    field_value = row.get(col_name)
                    # Ensure NaN values are not passed as actual NaN to JSONField
                    custom_data[col_name] = str(field_value).strip() if pd.notna(field_value) else None

            if custom_data:
                contact_data['custom_fields'] = custom_data

            try:
                Contact.objects.create(**contact_data)
                contacts_created += 1
            except IntegrityError: # Handles unique constraint violation for email
                errors.append({"row": index + 2, "email": email, "error": "Email already exists for this user or globally."})
            except Exception as e: # Catch any other model validation or creation errors
                errors.append({"row": index + 2, "email": email, "error": str(e)})

        summary = {
            "message": "File processed.",
            "contacts_successfully_imported": contacts_created,
            "errors_encountered": len(errors),
            "error_details": errors
        }
        return Response(summary, status=status.HTTP_201_CREATED if contacts_created > 0 else status.HTTP_400_BAD_REQUEST)
