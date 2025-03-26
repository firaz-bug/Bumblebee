// Chat.js - Main JavaScript file for the Wells Fargo AI Platform Support Assistant

// Global state
let currentIncidentId = null;
let currentConversationId = null;

// Helper function to get CSRF token
function getCSRFToken() {
    const cookieValue = document.cookie
        .split('; ')
        .find(row => row.startsWith('csrftoken='))
        ?.split('=')[1];
    return cookieValue || '';
}

// Function to show temporary notification
function showNotification(message, type = 'info') {
    // Create notification element if it doesn't exist
    let notification = document.getElementById('notification');
    if (!notification) {
        notification = document.createElement('div');
        notification.id = 'notification';
        document.body.appendChild(notification);
    }

    // Set notification content and style
    notification.textContent = message;
    notification.className = `notification ${type}`;

    // Show notification
    notification.style.display = 'block';
    notification.style.opacity = '1';

    // Hide notification after 3 seconds
    setTimeout(() => {
        notification.style.opacity = '0';
        setTimeout(() => {
            notification.style.display = 'none';
        }, 300);
    }, 3000);
}

// Function to load conversations
async function loadConversations() {
    try {
        const response = await fetch('/api/conversations/');
        if (!response.ok) {
            throw new Error('Failed to load conversations');
        }

        const conversations = await response.json();
        const conversationsList = document.getElementById('conversations-list');
        if (!conversationsList) return;

        if (conversations.length === 0) {
            conversationsList.innerHTML = '<div class="empty-state">No conversations yet</div>';
            return;
        }

        let html = '';
        conversations.forEach(conv => {
            html += `
                <div class="conversation-item" data-id="${conv.id}">
                    <div class="conversation-title">${conv.title}</div>
                    <div class="conversation-date">${new Date(conv.updated_at).toLocaleString()}</div>
                </div>
            `;
        });

        conversationsList.innerHTML = html;

        // Add click event listeners
        document.querySelectorAll('.conversation-item').forEach(item => {
            item.addEventListener('click', function() {
                const conversationId = this.dataset.id;
                switchConversation(conversationId);
            });
        });

        // Select the first conversation by default if none is selected
        if (!currentConversationId && conversations.length > 0) {
            switchConversation(conversations[0].id);
        }
    } catch (error) {
        console.error('Error loading conversations:', error);
        const conversationsList = document.getElementById('conversations-list');
        if (conversationsList) {
            conversationsList.innerHTML = '<div class="error">Failed to load conversations</div>';
        }
    }
}

// Function to switch conversation
async function switchConversation(conversationId) {
    if (conversationId === currentConversationId) return;

    try {
        currentConversationId = conversationId;

        // Highlight the selected conversation
        document.querySelectorAll('.conversation-item').forEach(item => {
            if (item.dataset.id === conversationId) {
                item.classList.add('active');
            } else {
                item.classList.remove('active');
            }
        });

        const response = await fetch(`/api/conversations/${conversationId}/`);
        if (!response.ok) {
            throw new Error('Failed to load conversation details');
        }

        const conversation = await response.json();

        // Update conversation title
        const titleElement = document.getElementById('current-conversation-title');
        if (titleElement) {
            titleElement.textContent = conversation.title;
        }

        // Display messages
        const messagesContainer = document.getElementById('chat-messages');
        if (messagesContainer) {
            displayMessages(conversation.messages);

            // Scroll to bottom of chat
            messagesContainer.scrollTop = messagesContainer.scrollHeight;
        } else {
            console.warn('Chat messages container not found');
        }
    } catch (error) {
        console.error('Error switching conversation:', error);
        const chatMessages = document.getElementById('chat-messages');
        if (chatMessages) {
            chatMessages.innerHTML = '<div class="error">Failed to load conversation</div>';
        }
    }
}

// Function to display messages
function displayMessages(messages) {
    const chatMessages = document.getElementById('chat-messages');
    if (!chatMessages) return;

    if (!messages || messages.length === 0) {
        chatMessages.innerHTML = '<div class="empty-state">No messages yet. Start the conversation!</div>';
        return;
    }

    let html = '';
    messages.forEach(msg => {
        // Define message class based on role
        let messageClass = '';
        if (msg.role === 'user') {
            messageClass = 'user';
        } else if (msg.role === 'assistant') {
            messageClass = 'assistant';
        } else if (msg.role === 'system') {
            messageClass = 'system';
        }

        // Format the message content to handle markdown-like formatting
        let formattedContent = msg.content;

        // Replace markdown code blocks with HTML
        formattedContent = formattedContent.replace(/```([^`]+)```/g, '<pre><code>$1</code></pre>');

        // Replace inline code with HTML
        formattedContent = formattedContent.replace(/`([^`]+)`/g, '<code>$1</code>');

        // Handle line breaks
        formattedContent = formattedContent.replace(/\n/g, '<br>');

        html += `
            <div class="message ${messageClass}">
                <div class="message-content">${formattedContent}</div>
            </div>
        `;
    });

    chatMessages.innerHTML = html;
}

// Function to create a new chat
async function createNewChat() {
    try {
        const response = await fetch('/api/conversations/', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-CSRFToken': getCSRFToken()
            },
            body: JSON.stringify({
                title: 'New Conversation'
            })
        });

        if (!response.ok) {
            throw new Error('Failed to create new conversation');
        }

        const newConversation = await response.json();

        // Reload conversations and switch to the new one
        await loadConversations();
        switchConversation(newConversation.id);

        // Clear the chat input
        const chatInput = document.getElementById('chat-input');
        if (chatInput) {
            chatInput.value = '';
        }
    } catch (error) {
        console.error('Error creating new conversation:', error);
        alert('Failed to create new conversation. Please try again.');
    }
}

// Function to rename the current chat
async function renameCurrentChat() {
    if (!currentConversationId) {
        alert('Please select a conversation first');
        return;
    }

    const newTitle = prompt('Enter a new title for this conversation:', '');
    if (!newTitle || newTitle.trim() === '') {
        return; // User canceled or entered empty title
    }

    try {
        // Using PATCH method as it's more appropriate for partial updates
        const response = await fetch(`/api/conversations/${currentConversationId}/`, {
            method: 'PATCH',
            headers: {
                'Content-Type': 'application/json',
                'X-CSRFToken': getCSRFToken()
            },
            body: JSON.stringify({
                title: newTitle.trim()
            })
        });

        if (!response.ok) {
            throw new Error(`Failed to rename conversation: ${response.status} ${response.statusText}`);
        }

        const updatedConversation = await response.json();

        // Update the conversation title in the UI
        const titleElement = document.getElementById('current-conversation-title');
        if (titleElement) {
            titleElement.textContent = updatedConversation.title;
        }

        // Update the title in the conversation list
        const conversationItem = document.querySelector(`.conversation-item[data-id="${currentConversationId}"]`);
        if (conversationItem) {
            const titleElement = conversationItem.querySelector('.conversation-title');
            if (titleElement) {
                titleElement.textContent = updatedConversation.title;
            }
        }

        // Notify the user
        showNotification('Conversation renamed successfully', 'success');
    } catch (error) {
        console.error('Error renaming conversation:', error);
        showNotification('Failed to rename conversation. Please try again.', 'error');
    }
}

// Function to delete the current chat
async function deleteCurrentChat() {
    if (!currentConversationId) {
        showNotification('Please select a conversation first', 'warning');
        return;
    }

    if (!confirm('Are you sure you want to delete this conversation?')) {
        return;
    }

    try {
        const response = await fetch(`/api/conversations/${currentConversationId}/`, {
            method: 'DELETE',
            headers: {
                'X-CSRFToken': getCSRFToken()
            }
        });

        if (!response.ok) {
            throw new Error(`Failed to delete conversation: ${response.status} ${response.statusText}`);
        }

        // Show success notification
        showNotification('Conversation deleted successfully', 'success');

        currentConversationId = null;

        // Reload conversations
        await loadConversations();
    } catch (error) {
        console.error('Error deleting conversation:', error);
        showNotification('Failed to delete conversation. Please try again.', 'error');
    }
}

