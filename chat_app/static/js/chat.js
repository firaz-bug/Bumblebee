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
    .then(response => response.json())
    .then(data => {
        currentConversationId = data.id;
        chatTitle.textContent = data.title;
        
        // Update the UI
        loadConversations();
        loadMessages(currentConversationId);
        
        isProcessing = false;
    })
    .catch(error => {
        console.error('Error creating conversation:', error);
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
    .then(response => response.json())
    .then(data => {
        // Remove typing indicator
        if (typingIndicator.parentNode) {
            typingIndicator.parentNode.removeChild(typingIndicator);
        }
        
        // The response contains both the user message and the assistant's response
        // We've already added the user message, so we just need the assistant's response
        const assistantMessage = data.find(msg => msg.role === 'assistant');
        if (assistantMessage) {
            addMessageToUI('assistant', assistantMessage.content);
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
        
        // Create a new conversation and switch to it
        createNewConversation();
    })
    .catch(error => {
        console.error('Error deleting conversation:', error);
        alert('Failed to delete conversation. Please try again.');
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
