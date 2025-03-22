// DOM Elements
const chatMessages = document.getElementById('chat-messages');
const chatForm = document.getElementById('chat-form');
const chatInput = document.getElementById('chat-input');
const newChatBtn = document.getElementById('new-chat-btn');
const uploadBtn = document.getElementById('upload-document-btn');
const uploadModal = document.getElementById('upload-modal');
const uploadForm = document.getElementById('document-upload-form');
const uploadStatus = document.getElementById('upload-status');
const closeModalBtns = document.querySelectorAll('.modal-close, .modal-close-btn');
const renameChatBtn = document.getElementById('rename-chat-btn');
const deleteChatBtn = document.getElementById('delete-chat-btn');
const chatTitle = document.getElementById('current-chat-title');
const conversationsList = document.querySelector('.conversations-list');

// State
let currentConversationId = null;
let conversationsData = [];
let isProcessing = false;

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    // Initialize feather icons
    feather.replace();
    
    // Get the conversation ID from the active conversation
    const activeConversation = document.querySelector('.conversation-item.active');
    if (activeConversation) {
        currentConversationId = activeConversation.dataset.id;
        loadMessages(currentConversationId);
    } else {
        createNewConversation();
    }
    
    // Load all conversations for the sidebar
    loadConversations();
    
    // Load documents for the sidebar
    loadDocuments();
    
    // Setup auto-resize for textarea
    setupTextareaAutoResize();
});

// Event Listeners
chatForm.addEventListener('submit', handleChatSubmit);
newChatBtn.addEventListener('submit', createNewConversation);
newChatBtn.addEventListener('click', createNewConversation);
uploadBtn.addEventListener('click', () => uploadModal.style.display = 'block');
uploadForm.addEventListener('submit', handleDocumentUpload);
closeModalBtns.forEach(btn => {
    btn.addEventListener('click', () => uploadModal.style.display = 'none');
});
renameChatBtn.addEventListener('click', renameConversation);
deleteChatBtn.addEventListener('click', deleteConversation);

// Handle conversation click in sidebar
document.addEventListener('click', (e) => {
    const conversationItem = e.target.closest('.conversation-item');
    if (conversationItem) {
        const conversationId = conversationItem.dataset.id;
        changeConversation(conversationId);
    }
});

// Core Functions
function loadConversations() {
    fetch('/api/conversations/')
        .then(response => response.json())
        .then(data => {
            conversationsData = data;
            renderConversationsList(data);
        })
        .catch(error => console.error('Error loading conversations:', error));
}

function renderConversationsList(conversations) {
    conversationsList.innerHTML = '';
    
    conversations.forEach(conversation => {
        const isActive = conversation.id === currentConversationId;
        const conversationEl = document.createElement('div');
        conversationEl.className = `conversation-item ${isActive ? 'active' : ''}`;
        conversationEl.dataset.id = conversation.id;
        conversationEl.innerHTML = `
            <i data-feather="message-square"></i>
            <span class="conversation-title">${conversation.title}</span>
        `;
        conversationsList.appendChild(conversationEl);
    });
    
    // Re-initialize feather icons
    feather.replace();
}

function loadMessages(conversationId) {
    chatMessages.innerHTML = '';
    
    // Show loading indicator
    chatMessages.innerHTML = '<div class="typing-indicator"><span></span><span></span><span></span></div>';
    
    fetch(`/api/conversations/${conversationId}/messages/`)
        .then(response => response.json())
        .then(data => {
            chatMessages.innerHTML = '';
            
            // Render each message
            data.forEach(message => {
                addMessageToUI(message.role, message.content);
            });
            
            // Scroll to bottom
            scrollToBottom();
        })
        .catch(error => {
            console.error('Error loading messages:', error);
            chatMessages.innerHTML = '<div class="message system"><div class="message-content">Failed to load messages. Please try again.</div></div>';
        });
}