// Function to handle chat form submission
async function handleChatSubmit(event) {
    event.preventDefault();

    const chatInput = document.getElementById('chat-input');
    if (!chatInput || !chatInput.value.trim() || !currentConversationId) {
        return;
    }

    const userMessage = chatInput.value.trim();
    chatInput.value = '';

    // Display user message immediately
    const chatMessages = document.getElementById('chat-messages');
    if (!chatMessages) {
        console.error('Chat messages container not found');
        return;
    }

    // Add user message
    const userMessageHtml = `
        <div class="message user">
            <div class="message-content">${userMessage}</div>
        </div>
    `;

    // If it's the first message, remove the empty state message
    if (chatMessages.querySelector('.empty-state')) {
        chatMessages.innerHTML = '';
    }

    chatMessages.insertAdjacentHTML('beforeend', userMessageHtml);
    chatMessages.scrollTop = chatMessages.scrollHeight;

    // Add loading indicator (typing animation)
    const loadingHtml = `
        <div class="message assistant loading">
            <div class="message-content">
                <div class="typing-indicator">
                    <span></span><span></span><span></span>
                </div>
            </div>
        </div>
    `;
    chatMessages.insertAdjacentHTML('beforeend', loadingHtml);
    const loadingElement = chatMessages.querySelector('.loading');
    chatMessages.scrollTop = chatMessages.scrollHeight;

    try {
        const response = await fetch(`/api/conversations/${currentConversationId}/messages/`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-CSRFToken': getCSRFToken()
            },
            body: JSON.stringify({
                role: 'user',
                content: userMessage
            })
        });

        if (!response.ok) {
            throw new Error('Failed to send message');
        }

        // Get the response data to check for special responses like datasource logs
        const responseData = await response.json();
        
        // Check if this is a datasource response with logs
        if (responseData && responseData.datasource_logs) {
            console.log("Received datasource logs:", responseData.datasource_logs);
            
            // Remove loading indicator
            if (loadingElement) {
                loadingElement.remove();
            }

            // Display messages directly from the response
            if (responseData.messages) {
                displayMessages(responseData.messages);
            } else {
                // Fetch updated conversation to display messages
                const conversationResponse = await fetch(`/api/conversations/${currentConversationId}/`);
                if (conversationResponse.ok) {
                    const updatedConversation = await conversationResponse.json();
                    displayMessages(updatedConversation.messages);
                }
            }
            chatMessages.scrollTop = chatMessages.scrollHeight;
            
            // Show datasource logs in modal
            showDatasourceLogs(responseData.datasource_logs);
            
            // Create a log entry
            createLogEntry(
                responseData.datasource_logs.status === 'success' ? 'info' : 'error', 
                'datasource_service',
                `Data source '${responseData.datasource_logs.datasource?.name || 'Unknown'}' queried: ${responseData.datasource_logs.message || 'No details'}`
            );
            
            return;
        }
        
        // Check if this is an automation response with logs
        if (responseData && responseData.automation_logs) {
            console.log("Received automation logs:", responseData.automation_logs);
            
            // Remove loading indicator
            if (loadingElement) {
                loadingElement.remove();
            }

            // Display messages directly from the response
            if (responseData.messages) {
                displayMessages(responseData.messages);
            } else {
                // Fetch updated conversation to display messages
                const conversationResponse = await fetch(`/api/conversations/${currentConversationId}/`);
                if (conversationResponse.ok) {
                    const updatedConversation = await conversationResponse.json();
                    displayMessages(updatedConversation.messages);
                }
            }
            chatMessages.scrollTop = chatMessages.scrollHeight;
            
            // Show automation logs in modal
            showAutomationLogs(responseData.automation_logs);
            
            // Create a log entry
            createLogEntry(
                responseData.automation_logs.status === 'success' ? 'info' : 'error', 
                'automation_service',
                `Automation '${responseData.automation_logs.automation?.name || 'Unknown'}' executed: ${responseData.automation_logs.message || 'No details'}`
            );
            
            return;
        }

        // Regular response - fetch updated conversation
        const conversationResponse = await fetch(`/api/conversations/${currentConversationId}/`);
        if (!conversationResponse.ok) {
            throw new Error('Failed to get conversation updates');
        }

        const updatedConversation = await conversationResponse.json();

        // Remove loading indicator
        if (loadingElement) {
            loadingElement.remove();
        }

        // Display all messages
        displayMessages(updatedConversation.messages);
        chatMessages.scrollTop = chatMessages.scrollHeight;
    } catch (error) {
        console.error('Error sending message:', error);
        
        // Remove loading indicator
        if (loadingElement) {
            loadingElement.remove();
        }
        
        // Add error message
        const errorMessageHtml = `
            <div class="message system error">
                <div class="message-content">Error: Failed to send message. Please try again.</div>
            </div>
        `;
        chatMessages.insertAdjacentHTML('beforeend', errorMessageHtml);
        chatMessages.scrollTop = chatMessages.scrollHeight;
    }
}

// Function to load documents
async function loadDocuments() {
    try {
        const response = await fetch('/api/documents/');
        if (!response.ok) {
            throw new Error('Failed to load documents');
        }

        const documents = await response.json();
        renderDocumentsList(documents);
    } catch (error) {
        console.error('Error loading documents:', error);
        const documentsContainer = document.getElementById('documents-list');
        if (documentsContainer) {
            documentsContainer.innerHTML = '<div class="error">Failed to load documents</div>';
        }
    }
}

// Function to render documents list
function renderDocumentsList(documents) {
    const documentsContainer = document.getElementById('documents-list');
    if (!documentsContainer) return;

    if (!documents || documents.length === 0) {
        documentsContainer.innerHTML = '<div class="empty-state">No documents uploaded yet</div>';
        return;
    }

    let html = '';
    documents.forEach(doc => {
        const fileTypeIcon = getFileTypeIcon(doc.file_type);
        html += `
            <div class="document-item" data-id="${doc.id}">
                <div class="document-icon">${fileTypeIcon}</div>
                <div class="document-details">
                    <div class="document-title">${doc.title}</div>
                    <div class="document-date">${new Date(doc.uploaded_at).toLocaleString()}</div>
                </div>
                <button class="document-delete-btn" data-id="${doc.id}" aria-label="Delete document">
                    <i class="fas fa-trash"></i>
                </button>
            </div>
        `;
    });

    documentsContainer.innerHTML = html;

    // Add event listeners for delete buttons
    document.querySelectorAll('.document-delete-btn').forEach(btn => {
        btn.addEventListener('click', function(e) {
            e.stopPropagation();
            const documentId = this.getAttribute('data-id');
            if (confirm('Are you sure you want to delete this document?')) {
                deleteDocument(documentId);
            }
        });
    });
}

// Helper function to get file type icon
function getFileTypeIcon(fileType) {
    const iconMap = {
        'pdf': '<i class="fas fa-file-pdf"></i>',
        'docx': '<i class="fas fa-file-word"></i>',
        'doc': '<i class="fas fa-file-word"></i>',
        'txt': '<i class="fas fa-file-alt"></i>',
        'csv': '<i class="fas fa-file-csv"></i>',
        'xlsx': '<i class="fas fa-file-excel"></i>',
        'xls': '<i class="fas fa-file-excel"></i>',
        'pptx': '<i class="fas fa-file-powerpoint"></i>',
        'ppt': '<i class="fas fa-file-powerpoint"></i>',
        'jpg': '<i class="fas fa-file-image"></i>',
        'jpeg': '<i class="fas fa-file-image"></i>',
        'png': '<i class="fas fa-file-image"></i>',
        'gif': '<i class="fas fa-file-image"></i>',
    };

    return iconMap[fileType.toLowerCase()] || '<i class="fas fa-file"></i>';
}

