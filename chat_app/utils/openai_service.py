"""
OpenAI service for generating chat responses and embeddings.
"""
import os
import logging
import openai
from openai import OpenAI

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

class OpenAIService:
    """
    Service for interacting with OpenAI API to generate chat responses and embeddings.
    """
    
    def __init__(self):
        """Initialize the OpenAI service."""
        self.api_key = os.environ.get('OPENAI_API_KEY')
        self.initialized = False
        self.client = None
        self._initialize_client()
        
    def _initialize_client(self):
        """Initialize the OpenAI client."""
        try:
            if not self.api_key:
                logger.warning("OpenAI API key not found in environment variables. OpenAI service will not be available.")
                self.initialized = False
                return
                
            self.client = OpenAI(api_key=self.api_key)
            self.initialized = True
            logger.info("OpenAI service initialized successfully.")
            
        except Exception as e:
            logger.error(f"Error initializing OpenAI client: {str(e)}")
            self.initialized = False
    
    def generate_embeddings(self, text):
        """
        Generate embeddings for a given text using OpenAI's embedding model.
        
        Args:
            text: Text to embed
            
        Returns:
            list: Embedding vector for the text or None if generation fails
        """
        if not self.initialized:
            self._initialize_client()
            if not self.initialized:
                logger.error("OpenAI service not initialized. Cannot generate embeddings.")
                return None
                
        try:
            # Call OpenAI embedding API
            response = self.client.embeddings.create(
                model="text-embedding-3-small",
                input=text,
                encoding_format="float"
            )
            
            # Extract the embedding vector
            embedding = response.data[0].embedding
            return embedding
            
        except Exception as e:
            logger.error(f"Error generating embeddings: {str(e)}")
            return None
    
    def generate_chat_response(self, user_query, conversation_history, relevant_docs):
        """
        Generate a chat response using OpenAI's chat completion API.
        
        Args:
            user_query: User's question
            conversation_history: List of previous messages with role and content
            relevant_docs: Relevant documents from vector store
            
        Returns:
            str: Generated response or error message
        """
        if not self.initialized:
            self._initialize_client()
            if not self.initialized:
                logger.error("OpenAI service not initialized. Cannot generate chat response.")
                return "I'm sorry, I couldn't generate a response at this time. Please check that the OpenAI API key is configured correctly."
                
        try:
            # Format relevant documents as context
            context = ""
            if relevant_docs:
                context = "Here is information that might be relevant to the user's query:\n\n"
                for i, doc in enumerate(relevant_docs):
                    doc_content = doc.get("content", "")
                    doc_metadata = doc.get("metadata", {})
                    doc_title = doc_metadata.get("title", f"Document {i+1}")
                    doc_score = doc.get("relevance_score", 0)
                    
                    # Print debug info
                    print(f"Adding document to context: {doc_title}")
                    print(f"  Content length: {len(doc_content)} chars")
                    print(f"  Score: {doc_score}")
                    
                    # Add formatted document to context
                    context += f"--- {doc_title} ---\n{doc_content}\n\n"
                
                # Print final context summary
                print(f"Total context length: {len(context)} chars")
            
            # Prepare messages for the API call
            messages = [
                {
                    "role": "system",
                    "content": """You are a helpful assistant that can answer questions based on provided context and documents. 
If you don't know the answer, admit it instead of making something up.
When asked about automations, explain you can trigger workflows with the @automation command.
Be concise, helpful, and accurate."""
                }
            ]
            
            # Add context as a system message if available
            if context:
                messages.append({
                    "role": "system",
                    "content": context
                })
            
            # Add conversation history (up to the last 5 messages)
            if conversation_history:
                for message in conversation_history[-5:]:
                    # Only include user and assistant messages (skip system messages)
                    if message.get("role") in ["user", "assistant"]:
                        messages.append({
                            "role": message.get("role"),
                            "content": message.get("content")
                        })
            
            # Add the current user query
            messages.append({
                "role": "user",
                "content": user_query
            })
            
            # Call the OpenAI chat completion API
            # the newest OpenAI model is "gpt-4o" which was released May 13, 2024. do not change this unless explicitly requested by the user
            response = self.client.chat.completions.create(
                model="gpt-4o-mini",
                messages=messages,
                temperature=0.7,
                max_tokens=500
            )
            
            # Extract and return the assistant's response
            return response.choices[0].message.content
            
        except Exception as e:
            logger.error(f"Error generating chat response: {str(e)}")
            return f"I encountered an error while generating a response: {str(e)}"