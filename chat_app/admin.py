from django.contrib import admin
from .models import Document, Conversation, Message, Automation, Incident, DataSource, Dashboard, Log, KnowledgeBase

@admin.register(DataSource)
class DataSourceAdmin(admin.ModelAdmin):
    list_display = ('name', 'endpoint', 'auth_required', 'created_at')
    search_fields = ('name', 'description', 'endpoint')
    list_filter = ('auth_required', 'created_at')
    
@admin.register(Dashboard)
class DashboardAdmin(admin.ModelAdmin):
    list_display = ('name', 'link', 'created_at')
    search_fields = ('name', 'description')
    list_filter = ('created_at',)

@admin.register(Log)
class LogAdmin(admin.ModelAdmin):
    list_display = ('level', 'source', 'message', 'timestamp')
    search_fields = ('message', 'source')
    list_filter = ('level', 'timestamp')

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
    list_display = ('incident_number', 'sys_id', 'priority', 'short_description', 'created_at')
    search_fields = ('incident_number', 'short_description', 'long_description')
    list_filter = ('priority', 'created_at')

@admin.register(KnowledgeBase)
class KnowledgeBaseAdmin(admin.ModelAdmin):
    list_display = ('title', 'category', 'created_at', 'updated_at')
    search_fields = ('title', 'content', 'category')
    list_filter = ('category', 'created_at', 'updated_at')