// Delete a document
async function deleteDocument(documentId) {
    try {
        const response = await fetch(`/api/documents/${documentId}/`, {
            method: 'DELETE',
            headers: {
                'X-CSRFToken': getCSRFToken()
            }
        });

        if (!response.ok) {
            throw new Error('Failed to delete document');
        }

        // Reload documents list
        await loadDocuments();
        showNotification('Document deleted successfully', 'success');
    } catch (error) {
        console.error('Error deleting document:', error);
        showNotification('Failed to delete document', 'error');
    }
}

// Function to render incidents list
function renderIncidentsList(incidents) {
    const incidentsContainer = document.getElementById('incidents-list');
    if (!incidentsContainer) return;

    if (!incidents || incidents.length === 0) {
        incidentsContainer.innerHTML = '<div class="empty-state">No incidents found</div>';
        return;
    }

    let html = '';
    incidents.forEach(incident => {
        // Set severity class based on priority
        let severityClass = '';
        if (incident.priority && incident.priority.toLowerCase().includes('critical')) {
            severityClass = 'critical';
        } else if (incident.priority && incident.priority.toLowerCase().includes('high')) {
            severityClass = 'high';
        } else if (incident.priority && incident.priority.toLowerCase().includes('medium')) {
            severityClass = 'medium';
        } else {
            severityClass = 'low';
        }
        
        // Get status badge based on state
        let statusBadge = '';
        const statusMap = {
            1: { text: 'New', class: 'new' },
            2: { text: 'In Progress', class: 'in-progress' },
            3: { text: 'On Hold', class: 'on-hold' },
            4: { text: 'Resolved', class: 'resolved' },
            5: { text: 'Closed/Canceled', class: 'closed' }
        };
        
        const status = statusMap[incident.state] || { text: 'Unknown', class: '' };
        statusBadge = `<span class="status-badge ${status.class}">${status.text}</span>`;

        html += `
            <div class="incident-item" data-id="${incident.id}">
                <div class="incident-header">
                    <div class="incident-title">${incident.incident_number}: ${incident.short_description}</div>
                    <div class="incident-severity ${severityClass}">${incident.priority}</div>
                </div>
                <div class="incident-status">
                    ${statusBadge}
                </div>
            </div>
        `;
    });

    incidentsContainer.innerHTML = html;

    // Add click event listeners to show details
    document.querySelectorAll('.incident-item').forEach(item => {
        item.addEventListener('click', function() {
            const incidentId = this.dataset.id;
            
            // Don't reload if already selected
            if (currentIncidentId === incidentId) return;
            
            fetchIncidentDetails(incidentId);
            
            // Highlight selected incident
            highlightIncident(this);
        });
    });
    
    // Update summary
    updateIncidentsSummary(incidents);
}

// Function to show incident details
function showIncidentDetails(incident) {
    const detailsContainer = document.getElementById('incident-details');
    if (!detailsContainer) return;

    // Set state text based on the state value
    const stateMap = {
        1: 'New',
        2: 'In Progress',
        3: 'On Hold',
        4: 'Resolved',
        5: 'Closed/Canceled'
    };
    
    const stateText = stateMap[incident.state] || 'Unknown';
    const stateClass = stateText.toLowerCase().replace(/\s+/g, '-');

    let html = `
        <div class="incident-detail-header">
            <h3>${incident.incident_number}</h3>
            <div class="incident-detail-priority">${incident.priority}</div>
        </div>
        <div class="incident-detail-state ${stateClass}">
            ${stateText}
        </div>
        <div class="incident-detail-description">
            <h4>Short Description</h4>
            <p>${incident.short_description}</p>
            <h4>Long Description</h4>
            <p>${incident.long_description}</p>
        </div>
    `;
    
    // Add state update buttons
    html += `<div class="incident-actions">`;
    
    // Show different actions based on current state
    if (incident.state < 4) { // For states 1, 2, 3 (New, In Progress, On Hold)
        html += `
            <button class="status-btn in-progress" data-state="2">Mark In Progress</button>
            <button class="status-btn on-hold" data-state="3">Mark On Hold</button>
            <button class="status-btn resolved" data-state="4">Mark Resolved</button>
            <button class="status-btn closed" data-state="5">Close/Cancel</button>
        `;
    } else if (incident.state === 4) { // For Resolved
        html += `
            <button class="status-btn in-progress" data-state="2">Reopen (In Progress)</button>
            <button class="status-btn closed" data-state="5">Close/Cancel</button>
        `;
    } else { // For Closed
        html += `
            <button class="status-btn in-progress" data-state="2">Reopen (In Progress)</button>
        `;
    }
    
    // Add comments button for all states
    html += `<button class="status-btn add-comments" data-state="add-comments">Add Comments</button>`;
    html += `</div>`;
    
    // Add comments section
    html += `
        <div class="incident-comments">
            <h4>Comments</h4>
            <div class="comments-content">
                ${incident.comments ? incident.comments : '<em>No comments yet</em>'}
            </div>
        </div>
    `;

    detailsContainer.innerHTML = html;
    
    // Add event listeners to status buttons
    detailsContainer.querySelectorAll('.status-btn').forEach(btn => {
        btn.addEventListener('click', function() {
            const newState = this.dataset.state;
            showStatusUpdateModal(incident.id, newState);
        });
    });
    
    // Fetch recommendations based on incident
    fetchRecommendations(incident.id);
}

// Function to fetch incident details
function fetchIncidentDetails(incidentId) {
    fetch(`/api/incidents/${incidentId}/`)
        .then(response => {
            if (!response.ok) {
                throw new Error('Failed to fetch incident details');
            }
            return response.json();
        })
        .then(incident => {
            currentIncidentId = incidentId;
            showIncidentDetails(incident);
        })
        .catch(error => {
            console.error('Error fetching incident details:', error);
            const detailsContainer = document.getElementById('incident-details');
            if (detailsContainer) {
                detailsContainer.innerHTML = '<div class="error">Failed to load incident details</div>';
            }
        });
}

// Function to fetch recommendations based on incident
function fetchRecommendations(incidentId) {
    fetch(`/api/incidents/${incidentId}/`)
        .then(response => {
            if (!response.ok) {
                throw new Error('Failed to fetch incident details');
            }
            return response.json();
        })
        .then(incident => {
            // Update automation recommendations
            if (incident.recommended_automations) {
                updateRecommendedAutomations(incident.recommended_automations);
            }
            
            // Update dashboard recommendations
            if (incident.recommended_dashboards) {
                updateRecommendedDashboards(incident.recommended_dashboards);
            }
        })
        .catch(error => {
            console.error('Error fetching recommendations:', error);
        });
}

// Function to highlight selected incident
function highlightIncident(element) {
    // Remove active class from all incidents
    document.querySelectorAll('.incident-item').forEach(item => {
        item.classList.remove('active');
    });
    
    // Add active class to selected incident
    element.classList.add('active');
}

