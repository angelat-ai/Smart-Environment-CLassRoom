from rest_framework import serializers
from django.contrib.auth.models import User
from .models import Room, MotionEvent, EnergyLog, EventLog, Profile


class ProfileSerializer(serializers.ModelSerializer):
    age = serializers.IntegerField(read_only=True)

    class Meta:
        model = Profile
        fields = ['date_of_birth', 'age']


class UserSerializer(serializers.ModelSerializer):
    profile = ProfileSerializer(read_only=True)

    class Meta:
        model = User
        fields = ['id', 'username', 'email', 'first_name', 'last_name', 'profile']


class RegisterSerializer(serializers.ModelSerializer):
    password = serializers.CharField(write_only=True)
    confirm_password = serializers.CharField(write_only=True)
    date_of_birth = serializers.DateField(write_only=True, required=False)

    class Meta:
        model = User
        fields = ['username', 'email', 'password', 'confirm_password', 'first_name', 'last_name', 'date_of_birth']

    def validate(self, data):
        if data['password'] != data['confirm_password']:
            raise serializers.ValidationError("Passwords do not match")
        if User.objects.filter(email=data['email']).exists():
            raise serializers.ValidationError("Email already registered")
        if User.objects.filter(username=data['username']).exists():
            raise serializers.ValidationError("Username already taken")
        return data

    def create(self, validated_data):
        validated_data.pop('confirm_password')
        dob = validated_data.pop('date_of_birth', None)
        user = User.objects.create_user(
            username=validated_data['username'],
            email=validated_data['email'],
            password=validated_data['password'],
            first_name=validated_data.get('first_name', ''),
            last_name=validated_data.get('last_name', '')
        )
        user.is_active = True
        user.save()
        Profile.objects.create(user=user, date_of_birth=dob)
        return user


class MotionEventSerializer(serializers.ModelSerializer):
    room_name = serializers.CharField(source='room.name', read_only=True)

    class Meta:
        model = MotionEvent
        fields = ['id', 'timestamp', 'event_type', 'duration', 'status', 'room_name']


class EnergyLogSerializer(serializers.ModelSerializer):
    class Meta:
        model = EnergyLog
        fields = ['date', 'hours_on', 'energy_saved']


class RoomSerializer(serializers.ModelSerializer):
    events = MotionEventSerializer(many=True, read_only=True)
    energy_logs = EnergyLogSerializer(many=True, read_only=True)

    class Meta:
        model = Room
        fields = ['id', 'name', 'is_active', 'occupancy', 'last_motion', 'energy_saved_today', 'events', 'energy_logs']


class EventLogSerializer(serializers.ModelSerializer):
    class Meta:
        model = EventLog
        fields = ['timestamp', 'event_type', 'details']