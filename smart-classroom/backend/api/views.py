from rest_framework import viewsets
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from django.utils import timezone
from datetime import datetime
import random

from .models import Room, MotionEvent, EnergyLog, EventLog
from .serializers import RoomSerializer, MotionEventSerializer, EnergyLogSerializer

class RoomViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = Room.objects.all()
    serializer_class = RoomSerializer
    permission_classes = [AllowAny]

@api_view(['POST'])
@permission_classes([AllowAny])
def motion_detected(request):
    room_name = request.data.get('room')
    event = request.data.get('event', 'Motion Detected')
    try:
        room = Room.objects.get(name=room_name)
    except Room.DoesNotExist:
        return Response({'error': 'Room not found'}, status=404)

    room.is_active = True
    room.occupancy = (event != 'Lights OFF')
    room.last_motion = timezone.now()
    room.save()

    MotionEvent.objects.create(
        room=room,
        event_type=event,
        duration='—' if event != 'Lights ON' else f"{random.randint(5,60)}m",
        status='on' if event == 'Lights ON' else 'off'
    )
    if event == 'Lights ON':
        room.energy_saved_today += 0.1
        room.save()

    EventLog.objects.create(
        room=room,
        event_type=event,
        details={'source': request.data.get('source', 'api')}
    )

    return Response({'status': 'ok'})

@api_view(['POST'])
@permission_classes([AllowAny])
def simulate_motion(request):
    return motion_detected(request)

@api_view(['GET'])
@permission_classes([AllowAny])
def room_history(request, room_name, year, month, day):
    try:
        room = Room.objects.get(name=room_name)
    except Room.DoesNotExist:
        return Response({'error': 'Room not found'}, status=404)

    date_obj = datetime(year, month, day).date()
    events = MotionEvent.objects.filter(room=room, timestamp__date=date_obj)
    energy_logs = EnergyLog.objects.filter(room=room, date=date_obj)

    return Response({
        'date': str(date_obj),
        'events': MotionEventSerializer(events, many=True).data,
        'energy_logs': EnergyLogSerializer(energy_logs, many=True).data,
        'occupancy': events.filter(event_type='Motion Detected').exists(),
        'energy_saved_today': sum(log.energy_saved for log in energy_logs),
        'last_motion': events.first().timestamp if events.exists() else None
    })