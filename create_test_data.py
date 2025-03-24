import os
import django
import datetime

# Set up Django
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'chat_assistant.settings')
django.setup()

# Import models
from chat_app.models import Dashboard, Log

# Create sample dashboards
dashboards = [
    {
        'name': 'System Overview',
        'description': 'Overall system health and metrics',
        'link': 'https://grafana.example.com/d/system-overview'
    },
    {
        'name': 'Network Performance',
        'description': 'Network latency and throughput metrics',
        'link': 'https://grafana.example.com/d/network-performance'
    },
    {
        'name': 'API Monitoring',
        'description': 'Real-time API status and performance',
        'link': 'https://grafana.example.com/d/api-monitoring'
    }
]

# Create sample logs
logs = [
    {
        'message': 'System startup complete',
        'level': 'info',
        'source': 'system'
    },
    {
        'message': 'Database connection pool initialized',
        'level': 'info',
        'source': 'database'
    },
    {
        'message': 'Failed login attempt from IP 192.168.1.100',
        'level': 'warning',
        'source': 'auth'
    },
    {
        'message': 'API rate limit exceeded for user johndoe',
        'level': 'warning',
        'source': 'api'
    },
    {
        'message': 'Database query timeout after 30s',
        'level': 'error',
        'source': 'database'
    }
]

# Create dashboards
print("Creating dashboards...")
for dashboard_data in dashboards:
    dashboard, created = Dashboard.objects.get_or_create(
        name=dashboard_data['name'],
        defaults={
            'description': dashboard_data['description'],
            'link': dashboard_data['link']
        }
    )
    if created:
        print(f"Created dashboard: {dashboard.name}")
    else:
        print(f"Dashboard already exists: {dashboard.name}")

# Create logs
print("\nCreating logs...")
for log_data in logs:
    log = Log.objects.create(
        message=log_data['message'],
        level=log_data['level'],
        source=log_data['source']
    )
    print(f"Created log: {log.level} - {log.message}")

print("\nTest data creation complete!")