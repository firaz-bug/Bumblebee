from django.urls import path
from . import views

urlpatterns = [
    # Web interface
    path('', views.index, name='index'),
    
    # API endpoints
    path('api/conversations/', views.conversations, name='conversations'),
    path('api/conversations/<uuid:conversation_id>/', views.conversation_detail, name='conversation_detail'),
    path('api/conversations/<uuid:conversation_id>/messages/', views.messages, name='messages'),
    path('api/documents/', views.documents, name='documents'),
    path('api/documents/upload/', views.upload_document, name='upload_document'),
    path('api/documents/<uuid:document_id>/delete/', views.delete_document, name='delete_document'),
    path('api/automations/', views.automations, name='automations'),
    path('api/automations/<uuid:automation_id>/trigger/', views.trigger_automation, name='trigger_automation'),
    path('api/datasources/', views.datasources, name='datasources'),
    path('api/datasources/<uuid:datasource_id>/query/', views.query_datasource, name='query_datasource'),
    
    # Debug endpoints
    path('api/debug/vector-store/', views.debug_vector_store, name='debug_vector_store'),
    
    # Incident endpoints
    path('api/incidents/', views.incidents, name='incidents'),
    path('api/incidents/<uuid:incident_id>/', views.incident_detail, name='incident_detail'),
]