// Function to show status update modal
function showStatusUpdateModal(incidentId, newStatus) {
    const statusModal = document.getElementById('status-update-modal');
    if (!statusModal) return;
    
    // Set modal title based on new status
    const statusTitleMap = {
        '1': 'Update to New',
        '2': 'Update to In Progress',
        '3': 'Update to On Hold',
        '4': 'Update to Resolved',
        '5': 'Update to Closed/Canceled',
        'add-comments': 'Add Comments'
    };
    
    const modalTitle = statusModal.querySelector('.modal-title');
    if (modalTitle) {
        modalTitle.textContent = statusTitleMap[newStatus] || 'Update Status';
    }
    
    // Set data attributes for the form submission handler
    statusModal.dataset.incidentId = incidentId;
    statusModal.dataset.newStatus = newStatus;
    
    // Set comments label based on action
    const commentsLabel = statusModal.querySelector('label[for="status-comments"]');
    if (commentsLabel) {
        commentsLabel.textContent = newStatus === 'add-comments' ? 'Comments:' : 'Comments for status update:';
    }
    
    // Clear previous comments
    const commentsField = document.getElementById('status-comments');
    if (commentsField) {
        commentsField.value = '';
    }
    
    // Show the modal
    statusModal.style.display = 'block';
}

// Function to update incident status
function updateIncidentStatus(incidentId, newState, comments = '') {
    // Return a Promise to allow chaining with other async operations
    return new Promise((resolve, reject) => {
        // Prepare request data with state field
        const requestData = {
            state: parseInt(newState) // Convert to integer since state is stored as an integer
        };

        // Add comments if provided
        if (comments) {
            requestData.comments = comments;
        }

        // Send PUT request to update incident
        fetch(`/api/incidents/${incidentId}/`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'X-CSRFToken': getCSRFToken()
            },
            body: JSON.stringify(requestData)
        })
        .then(response => {
            if (!response.ok) {
                throw new Error('Failed to update incident status');
            }
            return response.json();
        })
        .then(updatedIncident => {
            // Update the UI with the new incident data
            showIncidentDetails(updatedIncident);

            // Also update the incident in the list
            updateIncidentInList(updatedIncident);

            // Show success message
            const detailsContainer = document.getElementById('incident-details');
            const successMsg = document.createElement('div');
            successMsg.className = 'status-update-success';
            
            // Check if this was a status update or just comments
            const isStatusUpdate = newState !== 'add-comments';
            const statusMap = {
                1: 'New',
                2: 'In Progress',
                3: 'On Hold',
                4: 'Resolved',
                5: 'Closed/Canceled'
            };
            
            successMsg.textContent = isStatusUpdate 
                ? `Status updated to ${statusMap[newState] || 'new status'}` 
                : `Comments added successfully`;
                
            successMsg.style.color = 'green';
            successMsg.style.marginTop = '10px';
            detailsContainer.appendChild(successMsg);

            // Remove success message after 3 seconds
            setTimeout(() => {
                if (successMsg.parentNode) {
                    successMsg.parentNode.removeChild(successMsg);
                }
            }, 3000);

            // Reload the incidents list to reflect the updates
            loadIncidents();
            
            // Resolve the promise with the updated incident
            resolve(updatedIncident);
        })
        .catch(error => {
            console.error('Error updating incident status:', error);
            // Show error message
            const detailsContainer = document.getElementById('incident-details');
            const errorMsg = document.createElement('div');
            errorMsg.className = 'status-update-error';
            
            // Check if this was a status update or just comments
            const isStatusUpdate = newState !== 'add-comments';
            
            errorMsg.textContent = isStatusUpdate 
                ? `Failed to update status. Please try again.` 
                : `Failed to add comments. Please try again.`;
                
            errorMsg.style.color = 'red';
            errorMsg.style.marginTop = '10px';
            detailsContainer.appendChild(errorMsg);

            // Remove error message after 3 seconds
            setTimeout(() => {
                if (errorMsg.parentNode) {
                    errorMsg.parentNode.removeChild(errorMsg);
                }
            }, 3000);
            
            // Reject the promise with the error
            reject(error);
        });
    });
}

// Function to update a single incident in the list
function updateIncidentInList(updatedIncident) {
    const incidentElement = document.querySelector(`.incident-item[data-id="${updatedIncident.id}"]`);
    if (incidentElement) {
        const titleElement = incidentElement.querySelector('.incident-title');
        if (titleElement) {
            // Update incident title (number + short description)
            titleElement.textContent = `${updatedIncident.incident_number}: ${updatedIncident.short_description}`;
        }
        
        const priorityElement = incidentElement.querySelector('.incident-severity');
        if (priorityElement) {
            // Update priority
            priorityElement.textContent = updatedIncident.priority;
            
            // Update severity class
            priorityElement.className = 'incident-severity';
            if (updatedIncident.priority.toLowerCase().includes('critical')) {
                priorityElement.classList.add('critical');
            } else if (updatedIncident.priority.toLowerCase().includes('high')) {
                priorityElement.classList.add('high');
            } else if (updatedIncident.priority.toLowerCase().includes('medium')) {
                priorityElement.classList.add('medium');
            } else {
                priorityElement.classList.add('low');
            }
        }
        
        // Update status badge
        const statusElement = incidentElement.querySelector('.incident-status');
        if (statusElement) {
            const statusMap = {
                1: { text: 'New', class: 'new' },
                2: { text: 'In Progress', class: 'in-progress' },
                3: { text: 'On Hold', class: 'on-hold' },
                4: { text: 'Resolved', class: 'resolved' },
                5: { text: 'Closed/Canceled', class: 'closed' }
            };
            
            const status = statusMap[updatedIncident.state] || { text: 'Unknown', class: '' };
            statusElement.innerHTML = `<span class="status-badge ${status.class}">${status.text}</span>`;
        }
    }
}

// Function to update incidents summary
function updateIncidentsSummary(incidents) {
    const summaryElement = document.getElementById('incidents-summary');
    if (!summaryElement) return;
    
    // Count incidents by state
    const stateCounts = {
        1: 0, // New
        2: 0, // In Progress
        3: 0, // On Hold
        4: 0, // Resolved
        5: 0  // Closed/Canceled
    };
    
    incidents.forEach(incident => {
        if (stateCounts.hasOwnProperty(incident.state)) {
            stateCounts[incident.state]++;
        }
    });
    
    // Update summary text
    summaryElement.innerHTML = `
        <div>Total: <strong>${incidents.length}</strong></div>
        <div>New: <strong>${stateCounts[1]}</strong></div>
        <div>In Progress: <strong>${stateCounts[2]}</strong></div>
        <div>On Hold: <strong>${stateCounts[3]}</strong></div>
        <div>Resolved: <strong>${stateCounts[4]}</strong></div>
        <div>Closed: <strong>${stateCounts[5]}</strong></div>
    `;
}

// Function to load incidents from API
function loadIncidents() {
    fetch('/api/incidents/')
        .then(response => {
            if (!response.ok) {
                throw new Error('Failed to load incidents');
            }
            return response.json();
        })
        .then(incidents => {
            renderIncidentsList(incidents);
            
            // If we have a currentIncidentId, reselect that incident
            if (currentIncidentId) {
                const incidentElement = document.querySelector(`.incident-item[data-id="${currentIncidentId}"]`);
                if (incidentElement) {
                    highlightIncident(incidentElement);
                }
            }
        })
        .catch(error => {
            console.error('Error loading incidents:', error);
            const incidentsContainer = document.getElementById('incidents-list');
            if (incidentsContainer) {
                incidentsContainer.innerHTML = '<div class="error">Failed to load incidents</div>';
            }
        });
}

// Function to load automations from API
function loadAutomations() {
    fetch('/api/automations/')
        .then(response => {
            if (!response.ok) {
                throw new Error('Failed to load automations');
            }
            return response.json();
        })
        .then(automations => {
            renderAutomationsList(automations);
        })
        .catch(error => {
            console.error('Error loading automations:', error);
            const automationsContainer = document.getElementById('automations-list');
            if (automationsContainer) {
                automationsContainer.innerHTML = '<div class="error">Failed to load automations</div>';
            }
        });
}

