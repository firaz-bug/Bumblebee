from django.contrib import admin
from .models import Document, Conversation, Message, Automation, Incident, DataSource

@admin.register(DataSource)
class DataSourceAdmin(admin.ModelAdmin):
    list_display = ('name', 'endpoint', 'auth_required', 'created_at')
    search_fields = ('name', 'description', 'endpoint')
    list_filter = ('auth_required', 'created_at')

@admin.register(Document)
class DocumentAdmin(admin.ModelAdmin):
    list_display = ('title', 'file_type', 'uploaded_at')
    search_fields = ('title', 'content')
    list_filter = ('file_type', 'uploaded_at')

@admin.register(Conversation)
class ConversationAdmin(admin.ModelAdmin):
    list_display = ('id', 'title', 'created_at', 'updated_at')
    search_fields = ('title',)
    list_filter = ('created_at', 'updated_at')

@admin.register(Message)
class MessageAdmin(admin.ModelAdmin):
    list_display = ('id', 'conversation', 'role', 'created_at')
    search_fields = ('content',)
    list_filter = ('role', 'created_at')

@admin.register(Automation)
class AutomationAdmin(admin.ModelAdmin):
    list_display = ('name', 'description', 'endpoint')
    search_fields = ('name', 'description', 'endpoint')

@admin.register(Incident)
class IncidentAdmin(admin.ModelAdmin):
    list_display = ('title', 'severity', 'status', 'created_at')
    search_fields = ('title', 'description')
    list_filter = ('severity', 'status', 'created_at')
