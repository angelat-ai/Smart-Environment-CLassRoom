from rest_framework import serializers
from django.contrib.auth.models import User
from .models import Room, MotionEvent, EnergyLog, EventLog, Profile, AutomationRule


class ProfileSerializer(serializers.ModelSerializer):
    age = serializers.IntegerField(read_only=True)

    class Meta:
        model = Profile
        fields = ['role', 'date_of_birth', 'age']


class UserSerializer(serializers.ModelSerializer):
    profile = ProfileSerializer(read_only=True)
    role = serializers.SerializerMethodField()

    class Meta:
        model = User
        fields = ['id', 'username', 'email', 'first_name', 'last_name', 'profile', 'role']

    def get_role(self, obj):
        try:
            return obj.profile.role
        except Profile.DoesNotExist:
            return 'viewer'


class RegisterSerializer(serializers.ModelSerializer):
    password = serializers.CharField(write_only=True)
    confirm_password = serializers.CharField(write_only=True)
    date_of_birth = serializers.DateField(write_only=True, required=False)
    role = serializers.ChoiceField(choices=['admin', 'professor', 'viewer'], default='viewer', write_only=True)

    class Meta:
        model = User
        fields = ['username', 'email', 'password', 'confirm_password', 'first_name', 'last_name', 'date_of_birth', 'role']

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
        role = validated_data.pop('role', 'viewer')
        user = User.objects.create_user(
            username=validated_data['username'],
            email=validated_data['email'],
            password=validated_data['password'],
            first_name=validated_data.get('first_name', ''),
            last_name=validated_data.get('last_name', '')
        )
        user.is_active = True
        user.save()
        Profile.objects.create(user=user, date_of_birth=dob, role=role)
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


class AutomationRuleSerializer(serializers.ModelSerializer):
    room_name = serializers.CharField(source='room.name', read_only=True)
    created_by_username = serializers.CharField(source='created_by.username', read_only=True)

    class Meta:
        model = AutomationRule
        fields = ['id', 'name', 'room', 'room_name', 'trigger', 'action', 'delay_minutes', 'enabled', 'created_by_username', 'created_at']


class RoomSerializer(serializers.ModelSerializer):
    events = MotionEventSerializer(many=True, read_only=True)
    energy_logs = EnergyLogSerializer(many=True, read_only=True)
    automation_rules = AutomationRuleSerializer(many=True, read_only=True)

    class Meta:
        model = Room
        fields = ['id', 'name', 'description', 'is_active', 'occupancy', 'last_motion', 'energy_saved_today', 'events', 'energy_logs', 'automation_rules', 'created_at']


class EventLogSerializer(serializers.ModelSerializer):
    class Meta:
        model = EventLog
        fields = ['timestamp', 'event_type', 'details']