// Function to update recommended automations
function updateRecommendedAutomations(automationIds) {
    // First get all automations
    fetch('/api/automations/')
        .then(response => {
            if (!response.ok) {
                throw new Error('Failed to load automations');
            }
            return response.json();
        })
        .then(automations => {
            // Filter to just recommended ones
            const recommendedAutomations = automations.filter(automation => 
                automationIds.includes(automation.id)
            );
            
            // Render the recommended automations
            const container = document.getElementById('recommendations-automations');
            if (!container) return;
            
            if (recommendedAutomations.length === 0) {
                container.innerHTML = '<div class="empty-state">No recommended automations</div>';
                return;
            }
            
            let html = '';
            recommendedAutomations.forEach(automation => {
                html += `
                    <div class="recommendation-item automation-item" data-id="${automation.id}">
                        <div class="recommendation-icon"><i class="fas fa-robot"></i></div>
                        <div class="recommendation-details">
                            <div class="recommendation-title">${automation.name}</div>
                            <div class="recommendation-description">${automation.description}</div>
                        </div>
                        <button class="trigger-automation-btn" data-id="${automation.id}" aria-label="Run Automation">
                            <i class="fas fa-play"></i>
                        </button>
                    </div>
                `;
            });
            
            container.innerHTML = html;
            
            // Add event listeners to the trigger buttons
            container.querySelectorAll('.trigger-automation-btn').forEach(btn => {
                btn.addEventListener('click', function() {
                    const automationId = this.dataset.id;
                    triggerAutomation(automationId);
                });
            });
        })
        .catch(error => {
            console.error('Error updating recommended automations:', error);
            const container = document.getElementById('recommendations-automations');
            if (container) {
                container.innerHTML = '<div class="error">Failed to load recommended automations</div>';
            }
        });
}

// Function to render automations list
function renderAutomationsList(automations) {
    const automationsContainer = document.getElementById('automations-list');
    if (!automationsContainer) return;

    if (!automations || automations.length === 0) {
        automationsContainer.innerHTML = '<div class="empty-state">No automations available</div>';
        return;
    }

    let html = '';
    automations.forEach(automation => {
        html += `
            <div class="automation-item" data-id="${automation.id}">
                <div class="automation-icon"><i class="fas fa-robot"></i></div>
                <div class="automation-details">
                    <div class="automation-title">${automation.name}</div>
                    <div class="automation-description">${automation.description}</div>
                </div>
                <button class="trigger-automation-btn" data-id="${automation.id}" aria-label="Run Automation">
                    <i class="fas fa-play"></i>
                </button>
            </div>
        `;
    });

    automationsContainer.innerHTML = html;

    // Add event listeners to the trigger buttons
    automationsContainer.querySelectorAll('.trigger-automation-btn').forEach(btn => {
        btn.addEventListener('click', function() {
            const automationId = this.dataset.id;
            triggerAutomation(automationId);
        });
    });
}

// Function to trigger an automation
function triggerAutomation(automationId) {
    fetch(`/api/automations/${automationId}/trigger/`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'X-CSRFToken': getCSRFToken()
        }
    })
    .then(response => {
        if (!response.ok) {
            throw new Error('Failed to trigger automation');
        }
        return response.json();
    })
    .then(data => {
        console.log('Automation triggered successfully:', data);
        
        // Show logs modal
        showAutomationLogs(data);
        
        // Create a log entry
        createLogEntry(
            data.status === 'success' ? 'info' : 'error',
            'automation_service',
            `Automation '${data.automation?.name || automationId}' triggered: ${data.message || 'No details'}`
        );
    })
    .catch(error => {
        console.error('Error triggering automation:', error);
        showNotification('Failed to trigger automation', 'error');
    });
}

// Function to show automation logs modal
function showAutomationLogs(data) {
    const automationLogsModal = document.getElementById('automation-logs-modal');
    if (!automationLogsModal) return;
    
    const titleElement = automationLogsModal.querySelector('.modal-title');
    if (titleElement) {
        const automationName = data.automation?.name || 'Unknown Automation';
        titleElement.textContent = `${automationName} Execution Log`;
    }
    
    const contentElement = automationLogsModal.querySelector('.modal-content-inner');
    if (contentElement) {
        let html = '';
        
        // Add summary of execution
        html += `<div class="logs-summary ${data.status}">
            <div class="logs-status">${data.status === 'success' ? 'Successful' : 'Failed'}</div>
            <div class="logs-message">${data.message || ''}</div>
        </div>`;
        
        // Add individual log entries
        html += '<div class="logs-entries">';
        if (data.logs && data.logs.length > 0) {
            data.logs.forEach(log => {
                html += `<div class="log-entry ${log.level}">
                    <span class="log-timestamp">${log.timestamp}</span>
                    <span class="log-level ${log.level}">${log.level.toUpperCase()}</span>
                    <span class="log-message">${log.message}</span>
                </div>`;
            });
        } else {
            html += '<div class="log-entry">No detailed logs available</div>';
        }
        html += '</div>';
        
        // Add raw response section if available
        if (data.raw_response) {
            html += '<div class="logs-raw-response">';
            html += '<h4>Response Data</h4>';
            html += '<pre>' + JSON.stringify(data.raw_response, null, 2) + '</pre>';
            html += '</div>';
        }
        
        contentElement.innerHTML = html;
    }
    
    // Show the modal
    automationLogsModal.style.display = 'block';
}

// Function to show datasource logs modal
function showDatasourceLogs(data) {
    const datasourceLogsModal = document.getElementById('datasource-logs-modal');
    if (!datasourceLogsModal) return;
    
    const titleElement = datasourceLogsModal.querySelector('.modal-title');
    if (titleElement) {
        const datasourceName = data.datasource?.name || 'Unknown Data Source';
        titleElement.textContent = `${datasourceName} Query Log`;
    }
    
    const contentElement = datasourceLogsModal.querySelector('.modal-content-inner');
    if (contentElement) {
        let html = '';
        
        // Add summary of execution
        html += `<div class="logs-summary ${data.status}">
            <div class="logs-status">${data.status === 'success' ? 'Successful' : 'Failed'}</div>
            <div class="logs-message">${data.message || ''}</div>
        </div>`;
        
        // Add individual log entries
        html += '<div class="logs-entries">';
        if (data.logs && data.logs.length > 0) {
            data.logs.forEach(log => {
                html += `<div class="log-entry ${log.level}">
                    <span class="log-timestamp">${log.timestamp}</span>
                    <span class="log-level ${log.level}">${log.level.toUpperCase()}</span>
                    <span class="log-message">${log.message}</span>
                </div>`;
            });
        } else {
            html += '<div class="log-entry">No detailed logs available</div>';
        }
        html += '</div>';
        
        // Add raw response section if available
        if (data.raw_response) {
            html += '<div class="logs-raw-response">';
            html += '<h4>Response Data</h4>';
            html += '<pre>' + JSON.stringify(data.raw_response, null, 2) + '</pre>';
            html += '</div>';
        }
        
        contentElement.innerHTML = html;
    }
    
    // Show the modal
    datasourceLogsModal.style.display = 'block';
}

// Function to create a log entry
function createLogEntry(level, source, message) {
    fetch('/api/logs/', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'X-CSRFToken': getCSRFToken()
        },
        body: JSON.stringify({
            level: level,
            source: source,
            message: message
        })
    })
    .then(response => {
        if (!response.ok) {
            throw new Error('Failed to create log entry');
        }
        return response.json();
    })
    .then(() => {
        // Reload logs
        loadLogs();
    })
    .catch(error => {
        console.error('Error creating log entry:', error);
    });
}