function createNewConversation() {
    if (isProcessing) return;
    
    isProcessing = true;
    console.log("Creating new conversation...");
    
    fetch('/api/conversations/', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'X-CSRFToken': getCSRFToken(),
        },
        body: JSON.stringify({
            title: 'New Conversation'
        })
    })
    .then(response => {
        if (!response.ok) {
            throw new Error(`HTTP error ${response.status}: ${response.statusText}`);
        }
        return response.json();
    })
    .then(data => {
        console.log("New conversation created:", data);
        
        // Update the current conversation state
        currentConversationId = data.id;
        chatTitle.textContent = data.title;
        
        // Clear chat messages
        chatMessages.innerHTML = '';
        
        // Update the UI
        loadConversations();
        loadMessages(currentConversationId);
        
        isProcessing = false;
    })
    .catch(error => {
        console.error('Error creating conversation:', error);
        alert('Failed to create a new conversation. Please try again.');
        isProcessing = false;
    });
}

function changeConversation(conversationId) {
    if (conversationId === currentConversationId || isProcessing) return;
    
    currentConversationId = conversationId;
    
    // Update active state in sidebar
    document.querySelectorAll('.conversation-item').forEach(item => {
        item.classList.toggle('active', item.dataset.id === conversationId);
    });
    
    // Find the conversation title
    const conversation = conversationsData.find(c => c.id === conversationId);
    if (conversation) {
        chatTitle.textContent = conversation.title;
    }
    
    // Load messages for this conversation
    loadMessages(conversationId);
}

function handleChatSubmit(e) {
    e.preventDefault();
    
    if (isProcessing) return;
    
    const userMessage = chatInput.value.trim();
    if (!userMessage) return;
    
    // Clear input
    chatInput.value = '';
    resetTextareaHeight();
    
    // Add user message to UI
    addMessageToUI('user', userMessage);
    
    // Show typing indicator
    const typingIndicator = document.createElement('div');
    typingIndicator.className = 'typing-indicator';
    typingIndicator.innerHTML = '<span></span><span></span><span></span>';
    chatMessages.appendChild(typingIndicator);
    scrollToBottom();
    
    isProcessing = true;
    
    // Send message to server
    fetch(`/api/conversations/${currentConversationId}/messages/`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'X-CSRFToken': getCSRFToken(),
        },
        body: JSON.stringify({
            content: userMessage
        })
    })
    .then(response => {
        if (!response.ok) {
            return response.text().then(text => {
                console.error('Message error details:', text);
                throw new Error(`HTTP error ${response.status}: ${text}`);
            });
        }
        return response.json();
    })
    .then(data => {
        // Remove typing indicator
        if (typingIndicator.parentNode) {
            typingIndicator.parentNode.removeChild(typingIndicator);
        }
        
        console.log('Response data:', data);
        
        // The response contains both the user message and the assistant's response(s)
        // We've already added the user message, so we just need the assistant's response(s)
        if (Array.isArray(data)) {
            // Find all assistant messages in the response
            const assistantMessages = data.filter(msg => msg.role === 'assistant');
            
            // Add all assistant messages to UI
            for (const msg of assistantMessages) {
                addMessageToUI('assistant', msg.content);
            }
        } else if (data.role === 'assistant') {
            // Handle case where only one message is returned
            addMessageToUI('assistant', data.content);
        }
        
        isProcessing = false;
        scrollToBottom();
    })
    .catch(error => {
        console.error('Error sending message:', error);
        
        // Remove typing indicator
        if (typingIndicator.parentNode) {
            typingIndicator.parentNode.removeChild(typingIndicator);
        }
        
        // Add error message
        addMessageToUI('system', 'Failed to send message. Please try again.');
        
        isProcessing = false;
        scrollToBottom();
    });
}

