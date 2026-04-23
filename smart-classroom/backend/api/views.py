from rest_framework import viewsets
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework_simplejwt.tokens import RefreshToken
from django.contrib.auth.models import User
from django.utils import timezone
from datetime import datetime
import random

from .models import Room, MotionEvent, EnergyLog, EventLog
from .serializers import (
    RoomSerializer, MotionEventSerializer,
    EnergyLogSerializer, RegisterSerializer, UserSerializer
)


class RoomViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = Room.objects.all()
    serializer_class = RoomSerializer
    permission_classes = [AllowAny]


@api_view(['POST'])
@permission_classes([AllowAny])
def register(request):
    serializer = RegisterSerializer(data=request.data)
    if serializer.is_valid():
        user = serializer.save()
        refresh = RefreshToken.for_user(user)
        return Response({
            'message': 'Registration successful.',
            'access': str(refresh.access_token),
            'refresh': str(refresh),
            'username': user.username,
            'first_name': user.first_name,
        }, status=201)
    return Response(serializer.errors, status=400)


@api_view(['POST'])
@permission_classes([AllowAny])
def verify_otp(request):
    return Response({'message': 'OTP not required in this mode.'}, status=200)


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def current_user(request):
    serializer = UserSerializer(request.user)
    return Response(serializer.data)


@api_view(['POST'])
@permission_classes([AllowAny])
def motion_detected(request):
    room_name = request.data.get('room')
    event = request.data.get('event', 'Motion Detected')
    source = request.data.get('source', 'esp32')
    if not room_name:
        return Response({'error': 'Room name required'}, status=400)
    room, _ = Room.objects.get_or_create(
        name=room_name,
        defaults={'is_active': False, 'occupancy': False, 'energy_saved_today': 0.0}
    )
    is_on = event in ('Lights ON', 'Motion Detected')
    room.is_active = is_on
    room.occupancy = is_on
    room.last_motion = timezone.now()
    if is_on:
        room.energy_saved_today = round(room.energy_saved_today + random.uniform(0.05, 0.15), 3)
    room.save()
    MotionEvent.objects.create(
        room=room,
        event_type=event,
        duration=f"{random.randint(5, 60)}m" if is_on else '—',
        status='on' if is_on else 'off'
    )
    today = timezone.now().date()
    log, _ = EnergyLog.objects.get_or_create(room=room, date=today, defaults={'hours_on': 0.0, 'energy_saved': 0.0})
    if is_on:
        log.hours_on = round(log.hours_on + 0.1, 2)
        log.energy_saved = round(log.energy_saved + random.uniform(0.05, 0.12), 3)
        log.save()
    EventLog.objects.create(room=room, event_type=event, details={'source': source, 'is_on': is_on})
    return Response({'status': 'ok', 'room': room_name, 'event': event, 'occupancy': room.occupancy, 'energy_saved_today': room.energy_saved_today})


@api_view(['POST'])
@permission_classes([AllowAny])
def simulate_motion(request):
    room_name = request.data.get('room')
    event = request.data.get('event', 'Lights ON')
    if not room_name:
        return Response({'error': 'Room name required'}, status=400)
    room, _ = Room.objects.get_or_create(
        name=room_name,
        defaults={'is_active': False, 'occupancy': False, 'energy_saved_today': 0.0}
    )
    is_on = event not in ('Lights OFF',)
    room.is_active = is_on
    room.occupancy = is_on
    room.last_motion = timezone.now()
    if is_on:
        room.energy_saved_today = round(room.energy_saved_today + random.uniform(0.05, 0.15), 3)
    room.save()
    MotionEvent.objects.create(
        room=room,
        event_type=event,
        duration=f"{random.randint(5, 60)}m" if is_on else '—',
        status='on' if is_on else 'off'
    )
    today = timezone.now().date()
    log, _ = EnergyLog.objects.get_or_create(room=room, date=today, defaults={'hours_on': 0.0, 'energy_saved': 0.0})
    if is_on:
        log.hours_on = round(log.hours_on + 0.1, 2)
        log.energy_saved = round(log.energy_saved + random.uniform(0.05, 0.12), 3)
        log.save()
    EventLog.objects.create(room=room, event_type=event, details={'source': 'simulator', 'is_on': is_on})
    serializer = RoomSerializer(room)
    return Response({'status': 'ok', 'room': serializer.data})


@api_view(['GET'])
@permission_classes([AllowAny])
def room_history(request, room_name, year, month, day):
    try:
        room = Room.objects.get(name=room_name)
    except Room.DoesNotExist:
        return Response({'error': 'Room not found'}, status=404)
    try:
        date_obj = datetime(year, month, day).date()
    except ValueError:
        return Response({'error': 'Invalid date'}, status=400)
    events = MotionEvent.objects.filter(room=room, timestamp__date=date_obj)
    energy_logs = EnergyLog.objects.filter(room=room, date=date_obj)
    return Response({
        'date': str(date_obj),
        'name': room.name,
        'events': MotionEventSerializer(events, many=True).data,
        'energy_logs': EnergyLogSerializer(energy_logs, many=True).data,
        'occupancy': events.filter(status='on').exists(),
        'energy_saved_today': sum(log.energy_saved for log in energy_logs),
        'last_motion': events.first().timestamp if events.exists() else None
    })


@api_view(['GET'])
@permission_classes([AllowAny])
def calendar_events(request, room_name, year, month, day):
    return room_history(request, room_name=room_name, year=year, month=month, day=day)


@api_view(['GET'])
@permission_classes([AllowAny])
def esp32_status(request, room_name):
    try:
        room = Room.objects.get(name=room_name)
    except Room.DoesNotExist:
        return Response({'error': 'Room not found'}, status=404)
    return Response({'room': room_name, 'lights_on': room.is_active, 'occupancy': room.occupancy})