// Function to load dashboards from API
function loadDashboards() {
    fetch('/api/dashboards/')
        .then(response => {
            if (!response.ok) {
                throw new Error('Failed to load dashboards');
            }
            return response.json();
        })
        .then(dashboards => {
            renderDashboardsList(dashboards);
        })
        .catch(error => {
            console.error('Error loading dashboards:', error);
            const dashboardsContainer = document.getElementById('dashboards-list');
            if (dashboardsContainer) {
                dashboardsContainer.innerHTML = '<div class="error">Failed to load dashboards</div>';
            }
        });
}

// Function to update recommended dashboards
function updateRecommendedDashboards(dashboardIds) {
    // First get all dashboards
    fetch('/api/dashboards/')
        .then(response => {
            if (!response.ok) {
                throw new Error('Failed to load dashboards');
            }
            return response.json();
        })
        .then(dashboards => {
            // Filter to just recommended ones
            const recommendedDashboards = dashboards.filter(dashboard => 
                dashboardIds.includes(dashboard.id)
            );
            
            // Render the recommended dashboards
            const container = document.getElementById('recommendations-dashboards');
            if (!container) return;
            
            if (recommendedDashboards.length === 0) {
                container.innerHTML = '<div class="empty-state">No recommended dashboards</div>';
                return;
            }
            
            let html = '';
            recommendedDashboards.forEach(dashboard => {
                html += `
                    <div class="recommendation-item dashboard-item" data-id="${dashboard.id}">
                        <div class="recommendation-icon"><i class="fas fa-chart-line"></i></div>
                        <div class="recommendation-details">
                            <div class="recommendation-title">${dashboard.name}</div>
                            <div class="recommendation-description">${dashboard.description}</div>
                        </div>
                        <a href="${dashboard.link}" target="_blank" class="visit-dashboard-btn" aria-label="Open Dashboard">
                            <i class="fas fa-external-link-alt"></i>
                        </a>
                    </div>
                `;
            });
            
            container.innerHTML = html;
        })
        .catch(error => {
            console.error('Error updating recommended dashboards:', error);
            const container = document.getElementById('recommendations-dashboards');
            if (container) {
                container.innerHTML = '<div class="error">Failed to load recommended dashboards</div>';
            }
        });
}

// Function to render dashboards list
function renderDashboardsList(dashboards) {
    const dashboardsContainer = document.getElementById('dashboards-list');
    if (!dashboardsContainer) return;

    if (!dashboards || dashboards.length === 0) {
        dashboardsContainer.innerHTML = '<div class="empty-state">No dashboards available</div>';
        return;
    }

    let html = '';
    dashboards.forEach(dashboard => {
        html += `
            <div class="dashboard-item" data-id="${dashboard.id}">
                <div class="dashboard-icon"><i class="fas fa-chart-line"></i></div>
                <div class="dashboard-details">
                    <div class="dashboard-title">${dashboard.name}</div>
                    <div class="dashboard-description">${dashboard.description}</div>
                </div>
                <a href="${dashboard.link}" target="_blank" class="visit-dashboard-btn" aria-label="Open Dashboard">
                    <i class="fas fa-external-link-alt"></i>
                </a>
            </div>
        `;
    });

    dashboardsContainer.innerHTML = html;
}

// Function to load logs from API
function loadLogs() {
    fetch('/api/logs/')
        .then(response => {
            if (!response.ok) {
                throw new Error('Failed to load logs');
            }
            return response.json();
        })
        .then(logs => {
            renderLogsList(logs);
        })
        .catch(error => {
            console.error('Error loading logs:', error);
            const logsContainer = document.getElementById('logs-list');
            if (logsContainer) {
                logsContainer.innerHTML = '<div class="error">Failed to load logs</div>';
            }
        });
}

// Function to render logs list
function renderLogsList(logs) {
    const logsContainer = document.getElementById('logs-list');
    if (!logsContainer) return;

    if (!logs || logs.length === 0) {
        logsContainer.innerHTML = '<div class="empty-state">No logs available</div>';
        return;
    }

    // Limit to most recent logs
    const recentLogs = logs.slice(0, 50); // Show last 50 logs
    
    let html = '';
    recentLogs.forEach(log => {
        const timestamp = new Date(log.timestamp).toLocaleString();
        html += `
            <div class="log-item ${log.level}">
                <div class="log-timestamp">${timestamp}</div>
                <div class="log-level">${log.level.toUpperCase()}</div>
                <div class="log-source">[${log.source}]</div>
                <div class="log-message">${log.message}</div>
            </div>
        `;
    });

    logsContainer.innerHTML = html;
}

// Function to set up modal behavior
function setupModals() {
    // Get all modals
    const modals = document.querySelectorAll('.modal');

    // Get all close buttons
    const closeButtons = document.querySelectorAll('.modal-close, .modal-close-btn');

    // When the user clicks on a close button, close the parent modal
    closeButtons.forEach(button => {
        button.addEventListener('click', function() {
            const modal = this.closest('.modal');
            if (modal) {
                modal.style.display = 'none';

                // Reset form if this is the status update modal
                if (modal.id === 'status-update-modal') {
                    const commentsField = document.getElementById('status-comments');
                    if (commentsField) {
                        commentsField.value = '';
                    }
                }
            }
        });
    });

    // When the user clicks anywhere outside of the modal content, close it
    window.addEventListener('click', function(event) {
        modals.forEach(modal => {
            if (event.target === modal) {
                modal.style.display = 'none';

                // Reset form if this is the status update modal
                if (modal.id === 'status-update-modal') {
                    const commentsField = document.getElementById('status-comments');
                    if (commentsField) {
                        commentsField.value = '';
                    }
                }
            }
        });
    });

    // Set up document upload form
    const uploadForm = document.getElementById('document-upload-form');
    if (uploadForm) {
        uploadForm.addEventListener('submit', function(event) {
            event.preventDefault();

            const formData = new FormData(this);
            const statusDiv = document.getElementById('upload-status');

            fetch('/api/documents/upload/', {
                method: 'POST',
                headers: {
                    'X-CSRFToken': getCSRFToken()
                },
                body: formData
            })
            .then(response => {
                if (!response.ok) {
                    throw new Error('Network response was not ok');
                }
                return response.json();
            })
            .then(data => {
                statusDiv.innerHTML = '<div class="success">Document uploaded successfully!</div>';
                
                // Reset form and close modal after 2 seconds
                setTimeout(() => {
                    this.reset();
                    const modal = document.getElementById('upload-document-modal');
                    if (modal) {
                        modal.style.display = 'none';
                    }
                    statusDiv.innerHTML = '';
                    
                    // Reload documents list
                    loadDocuments();
                }, 2000);
            })
            .catch(error => {
                console.error('Error uploading document:', error);
                statusDiv.innerHTML = '<div class="error">Failed to upload document. Please try again.</div>';
            });
        });
    }

    // Set up status update form submission
    const updateCommentsForm = document.getElementById('update-comments-form');
    if (updateCommentsForm) {
        updateCommentsForm.addEventListener('submit', function(event) {
            event.preventDefault();

            const statusModal = document.getElementById('status-update-modal');
            const incidentId = statusModal.dataset.incidentId;
            const newStatus = statusModal.dataset.newStatus;
            const comments = document.getElementById('status-comments').value;
            
            // Show a loading indication in the button
            const submitBtn = this.querySelector('button[type="submit"]');
            const originalBtnText = submitBtn.textContent;
            submitBtn.textContent = 'Updating...';
            submitBtn.disabled = true;

            // Call the update function and handle modal closing after successful update
            updateIncidentStatus(incidentId, newStatus, comments)
                .then(() => {
                    // Close the modal on success
                    statusModal.style.display = 'none';
                    
                    // Clear the comments field for next time
                    document.getElementById('status-comments').value = '';
                })
                .catch(error => {
                    console.error('Error in modal form submission:', error);
                    // Show error message in the modal
                    const errorMsg = document.createElement('div');
                    errorMsg.className = 'status-update-error';
                    errorMsg.textContent = 'Failed to update incident. Please try again.';
                    errorMsg.style.color = 'red';
                    errorMsg.style.marginBottom = '10px';
                    
                    // Add the error message to the form
                    const formActions = this.querySelector('.form-actions');
                    formActions.insertAdjacentElement('beforebegin', errorMsg);
                    
                    // Remove error message after 3 seconds
                    setTimeout(() => {
                        if (errorMsg.parentNode) {
                            errorMsg.parentNode.removeChild(errorMsg);
                        }
                    }, 3000);
                })
                .finally(() => {
                    // Reset button state
                    submitBtn.textContent = originalBtnText;
                    submitBtn.disabled = false;
                });
        });
    }

    // Set up cancel button for status update modal
    const cancelUpdateBtn = document.getElementById('cancel-update-btn');
    if (cancelUpdateBtn) {
        cancelUpdateBtn.addEventListener('click', function() {
            const statusModal = document.getElementById('status-update-modal');
            if (statusModal) {
                statusModal.style.display = 'none';

                // Clear the comments field
                const commentsField = document.getElementById('status-comments');
                if (commentsField) {
                    commentsField.value = '';
                }
            }
        });
    }
}

