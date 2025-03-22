from django.shortcuts import render, redirect, get_object_or_404
from django.http import JsonResponse
from django.conf import settings
from django.views.decorators.csrf import csrf_exempt
from rest_framework.decorators import api_view, parser_classes
from rest_framework.parsers import MultiPartParser, FormParser, JSONParser
from rest_framework.response import Response
from rest_framework import status
from .models import Document, Conversation, Message, Automation
from .forms import DocumentUploadForm
from .serializers import DocumentSerializer, ConversationSerializer, MessageSerializer, AutomationSerializer
from .utils.document_processor import process_document, generate_citation
from .utils.vector_store import VectorStore
from .utils.llm_service import LLMService
from .utils.openai_service import OpenAIService
from .utils.automation_service import AutomationService
import json
import os

# Initialize services
openai_service = OpenAIService()
vector_store = VectorStore(settings.VECTOR_STORE_DIR)
llm_service = LLMService(settings.LLM_MODEL_PATH, settings.LLM_MODEL_NAME)
# Create a variable to store the AutomationService instance - will be initialized on first use
automation_service = None

# Connect OpenAI service to vector store for better embeddings
vector_store.openai_service = openai_service

# Load documents from database into vector store on startup
if hasattr(vector_store, '_load_documents_from_database'):
    try:
        vector_store._load_documents_from_database()
    except Exception as e:
        print(f"Error loading documents into vector store: {str(e)}")

# Helper function to get or create the automation service
def get_automation_service():
    global automation_service
    if automation_service is None:
        automation_service = AutomationService()
    return automation_service

def index(request):
    """Render the main chat interface."""
    conversations = Conversation.objects.all().order_by('-updated_at')
    if not conversations.exists():
        # Create a default conversation if none exists
        default_conversation = Conversation.objects.create(title="New Conversation")
        Message.objects.create(
            conversation=default_conversation,
            role="system",
            content="I am an assistant that can help you with documents and trigger automations. Upload documents or start chatting."
        )
        conversations = [default_conversation]
    
    return render(request, 'chat_app/index.html', {
        'conversations': conversations,
        'current_conversation': conversations[0]
    })

@api_view(['GET', 'POST'])
def conversations(request):
    """API endpoint for managing conversations."""
    if request.method == 'GET':
        conversations = Conversation.objects.all().order_by('-updated_at')
        serializer = ConversationSerializer(conversations, many=True)
        return Response(serializer.data)
    
    elif request.method == 'POST':
        serializer = ConversationSerializer(data=request.data)
        if serializer.is_valid():
            conversation = serializer.save()
            # Add system message
            Message.objects.create(
                conversation=conversation,
                role="system",
                content="I am an assistant that can help you with documents and trigger automations. Upload documents or start chatting."
            )
            return Response(serializer.data, status=status.HTTP_201_CREATED)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

@api_view(['GET', 'DELETE'])
def conversation_detail(request, conversation_id):
    """API endpoint for individual conversation operations."""
    try:
        conversation = Conversation.objects.get(pk=conversation_id)
    except Conversation.DoesNotExist:
        return Response(status=status.HTTP_404_NOT_FOUND)
    
    if request.method == 'GET':
        serializer = ConversationSerializer(conversation)
        return Response(serializer.data)
    
    elif request.method == 'DELETE':
        conversation.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)

