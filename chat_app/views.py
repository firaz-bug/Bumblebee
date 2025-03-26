from django.shortcuts import render, redirect, get_object_or_404
from django.http import JsonResponse
from django.conf import settings
from django.views.decorators.csrf import csrf_exempt
from rest_framework.decorators import api_view, parser_classes
from rest_framework.parsers import MultiPartParser, FormParser, JSONParser
from rest_framework.response import Response
from rest_framework import status
from .models import Document, Conversation, Message, Automation, Incident, DataSource, Dashboard, Log, KnowledgeBase
from .forms import DocumentUploadForm
from .serializers import DocumentSerializer, ConversationSerializer, MessageSerializer, AutomationSerializer, IncidentSerializer, DataSourceSerializer, DashboardSerializer, LogSerializer, KnowledgeBaseSerializer
from .utils.document_processor import process_document
from .utils.vector_store import VectorStore
from .utils.llm_service import LLMService
from .utils.openai_service import OpenAIService
from .utils.automation_service import AutomationService
from .utils.datasource_service import DataSourceService
import json
import os

# Initialize services
openai_service = OpenAIService()
vector_store = VectorStore(settings.VECTOR_STORE_DIR)
llm_service = LLMService(settings.LLM_MODEL_PATH, settings.LLM_MODEL_NAME)
# Create a variable to store the service instances - will be initialized on first use
automation_service = None
datasource_service = None

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

# Helper function to get or create the data source service
def get_datasource_service():
    global datasource_service
    if datasource_service is None:
        datasource_service = DataSourceService()
    return datasource_service

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
@csrf_exempt
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

@api_view(['GET', 'DELETE', 'PATCH'])
def conversation_detail(request, conversation_id):
    """API endpoint for individual conversation operations."""
    try:
        conversation = Conversation.objects.get(pk=conversation_id)
    except Conversation.DoesNotExist:
        return Response(status=status.HTTP_404_NOT_FOUND)
    
    if request.method == 'GET':
        serializer = ConversationSerializer(conversation)
        return Response(serializer.data)
    
    elif request.method == 'PATCH':
        # Update only the fields provided in the request
        serializer = ConversationSerializer(conversation, data=request.data, partial=True)
        if serializer.is_valid():
            serializer.save()
            return Response(serializer.data)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
    
    elif request.method == 'DELETE':
        conversation.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)

