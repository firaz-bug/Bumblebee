from django.db import models
import os
import uuid

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
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    name = models.CharField(max_length=100)
    description = models.TextField()
    endpoint = models.CharField(max_length=255)
    parameters = models.JSONField(default=dict, blank=True)
    
    def __str__(self):
        return self.name
