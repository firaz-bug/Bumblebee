"""
LLM service for generating responses using local models.
"""
import os
import logging
from django.conf import settings

# Setup logging
logger = logging.getLogger(__name__)

class LLMService:
    """
    Service for interacting with a local LLM using CTransformers/llama.cpp.
    """
    
    def __init__(self, model_path, model_name):
        """
        Initialize the LLM service.
        
        Args:
            model_path: Path to the directory containing the model
            model_name: Name of the model file
        """
        self.model_path = model_path
        self.model_name = model_name
        self.model_full_path = os.path.join(model_path, model_name)
        self.llm = None
        self.initialized = False
        
    def _initialize_llm(self):
        """Initialize the LLM."""
        try:
            # For demo purposes, we'll use a simple fallback function instead of loading a real model
            # This allows testing the application without requiring a full model download
            self.llm = self._simple_llm_fallback
            self.initialized = True
            logger.info("Using simple LLM fallback function for demonstration")
            return
            
            # The code below would be used in a production environment with an actual model
            """
            # Try to import CTransformers
            try:
                from langchain.llms import CTransformers
                
                # Check if model exists
                if not os.path.exists(self.model_full_path):
                    logger.warning(f"Model not found at {self.model_full_path}. Using fallback behavior.")
                    self.initialized = False
                    return
                
                # Initialize LLM
                self.llm = CTransformers(
                    model=self.model_full_path,
                    model_type="llama",
                    config={
                        'max_new_tokens': 512,
                        'temperature': 0.7,
                        'context_length': 2048,
                    }
                )
                
                self.initialized = True
                logger.info(f"Initialized LLM from {self.model_full_path}")
                
            except ImportError:
                # Try with alternative libraries
                try:
                    from langchain_community.llms import LlamaCpp
                    
                    # Check if model exists
                    if not os.path.exists(self.model_full_path):
                        logger.warning(f"Model not found at {self.model_full_path}. Using fallback behavior.")
                        self.initialized = False
                        return
                    
                    # Initialize LLM
                    self.llm = LlamaCpp(
                        model_path=self.model_full_path,
                        n_ctx=2048,
                        temperature=0.7,
                        max_tokens=512,
                        verbose=False,
                    )
                    
                    self.initialized = True
                    logger.info(f"Initialized LlamaCpp LLM from {self.model_full_path}")
                    
                except ImportError:
                    logger.error("Neither CTransformers nor LlamaCpp is available.")
                    self.initialized = False
            """
                    
        except Exception as e:
            logger.error(f"Error initializing LLM: {str(e)}")
            self.initialized = False
            
    def _simple_llm_fallback(self, prompt):
        """
        A simple function that mimics an LLM for demonstration purposes.
        This allows the app to run without requiring a real model.
        
        Args:
            prompt: The input prompt
            
        Returns:
            str: A simple response based on the prompt
        """
        # Extract the user query from the prompt
        user_query = ""
        if "User:" in prompt and "Assistant:" in prompt:
            user_parts = prompt.split("User:")
            if len(user_parts) > 1:
                last_user_part = user_parts[-1].split("Assistant:")[0].strip()
                user_query = last_user_part
        
        # Look for document content in the prompt
        document_content = []
        if "Here is information that might be relevant" in prompt:
            doc_section = prompt.split("Here is information that might be relevant")[1].split("Conversation history:")[0]
            documents = doc_section.split("---")
            for doc in documents:
                if "---" in doc:  # Skip the first split result
                    doc_title = doc.split("---")[0].strip()
                    document_content.append(doc.strip())
        
        # Generate appropriate responses
        if '@automation' in user_query.lower():
            return "I see you're trying to use an automation. You can trigger different workflows by using the @automation command followed by the name of the automation. Try '@automation' to see a list of available automations."
        
        elif 'hello' in user_query.lower() or 'hi' in user_query.lower():
            return "Hello! I'm your document assistant. I can help you search through your documents and answer questions based on their content. You can also use @automation to trigger various workflows."
        
        elif 'document' in user_query.lower() or 'upload' in user_query.lower():
            return "You can upload documents using the 'Upload Document' button in the sidebar. I support PDF, DOCX, and text files. Once uploaded, I'll process them and you can ask questions about their content."
        
        elif document_content:
            # If we have document content, provide a response that references it
            return f"Based on the documents I've found, I can provide some information related to your query. The documents mention {len(document_content)} relevant sections that might help answer your question. Let me know if you'd like more specific details about any particular aspect."
        
        else:
            return "I'm a document-based assistant running in demonstration mode. I can help you search through your documents once you upload them using the button in the sidebar. You can also use the @automation command to trigger various workflows."
    
    def generate_response(self, user_query, conversation_history, relevant_docs):
        """
        Generate a response using the LLM.
        
        Args:
            user_query: User's question
            conversation_history: List of previous messages
            relevant_docs: Relevant documents from vector store
            
        Returns:
            str: LLM's response
        """
        if not self.initialized:
            self._initialize_llm()
        
        # If initialization failed or model doesn't exist, use fallback behavior
        if not self.initialized:
            return self._fallback_response(user_query, relevant_docs)
        
        try:
            # Format context from relevant documents
            context = ""
            if relevant_docs:
                context = "Here is information that might be relevant to the user's query:\n\n"
                for i, doc in enumerate(relevant_docs):
                    doc_content = doc.get("content", "")
                    doc_title = doc.get("metadata", {}).get("title", f"Document {i+1}")
                    
                    context += f"--- {doc_title} ---\n{doc_content}\n\n"
            
            # Format conversation history as context
            conv_context = ""
            if conversation_history:
                for message in conversation_history[-5:]:  # Use last 5 messages for context
                    role = message.get("role", "")
                    content = message.get("content", "")
                    
                    if role == "user":
                        conv_context += f"User: {content}\n"
                    elif role == "assistant":
                        conv_context += f"Assistant: {content}\n"
                    # Skip system messages
            
            # Create prompt for LLM
            system_prompt = """You are a helpful assistant that can answer questions based on provided context and documents. 
If you don't know the answer, admit it instead of making something up.
When asked about automations, explain you can trigger workflows with the @automation command.
Be concise, helpful, and accurate."""

            # Full prompt with system, context, conversation, and query
            if context:
                full_prompt = f"{system_prompt}\n\n{context}\n\nConversation history:\n{conv_context}\nUser: {user_query}\nAssistant:"
            else:
                full_prompt = f"{system_prompt}\n\nConversation history:\n{conv_context}\nUser: {user_query}\nAssistant:"
            
            # Generate response
            response = self.llm(full_prompt)
            
            # Clean up response if needed
            response = response.strip()
            
            return response
            
        except Exception as e:
            logger.error(f"Error generating LLM response: {str(e)}")
            return self._fallback_response(user_query, relevant_docs)
    
    def _fallback_response(self, user_query, relevant_docs):
        """
        Fallback behavior when LLM is not available.
        
        Args:
            user_query: User's question
            relevant_docs: Relevant documents from vector store
            
        Returns:
            str: Fallback response
        """
        # If we have relevant docs, at least return those
        if relevant_docs:
            response = "I found some relevant information that might help:\n\n"
            
            for i, doc in enumerate(relevant_docs[:2]):  # Limit to 2 documents
                doc_content = doc.get("content", "")
                doc_title = doc.get("metadata", {}).get("title", f"Document {i+1}")
                
                # Truncate content if it's too long
                if len(doc_content) > 300:
                    doc_content = doc_content[:300] + "..."
                
                response += f"From {doc_title}:\n{doc_content}\n\n"
            
            response += "I'm currently running in fallback mode, so I can't provide a more specific answer. Please try again later."
            
            return response
        
        # Generic fallback response
        if '@automation' in user_query.lower():
            return "I can help you trigger automations with the @automation command. What kind of automation would you like to run?"
        
        return "I'm currently running in fallback mode without access to my language model. I can search through documents, but can't generate detailed responses. Please try again later."