@api_view(['GET', 'POST'])
@csrf_exempt
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
            
            # Check if response is structured (dict) or simple string
            if isinstance(automation_response, dict) and ('logs' in automation_response or 'status' in automation_response):
                # For structured responses, create an assistant message with formatted message
                # and include the full structured response for client-side processing
                if 'formatted_message' in automation_response:
                    assistant_message_content = automation_response['formatted_message']
                else:
                    # Create a formatted message if not already provided
                    assistant_message_content = f"**{automation_response.get('automation', {}).get('name', 'Automation')} Execution Result:**\n\n"
                    
                    if automation_response.get('status') == 'success':
                        assistant_message_content += f"✅ {automation_response.get('message', 'Execution completed successfully.')}"
                    else:
                        assistant_message_content += f"❌ {automation_response.get('message', 'Execution failed.')}"
                
                # Create the message
                assistant_message = Message.objects.create(
                    conversation=conversation,
                    role='assistant',
                    content=assistant_message_content
                )
                
                # Return both messages and the automation logs for the modal
                serializer = MessageSerializer([user_message_obj, assistant_message], many=True)
                
                # Return structured response with messages and automation logs
                return Response({
                    'messages': serializer.data,
                    'automation_logs': automation_response
                }, status=status.HTTP_201_CREATED)
            else:
                # For simple string responses
                assistant_message = Message.objects.create(
                    conversation=conversation,
                    role='assistant',
                    content=automation_response
                )
                
                # Return both user and assistant messages
                serializer = MessageSerializer([user_message_obj, assistant_message], many=True)
                return Response(serializer.data, status=status.HTTP_201_CREATED)
            
        # Check for @datasource command
        if '@datasource' in user_message.lower():
            # Handle data source command
            datasource_response = get_datasource_service().handle_datasource_command(user_message)
            
            # Check if response is structured (dict) or simple string
            if isinstance(datasource_response, dict) and 'logs' in datasource_response:
                # For structured responses, create an assistant message with basic info
                # and include the full structured response for client-side processing
                assistant_message_content = f"**{datasource_response.get('datasource', {}).get('name', 'Data Source')} Query Result:**\n\n"
                
                if datasource_response.get('status') == 'success':
                    assistant_message_content += f"✅ {datasource_response.get('message', 'Query executed successfully.')}"
                else:
                    assistant_message_content += f"❌ {datasource_response.get('message', 'Query execution failed.')}"
                
                # Create the message
                assistant_message = Message.objects.create(
                    conversation=conversation,
                    role='assistant',
                    content=assistant_message_content
                )
                
                # Return both messages with the structured response as metadata
                serializer = MessageSerializer([user_message_obj, assistant_message], many=True)
                
                # Ensure we include the full datasource_logs for the frontend to display the modal
                # Make the logs structure clearer with explicit field mappings
                response_data = {
                    'messages': serializer.data, 
                    'datasource_logs': {
                        'datasource': datasource_response.get('datasource', {}),
                        'status': datasource_response.get('status', ''),
                        'message': datasource_response.get('message', ''),
                        'logs': datasource_response.get('logs', []),
                        'raw_response': datasource_response.get('raw_response')
                    }
                }
                print("Returning datasource logs response:", response_data)
                return Response(response_data, status=status.HTTP_201_CREATED)
            else:
                # For simple string responses (like listings or errors), just return the string
                assistant_message = Message.objects.create(
                    conversation=conversation,
                    role='assistant',
                    content=datasource_response
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
    
    # Remove from vector store using document ID
    vector_store.delete_document(str(document.id))
    
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
@csrf_exempt
def trigger_automation(request, automation_id):
    """API endpoint to trigger a specific automation."""
    try:
        automation = Automation.objects.get(pk=automation_id)
    except Automation.DoesNotExist:
        return Response(
            {"error": "Automation not found"}, 
            status=status.HTTP_404_NOT_FOUND
        )
    
    # Create a log entry for this automation execution
    log_entry = Log.objects.create(
        message=f"Executing automation: {automation.name}",
        level="info",
        source="automation_service"
    )
    
    # Get automation info for the response
    automation_info = {
        "id": str(automation.id),
        "name": automation.name,
        "description": automation.description,
        "endpoint": automation.endpoint,
        "call_type": automation.call_type
    }
    
    # Execute the automation with the specified call type
    result = get_automation_service().execute_automation(
        automation.endpoint,
        automation.parameters,
        request.data,
        call_type=automation.call_type,
        automation_info=automation_info
    )
    
    # If the result is already a structured response with logs
    if isinstance(result, dict) and 'status' in result:
        # Make sure the result has the automation info
        if 'automation' not in result:
            result['automation'] = automation_info
            
        # Make sure it has logs
        if 'logs' not in result or not result['logs']:
            result['logs'] = [{
                "timestamp": log_entry.timestamp.isoformat(),
                "level": log_entry.level,
                "message": log_entry.message
            }]
            
        # Log the result in the database
        log_level = "info" if result['status'] == "success" else "error"
        Log.objects.create(
            message=f"Automation result: {result.get('message', 'No details')}",
            level=log_level,
            source="automation_service"
        )
        
        # Return the structured response directly
        return Response(result)
        
    else:
        # Construct a structured response for legacy/text results
        return Response({
            "status": "success",
            "message": str(result) if result else "Automation executed successfully",
            "automation": automation_info,
            "logs": [{
                "timestamp": log_entry.timestamp.isoformat(),
                "level": log_entry.level,
                "message": log_entry.message
            }],
            "raw_response": result
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
@api_view(['GET'])
def datasources(request):
    """API endpoint to list available data sources."""
    datasources = DataSource.objects.all()
    serializer = DataSourceSerializer(datasources, many=True)
    return Response(serializer.data)

@api_view(['POST'])
@csrf_exempt
def query_datasource(request, datasource_id):
    """API endpoint to query a specific data source."""
    try:
        datasource = DataSource.objects.get(pk=datasource_id)
    except DataSource.DoesNotExist:
        return Response(
            {"error": "Data source not found"}, 
            status=status.HTTP_404_NOT_FOUND
        )
    
    # Create datasource info for logs
    datasource_info = {
        'name': datasource.name,
        'id': str(datasource.id),
        'endpoint': datasource.endpoint,
        'call_type': datasource.call_type
    }
    
    # Execute the query with call_type and datasource info
    result = get_datasource_service().execute_query(
        endpoint=datasource.endpoint,
        param_schema=datasource.parameters,
        params=request.data,
        call_type=datasource.call_type,
        datasource_info=datasource_info
    )
    
    # Create a log entry for this datasource query
    log_entry = Log.objects.create(
        message=f"Executed data source query: {datasource.name}",
        level="info" if result.get('status') == 'success' else "error",
        source="datasource_service"
    )
    
    # Return the structured result directly
    return Response(result)

@api_view(['GET', 'POST'])
@csrf_exempt
def incidents(request):
    """API endpoint for listing and creating incidents."""
    if request.method == 'GET':
        incidents = Incident.objects.all().order_by('-created_at')
        serializer = IncidentSerializer(incidents, many=True)
        return Response(serializer.data)
    
    elif request.method == 'POST':
        serializer = IncidentSerializer(data=request.data)
        if serializer.is_valid():
            incident = serializer.save()
            
            # Log incident creation
            Log.objects.create(
                message=f"New incident created: {incident.incident_number} - {incident.short_description} (Priority: {incident.priority})",
                level="info",
                source="api"
            )
            
            return Response(serializer.data, status=status.HTTP_201_CREATED)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

@api_view(['GET', 'PUT', 'DELETE'])
def incident_detail(request, incident_id):
    """API endpoint for retrieving, updating and deleting incidents."""
    try:
        incident = Incident.objects.get(pk=incident_id)
    except Incident.DoesNotExist:
        return Response(status=status.HTTP_404_NOT_FOUND)
    
    if request.method == 'GET':
        # Get base incident data
        serializer = IncidentSerializer(incident)
        response_data = serializer.data
        
        # Find related automations based on incident description
        automation_ids = vector_store.recommend_automations(incident.long_description)
        if automation_ids:
            recommended_automations = Automation.objects.filter(id__in=automation_ids)
            automation_serializer = AutomationSerializer(recommended_automations, many=True)
            response_data['recommended_automations'] = automation_serializer.data
        else:
            response_data['recommended_automations'] = []
            
        # Find related dashboards based on incident description
        dashboard_ids = vector_store.recommend_dashboards(incident.long_description)
        if dashboard_ids:
            recommended_dashboards = Dashboard.objects.filter(id__in=dashboard_ids)
            dashboard_serializer = DashboardSerializer(recommended_dashboards, many=True)
            response_data['recommended_dashboards'] = dashboard_serializer.data
        else:
            response_data['recommended_dashboards'] = []
            
        return Response(response_data)
    
    elif request.method == 'PUT':
        # Get current incident data
        current_data = IncidentSerializer(incident).data
        
        # Update with provided fields
        for field, value in request.data.items():
            if field in current_data:
                setattr(incident, field, value)
        
        # Save the updated incident
        incident.save()
        
        # Return the updated incident
        serializer = IncidentSerializer(incident)
        return Response(serializer.data)
    
    elif request.method == 'DELETE':
        incident.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)
        
@api_view(['GET', 'POST'])
def dashboards(request):
    """API endpoint for listing and creating dashboards."""
    if request.method == 'GET':
        dashboards = Dashboard.objects.all().order_by('name')
        serializer = DashboardSerializer(dashboards, many=True)
        return Response(serializer.data)
    
    elif request.method == 'POST':
        serializer = DashboardSerializer(data=request.data)
        if serializer.is_valid():
            serializer.save()
            return Response(serializer.data, status=status.HTTP_201_CREATED)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

@api_view(['GET', 'PUT', 'DELETE'])
def dashboard_detail(request, dashboard_id):
    """API endpoint for retrieving, updating and deleting dashboards."""
    try:
        dashboard = Dashboard.objects.get(pk=dashboard_id)
    except Dashboard.DoesNotExist:
        return Response(status=status.HTTP_404_NOT_FOUND)
    
    if request.method == 'GET':
        serializer = DashboardSerializer(dashboard)
        return Response(serializer.data)
    
    elif request.method == 'PUT':
        serializer = DashboardSerializer(dashboard, data=request.data)
        if serializer.is_valid():
            serializer.save()
            return Response(serializer.data)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
    
    elif request.method == 'DELETE':
        dashboard.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)
        
@api_view(['GET', 'POST'])
def logs(request):
    """API endpoint for listing and creating logs."""
    if request.method == 'GET':
        logs = Log.objects.all().order_by('-timestamp')[:100]  # Limit to last 100 logs
        serializer = LogSerializer(logs, many=True)
        return Response(serializer.data)
    
    elif request.method == 'POST':
        serializer = LogSerializer(data=request.data)
        if serializer.is_valid():
            serializer.save()
            return Response(serializer.data, status=status.HTTP_201_CREATED)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

@api_view(['DELETE'])
def clear_conversations(request):
    """API endpoint for deleting all conversations."""
    # Create a default conversation to remain after clearing
    default_conversation = Conversation.objects.create(title="New Conversation")
    Message.objects.create(
        conversation=default_conversation,
        role='system',
        content='Welcome to Wells Fargo AI Integrated Platform Support Assistant.'
    )
    
    # Delete all other conversations
    Conversation.objects.exclude(id=default_conversation.id).delete()
    
    # Return success message
    return Response({"message": "All conversations cleared. Default conversation created."}, status=status.HTTP_200_OK)

@api_view(['DELETE'])
def clear_documents(request):
    """API endpoint for deleting all documents from database and vector store."""
    # Get all documents
    documents = Document.objects.all()
    
    # Delete each document from vector store
    for document in documents:
        if document.vector_id:
            try:
                vector_store.delete_document(document.id)
            except Exception as e:
                print(f"Error deleting document {document.id} from vector store: {str(e)}")
    
    # Delete all documents from database
    Document.objects.all().delete()
    
    # Return success message
    return Response({"message": "All documents cleared from database and vector store."}, status=status.HTTP_200_OK)

@api_view(['GET', 'POST'])
def knowledge_base_entries(request):
    """API endpoint for listing and creating knowledge base entries."""
    if request.method == 'GET':
        entries = KnowledgeBase.objects.all().order_by('-updated_at')
        serializer = KnowledgeBaseSerializer(entries, many=True)
        return Response(serializer.data)
    
    elif request.method == 'POST':
        serializer = KnowledgeBaseSerializer(data=request.data)
        if serializer.is_valid():
            kb_entry = serializer.save()
            
            # Add to vector store
            vector_id = vector_store.add_knowledge_base_entry(
                str(kb_entry.id), 
                kb_entry.title, 
                kb_entry.content,
                kb_entry.category
            )
            
            # Update vector_id
            kb_entry.vector_id = vector_id
            kb_entry.save()
            
            return Response(serializer.data, status=status.HTTP_201_CREATED)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

@api_view(['GET', 'PUT', 'DELETE'])
def knowledge_base_detail(request, kb_id):
    """API endpoint for retrieving, updating and deleting knowledge base entries."""
    try:
        kb_entry = KnowledgeBase.objects.get(pk=kb_id)
    except KnowledgeBase.DoesNotExist:
        return Response(status=status.HTTP_404_NOT_FOUND)
    
    if request.method == 'GET':
        serializer = KnowledgeBaseSerializer(kb_entry)
        return Response(serializer.data)
    
    elif request.method == 'PUT':
        serializer = KnowledgeBaseSerializer(kb_entry, data=request.data)
        if serializer.is_valid():
            updated_entry = serializer.save()
            
            # Update in vector store
            vector_id = vector_store.add_knowledge_base_entry(
                str(updated_entry.id), 
                updated_entry.title, 
                updated_entry.content,
                updated_entry.category
            )
            
            # Update vector_id if changed
            if updated_entry.vector_id != vector_id:
                updated_entry.vector_id = vector_id
                updated_entry.save()
            
            return Response(serializer.data)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
    
    elif request.method == 'DELETE':
        # Remove from vector store
        vector_store.delete_knowledge_base_entry(str(kb_entry.id))
        
        # Delete the record
        kb_entry.delete()
        
        return Response(status=status.HTTP_204_NO_CONTENT)
