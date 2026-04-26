from django.db import models
from django.contrib.auth.models import User
from django.utils import timezone


class Profile(models.Model):
    ROLE_CHOICES = [
        ('admin', 'Admin'),
        ('professor', 'Professor'),
        ('viewer', 'Viewer'),
    ]
    user = models.OneToOneField(User, on_delete=models.CASCADE, related_name='profile')
    role = models.CharField(max_length=20, choices=ROLE_CHOICES, default='viewer')
    date_of_birth = models.DateField(null=True, blank=True)
    assigned_rooms = models.ManyToManyField('Room', blank=True, related_name='assigned_profiles')

    @property
    def age(self):
        if self.date_of_birth:
            today = timezone.now().date()
            return today.year - self.date_of_birth.year - (
                (today.month, today.day) < (self.date_of_birth.month, self.date_of_birth.day)
            )
        return None

    def __str__(self):
        return f"{self.user.username} ({self.role})"


class Room(models.Model):
    name = models.CharField(max_length=10, unique=True)
    description = models.CharField(max_length=200, blank=True, default='')
    is_active = models.BooleanField(default=False)
    occupancy = models.BooleanField(default=False)
    last_motion = models.DateTimeField(null=True, blank=True)
    energy_saved_today = models.FloatField(default=0.0)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"Room {self.name}"


class MotionEvent(models.Model):
    STATUS_CHOICES = [('on', 'On'), ('off', 'Off')]
    room = models.ForeignKey(Room, on_delete=models.CASCADE, related_name='events')
    timestamp = models.DateTimeField(auto_now_add=True)
    event_type = models.CharField(max_length=100)
    duration = models.CharField(max_length=50, blank=True, default='—')
    status = models.CharField(max_length=10, choices=STATUS_CHOICES, default='on')

    class Meta:
        ordering = ['-timestamp']

    def __str__(self):
        return f"{self.room.name} - {self.event_type} at {self.timestamp}"


class EnergyLog(models.Model):
    room = models.ForeignKey(Room, on_delete=models.CASCADE, related_name='energy_logs')
    date = models.DateField()
    hours_on = models.FloatField(default=0.0)
    energy_saved = models.FloatField(default=0.0)

    class Meta:
        unique_together = ('room', 'date')
        ordering = ['date']

    def __str__(self):
        return f"{self.room.name} - {self.date}"


class EventLog(models.Model):
    room = models.ForeignKey(Room, on_delete=models.CASCADE, related_name='event_logs')
    timestamp = models.DateTimeField(auto_now_add=True)
    event_type = models.CharField(max_length=100)
    details = models.JSONField(default=dict)

    class Meta:
        ordering = ['-timestamp']


class AutomationRule(models.Model):
    TRIGGER_CHOICES = [
        ('no_motion', 'No motion detected'),
        ('motion', 'Motion detected'),
        ('lights_on', 'Lights turn ON'),
        ('lights_off', 'Lights turn OFF'),
        ('time_of_day', 'Time of day'),
    ]
    ACTION_CHOICES = [
        ('lights_off', 'Turn lights OFF'),
        ('lights_on', 'Turn lights ON'),
        ('notify', 'Send notification'),
        ('log_event', 'Log event'),
    ]
    name = models.CharField(max_length=200)
    room = models.ForeignKey(Room, on_delete=models.CASCADE, related_name='automation_rules')
    trigger = models.CharField(max_length=50, choices=TRIGGER_CHOICES)
    action = models.CharField(max_length=50, choices=ACTION_CHOICES)
    delay_minutes = models.IntegerField(default=5)
    enabled = models.BooleanField(default=True)
    created_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"{self.name} - Room {self.room.name}"