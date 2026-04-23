from django.db import models
from django.contrib.auth.models import User
from django.utils import timezone


class Profile(models.Model):
    user = models.OneToOneField(User, on_delete=models.CASCADE)
    date_of_birth = models.DateField(null=True, blank=True)

    @property
    def age(self):
        if self.date_of_birth:
            today = timezone.now().date()
            return today.year - self.date_of_birth.year - ((today.month, today.day) < (self.date_of_birth.month, self.date_of_birth.day))
        return None


class Room(models.Model):
    name = models.CharField(max_length=10, unique=True)
    is_active = models.BooleanField(default=False)
    occupancy = models.BooleanField(default=False)
    last_motion = models.DateTimeField(null=True, blank=True)
    energy_saved_today = models.FloatField(default=0.0)

    def __str__(self):
        return f"Room {self.name}"


class MotionEvent(models.Model):
    room = models.ForeignKey(Room, on_delete=models.CASCADE, related_name='events')
    timestamp = models.DateTimeField(default=timezone.now)
    event_type = models.CharField(max_length=50)
    duration = models.CharField(max_length=20, blank=True)
    status = models.CharField(max_length=10, choices=[('on', 'Active'), ('off', 'Ended')])

    class Meta:
        ordering = ['-timestamp']


class EnergyLog(models.Model):
    room = models.ForeignKey(Room, on_delete=models.CASCADE, related_name='energy_logs')
    date = models.DateField()
    hours_on = models.FloatField()
    energy_saved = models.FloatField()

    class Meta:
        unique_together = ['room', 'date']


class EventLog(models.Model):
    room = models.ForeignKey(Room, on_delete=models.CASCADE)
    timestamp = models.DateTimeField(auto_now_add=True)
    event_type = models.CharField(max_length=50)
    details = models.JSONField(default=dict)

    class Meta:
        ordering = ['-timestamp']