@api_view(['GET', 'POST'])
def messages(request, conversation_id):
    """API endpoint for messages in a conversation."""
    try:
        conversation = Conversation.objects.get(pk=conversation_id)
    except Conversation.DoesNotExist:
        return Response(status=status.HTTP_404_NOT_FOUND)
    
    if request.method == 'GET':
        messages = conversation.messages.all()
        serializer = MessageSerializer(messages, many=True)
        return Response(serializer.data)
    
    elif request.method == 'POST':
        # Check if there's a command in the message
        user_message = request.data.get('content', '')
        
        # Create user message
        user_message_obj = Message.objects.create(
            conversation=conversation,
            role='user',
            content=user_message
        )
        
        # Check for @automation command
        if '@automation' in user_message.lower():
            # Handle automation command
            automation_response = get_automation_service().handle_automation_command(user_message)
            
            # Create assistant message with automation response
            assistant_message = Message.objects.create(
                conversation=conversation,
                role='assistant',
                content=automation_response
            )
            
            # Return both user and assistant messages
            serializer = MessageSerializer([user_message_obj, assistant_message], many=True)
            return Response(serializer.data, status=status.HTTP_201_CREATED)
        
        # Normal message processing
        # 1. Search vector store for relevant documents
        relevant_docs = vector_store.search(user_message, top_k=3)
        
        # Debug information about documents
        print(f"Found {len(relevant_docs)} relevant documents for query: {user_message}")
        for i, doc in enumerate(relevant_docs):
            print(f"Document {i+1}:")
            print(f"  Content length: {len(doc.get('content', ''))}")
            print(f"  Metadata: {doc.get('metadata', {})}")
            print(f"  Relevance score: {doc.get('relevance_score', 0)}")
        
        # 2. Format conversation history and context for LLM
        conversation_history = []
        for msg in conversation.messages.all().order_by('created_at'):
            if msg.id != user_message_obj.id:  # Skip the message we just added
                conversation_history.append({"role": msg.role, "content": msg.content})
        
        # 3. Get response - use OpenAI if available, otherwise fall back to local LLM
        response = None
        try:
            # First try using OpenAI service
            if openai_service.initialized:
                response = openai_service.generate_chat_response(
                    user_message,
                    conversation_history,
                    relevant_docs
                )
        except Exception as e:
            print(f"Error using OpenAI service: {str(e)}")
            response = None
            
        # If OpenAI failed or not available, use fallback LLM service
        if response is None:
            response = llm_service.generate_response(
                user_message, 
                conversation_history, 
                relevant_docs
            )
        
        # 4. Create assistant message
        assistant_message = Message.objects.create(
            conversation=conversation,
            role='assistant',
            content=response
        )
        
        # Update conversation timestamp
        conversation.save()  # This will update the updated_at field
        
        # Return both user and assistant messages
        serializer = MessageSerializer([user_message_obj, assistant_message], many=True)
        return Response(serializer.data, status=status.HTTP_201_CREATED)