function handleDocumentUpload(e) {
    e.preventDefault();
    
    if (isProcessing) return;
    
    const fileInput = document.getElementById('document-file');
    const file = fileInput.files[0];
    
    if (!file) {
        updateUploadStatus('Please select a file to upload.', 'error');
        return;
    }
    
    // Check file type
    const fileExtension = file.name.split('.').pop().toLowerCase();
    const allowedTypes = ['pdf', 'docx', 'doc', 'txt', 'md'];
    
    if (!allowedTypes.includes(fileExtension)) {
        updateUploadStatus(`File type .${fileExtension} is not supported. Please use PDF, DOCX, TXT, or MD files.`, 'error');
        return;
    }
    
    // Update UI
    updateUploadStatus('Uploading document...', 'info');
    isProcessing = true;
    
    // Create form data
    const formData = new FormData();
    formData.append('file', file);
    
    // Send to server - don't include Content-Type header with FormData
    fetch('/api/documents/upload/', {
        method: 'POST',
        headers: {
            'X-CSRFToken': getCSRFToken(),
            // Let browser set Content-Type with boundary for FormData
        },
        body: formData,
        credentials: 'same-origin' // Include cookies for CSRF
    })
    .then(response => {
        if (!response.ok) {
            return response.text().then(text => {
                console.error('Upload error details:', text);
                throw new Error(`HTTP error ${response.status}: ${text}`);
            });
        }
        return response.json();
    })
    .then(data => {
        updateUploadStatus(`Document "${data.title}" uploaded successfully!`, 'success');
        
        // Reset form
        fileInput.value = '';
        
        // Reload document list
        loadDocuments();
        
        // Close modal after a delay
        setTimeout(() => {
            uploadModal.style.display = 'none';
            updateUploadStatus('', '');
        }, 2000);
        
        isProcessing = false;
    })
    .catch(error => {
        console.error('Error uploading document:', error);
        updateUploadStatus('Failed to upload document. Please try again.', 'error');
        isProcessing = false;
    });
}

function renameConversation() {
    if (isProcessing || !currentConversationId) return;
    
    const newTitle = prompt('Enter a new name for this conversation:', chatTitle.textContent);
    
    if (newTitle === null || newTitle.trim() === '') return;
    
    isProcessing = true;
    
    fetch(`/api/conversations/${currentConversationId}/`, {
        method: 'PATCH',
        headers: {
            'Content-Type': 'application/json',
            'X-CSRFToken': getCSRFToken(),
        },
        body: JSON.stringify({
            title: newTitle.trim()
        })
    })
    .then(response => {
        if (!response.ok) {
            throw new Error(`HTTP error ${response.status}`);
        }
        return response.json();
    })
    .then(data => {
        // Update title in UI
        chatTitle.textContent = data.title;
        
        // Update in sidebar
        loadConversations();
        
        isProcessing = false;
    })
    .catch(error => {
        console.error('Error renaming conversation:', error);
        alert('Failed to rename conversation. Please try again.');
        isProcessing = false;
    });
}

function deleteConversation() {
    if (isProcessing || !currentConversationId) return;
    
    if (!confirm('Are you sure you want to delete this conversation? This action cannot be undone.')) {
        return;
    }
    
    isProcessing = true;
    const deletedId = currentConversationId;
    
    fetch(`/api/conversations/${currentConversationId}/`, {
        method: 'DELETE',
        headers: {
            'X-CSRFToken': getCSRFToken(),
        }
    })
    .then(response => {
        if (!response.ok) {
            throw new Error(`HTTP error ${response.status}`);
        }
        
        console.log("Successfully deleted conversation:", deletedId);
        
        // Reset current conversation ID
        currentConversationId = null;
        
        // Clear messages
        chatMessages.innerHTML = '';
        
        // Remove the deleted conversation from the list
        const deletedElement = document.querySelector(`.conversation-item[data-id="${deletedId}"]`);
        if (deletedElement) {
            deletedElement.remove();
        }
        
        // Create a new conversation immediately
        return createNewConversation();
    })
    .then(() => {
        // Force refresh the conversations list
        return fetch('/api/conversations/')
            .then(response => response.json())
            .then(data => {
                conversationsData = data;
                renderConversationsList(data);
            });
    })
    .catch(error => {
        console.error('Error in conversation deletion flow:', error);
        alert('Failed to delete conversation. Please try again.');
    })
    .finally(() => {
        isProcessing = false;
    });
}

// Make createNewConversation return a promise
function createNewConversation() {
    if (isProcessing) return Promise.reject('Processing in progress');
    
    isProcessing = true;
    console.log("Creating new conversation...");
    
    return fetch('/api/conversations/', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'X-CSRFToken': getCSRFToken(),
        },
        body: JSON.stringify({
            title: 'New Conversation'
        })
    })
    .then(response => {
        if (!response.ok) {
            throw new Error(`HTTP error ${response.status}: ${response.statusText}`);
        }
        return response.json();
    })
    .then(data => {
        console.log("New conversation created:", data);
        
        // Update the current conversation state
        currentConversationId = data.id;
        chatTitle.textContent = data.title;
        
        // Clear chat messages
        chatMessages.innerHTML = '';
        
        // Load messages for the new conversation
        return loadMessages(currentConversationId);
    })
    .finally(() => {
        isProcessing = false;
    });
}

