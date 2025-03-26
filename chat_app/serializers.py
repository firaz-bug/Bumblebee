from rest_framework import serializers
from .models import Document, Conversation, Message, Automation, Incident, DataSource, Dashboard, Log, KnowledgeBase

class DataSourceSerializer(serializers.ModelSerializer):
    class Meta:
        model = DataSource
        fields = ['id', 'name', 'description', 'endpoint', 'call_type', 'parameters', 'auth_required', 'created_at', 'updated_at']
        read_only_fields = ['id', 'created_at', 'updated_at']
        
class DashboardSerializer(serializers.ModelSerializer):
    class Meta:
        model = Dashboard
        fields = ['id', 'name', 'description', 'link', 'created_at', 'updated_at']
        read_only_fields = ['id', 'created_at', 'updated_at']
        
class LogSerializer(serializers.ModelSerializer):
    class Meta:
        model = Log
        fields = ['id', 'message', 'level', 'source', 'timestamp']
        read_only_fields = ['id', 'timestamp']

class DocumentSerializer(serializers.ModelSerializer):
    class Meta:
        model = Document
        fields = ['id', 'title', 'file', 'file_type', 'uploaded_at']

class MessageSerializer(serializers.ModelSerializer):
    class Meta:
        model = Message
        fields = ['id', 'conversation', 'role', 'content', 'created_at']
        read_only_fields = ['id', 'created_at']

class ConversationSerializer(serializers.ModelSerializer):
    messages = MessageSerializer(many=True, read_only=True)
    
    class Meta:
        model = Conversation
        fields = ['id', 'title', 'created_at', 'updated_at', 'messages']
        read_only_fields = ['id', 'created_at', 'updated_at']

class AutomationSerializer(serializers.ModelSerializer):
    class Meta:
        model = Automation
        fields = ['id', 'name', 'description', 'endpoint', 'call_type', 'parameters']

class IncidentSerializer(serializers.ModelSerializer):
    state_display = serializers.CharField(source='get_state_display', read_only=True)
    
    class Meta:
        model = Incident
        fields = ['id', 'incident_number', 'sys_id', 'priority', 'short_description', 'long_description', 'state', 'state_display', 'comments', 'created_at', 'updated_at']
        read_only_fields = ['id', 'created_at', 'updated_at']

class KnowledgeBaseSerializer(serializers.ModelSerializer):
    class Meta:
        model = KnowledgeBase
        fields = ['id', 'title', 'content', 'category', 'tags', 'created_at', 'updated_at']
        read_only_fields = ['id', 'created_at', 'updated_at']