@api_view(['POST'])
@parser_classes([MultiPartParser, FormParser])
def upload_document(request):
    """API endpoint for uploading and processing documents."""
    try:
        # Print request details for debugging
        print(f"Upload document request: FILES={request.FILES}, POST={request.POST}")
        
        # Check if file is in the request
        if 'file' not in request.FILES:
            return Response(
                {"error": "No file found in the request. Please select a file to upload."},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        form = DocumentUploadForm(request.POST, request.FILES)
        if form.is_valid():
            document = form.save()
            
            # Process document and add to vector store
            success, content = process_document(document)
            
            if success:
                document.content = content
                document.save()
                
                # Add to vector store
                print(f"Adding document to vector store: {document.title}")
                print(f"Document content length: {len(content)} characters")
                vector_id = vector_store.add_document(str(document.id), document.title, content)
                document.vector_id = vector_id
                document.save()
                print(f"Document added to vector store with ID: {vector_id}")
                
                # Print vector store stats after upload
                doc_count = len(vector_store.documents_by_id) if hasattr(vector_store, 'documents_by_id') else 0
                print(f"Vector store now contains {doc_count} document chunks")
                
                serializer = DocumentSerializer(document)
                return Response(serializer.data, status=status.HTTP_201_CREATED)
            else:
                # Delete document if processing failed
                document.delete()
                return Response(
                    {"error": "Failed to process document", "details": content},
                    status=status.HTTP_400_BAD_REQUEST
                )
        else:
            print(f"Form validation failed: {form.errors}")
            return Response(form.errors, status=status.HTTP_400_BAD_REQUEST)
    except Exception as e:
        import traceback
        print(f"Exception in upload_document: {str(e)}")
        print(traceback.format_exc())
        return Response(
            {"error": "An unexpected error occurred", "details": str(e)},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )

@api_view(['GET'])
def documents(request):
    """API endpoint to list all uploaded documents."""
    documents = Document.objects.all().order_by('-uploaded_at')
    serializer = DocumentSerializer(documents, many=True)
    return Response(serializer.data)

@api_view(['DELETE'])
def delete_document(request, document_id):
    """API endpoint to delete a document and remove it from vector store."""
    try:
        document = Document.objects.get(pk=document_id)
    except Document.DoesNotExist:
        return Response(status=status.HTTP_404_NOT_FOUND)
    
    # Remove from vector store if it exists there
    if document.vector_id:
        vector_store.delete_document(document.vector_id)
    
    # Delete the file
    if document.file and os.path.isfile(document.file.path):
        os.remove(document.file.path)
    
    # Delete the document record
    document.delete()
    
    return Response(status=status.HTTP_204_NO_CONTENT)

@api_view(['GET'])
def automations(request):
    """API endpoint to list available automations."""
    automations = Automation.objects.all()
    serializer = AutomationSerializer(automations, many=True)
    return Response(serializer.data)

@api_view(['POST'])
def trigger_automation(request, automation_id):
    """API endpoint to trigger a specific automation."""
    try:
        automation = Automation.objects.get(pk=automation_id)
    except Automation.DoesNotExist:
        return Response(
            {"error": "Automation not found"}, 
            status=status.HTTP_404_NOT_FOUND
        )
    
    # Execute the automation
    result = get_automation_service().execute_automation(
        automation.endpoint,
        automation.parameters,
        request.data
    )
    
    return Response(result)

@api_view(['GET', 'POST'])
def generate_document_citation(request, document_id, style=None):
    """API endpoint to generate citations for a document."""
    try:
        document = Document.objects.get(pk=document_id)
    except Document.DoesNotExist:
        return Response(
            {"error": "Document not found"}, 
            status=status.HTTP_404_NOT_FOUND
        )
    
    # Get citation style from URL path, request parameters, or default to APA
    if style is None:
        style = request.GET.get('style', 'apa')
        if request.method == 'POST' and 'style' in request.data:
            style = request.data.get('style')
    
    # Valid citation styles
    valid_styles = ['apa', 'mla', 'chicago', 'harvard']
    if style not in valid_styles:
        style = 'apa'  # Default to APA if invalid style
    
    # Generate citation
    citation = generate_citation(document, style)
    
    return Response({
        'document_id': str(document.id),
        'title': document.title,
        'style': style,
        'citation': citation
    })

@api_view(['GET'])
def document_citations(request, document_id):
    """Generate all citation styles for a document."""
    try:
        document = Document.objects.get(pk=document_id)
    except Document.DoesNotExist:
        return Response(
            {"error": "Document not found"}, 
            status=status.HTTP_404_NOT_FOUND
        )
    
    # Generate citations in all supported styles
    citations = {
        'apa': generate_citation(document, 'apa'),
        'mla': generate_citation(document, 'mla'),
        'chicago': generate_citation(document, 'chicago'),
        'harvard': generate_citation(document, 'harvard')
    }
    
    return Response({
        'document_id': str(document.id),
        'title': document.title,
        'citations': citations
    })

@api_view(['GET'])
def debug_vector_store(request):
    """Debug endpoint to check vector store status."""
    # Get all documents in the vector store
    doc_count = len(vector_store.documents_by_id) if hasattr(vector_store, 'documents_by_id') else 0
    
    # Get stats about stored documents
    doc_stats = {}
    for doc_id, doc_info in vector_store.documents_info.items():
        doc_stats[doc_id] = {
            'title': doc_info.get('title', 'Unknown'),
            'chunks': doc_info.get('chunks', 0),
            'vector_ids': doc_info.get('vector_ids', [])
        }
    
    # Get sample from documents_by_id
    sample_docs = {}
    counter = 0
    for chunk_id, doc in vector_store.documents_by_id.items():
        if counter < 3:  # Only show first 3 docs for brevity
            sample_docs[chunk_id] = {
                'content_preview': doc['content'][:100] + '...' if len(doc['content']) > 100 else doc['content'],
                'metadata': doc['metadata']
            }
            counter += 1
    
    return Response({
        'vector_store_initialized': vector_store.initialized,
        'document_count_in_db': Document.objects.count(),
        'document_chunks_in_vector_store': doc_count,
        'document_info': doc_stats,
        'sample_chunks': sample_docs,
        'openai_service_attached': hasattr(vector_store, 'openai_service') and vector_store.openai_service is not None
    })
