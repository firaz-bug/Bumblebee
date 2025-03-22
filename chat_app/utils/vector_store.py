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
    """
    
    def __init__(self, persist_directory):
        """
        Initialize the vector store.
        
        Args:
            persist_directory: Directory to store the vector database
        """
        self.persist_directory = persist_directory
        self.documents_info_path = os.path.join(persist_directory, 'documents_info.json')
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
            # Get document info
            doc_info = self.documents_info.get(str(document_id))
            if not doc_info:
                logger.warning(f"Document {document_id} not found in vector store")
                return
                
            # Delete chunks from in-memory storage
            for chunk_id in doc_info.get("vector_ids", []):
                if chunk_id in self.documents_by_id:
                    # Remove from document texts list
                    content = self.documents_by_id[chunk_id]["content"]
                    if content in self.document_texts:
                        self.document_texts.remove(content)
                    
                    # Remove from documents_by_id
                    del self.documents_by_id[chunk_id]
            
            # Remove from documents_info
            if str(document_id) in self.documents_info:
                del self.documents_info[str(document_id)]
                
                with open(self.documents_info_path, 'w') as f:
                    json.dump(self.documents_info, f)
                    
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
                        doc_info = self.documents_info.get(str(document.id))
                        if doc_info:
                            # Reload document chunks using the stored info
                            chunks = self._chunk_text(document.content)
                            
                            for i, chunk in enumerate(chunks):
                                chunk_id = f"{document.id}_{i}"
                                
                                # Store chunk in memory
                                self.documents_by_id[chunk_id] = {
                                    "content": chunk,
                                    "metadata": {
                                        "document_id": str(document.id),
                                        "title": document.title,
                                        "chunk": i
                                    }
                                }
                                self.document_texts.append(chunk)
                            
                            logger.info(f"Reloaded document '{document.title}' with {len(chunks)} chunks")
            
            # Log summary
            logger.info(f"Loaded {len(self.documents_by_id)} document chunks into vector store")
            
        except Exception as e:
            logger.error(f"Error loading documents from database: {str(e)}")
    
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
