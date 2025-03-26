from django.urls import path
from . import views

urlpatterns = [
    # Web interface
    path('', views.index, name='index'),
    
    # API endpoints
    path('api/conversations/', views.conversations, name='conversations'),
    path('api/conversations/<uuid:conversation_id>/', views.conversation_detail, name='conversation_detail'),
    path('api/conversations/<uuid:conversation_id>/messages/', views.messages, name='messages'),
    path('api/conversations/clear/', views.clear_conversations, name='clear_conversations'),
    path('api/documents/', views.documents, name='documents'),
    path('api/documents/upload/', views.upload_document, name='upload_document'),
    path('api/documents/<uuid:document_id>/', views.delete_document, name='delete_document'),
    path('api/documents/clear/', views.clear_documents, name='clear_documents'),
    path('api/automations/', views.automations, name='automations'),
    path('api/automations/<uuid:automation_id>/trigger/', views.trigger_automation, name='trigger_automation'),
    path('api/datasources/', views.datasources, name='datasources'),
    path('api/datasources/<uuid:datasource_id>/query/', views.query_datasource, name='query_datasource'),
    
    # Debug endpoints
    path('api/debug/vector-store/', views.debug_vector_store, name='debug_vector_store'),
    
    # Incident endpoints
    path('api/incidents', views.incidents, name='incidents'),
    path('api/incidents/<uuid:incident_id>/', views.incident_detail, name='incident_detail'),
    
    # Dashboard endpoints
    path('api/dashboards/', views.dashboards, name='dashboards'),
    path('api/dashboards/<uuid:dashboard_id>/', views.dashboard_detail, name='dashboard_detail'),
    
    # Log endpoints
    path('api/logs/', views.logs, name='logs'),
    
    # Knowledge base endpoints
    path('api/knowledge-base/', views.knowledge_base_entries, name='knowledge_base_entries'),
    path('api/knowledge-base/<uuid:kb_id>/', views.knowledge_base_detail, name='knowledge_base_detail'),
]
