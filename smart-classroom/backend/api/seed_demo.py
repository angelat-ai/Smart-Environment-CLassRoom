from django.core.management.base import BaseCommand
from django.contrib.auth.models import User
from django.utils import timezone
from datetime import timedelta
import random
from api.models import Profile, Room, MotionEvent, EnergyLog, AutomationRule

DEMO_ACCOUNTS = [
    {
        'username': 'admin',
        'password': 'admin123',
        'email': 'admin@sec.wmsu.edu.ph',
        'first_name': 'Administrator',
        'last_name': '',
        'role': 'admin',
    },
]

ROOMS = [
    {'name': 'A', 'description': 'CCS Lab 1 — Ground Floor'},
    {'name': 'B', 'description': 'CCS Lab 2 — Ground Floor'},
    {'name': 'C', 'description': 'CCS Lecture Room — 2nd Floor'},
]

class Command(BaseCommand):
    help = 'Seed demo accounts, rooms, and historical data for SEC'

    def handle(self, *args, **kwargs):
        self.stdout.write(self.style.SUCCESS('=== SEC Demo Seed ==='))

        for acc in DEMO_ACCOUNTS:
            if User.objects.filter(username=acc['username']).exists():
                self.stdout.write(f"  Account exists: {acc['username']}")
                continue
            user = User.objects.create_user(
                username=acc['username'],
                password=acc['password'],
                email=acc['email'],
                first_name=acc['first_name'],
                last_name=acc['last_name'],
            )
            user.is_active = True
            user.is_staff = True
            user.save()
            Profile.objects.create(user=user, role=acc['role'])
            self.stdout.write(self.style.SUCCESS(f'  Created: {acc["username"]} ({acc["role"]})'))

        today = timezone.now().date()
        for room_data in ROOMS:
            room, created = Room.objects.get_or_create(
                name=room_data['name'],
                defaults={
                    'description': room_data['description'],
                    'is_active': False,
                    'occupancy': False,
                    'energy_saved_today': round(random.uniform(0.2, 0.8), 3),
                }
            )
            if created:
                self.stdout.write(self.style.SUCCESS(f'  Created Room {room.name}'))

            for day_offset in range(7):
                day = today - timedelta(days=6 - day_offset)
                hours = round(random.uniform(1.5, 6.5), 2)
                saved = round(hours * 0.09, 3)
                EnergyLog.objects.get_or_create(
                    room=room, date=day,
                    defaults={'hours_on': hours, 'energy_saved': saved}
                )

                periods = [(7, 9), (10, 12), (13, 15), (15, 17)]
                for (start_h, end_h) in periods:
                    if random.random() < 0.75:
                        on_time = timezone.make_aware(
                            timezone.datetime(day.year, day.month, day.day, start_h, random.randint(0, 30))
                        )
                        off_time = timezone.make_aware(
                            timezone.datetime(day.year, day.month, day.day, end_h, random.randint(0, 30))
                        )
                        MotionEvent.objects.get_or_create(
                            room=room, timestamp=on_time, event_type='Motion Detected',
                            defaults={'duration': '—', 'status': 'on'}
                        )
                        MotionEvent.objects.get_or_create(
                            room=room, timestamp=off_time, event_type='Lights Auto-OFF',
                            defaults={'duration': '7s timeout', 'status': 'off'}
                        )

            if not AutomationRule.objects.filter(room=room).exists():
                AutomationRule.objects.create(
                    name=f'Auto lights off — Room {room.name}',
                    room=room, trigger='no_motion', action='lights_off',
                    delay_minutes=5, enabled=True
                )

        self.stdout.write(self.style.SUCCESS('\n=== DEMO ACCOUNT ==='))
        self.stdout.write(f"  Username: admin | Password: admin123")

        self.stdout.write(self.style.SUCCESS('\nSeed complete.'))