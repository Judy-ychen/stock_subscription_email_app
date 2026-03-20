import os
from django.core.management.base import BaseCommand
from django.contrib.auth import get_user_model


class Command(BaseCommand):
    help = "Create admin user if it does not exist"

    def handle(self, *args, **options):
        User = get_user_model()

        email = os.getenv("DJANGO_SUPERUSER_EMAIL")
        password = os.getenv("DJANGO_SUPERUSER_PASSWORD")
        first_name = os.getenv("DJANGO_SUPERUSER_FIRST_NAME", "Admin")
        last_name = os.getenv("DJANGO_SUPERUSER_LAST_NAME", "User")

        if not email or not password:
            self.stdout.write(
                self.style.ERROR(
                    "Missing DJANGO_SUPERUSER_EMAIL or DJANGO_SUPERUSER_PASSWORD"
                )
            )
            return

        existing_user = User.objects.filter(email=email).first()

        if existing_user:
            updated = False

            if not existing_user.is_staff:
                existing_user.is_staff = True
                updated = True

            if not existing_user.is_superuser:
                existing_user.is_superuser = True
                updated = True

            if updated:
                existing_user.save()
                self.stdout.write(
                    self.style.SUCCESS(f"Existing user {email} promoted to admin")
                )
            else:
                self.stdout.write(f"Admin already exists: {email}")

            return

        User.objects.create_superuser(
            email=email,
            password=password,
            first_name=first_name,
            last_name=last_name,
        )

        self.stdout.write(self.style.SUCCESS(f"Admin created: {email}"))