// Function to clear all conversations
async function clearAllConversations() {
    if (!confirm('Are you sure you want to delete ALL conversations? This cannot be undone.')) {
        return;
    }
    
    try {
        const response = await fetch('/api/conversations/clear/', {
            method: 'POST',
            headers: {
                'X-CSRFToken': getCSRFToken()
            }
        });
        
        if (!response.ok) {
            throw new Error('Failed to clear conversations');
        }
        
        // Show success notification
        showNotification('All conversations cleared successfully', 'success');
        
        // Reset current conversation ID
        currentConversationId = null;
        
        // Reload conversations
        await loadConversations();
        
        // Clear chat messages
        const chatMessages = document.getElementById('chat-messages');
        if (chatMessages) {
            chatMessages.innerHTML = '<div class="empty-state">No messages yet. Start the conversation!</div>';
        }
    } catch (error) {
        console.error('Error clearing conversations:', error);
        showNotification('Failed to clear conversations. Please try again.', 'error');
    }
}

// Function to clear all documents
async function clearAllDocuments() {
    if (!confirm('Are you sure you want to delete ALL documents? This cannot be undone.')) {
        return;
    }
    
    try {
        const response = await fetch('/api/documents/clear/', {
            method: 'POST',
            headers: {
                'X-CSRFToken': getCSRFToken()
            }
        });
        
        if (!response.ok) {
            throw new Error('Failed to clear documents');
        }
        
        // Show success notification
        showNotification('All documents cleared successfully', 'success');
        
        // Reload documents
        await loadDocuments();
    } catch (error) {
        console.error('Error clearing documents:', error);
        showNotification('Failed to clear documents. Please try again.', 'error');
    }
}

// Function to load knowledge base entries
async function loadKnowledgeBase() {
    try {
        const response = await fetch('/api/knowledge-base/');
        if (!response.ok) {
            throw new Error('Failed to load knowledge base entries');
        }

        const entries = await response.json();
        renderKnowledgeBaseList(entries);
    } catch (error) {
        console.error('Error loading knowledge base:', error);
        const kbContainer = document.getElementById('knowledge-base-list');
        if (kbContainer) {
            kbContainer.innerHTML = '<div class="error">Failed to load knowledge base</div>';
        }
    }
}

// Function to render knowledge base list
function renderKnowledgeBaseList(entries) {
    const kbContainer = document.getElementById('knowledge-base-list');
    if (!kbContainer) return;

    if (!entries || entries.length === 0) {
        kbContainer.innerHTML = '<div class="empty-state">No knowledge base entries</div>';
        return;
    }

    let html = '';
    entries.forEach(entry => {
        html += `
            <div class="kb-item" data-id="${entry.id}">
                <div class="kb-icon"><i class="fas fa-book"></i></div>
                <div class="kb-details">
                    <div class="kb-title">${entry.title}</div>
                    <div class="kb-category">${entry.category || 'General'}</div>
                </div>
                <div class="kb-actions">
                    <button class="kb-view-btn" data-id="${entry.id}" aria-label="View Entry">
                        <i class="fas fa-eye"></i>
                    </button>
                    <button class="kb-edit-btn" data-id="${entry.id}" aria-label="Edit Entry">
                        <i class="fas fa-edit"></i>
                    </button>
                    <button class="kb-delete-btn" data-id="${entry.id}" aria-label="Delete Entry">
                        <i class="fas fa-trash"></i>
                    </button>
                </div>
            </div>
        `;
    });

    kbContainer.innerHTML = html;

    // Add event listeners
    kbContainer.querySelectorAll('.kb-view-btn').forEach(btn => {
        btn.addEventListener('click', function() {
            const entryId = this.dataset.id;
            viewKnowledgeBaseEntry(entryId);
        });
    });

    kbContainer.querySelectorAll('.kb-edit-btn').forEach(btn => {
        btn.addEventListener('click', function() {
            const entryId = this.dataset.id;
            editKnowledgeBaseEntry(entryId);
        });
    });

    kbContainer.querySelectorAll('.kb-delete-btn').forEach(btn => {
        btn.addEventListener('click', function() {
            const entryId = this.dataset.id;
            if (confirm('Are you sure you want to delete this knowledge base entry?')) {
                deleteKnowledgeBaseEntry(entryId);
            }
        });
    });
}

// Function to create a new knowledge base entry
async function createKnowledgeBaseEntry() {
    const kbModal = document.getElementById('knowledge-base-modal');
    if (!kbModal) return;
    
    // Reset form
    const kbForm = document.getElementById('knowledge-base-form');
    if (kbForm) {
        kbForm.reset();
        
        // Set attributes for create mode
        kbForm.dataset.mode = 'create';
        kbForm.dataset.entryId = '';
        
        // Update modal title
        const modalTitle = kbModal.querySelector('.modal-title');
        if (modalTitle) {
            modalTitle.textContent = 'Create Knowledge Base Entry';
        }
    }
    
    // Show the modal
    kbModal.style.display = 'block';
}

// Function to edit a knowledge base entry
async function editKnowledgeBaseEntry(id) {
    try {
        const response = await fetch(`/api/knowledge-base/${id}/`);
        if (!response.ok) {
            throw new Error('Failed to fetch knowledge base entry');
        }
        
        const entry = await response.json();
        
        const kbModal = document.getElementById('knowledge-base-modal');
        if (!kbModal) return;
        
        // Fill form fields
        const titleField = document.getElementById('kb-title');
        const categoryField = document.getElementById('kb-category');
        const contentField = document.getElementById('kb-content');
        const tagsField = document.getElementById('kb-tags');
        
        if (titleField) titleField.value = entry.title;
        if (categoryField) categoryField.value = entry.category || '';
        if (contentField) contentField.value = entry.content;
        if (tagsField) tagsField.value = Array.isArray(entry.tags) ? entry.tags.join(', ') : '';
        
        // Set form mode to edit
        const kbForm = document.getElementById('knowledge-base-form');
        if (kbForm) {
            kbForm.dataset.mode = 'edit';
            kbForm.dataset.entryId = id;
            
            // Update modal title
            const modalTitle = kbModal.querySelector('.modal-title');
            if (modalTitle) {
                modalTitle.textContent = 'Edit Knowledge Base Entry';
            }
        }
        
        // Show the modal
        kbModal.style.display = 'block';
    } catch (error) {
        console.error('Error fetching knowledge base entry:', error);
        showNotification('Failed to load knowledge base entry', 'error');
    }
}

