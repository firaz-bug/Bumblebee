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
            else:
                self.documents_info = {}
                # Save empty document info
                with open(self.documents_info_path, 'w') as f:
                    json.dump(self.documents_info, f)
            
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
            # For our simplified implementation, we'll do a basic keyword search
            # This is not semantic search, just a simple demonstration
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
            
        except Exception as e:
            logger.error(f"Error searching vector store: {str(e)}")
            return []
    
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
