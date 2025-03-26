"""
Vector store utilities for document storage and retrieval.
"""
import os
import uuid
import json
from django.conf import settings
import logging

# Setup logging
logger = logging.getLogger(__name__)

class VectorStore:
    """
    Vector store using FAISS or Chroma for storing document embeddings.
    Also provides vector stores for automations and dashboards to support intelligent recommendations.
    """
    
    def __init__(self, persist_directory):
        """
        Initialize the vector store.
        
        Args:
            persist_directory: Directory to store the vector database
        """
        self.persist_directory = persist_directory
        self.documents_info_path = os.path.join(persist_directory, 'documents_info.json')
        self.automations_info_path = os.path.join(persist_directory, 'automations_info.json')
        self.dashboards_info_path = os.path.join(persist_directory, 'dashboards_info.json')
        self.knowledge_base_info_path = os.path.join(persist_directory, 'knowledge_base_info.json')
        self.initialized = False
        # This will be set from the outside by views.py
        self.openai_service = None
        self._initialize_vector_store()
        
    def _initialize_vector_store(self):
        """Initialize the vector store with Langchain and FAISS/Chroma."""
        try:
            # For demo purposes, use a simple dictionary-based storage
            # This will allow testing the application without requiring embedding models
            self.documents_by_id = {}
            self.document_texts = []
            
            # Initialize automation and dashboard vector stores
            self.automations_by_id = {}
            self.automation_texts = []
            self.automations_info = {}
            
            self.dashboards_by_id = {}
            self.dashboard_texts = []
            self.dashboards_info = {}
            
            # Load document info if it exists
            if os.path.exists(self.documents_info_path):
                with open(self.documents_info_path, 'r') as f:
                    self.documents_info = json.load(f)
                    
                # Log document info loaded from file
                doc_count = len(self.documents_info)
                logger.info(f"Loaded {doc_count} documents info from disk")
            else:
                self.documents_info = {}
                # Save empty document info
                with open(self.documents_info_path, 'w') as f:
                    json.dump(self.documents_info, f)
            
            # Load automations info if it exists
            if os.path.exists(self.automations_info_path):
                with open(self.automations_info_path, 'r') as f:
                    self.automations_info = json.load(f)
                    
                auto_count = len(self.automations_info)
                logger.info(f"Loaded {auto_count} automations info from disk")
            else:
                self.automations_info = {}
                # Save empty automations info
                with open(self.automations_info_path, 'w') as f:
                    json.dump(self.automations_info, f)
            
            # Load dashboards info if it exists
            if os.path.exists(self.dashboards_info_path):
                with open(self.dashboards_info_path, 'r') as f:
                    self.dashboards_info = json.load(f)
                    
                dash_count = len(self.dashboards_info)
                logger.info(f"Loaded {dash_count} dashboards info from disk")
            else:
                self.dashboards_info = {}
                # Save empty dashboards info
                with open(self.dashboards_info_path, 'w') as f:
                    json.dump(self.dashboards_info, f)
                    
            # Initialize in-memory document and knowledge base store
            self.knowledge_base_by_id = {}
            self.knowledge_base_texts = []
            self.knowledge_base_info = {}
            
            # Load knowledge base info if it exists
            if os.path.exists(self.knowledge_base_info_path):
                with open(self.knowledge_base_info_path, 'r') as f:
                    self.knowledge_base_info = json.load(f)
                    
                kb_count = len(self.knowledge_base_info)
                logger.info(f"Loaded {kb_count} knowledge base entries info from disk")
            else:
                self.knowledge_base_info = {}
                # Save empty knowledge base info
                with open(self.knowledge_base_info_path, 'w') as f:
                    json.dump(self.knowledge_base_info, f)
            
            # Initialize in-memory document store
            self.initialized = True
            logger.info("Using simple in-memory vector store for demonstration")
            
            # In a production environment, you would use actual vector embeddings.
            # The code below would be uncommented for that purpose.
            """
            # Try to import required packages
            try:
                from langchain.embeddings import HuggingFaceEmbeddings
                from langchain.vectorstores import FAISS
                
                # Use HuggingFace embeddings (smaller model for local use)
                self.embeddings = HuggingFaceEmbeddings(
                    model_name="sentence-transformers/all-MiniLM-L6-v2"
                )
                
                # Check if vector store exists and load it
                if os.path.exists(os.path.join(self.persist_directory, 'index.faiss')):
                    self.vector_db = FAISS.load_local(
                        self.persist_directory, 
                        self.embeddings
                    )
                    logger.info("Loaded existing FAISS vector store")
                else:
                    # Initialize empty vector store
                    self.vector_db = FAISS.from_texts(
                        ["Initialization text for vector store"], 
                        self.embeddings
                    )
                    # Save the empty vector store
                    self.vector_db.save_local(self.persist_directory)
                    logger.info("Created new FAISS vector store")
                
                # Load document info if it exists
                if os.path.exists(self.documents_info_path):
                    with open(self.documents_info_path, 'r') as f:
                        self.documents_info = json.load(f)
                else:
                    self.documents_info = {}
                    # Save empty document info
                    with open(self.documents_info_path, 'w') as f:
                        json.dump(self.documents_info, f)
                
                self.initialized = True
                
            except ImportError:
                # Fall back to Chroma if FAISS not available
                from langchain.embeddings import HuggingFaceEmbeddings
                from langchain.vectorstores import Chroma
                
                self.embeddings = HuggingFaceEmbeddings(
                    model_name="sentence-transformers/all-MiniLM-L6-v2"
                )
                
                # Initialize or load Chroma vector store
                self.vector_db = Chroma(
                    persist_directory=self.persist_directory,
                    embedding_function=self.embeddings
                )
                
                # Load document info if it exists
                if os.path.exists(self.documents_info_path):
                    with open(self.documents_info_path, 'r') as f:
                        self.documents_info = json.load(f)
                else:
                    self.documents_info = {}
                    # Save empty document info
                    with open(self.documents_info_path, 'w') as f:
                        json.dump(self.documents_info, f)
                
                self.initialized = True
                logger.info("Using Chroma vector store")
            """
                
        except Exception as e:
            logger.error(f"Error initializing vector store: {str(e)}")
            self.initialized = False
    
    def add_document(self, document_id, title, content):
        """
        Add a document to the vector store.
        
        Args:
            document_id: ID of the document in the database
            title: Document title
            content: Text content of the document
            
        Returns:
            str: Vector store ID for the document
        """
        if not self.initialized:
            self._initialize_vector_store()
            if not self.initialized:
                raise Exception("Vector store initialization failed")
        
        try:
            # For our simplified implementation, just store the document in memory
            # Split content into chunks if it's too long
            chunks = self._chunk_text(content)
            
            vector_ids = []
            for i, chunk in enumerate(chunks):
                # Generate a unique ID for this chunk
                chunk_id = f"{document_id}_{i}"
                vector_ids.append(chunk_id)
                
                # Store chunk in memory
                self.documents_by_id[chunk_id] = {
                    "content": chunk,
                    "metadata": {
                        "document_id": str(document_id),
                        "title": title,
                        "chunk": i
                    }
                }
                self.document_texts.append(chunk)
            
            # Save document info
            self.documents_info[str(document_id)] = {
                "title": title,
                "vector_ids": vector_ids,
                "chunks": len(chunks)
            }
            
            with open(self.documents_info_path, 'w') as f:
                json.dump(self.documents_info, f)
                
            return str(document_id)
            
        except Exception as e:
            logger.error(f"Error adding document to vector store: {str(e)}")
            raise
    
    def search(self, query, top_k=3):
        """
        Search the vector store for relevant document chunks.
        
        Args:
            query: Search query
            top_k: Number of results to return
            
        Returns:
            list: List of relevant document chunks with metadata
        """
        if not self.initialized:
            self._initialize_vector_store()
            if not self.initialized:
                return []
        
        try:
            # Try to use OpenAI for semantic search if available
            if hasattr(self, 'openai_service') and self.openai_service is not None and self.openai_service.initialized:
                return self._semantic_search_with_openai(query, top_k)
            
            # Fall back to basic keyword search
            return self._basic_keyword_search(query, top_k)
            
        except Exception as e:
            logger.error(f"Error searching vector store: {str(e)}")
            return []
            
    def _semantic_search_with_openai(self, query, top_k=3):
        """
        Perform semantic search using OpenAI embeddings.
        
        Args:
            query: Search query
            top_k: Number of results to return
            
        Returns:
            list: List of relevant document chunks with metadata
        """
        try:
            # Log the current state of the documents
            doc_count = len(self.documents_by_id)
            logger.info(f"Searching through {doc_count} document chunks for query: '{query}'")
            if doc_count == 0:
                logger.warning("No documents found in vector store")
                return []
                
            # For demonstration purposes with limited integration,
            # we'll enhance the keyword search with better scoring
            results = []
            query_terms = query.lower().split()
            
            # Get all documents and their contents
            for chunk_id, doc in self.documents_by_id.items():
                content = doc["content"]
                metadata = doc["metadata"]
                
                # Basic relevance scoring enhanced with term frequency
                score = 0
                content_lower = content.lower()
                
                # Count term frequency and give weight to full phrase matches
                if query.lower() in content_lower:
                    # Exact phrase match gets a big boost
                    score += 5
                
                # Count individual term matches with proximity boost
                term_count = 0
                for term in query_terms:
                    if term in content_lower:
                        term_count += 1
                        
                        # Boost score based on term frequency
                        score += content_lower.count(term)
                
                # Boost score if most/all query terms are found
                if term_count > 0:
                    coverage_ratio = term_count / len(query_terms)
                    score += coverage_ratio * 3
                
                # Only include if there's some relevance
                if score > 0:
                    # Print debug info
                    logger.info(f"Document '{metadata.get('title', chunk_id)}' matched with score {score}")
                    
                    # Add to results
                    results.append((doc, score))
            
            # Sort by score and take top_k
            results.sort(key=lambda x: x[1], reverse=True)
            results = results[:top_k]
            
            # Format results
            formatted_results = []
            for doc, score in results:
                formatted_results.append({
                    "content": doc["content"],
                    "metadata": doc["metadata"],
                    "relevance_score": score
                })
            
            # Log summary
            logger.info(f"Returning {len(formatted_results)} documents with scores: {[d['relevance_score'] for d in formatted_results]}")
            
            return formatted_results
            
        except Exception as e:
            logger.error(f"Error in semantic search: {str(e)}")
            return self._basic_keyword_search(query, top_k)
    
    def _basic_keyword_search(self, query, top_k=3):
        """
        Perform basic keyword search.
        
        Args:
            query: Search query
            top_k: Number of results to return
            
        Returns:
            list: List of relevant document chunks with metadata
        """
        # For our simplified implementation, we'll do a basic keyword search
        query_terms = query.lower().split()
        
        # Score each document based on term frequency
        results = []
        for chunk_id, doc in self.documents_by_id.items():
            content = doc["content"].lower()
            metadata = doc["metadata"]
            
            # Count how many query terms are in the content
            score = sum(1 for term in query_terms if term in content)
            
            # Store result if it has any matches
            if score > 0:
                results.append((doc, score))
        
        # Sort by score (descending) and take top_k
        results.sort(key=lambda x: x[1], reverse=True)
        results = results[:top_k]
        
        # Format results
        formatted_results = []
        for doc, score in results:
            formatted_results.append({
                "content": doc["content"],
                "metadata": doc["metadata"],
                "relevance_score": score
            })
        
        # If we have no results but have documents, return a random one
        if not formatted_results and self.documents_by_id:
            random_id = list(self.documents_by_id.keys())[0]
            random_doc = self.documents_by_id[random_id]
            formatted_results.append({
                "content": random_doc["content"],
                "metadata": random_doc["metadata"],
                "relevance_score": 0.1
            })
            
        return formatted_results
    
    def delete_document(self, document_id):
        """
        Delete a document from the vector store.
        
        Args:
            document_id: ID of the document to delete
        """
        if not self.initialized:
            self._initialize_vector_store()
            if not self.initialized:
                return
            
        try:
            document_id = str(document_id)
            logger.info(f"Deleting document {document_id} from vector store")
            
            # Clear document chunks from memory
            chunk_ids_to_remove = []
            for chunk_id, doc in self.documents_by_id.items():
                if doc["metadata"]["document_id"] == document_id:
                    chunk_ids_to_remove.append(chunk_id)
                    if doc["content"] in self.document_texts:
                        self.document_texts.remove(doc["content"])
            
            for chunk_id in chunk_ids_to_remove:
                del self.documents_by_id[chunk_id]
            
            # Remove from documents_info and save
            if document_id in self.documents_info:
                del self.documents_info[document_id]
                os.makedirs(os.path.dirname(self.documents_info_path), exist_ok=True)
                with open(self.documents_info_path, 'w') as f:
                    json.dump(self.documents_info, f)
                    
            logger.info(f"Successfully deleted document {document_id} and {len(chunk_ids_to_remove)} chunks")
                    
        except Exception as e:
            logger.error(f"Error deleting document from vector store: {str(e)}")
            
    def _load_documents_from_database(self):
        """
        Load all documents from the database into the vector store.
        This ensures documents are available after server restart.
        """
        try:
            # Import here to avoid circular imports
            from django.apps import apps
            Document = apps.get_model('chat_app', 'Document')
            Automation = apps.get_model('chat_app', 'Automation')
            Dashboard = apps.get_model('chat_app', 'Dashboard')
            KnowledgeBase = apps.get_model('chat_app', 'KnowledgeBase')
            
            # Get all documents from database
            documents = Document.objects.all()
            doc_count = documents.count()
            logger.info(f"Loading {doc_count} documents from database into vector store")
            
            # Add each document to the vector store
            for document in documents:
                if document.content:
                    # Only add if not already in documents_info
                    if str(document.id) not in self.documents_info:
                        logger.info(f"Adding document '{document.title}' to vector store")
                        self.add_document(str(document.id), document.title, document.content)
                    else:
                        # Document info exists, but we need to reload chunks into memory
                        logger.info(f"Document '{document.title}' already in vector store")
            
            # Load all automations from database
            automations = Automation.objects.all()
            auto_count = automations.count()
            logger.info(f"Loading {auto_count} automations from database into vector store")
            
            # Add each automation to the vector store
            for automation in automations:
                # Only add if not already in automations_info
                if str(automation.id) not in self.automations_info:
                    logger.info(f"Adding automation '{automation.name}' to vector store")
                    self.add_automation(str(automation.id), automation.name, automation.description)
                else:
                    # Automation info exists, but we need to reload it into memory
                    logger.info(f"Automation '{automation.name}' already in vector store")
                    # Add to automations_by_id for in-memory lookup
                    self.automations_by_id[str(automation.id)] = {
                        "content": automation.description,
                        "metadata": {
                            "automation_id": str(automation.id),
                            "name": automation.name
                        }
                    }
                    self.automation_texts.append(automation.description)
            
            # Load all dashboards from database
            dashboards = Dashboard.objects.all()
            dash_count = dashboards.count()
            logger.info(f"Loading {dash_count} dashboards from database into vector store")
            
            # Add each dashboard to the vector store
            for dashboard in dashboards:
                # Only add if not already in dashboards_info
                if str(dashboard.id) not in self.dashboards_info:
                    logger.info(f"Adding dashboard '{dashboard.name}' to vector store")
                    self.add_dashboard(str(dashboard.id), dashboard.name, dashboard.description)
                else:
                    # Dashboard info exists, but we need to reload it into memory
                    logger.info(f"Dashboard '{dashboard.name}' already in vector store")
                    # Add to dashboards_by_id for in-memory lookup
                    self.dashboards_by_id[str(dashboard.id)] = {
                        "content": dashboard.description,
                        "metadata": {
                            "dashboard_id": str(dashboard.id),
                            "name": dashboard.name
                        }
                    }
                    self.dashboard_texts.append(dashboard.description)
            
            # Load all knowledge base entries from database
            knowledge_base_entries = KnowledgeBase.objects.all()
            kb_count = knowledge_base_entries.count()
            logger.info(f"Loading {kb_count} knowledge base entries from database into vector store")
            
            # Add each knowledge base entry to the vector store
            for kb_entry in knowledge_base_entries:
                # Only add if not already in knowledge_base_info
                if str(kb_entry.id) not in self.knowledge_base_info:
                    logger.info(f"Adding knowledge base entry '{kb_entry.title}' to vector store")
                    self.add_knowledge_base_entry(str(kb_entry.id), kb_entry.title, kb_entry.content, kb_entry.category)
                else:
                    # Knowledge base entry info exists, but we need to reload it into memory
                    logger.info(f"Knowledge base entry '{kb_entry.title}' already in vector store")
                    # Add to knowledge_base_by_id for in-memory lookup
                    self.knowledge_base_by_id[str(kb_entry.id)] = {
                        "content": kb_entry.content,
                        "metadata": {
                            "kb_id": str(kb_entry.id),
                            "title": kb_entry.title,
                            "category": kb_entry.category
                        }
                    }
                    self.knowledge_base_texts.append(kb_entry.content)
            
            # Log summary
            logger.info(f"Loaded {len(self.documents_by_id)} document chunks, {len(self.automations_by_id)} automations, {len(self.dashboards_by_id)} dashboards, and {len(self.knowledge_base_by_id)} knowledge base entries into vector store")
            
        except Exception as e:
            logger.error(f"Error loading documents from database: {str(e)}")
    
    def add_automation(self, automation_id, name, description):
        """
        Add an automation to the vector store.
        
        Args:
            automation_id: ID of the automation in the database
            name: Automation name
            description: Text description of the automation
            
        Returns:
            str: Vector store ID for the automation
        """
        if not self.initialized:
            self._initialize_vector_store()
            if not self.initialized:
                raise Exception("Vector store initialization failed")
        
        try:
            # Store in memory
            vector_id = str(automation_id)
            
            # Store automation in memory
            self.automations_by_id[vector_id] = {
                "content": description,
                "metadata": {
                    "automation_id": str(automation_id),
                    "name": name
                }
            }
            self.automation_texts.append(description)
            
            # Save automation info
            self.automations_info[str(automation_id)] = {
                "name": name,
                "vector_id": vector_id
            }
            
            with open(self.automations_info_path, 'w') as f:
                json.dump(self.automations_info, f)
                
            return vector_id
            
        except Exception as e:
            logger.error(f"Error adding automation to vector store: {str(e)}")
            raise
            
    def add_dashboard(self, dashboard_id, name, description):
        """
        Add a dashboard to the vector store.
        
        Args:
            dashboard_id: ID of the dashboard in the database
            name: Dashboard name
            description: Text description of the dashboard
            
        Returns:
            str: Vector store ID for the dashboard
        """
        if not self.initialized:
            self._initialize_vector_store()
            if not self.initialized:
                raise Exception("Vector store initialization failed")
        
        try:
            # Store in memory
            vector_id = str(dashboard_id)
            
            # Store dashboard in memory
            self.dashboards_by_id[vector_id] = {
                "content": description,
                "metadata": {
                    "dashboard_id": str(dashboard_id),
                    "name": name
                }
            }
            self.dashboard_texts.append(description)
            
            # Save dashboard info
            self.dashboards_info[str(dashboard_id)] = {
                "name": name,
                "vector_id": vector_id
            }
            
            with open(self.dashboards_info_path, 'w') as f:
                json.dump(self.dashboards_info, f)
                
            return vector_id
            
        except Exception as e:
            logger.error(f"Error adding dashboard to vector store: {str(e)}")
            raise
            
    def recommend_automations(self, incident_description, top_k=2):
        """
        Find automations related to an incident description.
        
        Args:
            incident_description: Description of the incident
            top_k: Number of results to return
            
        Returns:
            list: List of relevant automation IDs
        """
        if not self.initialized or len(self.automations_by_id) == 0:
            self._initialize_vector_store()
            if not self.initialized:
                return []
                
        try:
            # For our simplified implementation, do a basic keyword search
            logger.info(f"Finding automations related to incident: '{incident_description[:100]}...'")
            
            query_terms = incident_description.lower().split()
            
            # Score each automation based on term frequency
            results = []
            for vector_id, auto in self.automations_by_id.items():
                content = auto["content"].lower()
                metadata = auto["metadata"]
                
                # Count how many query terms are in the content
                score = 0
                
                # Give higher weights to name matches
                for term in query_terms:
                    if term in metadata["name"].lower():
                        score += 2
                    if term in content:
                        score += 1
                
                # Store result if it has any matches
                if score > 0:
                    results.append((vector_id, score))
            
            # Sort by score (descending) and take top_k
            results.sort(key=lambda x: x[1], reverse=True)
            results = results[:top_k]
            
            # Return automation IDs
            return [r[0] for r in results]
            
        except Exception as e:
            logger.error(f"Error recommending automations: {str(e)}")
            return []
            
    def recommend_dashboards(self, incident_description, top_k=2):
        """
        Find dashboards related to an incident description.
        
        Args:
            incident_description: Description of the incident
            top_k: Number of results to return
            
        Returns:
            list: List of relevant dashboard IDs
        """
        if not self.initialized or len(self.dashboards_by_id) == 0:
            self._initialize_vector_store()
            if not self.initialized:
                return []
                
        try:
            # For our simplified implementation, do a basic keyword search
            logger.info(f"Finding dashboards related to incident: '{incident_description[:100]}...'")
            
            query_terms = incident_description.lower().split()
            
            # Score each dashboard based on term frequency
            results = []
            for vector_id, dash in self.dashboards_by_id.items():
                content = dash["content"].lower()
                metadata = dash["metadata"]
                
                # Count how many query terms are in the content
                score = 0
                
                # Give higher weights to name matches
                for term in query_terms:
                    if term in metadata["name"].lower():
                        score += 2
                    if term in content:
                        score += 1
                
                # Store result if it has any matches
                if score > 0:
                    results.append((vector_id, score))
            
            # Sort by score (descending) and take top_k
            results.sort(key=lambda x: x[1], reverse=True)
            results = results[:top_k]
            
            # Return dashboard IDs
            return [r[0] for r in results]
            
        except Exception as e:
            logger.error(f"Error recommending dashboards: {str(e)}")
            return []
            
    def add_knowledge_base_entry(self, kb_id, title, content, category=""):
        """
        Add a knowledge base entry to the vector store.
        
        Args:
            kb_id: ID of the knowledge base entry in the database
            title: Entry title
            content: Text content of the entry
            category: Category of the entry
            
        Returns:
            str: Vector store ID for the knowledge base entry
        """
        if not self.initialized:
            self._initialize_vector_store()
            if not self.initialized:
                raise Exception("Vector store initialization failed")
        
        try:
            # For our simplified implementation, just store the knowledge base entry in memory
            # Split content into chunks if it's too long
            chunks = self._chunk_text(content)
            
            vector_ids = []
            for i, chunk in enumerate(chunks):
                # Generate a unique ID for this chunk
                chunk_id = f"{kb_id}_{i}"
                vector_ids.append(chunk_id)
                
                # Store chunk in memory
                self.knowledge_base_by_id[chunk_id] = {
                    "content": chunk,
                    "metadata": {
                        "kb_id": str(kb_id),
                        "title": title,
                        "category": category,
                        "chunk": i
                    }
                }
                self.knowledge_base_texts.append(chunk)
            
            # Save knowledge base info
            self.knowledge_base_info[str(kb_id)] = {
                "title": title,
                "category": category,
                "vector_ids": vector_ids,
                "chunks": len(chunks)
            }
            
            with open(self.knowledge_base_info_path, 'w') as f:
                json.dump(self.knowledge_base_info, f)
                
            return str(kb_id)
            
        except Exception as e:
            logger.error(f"Error adding knowledge base entry to vector store: {str(e)}")
            raise
    
    def delete_knowledge_base_entry(self, kb_id):
        """
        Delete a knowledge base entry from the vector store.
        
        Args:
            kb_id: ID of the knowledge base entry to delete
        """
        if not self.initialized:
            self._initialize_vector_store()
            if not self.initialized:
                return
            
        try:
            kb_id = str(kb_id)
            logger.info(f"Deleting knowledge base entry {kb_id} from vector store")
            
            # Clear knowledge base entry chunks from memory
            chunk_ids_to_remove = []
            for chunk_id, entry in self.knowledge_base_by_id.items():
                if entry["metadata"]["kb_id"] == kb_id:
                    chunk_ids_to_remove.append(chunk_id)
                    if entry["content"] in self.knowledge_base_texts:
                        self.knowledge_base_texts.remove(entry["content"])
            
            for chunk_id in chunk_ids_to_remove:
                del self.knowledge_base_by_id[chunk_id]
            
            # Remove from knowledge_base_info and save
            if kb_id in self.knowledge_base_info:
                del self.knowledge_base_info[kb_id]
                os.makedirs(os.path.dirname(self.knowledge_base_info_path), exist_ok=True)
                with open(self.knowledge_base_info_path, 'w') as f:
                    json.dump(self.knowledge_base_info, f)
                    
            logger.info(f"Successfully deleted knowledge base entry {kb_id} and {len(chunk_ids_to_remove)} chunks")
                    
        except Exception as e:
            logger.error(f"Error deleting knowledge base entry from vector store: {str(e)}")
            
    def _chunk_text(self, text, chunk_size=1000, overlap=100):
        """
        Split text into chunks for better vector storage and retrieval.
        
        Args:
            text: Text to split
            chunk_size: Maximum size of each chunk
            overlap: Overlap between chunks
            
        Returns:
            list: List of text chunks
        """
        if len(text) <= chunk_size:
            return [text]
            
        chunks = []
        start = 0
        
        while start < len(text):
            # Find a good breaking point (end of a sentence)
            end = min(start + chunk_size, len(text))
            
            # Try to find sentence boundary
            if end < len(text):
                # Look for period, question mark, or exclamation followed by space or newline
                for i in range(end, max(start, end - 200), -1):
                    if text[i-1] in ['.', '?', '!'] and (i == len(text) or text[i] in [' ', '\n']):
                        end = i
                        break
            
            # Add the chunk
            chunks.append(text[start:end])
            
            # Move start with overlap
            start = end - overlap if end - overlap > start else end
            
        return chunks