// Function to view a knowledge base entry
async function viewKnowledgeBaseEntry(id) {
    try {
        const response = await fetch(`/api/knowledge-base/${id}/`);
        if (!response.ok) {
            throw new Error('Failed to fetch knowledge base entry');
        }
        
        const entry = await response.json();
        
        const kbViewModal = document.getElementById('knowledge-base-view-modal');
        if (!kbViewModal) return;
        
        // Fill content
        const titleElement = kbViewModal.querySelector('.kb-view-title');
        const categoryElement = kbViewModal.querySelector('.kb-view-category');
        const contentElement = kbViewModal.querySelector('.kb-view-content');
        const tagsElement = kbViewModal.querySelector('.kb-view-tags');
        
        if (titleElement) titleElement.textContent = entry.title;
        if (categoryElement) categoryElement.textContent = entry.category || 'General';
        if (contentElement) contentElement.textContent = entry.content;
        
        if (tagsElement) {
            if (Array.isArray(entry.tags) && entry.tags.length > 0) {
                tagsElement.innerHTML = entry.tags.map(tag => 
                    `<span class="kb-tag">${tag}</span>`
                ).join('');
            } else {
                tagsElement.innerHTML = '<em>No tags</em>';
            }
        }
        
        // Show the modal
        kbViewModal.style.display = 'block';
    } catch (error) {
        console.error('Error fetching knowledge base entry:', error);
        showNotification('Failed to load knowledge base entry', 'error');
    }
}

// Function to save a knowledge base entry
async function saveKnowledgeBaseEntry(form) {
    const mode = form.dataset.mode;
    const entryId = form.dataset.entryId;
    
    const titleField = document.getElementById('kb-title');
    const categoryField = document.getElementById('kb-category');
    const contentField = document.getElementById('kb-content');
    const tagsField = document.getElementById('kb-tags');
    
    if (!titleField || !contentField) {
        showNotification('Missing required fields', 'error');
        return;
    }
    
    const title = titleField.value.trim();
    const content = contentField.value.trim();
    
    if (!title || !content) {
        showNotification('Title and content are required', 'error');
        return;
    }
    
    const category = categoryField?.value.trim() || '';
    const tagsInput = tagsField?.value.trim() || '';
    
    // Process tags - split by commas and trim whitespace
    const tags = tagsInput ? tagsInput.split(',').map(tag => tag.trim()).filter(tag => tag) : [];
    
    // Prepare request data
    const entryData = {
        title: title,
        content: content,
        category: category,
        tags: tags
    };
    
    try {
        let response;
        
        if (mode === 'edit') {
            // Update existing entry
            response = await fetch(`/api/knowledge-base/${entryId}/`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'X-CSRFToken': getCSRFToken()
                },
                body: JSON.stringify(entryData)
            });
        } else {
            // Create new entry
            response = await fetch('/api/knowledge-base/', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-CSRFToken': getCSRFToken()
                },
                body: JSON.stringify(entryData)
            });
        }
        
        if (!response.ok) {
            throw new Error(`Failed to ${mode} knowledge base entry`);
        }
        
        // Close modal
        const kbModal = document.getElementById('knowledge-base-modal');
        if (kbModal) {
            kbModal.style.display = 'none';
        }
        
        // Show success notification
        showNotification(`Knowledge base entry ${mode === 'edit' ? 'updated' : 'created'} successfully`, 'success');
        
        // Reload knowledge base
        await loadKnowledgeBase();
    } catch (error) {
        console.error(`Error ${mode}ing knowledge base entry:`, error);
        showNotification(`Failed to ${mode} knowledge base entry`, 'error');
    }
}

// Function to delete a knowledge base entry
async function deleteKnowledgeBaseEntry(id) {
    try {
        const response = await fetch(`/api/knowledge-base/${id}/`, {
            method: 'DELETE',
            headers: {
                'X-CSRFToken': getCSRFToken()
            }
        });
        
        if (!response.ok) {
            throw new Error('Failed to delete knowledge base entry');
        }
        
        // Show success notification
        showNotification('Knowledge base entry deleted successfully', 'success');
        
        // Reload knowledge base
        await loadKnowledgeBase();
    } catch (error) {
        console.error('Error deleting knowledge base entry:', error);
        showNotification('Failed to delete knowledge base entry', 'error');
    }
}

// Function to toggle the knowledge base sidebar
function toggleKnowledgeBase() {
    const knowledgeBaseSection = document.getElementById('knowledge-base-section');
    if (knowledgeBaseSection) {
        const isOpen = knowledgeBaseSection.classList.contains('open');
        if (isOpen) {
            knowledgeBaseSection.classList.remove('open');
        } else {
            knowledgeBaseSection.classList.add('open');
            // Load knowledge base when opening
            loadKnowledgeBase();
        }
    }
}

// Initialize the app when the DOM is loaded
document.addEventListener('DOMContentLoaded', function() {
    // Initialize modals
    setupModals();
    
    // Load data
    loadConversations();
    loadDocuments();
    loadIncidents();
    loadAutomations();
    loadDashboards();
    loadLogs();
    
    // Set up event listeners for global actions
    
    // Chat form submission
    const chatForm = document.getElementById('chat-form');
    if (chatForm) {
        chatForm.addEventListener('submit', handleChatSubmit);
    }
    
    // Create new chat button
    const newChatBtn = document.getElementById('new-chat-btn');
    if (newChatBtn) {
        newChatBtn.addEventListener('click', createNewChat);
    }
    
    // Rename chat button
    const renameChatBtn = document.getElementById('rename-chat-btn');
    if (renameChatBtn) {
        renameChatBtn.addEventListener('click', renameCurrentChat);
    }
    
    // Delete chat button
    const deleteChatBtn = document.getElementById('delete-chat-btn');
    if (deleteChatBtn) {
        deleteChatBtn.addEventListener('click', deleteCurrentChat);
    }
    
    // Clear all conversations button
    const clearConversationsBtn = document.getElementById('clear-conversations-btn');
    if (clearConversationsBtn) {
        clearConversationsBtn.addEventListener('click', clearAllConversations);
    }
    
    // Upload document button
    const uploadDocumentBtn = document.getElementById('upload-document-btn');
    if (uploadDocumentBtn) {
        uploadDocumentBtn.addEventListener('click', function() {
            const modal = document.getElementById('upload-document-modal');
            if (modal) {
                modal.style.display = 'block';
            }
        });
    }
    
    // Clear all documents button
    const clearDocumentsBtn = document.getElementById('clear-documents-btn');
    if (clearDocumentsBtn) {
        clearDocumentsBtn.addEventListener('click', clearAllDocuments);
    }
    
    // Knowledge base create button
    const createKbBtn = document.getElementById('create-kb-btn');
    if (createKbBtn) {
        createKbBtn.addEventListener('click', createKnowledgeBaseEntry);
    }
    
    // Knowledge base form submission
    const kbForm = document.getElementById('knowledge-base-form');
    if (kbForm) {
        kbForm.addEventListener('submit', function(event) {
            event.preventDefault();
            saveKnowledgeBaseEntry(this);
        });
    }
    
    // Knowledge base toggle button
    const toggleKbBtn = document.getElementById('toggle-kb-btn');
    if (toggleKbBtn) {
        toggleKbBtn.addEventListener('click', toggleKnowledgeBase);
    }
    
    // Automatic refreshing of data
    // Refresh logs, incidents and automations every 30 seconds
    setInterval(() => {
        loadLogs();
        loadIncidents();
        loadAutomations();
        loadDashboards();
    }, 30000);
});