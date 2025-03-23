from rest_framework import serializers
from .models import Document, Conversation, Message, Automation, Incident

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
        fields = ['id', 'name', 'description', 'endpoint', 'parameters']

class IncidentSerializer(serializers.ModelSerializer):
    class Meta:
        model = Incident
        fields = ['id', 'title', 'description', 'severity', 'status', 'created_at', 'updated_at']
        read_only_fields = ['id', 'created_at', 'updated_at']