// Helper Functions
function addMessageToUI(role, content) {
    const messageEl = document.createElement('div');
    messageEl.className = `message ${role}`;
    
    // Format message content - handle markdown-like syntax
    let formattedContent = content
        // Bold text
        .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
        // Code blocks
        .replace(/```([^`]+)```/g, '<pre><code>$1</code></pre>')
        // Inline code
        .replace(/`([^`]+)`/g, '<code>$1</code>')
        // Newlines
        .replace(/\n/g, '<br>');
    
    messageEl.innerHTML = `<div class="message-content">${formattedContent}</div>`;
    chatMessages.appendChild(messageEl);
    scrollToBottom();
}

function scrollToBottom() {
    chatMessages.scrollTop = chatMessages.scrollHeight;
}

function updateUploadStatus(message, type) {
    uploadStatus.textContent = message;
    uploadStatus.className = 'upload-status';
    if (type) {
        uploadStatus.classList.add(type);
    }
}

function setupTextareaAutoResize() {
    chatInput.addEventListener('input', () => {
        chatInput.style.height = 'auto';
        chatInput.style.height = (chatInput.scrollHeight) + 'px';
    });
}

function resetTextareaHeight() {
    chatInput.style.height = 'auto';
}

function getCSRFToken() {
    // Get CSRF token from cookie
    const cookieValue = document.cookie
        .split('; ')
        .find(row => row.startsWith('csrftoken='))
        ?.split('=')[1];
    
    return cookieValue || '';
}

// Document list functions
function loadDocuments() {
    fetch('/api/documents/')
        .then(response => response.json())
        .then(documents => {
            renderDocumentsList(documents);
        })
        .catch(error => {
            console.error('Error loading documents:', error);
            document.getElementById('documents-list').innerHTML = 
                '<div class="loading-documents">Failed to load documents. Please try again.</div>';
        });
}

function renderDocumentsList(documents) {
    const documentsListEl = document.getElementById('documents-list');
    
    // Empty the list first
    documentsListEl.innerHTML = '';
    
    if (documents.length === 0) {
        documentsListEl.innerHTML = '<div class="loading-documents">No documents uploaded yet.</div>';
        return;
    }
    
    // Add each document to the list
    documents.forEach(doc => {
        const docEl = document.createElement('div');
        docEl.className = 'document-item';
        docEl.setAttribute('data-id', doc.id);
        
        // Get icon based on file type
        let iconName = 'file-text';
        if (doc.file_type === 'pdf') {
            iconName = 'file-text';
        } else if (doc.file_type === 'word') {
            iconName = 'file';
        }
        
        docEl.innerHTML = `
            <div class="document-icon">
                <i data-feather="${iconName}"></i>
            </div>
            <div class="document-title">${doc.title}</div>
            <div class="document-delete" title="Delete document">
                <i data-feather="trash-2"></i>
            </div>
        `;
        
        documentsListEl.appendChild(docEl);
        
        // Add event listener for delete button
        const deleteBtn = docEl.querySelector('.document-delete');
        deleteBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            if (confirm('Are you sure you want to delete this document? This action cannot be undone.')) {
                deleteDocument(doc.id);
            }
        });
    });
    
    // Reinitialize Feather icons
    feather.replace();
}

function deleteDocument(documentId) {
    fetch(`/api/documents/${documentId}/delete/`, {
        method: 'DELETE',
        headers: {
            'X-CSRFToken': getCSRFToken(),
        }
    })
    .then(response => {
        if (!response.ok) {
            throw new Error(`HTTP error ${response.status}`);
        }
        
        // Reload documents
        loadDocuments();
    })
    .catch(error => {
        console.error('Error deleting document:', error);
        alert('Failed to delete document. Please try again.');
    });
}

// Handle modal window outside click to close
window.addEventListener('click', (e) => {
    if (e.target === uploadModal) {
        uploadModal.style.display = 'none';
    }
});

// Handle escape key to close modal
document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && uploadModal.style.display === 'block') {
        uploadModal.style.display = 'none';
    }
});
