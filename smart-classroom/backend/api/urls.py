from django.urls import path, include
from rest_framework.routers import DefaultRouter
from rest_framework_simplejwt.views import TokenObtainPairView, TokenRefreshView
from . import views

router = DefaultRouter()
router.register(r'rooms', views.RoomViewSet)

urlpatterns = [
    path('', include(router.urls)),
    path('motion/', views.motion_detected),
    path('simulate/', views.simulate_motion),
    path('register/', views.register),
    path('verify-otp/', views.verify_otp),
    path('token/', TokenObtainPairView.as_view(), name='token_obtain_pair'),
    path('token/refresh/', TokenRefreshView.as_view(), name='token_refresh'),
    path('user/', views.current_user),
    path('history/<str:room_name>/<int:year>/<int:month>/<int:day>/', views.room_history),
    path('calendar/<str:room_name>/<int:year>/<int:month>/<int:day>/', views.calendar_events),
    path('esp32/<str:room_name>/status/', views.esp32_status),
]