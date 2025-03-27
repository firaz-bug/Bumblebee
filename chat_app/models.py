from django.db import models
import os
import uuid

class DataSource(models.Model):
    """Model for external data sources that can be queried."""
    CALL_TYPE_CHOICES = [
        ('GET', 'GET'),
        ('POST', 'POST'),
    ]
    
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    name = models.CharField(max_length=100)
    description = models.TextField()
    endpoint = models.CharField(max_length=255)
    call_type = models.CharField(max_length=4, choices=CALL_TYPE_CHOICES, default='GET')
    parameters = models.JSONField(default=dict, blank=True)
    auth_required = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return self.name

class Document(models.Model):
    """Model for uploaded documents that are processed into the vector store."""
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    title = models.CharField(max_length=255)
    content = models.TextField(blank=True)
    file = models.FileField(upload_to='documents/')
    file_type = models.CharField(max_length=20)
    vector_id = models.CharField(max_length=100, blank=True, null=True)
    uploaded_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return self.title

    def delete(self, *args, **kwargs):
        # Delete from disk first
        if self.file and os.path.isfile(self.file.path):
            os.remove(self.file.path)
        
        # Clear vector store cache
        from .utils.vector_store import VectorStore
        vector_store = VectorStore(os.path.join(os.path.dirname(os.path.dirname(__file__)), 'vector_store'))
        vector_store._initialize_vector_store()  # Ensure it's loaded
        vector_store.delete_document(str(self.id))
        
        super().delete(*args, **kwargs)

    def save(self, *args, **kwargs):
        if self.file:
            if not self.title:
                self.title = os.path.basename(self.file.name)
                
            file_extension = os.path.splitext(self.file.name)[1].lower()
            if file_extension == '.pdf':
                self.file_type = 'pdf'
            elif file_extension in ['.docx', '.doc']:
                self.file_type = 'word'
            elif file_extension in ['.txt', '.md']:
                self.file_type = 'text'
            else:
                self.file_type = 'other'
                
            print(f"Saving document: title={self.title}, file_type={self.file_type}, file={self.file.name}")
        super().save(*args, **kwargs)

class Conversation(models.Model):
    """Model for chat conversations."""
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    title = models.CharField(max_length=255, default="New Conversation")
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return self.title

class Message(models.Model):
    """Model for individual messages in a conversation."""
    ROLE_CHOICES = [
        ('user', 'User'),
        ('assistant', 'Assistant'),
        ('system', 'System'),
    ]
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    conversation = models.ForeignKey(Conversation, on_delete=models.CASCADE, related_name='messages')
    role = models.CharField(max_length=10, choices=ROLE_CHOICES)
    content = models.TextField()
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['created_at']

    def __str__(self):
        return f"{self.role}: {self.content[:50]}..."

class Automation(models.Model):
    """Model for automation actions that can be triggered with @automation command."""
    CALL_TYPE_CHOICES = [
        ('GET', 'GET'),
        ('POST', 'POST'),
    ]
    
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    name = models.CharField(max_length=100)
    description = models.TextField()
    endpoint = models.CharField(max_length=255)
    call_type = models.CharField(max_length=4, choices=CALL_TYPE_CHOICES, default='POST')
    parameters = models.JSONField(default=dict, blank=True)
    
    def __str__(self):
        return self.name

class Incident(models.Model):
    """Model for storing incidents."""
    STATE_CHOICES = [
        (1, 'New'),
        (2, 'In Progress'),
        (3, 'On Hold'),
        (4, 'Resolved'),
        (5, 'Closed'),
        (6, 'Cancelled'),
    ]

    PRIORITY_CHOICES = [
        (1,'Critical'),
        (2,'High'),
        (3,'Medium'),
        (4,'Low'),
        (5,'Very Low'),
    ]
    
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    incident_number = models.CharField(max_length=50)
    sys_id = models.CharField(max_length=50, blank=True, null=True)
    priority = models.CharField(choices=PRIORITY_CHOICES, default=5, max_length=20)
    short_description = models.CharField(max_length=255)
    long_description = models.TextField()
    state = models.IntegerField(choices=STATE_CHOICES, default=1)
    comments = models.TextField(blank=True, null=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f"{self.incident_number} - {self.short_description}"
        
class Dashboard(models.Model):
    """Model for storing dashboard links."""
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    name = models.CharField(max_length=100)
    description = models.TextField()
    link = models.URLField(max_length=255)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    def __str__(self):
        return self.name
        
class Log(models.Model):
    """Model for storing system logs."""
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    message = models.TextField()
    level = models.CharField(max_length=20)  # info, warning, error
    source = models.CharField(max_length=100)
    timestamp = models.DateTimeField(auto_now_add=True)
    
    def __str__(self):
        return f"{self.level}: {self.message[:50]}..."

class KnowledgeBase(models.Model):
    """Model for knowledge base entries that are processed into the vector store."""
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    title = models.CharField(max_length=255)
    content = models.TextField()
    category = models.CharField(max_length=100, blank=True)
    tags = models.JSONField(default=list, blank=True)
    vector_id = models.CharField(max_length=100, blank=True, null=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    def __str__(self):
        return self.title
    
    def delete(self, *args, **kwargs):
        # Clear vector store cache
        from .utils.vector_store import VectorStore
        vector_store = VectorStore(os.path.join(os.path.dirname(os.path.dirname(__file__)), 'vector_store'))
        vector_store._initialize_vector_store()  # Ensure it's loaded
        vector_store.delete_knowledge_base_entry(str(self.id))
        
        super().delete(*args, **kwargs)
