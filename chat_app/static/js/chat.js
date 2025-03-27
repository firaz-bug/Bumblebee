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
        formattedContent=marked.parse(formattedContent);
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

        // Display error message
        const errorHtml = `
            <div class="message system">
                <div class="message-content">Error: Failed to send message. Please try again.</div>
            </div>
        `;
        chatMessages.insertAdjacentHTML('beforeend', errorHtml);
        chatMessages.scrollTop = chatMessages.scrollHeight;
    }
}

// Function to load documents
async function loadDocuments() {
    const documentsList = document.getElementById('documents-list');
    if (!documentsList) return;

    try {
        const response = await fetch('/api/documents/');
        if (!response.ok) {
            throw new Error('Network response was not ok');
        }

        const documents = await response.json();
        renderDocumentsList(documents);
    } catch (error) {
        console.error('Error loading documents:', error);
        documentsList.innerHTML = '<div class="loading-error">Failed to load documents. Please try again.</div>';
    }
}

// Function to render documents list
function renderDocumentsList(documents) {
    const documentsList = document.getElementById('documents-list');
    if (!documentsList) return;

    if (documents.length === 0) {
        documentsList.innerHTML = '<div class="empty-state">No documents uploaded yet</div>';
        return;
    }

    let html = '';
    documents.forEach(doc => {
        const fileTypeIcon = getFileTypeIcon(doc.file_type);
        html += `
            <div class="document-item" data-id="${doc.id}">
                <div class="document-info">
                    <i data-feather="${fileTypeIcon}" class="document-icon"></i>
                    <div class="document-title">${doc.title}</div>
                    <div class="document-type">${doc.file_type.toUpperCase()}</div>
                </div>
                <div class="document-actions">
                    <button class="delete-document-btn" data-id="${doc.id}" title="Delete document">
                        <i data-feather="trash-2"></i>
                    </button>
                </div>
            </div>
        `;
    });

    documentsList.innerHTML = html;

    // Initialize feather icons
    feather.replace();

    // Add event listeners to delete buttons
    document.querySelectorAll('.delete-document-btn').forEach(btn => {
        btn.addEventListener('click', function(e) {
            e.stopPropagation(); // Prevent triggering parent click events
            const documentId = this.dataset.id;
            deleteDocument(documentId);
        });
    });
}

// Helper function to get the appropriate icon for file type
function getFileTypeIcon(fileType) {
    const type = fileType.toLowerCase();
    if (type.includes('pdf')) {
        return 'file-text';
    } else if (type.includes('doc') || type.includes('word')) {
        return 'file-text';
    } else if (type.includes('txt') || type.includes('text')) {
        return 'file';
    } else if (type.includes('xls') || type.includes('sheet') || type.includes('csv')) {
        return 'grid';
    } else if (type.includes('ppt') || type.includes('presentation')) {
        return 'monitor';
    } else if (type.includes('jpg') || type.includes('jpeg') || type.includes('png') || type.includes('gif')) {
        return 'image';
    } else {
        return 'file';
    }
}

// Function to delete a document
async function deleteDocument(documentId) {
    if (!confirm('Are you sure you want to delete this document?')) {
        return;
    }

    try {
        // Using the correct endpoint pattern
        const response = await fetch(`/api/documents/${documentId}/`, {
            method: 'DELETE',
            headers: {
                'X-CSRFToken': getCSRFToken()
            }
        });

        if (!response.ok) {
            throw new Error(`Failed to delete document: ${response.status} ${response.statusText}`);
        }

        // Show success notification
        showNotification('Document deleted successfully', 'success');

        // Reload documents
        loadDocuments();
    } catch (error) {
        console.error('Error deleting document:', error);
        showNotification('Failed to delete document. Please try again.', 'error');
    }
}

// Function to render the incidents list
function renderIncidentsList(incidents) {
    const incidentsList = document.getElementById('incidents-list');
    if (!incidentsList) return;

    if (incidents.length === 0) {
        incidentsList.innerHTML = '<div class="empty-state">No incidents available</div>';
        return;
    }

    let html = '';
    // const priorityOrder = { 1:"Critical", 2:"High", 3:"Medium", 4:"Low", 5:"Very Low" };

    // // Sort incidents by priority
    // incidents.sort((a, b) => {
    //     const priorityA = priorityOrder[a.priority] || Number.MAX_SAFE_INTEGER;
    //     const priorityB = priorityOrder[b.priority] || Number.MAX_SAFE_INTEGER;

    // });

    incidents.forEach(incident => {
        if (typeof incident.priority === 'number') {
            const priorityMap = {
                1: 'Critical',
                2: 'High',
                3: 'Medium',
                4: 'Low',
                5: 'Very Low'
            };
            incident.priority = priorityMap[incident.priority] || 'Unknown';
        }
    });
    const priorityOrder = { 'Critical': 1, 'High': 2, 'Medium': 3, 'Low': 4, 'Very Low': 5 };
    incidents.sort((a, b) => {
        const priorityA = priorityOrder[a.priority] || Number.MAX_SAFE_INTEGER;
        const priorityB = priorityOrder[b.priority] || Number.MAX_SAFE_INTEGER;
        return priorityA - priorityB;
    });
    incidents.forEach(incident => {
        html += `
            <div class="incident-item" data-id="${incident.id}">
                <div class="incident-severity ${incident.priority}">${incident.priority}</div>
                <div class="incident-title">${incident.incident_number}: ${incident.short_description}</div>
            </div>
        `;
    });

    incidentsList.innerHTML = html;

    // Add click event listeners
    document.querySelectorAll('.incident-item').forEach(item => {
        item.addEventListener('click', function() {
            highlightIncident(this);
            const incidentId = this.dataset.id;
            fetchIncidentDetails(incidentId);
        });
    });
}

// Function to show incident details
function showIncidentDetails(incident) {
    const detailsContainer = document.getElementById('incident-details');
    if (!detailsContainer) return;

    currentIncidentId = incident.id;

    // Format created and updated dates
    const createdDate = new Date(incident.created_at).toLocaleString();
    const updatedDate = new Date(incident.updated_at).toLocaleString();

    // Get state display based on the state value
    const stateMap = {
        1: 'New',
        2: 'In Progress',
        3: 'On Hold',
        4: 'Resolved',
        5: 'Closed/Canceled'
    };
    const stateDisplay = incident.state_display || stateMap[incident.state] || 'Unknown';

    // Build the HTML for the details section
    let html = `
        <h3>${incident.incident_number}: ${incident.short_description}</h3>
        <div class="incident-detail-row">
            <span class="detail-label">Priority:</span>
            <span class="detail-value ${incident.priority}">${incident.priority}</span>
        </div>
        <div class="incident-detail-row">
            <span class="detail-label">State:</span>
            <span class="detail-value">${stateDisplay}</span>
        </div>
        <div class="incident-detail-row">
            <span class="detail-label">Created:</span>
            <span class="detail-value">${createdDate}</span>
        </div>
        <div class="incident-detail-row">
            <span class="detail-label">Updated:</span>
            <span class="detail-value">${updatedDate}</span>
        </div>
        <div class="incident-description">
            <span class="detail-label">Description:</span>
            <p>${incident.long_description}</p>
        </div>
    `;

    // Add comments section if there are comments
    if (incident.comments) {
        html += `
            <div class="incident-comments">
                <span class="detail-label">Comments:</span>
                <p>${incident.comments}</p>
            </div>
        `;
    }

    // Show state update control
    html += `
        <div class="incident-actions">
            <button id="update-state-btn" class="btn">Update State</button>
            <button id="add-comments-btn" class="btn">Add Comments</button>
        </div>
    `;

    detailsContainer.innerHTML = html;

    // Add event listener for the Add Comments button
    const addCommentsBtn = document.getElementById('add-comments-btn');
    if (addCommentsBtn) {
        addCommentsBtn.addEventListener('click', function() {
            showStatusUpdateModal(incident.id, 'add-comments');
        });
    }

    // Add event listener for the Update State button
    const updateStateBtn = document.getElementById('update-state-btn');
    if (updateStateBtn) {
        updateStateBtn.addEventListener('click', function() {
            // Show the status update controls
            const statusControls = document.getElementById('incident-status-controls');
            if (statusControls) {
                statusControls.style.display = 'flex';
                
                // Set the current state in the dropdown
                const stateSelect = document.getElementById('status-select');
                if (stateSelect) {
                    stateSelect.value = incident.state;
                }
                
                // Add click event to the update button
                const updateBtn = document.getElementById('update-status-btn');
                if (updateBtn) {
                    updateBtn.onclick = function() {
                        const newState = stateSelect.value;
                        showStatusUpdateModal(incident.id, newState);
                    };
                }
            }
        });
    }

    // Fetch recommendations based on the incident
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
    // Fetch automations
    fetch(`/api/incidents/${incidentId}/`)
        .then(response => response.json())
        .then(incident => {
            // Get recommended automations
            const relevantAutomations = incident.recommended_automations || [];
            updateRecommendedAutomations(relevantAutomations);

            // Get recommended dashboards
            const relevantDashboards = incident.recommended_dashboards || [];
            updateRecommendedDashboards(relevantDashboards);
        })
        .catch(error => {
            console.error('Error fetching recommendations:', error);
        });
}

// Function to highlight the selected incident
function highlightIncident(element) {
    // Remove highlight from other incidents
    document.querySelectorAll('.incident-item').forEach(item => {
        item.style.backgroundColor = 'white';
    });
    // Highlight clicked incident
    element.style.backgroundColor = '#f0f0f0';
}

// Function to show the status update modal
function showStatusUpdateModal(incidentId, newStatus) {
    const modal = document.getElementById('status-update-modal');
    if (modal) {
        modal.style.display = 'block';
        modal.dataset.incidentId = incidentId;
        modal.dataset.newStatus = newStatus;

        // Update modal title based on status
        const modalTitle = modal.querySelector('h2');
        if (modalTitle) {
            const stateMap = {
                1: 'New', 
                2: 'In Progress',
                3: 'On Hold',
                4: 'Resolved',
                5: 'Closed/Canceled',
                'add-comments': 'Add Comments'
            };
            
            const statusName = stateMap[newStatus] || 'Update State';
            modalTitle.textContent = newStatus === 'add-comments' 
                ? `Add Comments to Incident` 
                : `Update Status to ${statusName}`;
        }
    }
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
            // Update the priority class and text if it changed
            const oldPriorityClass = priorityElement.className.split(' ')[1];
            if (oldPriorityClass !== updatedIncident.priority) {
                priorityElement.classList.remove(oldPriorityClass);
                priorityElement.classList.add(updatedIncident.priority);
                priorityElement.textContent = updatedIncident.priority;
            }
        }
    }
}

// Function to update the incidents summary
function updateIncidentsSummary(incidents) {
    const summaryContainer = document.getElementById('incident-summary');
    if (!summaryContainer) return;

    // Count incidents by priority
    let highPriorityIncidents = incidents.filter(inc => inc.priority && (inc.priority === "Critical" || inc.priority === "High")).length;
    let mediumPriorityIncidents = incidents.filter(inc => inc.priority && inc.priority === "Medium").length;
    let lowPriorityIncidents = incidents.filter(inc => inc.priority && (inc.priority === "Low" || inc.priority === "Very Low")).length;
    let totalIncidents = incidents.length;

    // Create the HTML for the incident summary section
    let summaryHTML = `
        <h3>Incidents Overview</h3>
        <div class="summary-content">
            <div class="summary-stats">
                <div class="severity-item High">
                    <span>High Priority &nbsp</span>
                    <span>(${highPriorityIncidents})</span>
                </div>
                <div class="severity-item Medium">
                    <span>Medium Priority &nbsp</span>
                    <span>(${mediumPriorityIncidents})</span>
                </div>
                <div class="severity-item Low">
                    <span>Low Priority &nbsp</span>
                    <span>(${lowPriorityIncidents})</span>
                </div>
                <div class="severity-item total">
                    <span>Total &nbsp</span>
                    <span>(${totalIncidents})</span>
                </div>
            </div>
        </div>
    `;

    // Update the summary container with our HTML
    summaryContainer.innerHTML = summaryHTML;
}

// Function to load incidents
function loadIncidents() {
    const incidentsList = document.getElementById('incidents-list');
    if (!incidentsList) {
        console.warn('Incidents list element not found in the DOM');
        return;
    }

    // Show loading indicator
    incidentsList.innerHTML = '<div class="loading-incidents">Loading incidents...</div>';

    fetch('/api/incidents')
        .then(response => {
            if (!response.ok) {
                throw new Error(`Network response was not ok: ${response.status} ${response.statusText}`);
            }
            return response.json();
        })
        .then(incidents => {
            if (Array.isArray(incidents)) {
                renderIncidentsList(incidents);

                // Only update summary if the container exists
                const summaryContainer = document.getElementById('incident-summary');
                if (summaryContainer) {
                    updateIncidentsSummary(incidents);
                }
            } else {
                throw new Error('Invalid incidents data format');
            }
        })
        .catch(error => {
            console.error('Error loading incidents:', error);
            incidentsList.innerHTML = '<div class="loading-incidents error">Failed to load incidents. Please refresh the page or try again later.</div>';

            // Only update summary if the container exists
            const summaryContainer = document.getElementById('incident-summary');
            if (summaryContainer) {
                updateIncidentsSummary([]);
            }
        });
}

// Function to load automations
function loadAutomations() {
    const automationsList = document.getElementById('automations-list');
    if (!automationsList) return;

    fetch('/api/automations/')
        .then(response => {
            if (!response.ok) {
                throw new Error('Network response was not ok');
            }
            return response.json();
        })
        .then(automations => {
            renderAutomationsList(automations);
        })
        .catch(error => {
            console.error('Error loading automations:', error);
            automationsList.innerHTML = '<div class="loading-error">Failed to load automations. Please try again.</div>';
        });
}

// Function to update recommended automations based on incident selection
function updateRecommendedAutomations(automations) {
    const automationsList = document.getElementById('automations-list');
    if (!automationsList) return;

    // If no recommended automations, show message
    if (!automations || automations.length === 0) {
        automationsList.innerHTML = '<div class="empty-state">No relevant automations found for this incident</div>';
        return;
    }

    let html = '';
    automations.forEach(automation => {
        html += `
            <div class="automation-item recommended" data-id="${automation.id}">
                <div class="automation-name">${automation.name}</div>
                <div class="automation-description">${automation.description}</div>
                <button class="run-btn" data-id="${automation.id}">Run</button>
            </div>
        `;
    });

    automationsList.innerHTML = html;

    // Add event listeners to run buttons
    document.querySelectorAll('.automation-item .run-btn').forEach(btn => {
        btn.addEventListener('click', function() {
            const automationId = this.dataset.id;
            triggerAutomation(automationId);
        });
    });
}

// Function to render the automations list
function renderAutomationsList(automations) {
    const automationsList = document.getElementById('automations-list');
    if (!automationsList) return;

    if (automations.length === 0) {
        automationsList.innerHTML = '<div class="empty-state">No automations available</div>';
        return;
    }

    let html = '';
    automations.forEach(automation => {
        html += `
            <div class="automation-item" data-id="${automation.id}">
                <div class="automation-name">${automation.name}</div>
                <div class="automation-description">${automation.description}</div>
                <button class="run-btn" data-id="${automation.id}">Run</button>
            </div>
        `;
    });

    automationsList.innerHTML = html;

    // Add event listeners to run buttons
    document.querySelectorAll('.automation-item .run-btn').forEach(btn => {
        btn.addEventListener('click', function() {
            const automationId = this.dataset.id;
            triggerAutomation(automationId);
        });
    });
}

// Function to trigger an automation
function triggerAutomation(automationId) {
    // Show loading indicator
    const btn = document.querySelector(`.run-btn[data-id="${automationId}"]`);
    const originalText = btn ? btn.innerText : 'Run';
    if (btn) {
        btn.innerText = 'Running...';
        btn.disabled = true;
    }

    fetch(`/api/automations/${automationId}/trigger/`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'X-CSRFToken': getCSRFToken()
        },
        body: JSON.stringify({})
    })
    .then(response => {
        if (!response.ok) {
            throw new Error('Failed to trigger automation');
        }
        return response.json();
    })
    .then(data => {
        // Reset button state
        if (btn) {
            btn.innerText = originalText;
            btn.disabled = false;
        }

        // Show logs in the modal
        showAutomationLogs(data);
        
        // Create a log entry
        createLogEntry('info', `Automation '${data.name || 'Unknown'}' executed successfully`, data.result || data.message || 'Completed');
    })
    .catch(error => {
        console.error('Error triggering automation:', error);
        
        // Reset button state
        if (btn) {
            btn.innerText = originalText;
            btn.disabled = false;
        }
        
        // Show error in logs
        createLogEntry('error', 'Automation execution failed', error.message);
        
        // Show error alert
        alert('Failed to trigger automation. Please try again.');
    });
}

// Function to show automation logs in modal
function showAutomationLogs(data) {
    const modal = document.getElementById('automation-logs-modal');
    const overlay = document.getElementById('automation-logs-overlay');
    
    if (!modal) return;
    
    // Format logs based on the structured response format
    const automationInfo = data.automation || {};
    const automationName = automationInfo.name || 'Unknown Automation';
    const automationDesc = automationInfo.description || '';
    
    // Extract result information
    const resultStatus = data.status || 'unknown';
    const resultMessage = data.message || 'No detailed information available';
    
    // Determine status class for styling
    const statusClass = resultStatus === 'success' ? 'success' : 'error';
    
    // Get current timestamp
    const timestamp = new Date().toLocaleString();
    
    // Update automation header information
    document.getElementById('automation-name').textContent = automationName;
    document.getElementById('automation-timestamp').textContent = `Executed: ${timestamp}`;
    document.getElementById('automation-description').textContent = automationDesc;
    
    // Clear previous logs
    const logsContainer = document.getElementById('execution-logs-container');
    if (logsContainer) {
        logsContainer.innerHTML = '';
        
        // Process logs from the response
        const logs = data.logs || [];
        
        if (logs.length > 0) {
            logs.forEach(log => {
                const logTime = log.timestamp ? new Date(log.timestamp).toLocaleTimeString() : new Date().toLocaleTimeString();
                const logLevel = log.level || 'info';
                const logMessage = log.message || '';
                
                const logItem = document.createElement('div');
                logItem.className = `log-item log-${logLevel}`;
                logItem.innerHTML = `
                    <span class="log-time">${logTime}</span>
                    <span class="log-level">${logLevel}</span>
                    <span class="log-message">${logMessage}</span>
                `;
                logsContainer.appendChild(logItem);
            });
        } else {
            // Add a default log message if no logs provided
            const defaultLog = document.createElement('div');
            defaultLog.className = 'log-item log-info';
            defaultLog.innerHTML = `
                <span class="log-time">${new Date().toLocaleTimeString()}</span>
                <span class="log-level">info</span>
                <span class="log-message">Automation execution triggered</span>
            `;
            logsContainer.appendChild(defaultLog);
        }
    }
    
    // Update status display
    const responseStatus = document.getElementById('response-status');
    if (responseStatus) {
        responseStatus.className = `status-${statusClass}`;
        responseStatus.textContent = `(${resultStatus.toUpperCase()})`;
    }
    
    // Update response data
    const responseData = document.getElementById('api-response-data');
    if (responseData) {
        if (data.raw_response) {
            let rawResponseData = '';
            try {
                // Try to prettify JSON if it's an object
                if (typeof data.raw_response === 'object') {
                    rawResponseData = JSON.stringify(data.raw_response, null, 2);
                } else {
                    rawResponseData = String(data.raw_response);
                }
            } catch (e) {
                rawResponseData = String(data.raw_response);
            }
            responseData.textContent = rawResponseData;
        } else {
            responseData.textContent = resultMessage || 'No response data available';
        }
    }
    
    // Show the modal
    modal.style.display = 'block';
    if (overlay) overlay.style.display = 'block';
    
    // Add event listeners to close buttons
    const closeButtons = modal.querySelectorAll('.modal-close, .modal-close-btn');
    closeButtons.forEach(btn => {
        btn.onclick = function() {
            modal.style.display = 'none';
            if (overlay) overlay.style.display = 'none';
        };
    });
}

// Function to show datasource logs in a modal
function showDatasourceLogs(data) {
    // Reuse the automation logs modal with different content
    const modal = document.getElementById('automation-logs-modal');
    const overlay = document.getElementById('automation-logs-overlay');
    
    if (!modal) return;
    
    // Format logs based on the structured response format
    const datasourceInfo = data.datasource || {};
    const datasourceName = datasourceInfo.name || 'Unknown Data Source';
    const datasourceEndpoint = datasourceInfo.endpoint || '';
    
    // Extract result information
    const resultStatus = data.status || 'unknown';
    const resultMessage = data.message || 'No detailed information available';
    
    // Determine status class for styling
    const statusClass = resultStatus === 'success' ? 'success' : 'error';
    
    // Get current timestamp
    const timestamp = new Date().toLocaleString();
    
    // Update automation header information - reusing the automation modal elements
    document.getElementById('automation-name').textContent = datasourceName;
    document.getElementById('automation-timestamp').textContent = `Queried: ${timestamp}`;
    document.getElementById('automation-description').textContent = `Endpoint: ${datasourceEndpoint}`;
    
    // Update modal title
    const modalTitle = document.querySelector('#automation-logs-modal .modal-title');
    if (modalTitle) modalTitle.textContent = 'Data Source Query Logs';
    
    // Clear previous logs
    const logsContainer = document.getElementById('execution-logs-container');
    if (logsContainer) {
        logsContainer.innerHTML = '';
        
        // Process logs from the response
        const logs = data.logs || [];
        
        if (logs.length > 0) {
            logs.forEach(log => {
                const logTime = log.timestamp ? new Date(log.timestamp).toLocaleTimeString() : new Date().toLocaleTimeString();
                const logLevel = log.level || 'info';
                const logMessage = log.message || '';
                
                const logItem = document.createElement('div');
                logItem.className = `log-item log-${logLevel}`;
                logItem.innerHTML = `
                    <span class="log-time">${logTime}</span>
                    <span class="log-level">${logLevel}</span>
                    <span class="log-message">${logMessage}</span>
                `;
                logsContainer.appendChild(logItem);
            });
        } else {
            // Add a default log message if no logs provided
            const defaultLog = document.createElement('div');
            defaultLog.className = 'log-item log-info';
            defaultLog.innerHTML = `
                <span class="log-time">${new Date().toLocaleTimeString()}</span>
                <span class="log-level">info</span>
                <span class="log-message">Data source query executed</span>
            `;
            logsContainer.appendChild(defaultLog);
        }
    }
    
    // Update status display
    const responseStatus = document.getElementById('response-status');
    if (responseStatus) {
        responseStatus.className = `status-${statusClass}`;
        responseStatus.textContent = `(${resultStatus.toUpperCase()})`;
    }
    
    // Update response data
    const responseData = document.getElementById('api-response-data');
    if (responseData) {
        if (data.raw_response) {
            let rawResponseData = '';
            try {
                // Try to prettify JSON if it's an object
                if (typeof data.raw_response === 'object') {
                    rawResponseData = JSON.stringify(data.raw_response, null, 2);
                } else {
                    rawResponseData = String(data.raw_response);
                }
            } catch (e) {
                rawResponseData = String(data.raw_response);
            }
            responseData.textContent = rawResponseData;
        } else {
            responseData.textContent = resultMessage || 'No response data available';
        }
    }
    
    // Show the modal
    modal.style.display = 'block';
    if (overlay) overlay.style.display = 'block';
    
    // Add event listeners to close buttons
    const closeButtons = modal.querySelectorAll('.modal-close, .modal-close-btn');
    closeButtons.forEach(btn => {
        btn.onclick = function() {
            modal.style.display = 'none';
            if (overlay) overlay.style.display = 'none';
            
            // Reset title back to "Automation Logs" for future automation uses
            if (modalTitle) modalTitle.textContent = 'Automation Logs';
        };
    });
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
        // Refresh logs
        loadLogs();
    })
    .catch(error => {
        console.error('Error creating log entry:', error);
    });
}

// Function to load dashboards
function loadDashboards() {
    const dashboardsList = document.getElementById('dashboards-list');
    if (!dashboardsList) return;

    fetch('/api/dashboards/')
        .then(response => {
            if (!response.ok) {
                throw new Error('Network response was not ok');
            }
            return response.json();
        })
        .then(dashboards => {
            renderDashboardsList(dashboards);
        })
        .catch(error => {
            console.error('Error loading dashboards:', error);
            dashboardsList.innerHTML = '<div class="loading-error">Failed to load dashboards. Please try again.</div>';
        });
}

// Function to update recommended dashboards based on incident selection
function updateRecommendedDashboards(dashboards) {
    const dashboardsList = document.getElementById('dashboards-list');
    if (!dashboardsList) return;

    // If no recommended dashboards, show message
    if (!dashboards || dashboards.length === 0) {
        dashboardsList.innerHTML = '<div class="empty-state">No relevant dashboards found for this incident</div>';
        return;
    }

    let html = '';dashboards.forEach(dashboard => {
        html += `
            <div class="dashboard-item recommended">
                <div class="dashboard-name">${dashboard.name}</div>
            
                <a href="${dashboard.link}" target="_blank" class="dashboard-link">Open Dashboard <i data-feather="external-link"></i></a>
            </div>
        `;
    });

    dashboardsList.innerHTML = html;

    // Initialize feather icons
    feather.replace();
}

// Function to render the dashboards list
function renderDashboardsList(dashboards) {
    const dashboardsList = document.getElementById('dashboards-list');
    if (!dashboardsList) return;

    if (dashboards.length === 0) {
        dashboardsList.innerHTML = '<div class="empty-state">No dashboards available</div>';
        return;
    }

    let html = '';
    dashboards.forEach(dashboard => {
        html += `
            <div class="dashboard-item">
                <div class="dashboard-name">${dashboard.name}</div>
                <a href="${dashboard.link}" target="_blank" class="dashboard-link">Open Dashboard <i data-feather="external-link"></i></a>
            </div>
        `;
    });

    dashboardsList.innerHTML = html;

    // Initialize feather icons
    feather.replace();
}

// Function to load logs for the recommendations column
function loadLogs() {
    const logsList = document.getElementById('logs-list');
    if (!logsList) return;

    fetch('/api/logs/')
        .then(response => {
            if (!response.ok) {
                throw new Error('Network response was not ok');
            }
            return response.json();
        })
        .then(logs => {
            renderLogsList(logs);
        })
        .catch(error => {
            console.error('Error loading logs:', error);
            logsList.innerHTML = '<div class="loading-error">Failed to load logs. Please try again.</div>';
        });
}

// Function to render the logs list
function renderLogsList(logs) {
    const logsList = document.getElementById('logs-list');
    if (!logsList) return;

    if (logs.length === 0) {
        logsList.innerHTML = '<div class="empty-state">No logs available</div>';
        return;
    }

    let html = '';
    logs.forEach(log => {
        const logClass = `log-${log.level.toLowerCase()}`;
        html += `
            <div class="log-item ${logClass}">
                <div class="log-timestamp">${new Date(log.timestamp).toLocaleString()}</div>
                <div class="log-source">${log.source}</div>
                <div class="log-message">${log.message}</div>
            </div>
        `;
    });

    logsList.innerHTML = html;
}

// Function to set up all the modal functionality
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
            .then(result => {
                statusDiv.innerHTML = `<div class="success">Document uploaded successfully!</div>`;

                // Close the modal after a short delay
                setTimeout(() => {
                    document.getElementById('upload-modal').style.display = 'none';

                    // Reload the documents list
                    loadDocuments();
                }, 1500);
            })
            .catch(error => {
                console.error('Error uploading document:', error);
                statusDiv.innerHTML = `<div class="error">Failed to upload document. Please try again.</div>`;
            });
        });
    }

    // Set up upload document button
    const uploadBtn = document.getElementById('upload-document-btn');
    if (uploadBtn) {
        uploadBtn.addEventListener('click', function() {
            const uploadModal = document.getElementById('upload-modal');
            if (uploadModal) {
                uploadModal.style.display = 'block';
            }
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

            // Call the update function
            updateIncidentStatus(incidentId, newStatus, comments);

            // Close the modal
            statusModal.style.display = 'none';

            // Clear the comments field for next time
            document.getElementById('status-comments').value = '';
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
    if (!confirm('Are you sure you want to delete all conversations? This action cannot be undone.')) {
        return;
    }

    try {
        const response = await fetch('/api/conversations/clear/', {
            method: 'DELETE',
            headers: {
                'Content-Type': 'application/json',
                'X-CSRFToken': getCSRFToken()
            }
        });

        if (!response.ok) {
            throw new Error('Failed to clear conversations');
        }

        const result = await response.json();
        showNotification(result.message || 'All conversations cleared successfully', 'success');

        // Reload conversations
        loadConversations();

        // Clear current conversation view
        const chatMessages = document.getElementById('chat-messages');
        if (chatMessages) {
            chatMessages.innerHTML = '<div class="empty-state">No messages yet. Start the conversation!</div>';
        }

        const titleElement = document.getElementById('current-conversation-title');
        if (titleElement) {
            titleElement.textContent = 'Select or create a conversation';
        }

        currentConversationId = null;
    } catch (error) {
        console.error('Error clearing conversations:', error);
        showNotification('Failed to clear conversations: ' + error.message, 'error');
    }
}

// Function to clear all documents
async function clearAllDocuments() {
    if (!confirm('Are you sure you want to delete all documents? This action cannot be undone.')) {
        return;
    }

    try {
        const response = await fetch('/api/documents/clear/', {
            method: 'DELETE',
            headers: {
                'Content-Type': 'application/json',
                'X-CSRFToken': getCSRFToken()
            }
        });

        if (!response.ok) {
            throw new Error('Failed to clear documents');
        }

        const result = await response.json();
        showNotification(result.message || 'All documents cleared successfully', 'success');

        // Reload documents
        loadDocuments();
    } catch (error) {
        console.error('Error clearing documents:', error);
        showNotification('Failed to clear documents: ' + error.message, 'error');
    }
}

// Function to load knowledge base entries
async function loadKnowledgeBase() {
    try {
        const response = await fetch('/api/knowledge-base/');
        const entries = await response.json();

        const kbList = document.getElementById('knowledge-base-list');
        kbList.innerHTML = '';

        // Group entries by category
        const entriesByCategory = {};
        entries.forEach(entry => {
            const category = entry.category || 'Uncategorized';
            if (!entriesByCategory[category]) {
                entriesByCategory[category] = [];
            }
            entriesByCategory[category].push(entry);
        });

        // Create sections for each category
        Object.keys(entriesByCategory).sort().forEach(category => {
            const categoryHeading = document.createElement('div');
            categoryHeading.className = 'kb-category-heading';
            categoryHeading.textContent = category;
            kbList.appendChild(categoryHeading);

            entriesByCategory[category].forEach(entry => {
                const entryElement = document.createElement('div');
                entryElement.className = 'kb-entry';
                entryElement.innerHTML = `
                    <div class="kb-entry-header">
                        <h4 class="kb-entry-title">${entry.title}</h4>
                        <div class="kb-entry-actions">
                            <button onclick="editKnowledgeBaseEntry('${entry.id}')" class="icon-btn">
                                <i data-feather="edit-2"></i>
                            </button>
                            <button onclick="deleteKnowledgeBaseEntry('${entry.id}')" class="icon-btn">
                                <i data-feather="trash-2"></i>
                            </button>
                        </div>
                    </div>
                    <div class="kb-entry-preview">${entry.content.substring(0, 100)}...</div>
                `;

                entryElement.addEventListener('click', (e) => {
                    if (!e.target.closest('.icon-btn')) {
                        viewKnowledgeBaseEntry(entry.id);
                    }
                });

                kbList.appendChild(entryElement);
            });
        });

        feather.replace();
    } catch (error) {
        console.error('Error loading knowledge base:', error);
        showNotification('Error loading knowledge base: ' + error.message, 'error');
    }
}

// Function to render knowledge base entries
function renderKnowledgeBaseList(entries) {
    const knowledgeBaseList = document.getElementById('knowledge-base-list');
    if (!knowledgeBaseList) return;

    if (entries.length === 0) {
        knowledgeBaseList.innerHTML = '<div class="empty-state">No knowledge base entries available</div>';
        return;
    }

    let html = '';
    entries.forEach(entry => {
        html += `<div class="kb-entry" data-id="${entry.id}">
            <div class="kb-entry-header">
                <h5 class="kb-entry-title">${entry.title}</h5>
                <div class="kb-entry-actions">
                    <button class="kb-edit-btn icon-btn" data-id="${entry.id}" title="Edit entry">
                        <i data-feather="edit-2"></i>
                    </button>
                    <button class="kb-delete-btn icon-btn" data-id="${entry.id}" title="Delete entry">
                        <i data-feather="trash-2"></i>
                    </button>
                </div>
            </div>
            <div class="kb-entry-category">Category: ${entry.category || 'Uncategorized'}</div>
            <div class="kb-entry-preview">${entry.content}</div>
        </div>`;
    });

    knowledgeBaseList.innerHTML = html;

    // Initialize feather icons
    feather.replace();

    // Add event listeners for edit and delete buttons
    document.querySelectorAll('.kb-edit-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            const id = btn.getAttribute('data-id');
            editKnowledgeBaseEntry(id);
        });
    });

    document.querySelectorAll('.kb-delete-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            const id = btn.getAttribute('data-id');
            deleteKnowledgeBaseEntry(id);
        });
    });

    // Add event listeners for entry clicks (to view full content)
    document.querySelectorAll('.kb-entry').forEach(entry => {
        entry.addEventListener('click', () => {
            const id = entry.getAttribute('data-id');
            viewKnowledgeBaseEntry(id);
        });
    });
}

// Function to create a new knowledge base entry
async function createKnowledgeBaseEntry() {
    // Show modal with form
    const modal = document.getElementById('kb-modal');
    const overlay = document.getElementById('kb-overlay');
    const form = document.getElementById('kb-form');
    const modalTitle = document.getElementById('kb-modal-title');

    if (!modal || !overlay || !form || !modalTitle) {
        showNotification('Knowledge base modal not found', 'error');
        return;
    }

    // Reset form and set title for create mode
    form.reset();
    modalTitle.textContent = 'Create Knowledge Base Entry';
    form.setAttribute('data-mode', 'create');
    form.removeAttribute('data-id');

    // Show modal
    modal.style.display = 'block';
    overlay.style.display = 'block';

    // Focus on title input
    setTimeout(() => {
        document.getElementById('kb-title-input').focus();
    }, 100);
}

// Function to edit an existing knowledge base entry
async function editKnowledgeBaseEntry(id) {
    // Fetch entry details
    try {
        const response = await fetch(`/api/knowledge-base/${id}/`);
        if (!response.ok) {
            throw new Error('Failed to load knowledge base entry');
        }

        const entry = await response.json();

        // Show modal with form
        const modal = document.getElementById('kb-modal');
        const overlay = document.getElementById('kb-overlay');
        const form = document.getElementById('kb-form');
        const modalTitle = document.getElementById('kb-modal-title');

        if (!modal || !overlay || !form || !modalTitle) {
            showNotification('Knowledge base modal not found', 'error');
            return;
        }

        // Fill form with entry data
        document.getElementById('kb-title-input').value = entry.title;
        document.getElementById('kb-category-input').value = entry.category || '';
        document.getElementById('kb-content-input').value = entry.content;

        // Set form mode and ID
        modalTitle.textContent = 'Edit Knowledge Base Entry';
        form.setAttribute('data-mode', 'edit');
        form.setAttribute('data-id', id);

        // Show modal
        modal.style.display = 'block';
        overlay.style.display = 'block';

    } catch (error) {
        console.error('Error loading knowledge base entry:', error);
        showNotification('Error loading knowledge base entry: ' + error.message, 'error');
    }
}

// Function to view a knowledge base entry
async function viewKnowledgeBaseEntry(id) {
    // Fetch entry details
    try {
        const response = await fetch(`/api/knowledge-base/${id}/`);
        if (!response.ok) {
            throw new Error('Failed to load knowledge base entry');
        }

        const entry = await response.json();

        // Show modal with entry details
        const modal = document.getElementById('kb-view-modal');
        const overlay = document.getElementById('kb-view-overlay');

        if (!modal || !overlay) {
            showNotification('Knowledge base view modal not found', 'error');
            return;
        }

        // Fill modal with entry data
        document.getElementById('kb-view-title').textContent = entry.title;
        document.getElementById('kb-view-category').textContent = entry.category || 'Uncategorized';
        document.getElementById('kb-view-content').textContent = entry.content;

        // Show modal
        modal.style.display = 'block';
        overlay.style.display = 'block';

    } catch (error) {
        console.error('Error loading knowledge base entry:', error);
        showNotification('Error loading knowledge base entry: ' + error.message, 'error');
    }
}

// Function to save a knowledge base entry
async function saveKnowledgeBaseEntry(form) {
    const mode = form.getAttribute('data-mode');
    const id = form.getAttribute('data-id');

    const title = document.getElementById('kb-title-input').value.trim();
    const category = document.getElementById('kb-category-input').value.trim();
    const content = document.getElementById('kb-content-input').value.trim();

    if (!title || !content) {
        showNotification('Title and content are required', 'error');
        return;
    }

    const data = {
        title,
        category,
        content
    };

    try {
        let url = '/api/knowledge-base/';
        let method = 'POST';

        if (mode === 'edit' && id) {
            url = `/api/knowledge-base/${id}/`;
            method = 'PUT';
        }

        const response = await fetch(url, {
            method,
            headers: {
                'X-CSRFToken': getCSRFToken(),
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(data)
        });

        if (!response.ok) {
            throw new Error('Failed to save knowledge base entry');
        }

        // Close modal
        const modal = document.getElementById('kb-modal');
        const overlay = document.getElementById('kb-overlay');

        if (modal) modal.style.display = 'none';
        if (overlay) overlay.style.display = 'none';

        // Reload knowledge base entries
        loadKnowledgeBase();

        // Show notification
        showNotification(`Knowledge base entry ${mode === 'edit' ? 'updated' : 'created'} successfully`, 'success');

    } catch (error) {
        console.error('Error saving knowledge base entry:', error);
        showNotification('Error saving knowledge base entry: ' + error.message, 'error');
    }
}

// Function to delete a knowledge base entry
async function deleteKnowledgeBaseEntry(id) {
    if (!confirm('Are you sure you want to delete this knowledge base entry? This cannot be undone.')) {
        return;
    }

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

        // Reload knowledge base entries
        loadKnowledgeBase();

        // Show notification
        showNotification('Knowledge base entry deleted successfully', 'success');

    } catch (error) {
        console.error('Error deleting knowledge base entry:', error);
        showNotification('Error deleting knowledge base entry: ' + error.message, 'error');
    }
}

// Function to set up all the modal functionality
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
            .then(result => {
                statusDiv.innerHTML = `<div class="success">Document uploaded successfully!</div>`;

                // Close the modal after a short delay
                setTimeout(() => {
                    document.getElementById('upload-modal').style.display = 'none';

                    // Reload the documents list
                    loadDocuments();
                }, 1500);
            })
            .catch(error => {
                console.error('Error uploading document:', error);
                statusDiv.innerHTML = `<div class="error">Failed to upload document. Please try again.</div>`;
            });
        });
    }

    // Set up upload document button
    const uploadBtn = document.getElementById('upload-document-btn');
    if (uploadBtn) {
        uploadBtn.addEventListener('click', function() {
            const uploadModal = document.getElementById('upload-modal');
            if (uploadModal) {
                uploadModal.style.display = 'block';
            }
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

            // Call the update function
            updateIncidentStatus(incidentId, newStatus, comments);

            // Close the modal
            statusModal.style.display = 'none';

            // Clear the comments field for next time
            document.getElementById('status-comments').value = '';
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
    if (!confirm('Are you sure you want to delete all conversations? This action cannot be undone.')) {
        return;
    }

    try {
        const response = await fetch('/api/conversations/clear/', {
            method: 'DELETE',
            headers: {
                'Content-Type': 'application/json',
                'X-CSRFToken': getCSRFToken()
            }
        });

        if (!response.ok) {
            throw new Error('Failed to clear conversations');
        }

        const result = await response.json();
        showNotification(result.message || 'All conversations cleared successfully', 'success');

        // Reload conversations
        loadConversations();

        // Clear current conversation view
        const chatMessages = document.getElementById('chat-messages');
        if (chatMessages) {
            chatMessages.innerHTML = '<div class="empty-state">No messages yet. Start the conversation!</div>';
        }

        const titleElement = document.getElementById('current-conversation-title');
        if (titleElement) {
            titleElement.textContent = 'Select or create a conversation';
        }

        currentConversationId = null;
    } catch (error) {
        console.error('Error clearing conversations:', error);
        showNotification('Failed to clear conversations: ' + error.message, 'error');
    }
}

// Function to clear all documents
async function clearAllDocuments() {
    if (!confirm('Are you sure you want to delete all documents? This action cannot be undone.')) {
        return;
    }

    try {
        const response = await fetch('/api/documents/clear/', {
            method: 'DELETE',
            headers: {
                'Content-Type': 'application/json',
                'X-CSRFToken': getCSRFToken()
            }
        });

        if (!response.ok) {
            throw new Error('Failed to clear documents');
        }

        const result = await response.json();
        showNotification(result.message || 'All documents cleared successfully', 'success');

        // Reload documents
        loadDocuments();
    } catch (error) {
        console.error('Error clearing documents:', error);
        showNotification('Failed to clear documents: ' + error.message, 'error');
    }
}

// Function to load knowledge base entries
async function loadKnowledgeBase() {
    try {
        const response = await fetch('/api/knowledge-base/');
        const entries = await response.json();

        const kbList = document.getElementById('knowledge-base-list');
        kbList.innerHTML = '';

        // Group entries by category
        const entriesByCategory = {};
        entries.forEach(entry => {
            const category = entry.category || 'Uncategorized';
            if (!entriesByCategory[category]) {
                entriesByCategory[category] = [];
            }
            entriesByCategory[category].push(entry);
        });

        // Create sections for each category
        Object.keys(entriesByCategory).sort().forEach(category => {
            const categoryHeading = document.createElement('div');
            categoryHeading.className = 'kb-category-heading';
            categoryHeading.textContent = category;
            kbList.appendChild(categoryHeading);

            entriesByCategory[category].forEach(entry => {
                const entryElement = document.createElement('div');
                entryElement.className = 'kb-entry';
                entryElement.innerHTML = `
                    <div class="kb-entry-header">
                        <h4 class="kb-entry-title">${entry.title}</h4>
                        <div class="kb-entry-actions">
                            <button onclick="editKnowledgeBaseEntry('${entry.id}')" class="icon-btn">
                                <i data-feather="edit-2"></i>
                            </button>
                            <button onclick="deleteKnowledgeBaseEntry('${entry.id}')" class="icon-btn">
                                <i data-feather="trash-2"></i>
                            </button>
                        </div>
                    </div>
                    <div class="kb-entry-preview">${entry.content.substring(0, 100)}...</div>
                `;

                entryElement.addEventListener('click', (e) => {
                    if (!e.target.closest('.icon-btn')) {
                        viewKnowledgeBaseEntry(entry.id);
                    }
                });

                kbList.appendChild(entryElement);
            });
        });

        feather.replace();
    } catch (error) {
        console.error('Error loading knowledge base:', error);
        showNotification('Error loading knowledge base: ' + error.message, 'error');
    }
}

// Function to render knowledge base entries
function renderKnowledgeBaseList(entries) {
    const knowledgeBaseList = document.getElementById('knowledge-base-list');
    if (!knowledgeBaseList) return;

    if (entries.length === 0) {
        knowledgeBaseList.innerHTML = '<div class="empty-state">No knowledge base entries available</div>';
        return;
    }

    let html = '';
    entries.forEach(entry => {
        html += `<div class="kb-entry" data-id="${entry.id}">
            <div class="kb-entry-header">
                <h5 class="kb-entry-title">${entry.title}</h5>
                <div class="kb-entry-actions">
                    <button class="kb-edit-btn icon-btn" data-id="${entry.id}" title="Edit entry">
                        <i data-feather="edit-2"></i>
                    </button>
                    <button class="kb-delete-btn icon-btn" data-id="${entry.id}" title="Delete entry">
                        <i data-feather="trash-2"></i>
                    </button>
                </div>
            </div>
            <div class="kb-entry-category">Category: ${entry.category || 'Uncategorized'}</div>
            <div class="kb-entry-preview">${entry.content}</div>
        </div>`;
    });

    knowledgeBaseList.innerHTML = html;

    // Initialize feather icons
    feather.replace();

    // Add event listeners for edit and delete buttons
    document.querySelectorAll('.kb-edit-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            const id = btn.getAttribute('data-id');
            editKnowledgeBaseEntry(id);
        });
    });

    document.querySelectorAll('.kb-delete-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            const id = btn.getAttribute('data-id');
            deleteKnowledgeBaseEntry(id);
        });
    });

    // Add event listeners for entry clicks (to view full content)
    document.querySelectorAll('.kb-entry').forEach(entry => {
        entry.addEventListener('click', () => {
            const id = entry.getAttribute('data-id');
            viewKnowledgeBaseEntry(id);
        });
    });
}

// Function to create a new knowledge base entry
async function createKnowledgeBaseEntry() {
    // Show modal with form
    const modal = document.getElementById('kb-modal');
    const overlay = document.getElementById('kb-overlay');
    const form = document.getElementById('kb-form');
    const modalTitle = document.getElementById('kb-modal-title');

    if (!modal || !overlay || !form || !modalTitle) {
        showNotification('Knowledge base modal not found', 'error');
        return;
    }

    // Reset form and set title for create mode
    form.reset();
    modalTitle.textContent = 'Create Knowledge Base Entry';
    form.setAttribute('data-mode', 'create');
    form.removeAttribute('data-id');

    // Show modal
    modal.style.display = 'block';
    overlay.style.display = 'block';

    // Focus on title input
    setTimeout(() => {
        document.getElementById('kb-title-input').focus();
    }, 100);
}

// Function to edit an existing knowledge base entry
async function editKnowledgeBaseEntry(id) {
    // Fetch entry details
    try {
        const response = await fetch(`/api/knowledge-base/${id}/`);
        if (!response.ok) {
            throw new Error('Failed to load knowledge base entry');
        }

        const entry = await response.json();

        // Show modal with form
        const modal = document.getElementById('kb-modal');
        const overlay = document.getElementById('kb-overlay');
        const form = document.getElementById('kb-form');
        const modalTitle = document.getElementById('kb-modal-title');

        if (!modal || !overlay || !form || !modalTitle) {
            showNotification('Knowledge base modal not found', 'error');
            return;
        }

        // Fill form with entry data
        document.getElementById('kb-title-input').value = entry.title;
        document.getElementById('kb-category-input').value = entry.category || '';
        document.getElementById('kb-content-input').value = entry.content;

        // Set form mode and ID
        modalTitle.textContent = 'Edit Knowledge Base Entry';
        form.setAttribute('data-mode', 'edit');
        form.setAttribute('data-id', id);

        // Show modal
        modal.style.display = 'block';
        overlay.style.display = 'block';

    } catch (error) {
        console.error('Error loading knowledge base entry:', error);
        showNotification('Error loading knowledge base entry: ' + error.message, 'error');
        }
}

// Function to view a knowledge base entry
async function viewKnowledgeBaseEntry(id) {
    // Fetch entry details
    try {
        const response = await fetch(`/api/knowledge-base/${id}/`);
        if (!response.ok) {
            throw new Error('Failed to load knowledge base entry');
        }

        const entry = await response.json();

        // Show modal with entry details
        const modal = document.getElementById('kb-view-modal');
        const overlay = document.getElementById('kb-view-overlay');

        if (!modal || !overlay) {
            showNotification('Knowledge base view modal not found', 'error');
            return;
        }

        // Fill modal with entry data
        document.getElementById('kb-view-title').textContent = entry.title;
        document.getElementById('kb-view-category').textContent = entry.category || 'Uncategorized';
        document.getElementById('kb-view-content').textContent = entry.content;

        // Show modal
        modal.style.display = 'block';
        overlay.style.display = 'block';

    } catch (error) {
        console.error('Error loading knowledge base entry:', error);
        showNotification('Error loading knowledge base entry: ' + error.message, 'error');
    }
}

// Function to save a knowledge base entry
async function saveKnowledgeBaseEntry(form) {
    const mode = form.getAttribute('data-mode');
    const id = form.getAttribute('data-id');

    const title = document.getElementById('kb-title-input').value.trim();
    const category = document.getElementById('kb-category-input').value.trim();
    const content = document.getElementById('kb-content-input').value.trim();

    if (!title || !content) {
        showNotification('Title and content are required', 'error');
        return;
    }

    const data = {
        title,
        category,
        content
    };

    try {
        let url = '/api/knowledge-base/';
        let method = 'POST';

        if (mode === 'edit' && id) {
            url = `/api/knowledge-base/${id}/`;
            method = 'PUT';
        }

        const response = await fetch(url, {
            method,
            headers: {
                'X-CSRFToken': getCSRFToken(),
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(data)
        });

        if (!response.ok) {
            throw new Error('Failed to save knowledge base entry');
        }

        // Close modal
        const modal = document.getElementById('kb-modal');
        const overlay = document.getElementById('kb-overlay');

        if (modal) modal.style.display = 'none';
        if (overlay) overlay.style.display = 'none';

        // Reload knowledge base entries
        loadKnowledgeBase();

        // Show notification
        showNotification(`Knowledge base entry ${mode === 'edit' ? 'updated' : 'created'} successfully`, 'success');

    } catch (error) {
        console.error('Error saving knowledge base entry:', error);
        showNotification('Error saving knowledge base entry: ' + error.message, 'error');
    }
}

// Function to delete a knowledge base entry
async function deleteKnowledgeBaseEntry(id) {
    if (!confirm('Are you sure you want to delete this knowledge base entry? This cannot be undone.')) {
        return;
    }

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

        // Reload knowledge base entries
        loadKnowledgeBase();

        // Show notification
        showNotification('Knowledge base entry deleted successfully', 'success');

    } catch (error) {
        console.error('Error deleting knowledge base entry:', error);
        showNotification('Error deleting knowledge base entry: ' + error.message, 'error');
    }
}

// Function to set up all the modal functionality
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
            .then(result => {
                statusDiv.innerHTML = `<div class="success">Document uploaded successfully!</div>`;

                // Close the modal after a short delay
                setTimeout(() => {
                    document.getElementById('upload-modal').style.display = 'none';

                    // Reload the documents list
                    loadDocuments();
                }, 1500);
            })
            .catch(error => {
                console.error('Error uploading document:', error);
                statusDiv.innerHTML = `<div class="error">Failed to upload document. Please try again.</div>`;
            });
        });
    }

    // Set up upload document button
    const uploadBtn = document.getElementById('upload-document-btn');
    if (uploadBtn) {
        uploadBtn.addEventListener('click', function() {
            const uploadModal = document.getElementById('upload-modal');
            if (uploadModal) {
                uploadModal.style.display = 'block';
            }
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

            // Call the update function
            updateIncidentStatus(incidentId, newStatus, comments);

            // Close the modal
            statusModal.style.display = 'none';

            // Clear the comments field for next time
            document.getElementById('status-comments').value = '';
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
    if (!confirm('Are you sure you want to delete all conversations? This action cannot be undone.')) {
        return;
    }

    try {
        const response = await fetch('/api/conversations/clear/', {
            method: 'DELETE',
            headers: {
                'Content-Type': 'application/json',
                'X-CSRFToken': getCSRFToken()
            }
        });

        if (!response.ok) {
            throw new Error('Failed to clear conversations');
        }

        const result = await response.json();
        showNotification(result.message || 'All conversations cleared successfully', 'success');

        // Reload conversations
        loadConversations();

        // Clear current conversation view
        const chatMessages = document.getElementById('chat-messages');
        if (chatMessages) {
            chatMessages.innerHTML = '<div class="empty-state">No messages yet. Start the conversation!</div>';
        }

        const titleElement = document.getElementById('current-conversation-title');
        if (titleElement) {
            titleElement.textContent = 'Select or create a conversation';
        }

        currentConversationId = null;
    } catch (error) {
        console.error('Error clearing conversations:', error);
        showNotification('Failed to clear conversations: ' + error.message, 'error');
    }
}

// Function to clear all documents
async function clearAllDocuments() {
    if (!confirm('Are you sure you want to delete all documents? This action cannot be undone.')) {
        return;
    }

    try {
        const response = await fetch('/api/documents/clear/', {
            method: 'DELETE',
            headers: {
                'Content-Type': 'application/json',
                'X-CSRFToken': getCSRFToken()
            }
        });

        if (!response.ok) {
            throw new Error('Failed to clear documents');
        }

        const result = await response.json();
        showNotification(result.message || 'All documents cleared successfully', 'success');

        // Reload documents
        loadDocuments();
    } catch (error) {
        console.error('Error clearing documents:', error);
        showNotification('Failed to clear documents: ' + error.message, 'error');
    }
}

// Function to load knowledge base entries
async function loadKnowledgeBase() {
    try {
        const response = await fetch('/api/knowledge-base/');
        const entries = await response.json();

        const kbList = document.getElementById('knowledge-base-list');
        kbList.innerHTML = '';

        // Group entries by category
        const entriesByCategory = {};
        entries.forEach(entry => {
            const category = entry.category || 'Uncategorized';
            if (!entriesByCategory[category]) {
                entriesByCategory[category] = [];
            }
            entriesByCategory[category].push(entry);
        });

        // Create sections for each category
        Object.keys(entriesByCategory).sort().forEach(category => {
            const categoryHeading = document.createElement('div');
            categoryHeading.className = 'kb-category-heading';
            categoryHeading.textContent = category;
            kbList.appendChild(categoryHeading);

            entriesByCategory[category].forEach(entry => {
                const entryElement = document.createElement('div');
                entryElement.className = 'kb-entry';
                entryElement.innerHTML = `
                    <div class="kb-entry-header">
                        <h4 class="kb-entry-title">${entry.title}</h4>
                        <div class="kb-entry-actions">
                            <button onclick="editKnowledgeBaseEntry('${entry.id}')" class="icon-btn">
                                <i data-feather="edit-2"></i>
                            </button>
                            <button onclick="deleteKnowledgeBaseEntry('${entry.id}')" class="icon-btn">
                                <i data-feather="trash-2"></i>
                            </button>
                        </div>
                    </div>
                    <div class="kb-entry-preview">${entry.content.substring(0, 100)}...</div>
                `;

                entryElement.addEventListener('click', (e) => {
                    if (!e.target.closest('.icon-btn')) {
                        viewKnowledgeBaseEntry(entry.id);
                    }
                });

                kbList.appendChild(entryElement);
            });
        });

        feather.replace();
    } catch (error) {
        console.error('Error loading knowledge base:', error);
        showNotification('Error loading knowledge base: ' + error.message, 'error');
    }
}

// Function to render knowledge base entries
function renderKnowledgeBaseList(entries) {
    const knowledgeBaseList = document.getElementById('knowledge-base-list');
    if (!knowledgeBaseList) return;

    if (entries.length === 0) {
        knowledgeBaseList.innerHTML = '<div class="empty-state">No knowledge base entries available</div>';
        return;
    }

    let html = '';
    entries.forEach(entry => {
        html += `<div class="kb-entry" data-id="${entry.id}">
            <div class="kb-entry-header">
                <h5 class="kb-entry-title">${entry.title}</h5>
                <div class="kb-entry-actions">
                    <button class="kb-edit-btn icon-btn" data-id="${entry.id}" title="Edit entry">
                        <i data-feather="edit-2"></i>
                    </button>
                    <button class="kb-delete-btn icon-btn" data-id="${entry.id}" title="Delete entry">
                        <i data-feather="trash-2"></i>
                    </button>
                </div>
            </div>
            <div class="kb-entry-category">Category: ${entry.category || 'Uncategorized'}</div>
            <div class="kb-entry-preview">${entry.content}</div>
        </div>`;
    });

    knowledgeBaseList.innerHTML = html;

    // Initialize feather icons
    feather.replace();

    // Add event listeners for edit and delete buttons
    document.querySelectorAll('.kb-edit-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            const id = btn.getAttribute('data-id');
            editKnowledgeBaseEntry(id);
        });
    });

    document.querySelectorAll('.kb-delete-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            const id = btn.getAttribute('data-id');
            deleteKnowledgeBaseEntry(id);
        });
    });

    // Add event listeners for entry clicks (to view full content)
    document.querySelectorAll('.kb-entry').forEach(entry => {
        entry.addEventListener('click', () => {
            const id = entry.getAttribute('data-id');
            viewKnowledgeBaseEntry(id);
        });
    });
}

// Function to create a new knowledge base entry
async function createKnowledgeBaseEntry() {
    // Show modal with form
    const modal = document.getElementById('kb-modal');
    const overlay = document.getElementById('kb-overlay');
    const form = document.getElementById('kb-form');
    const modalTitle = document.getElementById('kb-modal-title');

    if (!modal || !overlay || !form || !modalTitle) {
        showNotification('Knowledge base modal not found', 'error');
        return;
    }

    // Reset form and set title for create mode
    form.reset();
    modalTitle.textContent = 'Create Knowledge Base Entry';
    form.setAttribute('data-mode', 'create');
    form.removeAttribute('data-id');

    // Show modal
    modal.style.display = 'block';
    overlay.style.display = 'block';

    // Focus on title input
    setTimeout(() => {
        document.getElementById('kb-title-input').focus();
    }, 100);
}

// Function to edit an existing knowledge base entry
async function editKnowledgeBaseEntry(id) {
    // Fetch entry details
    try {
        const response = await fetch(`/api/knowledge-base/${id}/`);
        if (!response.ok) {
            throw new Error('Failed to load knowledge base entry');
        }

        const entry = await response.json();

        // Show modal with form
        const modal = document.getElementById('kb-modal');
        const overlay = document.getElementById('kb-overlay');
        const form = document.getElementById('kb-form');
        const modalTitle = document.getElementById('kb-modal-title');

        if (!modal || !overlay || !form || !modalTitle) {
            showNotification('Knowledge base modal not found', 'error');
            return;
        }

        // Fill form with entry data
        document.getElementById('kb-title-input').value = entry.title;
        document.getElementById('kb-category-input').value = entry.category || '';
        document.getElementById('kb-content-input').value = entry.content;

        // Set form mode and ID
        modalTitle.textContent = 'Edit Knowledge Base Entry';
        form.setAttribute('data-mode', 'edit');
        form.setAttribute('data-id', id);

        // Show modal
        modal.style.display = 'block';
        overlay.style.display = 'block';

    } catch (error) {
        console.error('Error loading knowledge base entry:', error);
        showNotification('Error loading knowledge base entry: ' + error.message, 'error');
    }
}

// Function to view a knowledge base entry
async function viewKnowledgeBaseEntry(id) {
    // Fetch entry details
    try {
        const response = await fetch(`/api/knowledge-base/${id}/`);
        if (!response.ok) {
            throw new Error('Failed to load knowledge base entry');
        }

        const entry = await response.json();

        // Show modal with entry details
        const modal = document.getElementById('kb-view-modal');
        const overlay = document.getElementById('kb-view-overlay');

        if (!modal || !overlay) {
            showNotification('Knowledge base view modal not found', 'error');
            return;
        }

        // Fill modal with entry data
        document.getElementById('kb-view-title').textContent = entry.title;
        document.getElementById('kb-view-category').textContent = entry.category || 'Uncategorized';
        document.getElementById('kb-view-content').textContent = entry.content;

        // Show modal
        modal.style.display = 'block';
        overlay.style.display = 'block';

    } catch (error) {
        console.error('Error loading knowledge base entry:', error);
        showNotification('Error loading knowledge base entry: ' + error.message, 'error');
    }
}

// Function to save a knowledge base entry
async function saveKnowledgeBaseEntry(form) {
    const mode = form.getAttribute('data-mode');
    const id = form.getAttribute('data-id');

    const title = document.getElementById('kb-title-input').value.trim();
    const category = document.getElementById('kb-category-input').value.trim();
    const content = document.getElementById('kb-content-input').value.trim();

    if (!title || !content) {
        showNotification('Title and content are required', 'error');
        return;
    }

    const data = {
        title,
        category,
        content
    };

    try {
        let url = '/api/knowledge-base/';
        let method = 'POST';

        if (mode === 'edit' && id) {
            url = `/api/knowledge-base/${id}/`;
            method = 'PUT';
        }

        const response = await fetch(url, {
            method,
            headers: {
                'X-CSRFToken': getCSRFToken(),
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(data)
        });

        if (!response.ok) {
            throw new Error('Failed to save knowledge base entry');
        }

        // Close modal
        const modal = document.getElementById('kb-modal');
        const overlay = document.getElementById('kb-overlay');

        if (modal) modal.style.display = 'none';
        if (overlay) overlay.style.display = 'none';

        // Reload knowledge base entries
        loadKnowledgeBase();

        // Show notification
        showNotification(`Knowledge base entry ${mode === 'edit' ? 'updated' : 'created'} successfully`, 'success');

    } catch (error) {
        console.error('Error saving knowledge base entry:', error);
        showNotification('Error saving knowledge base entry: ' + error.message, 'error');
    }
}

// Function to delete a knowledge base entry
async function deleteKnowledgeBaseEntry(id) {
    if (!confirm('Are you sure you want to delete this knowledge base entry? This cannot be undone.')) {
        return;
    }

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

        // Reload knowledge base entries
        loadKnowledgeBase();

        // Show notification
        showNotification('Knowledge base entry deleted successfully', 'success');

    } catch (error) {
        console.error('Error deleting knowledge base entry:', error);
        showNotification('Error deleting knowledge base entry: ' + error.message, 'error');
    }
}

// Initialize event listeners when DOM is loaded
function toggleKnowledgeBase() {
    const kbContainer = document.querySelector('.knowledge-base-container');
    const overlay = document.getElementById('kb-overlay');

    if (kbContainer.style.display === 'none' || !kbContainer.style.display) {
        kbContainer.style.display = 'block';
        overlay.style.display = 'block';
        loadKnowledgeBase(); // Load KB entries when opening popup
    } else {
        kbContainer.style.display = 'none';
        overlay.style.display = 'none';
    }
}

document.addEventListener('DOMContentLoaded', function() {
    // Add KB toggle button handler
    const openKbBtn = document.getElementById('open-kb-btn');
    if (openKbBtn) {
        openKbBtn.addEventListener('click', toggleKnowledgeBase);
    }

    // Add overlay click handler to close KB
    const overlay = document.getElementById('kb-overlay');
    if (overlay) {
        overlay.addEventListener('click', toggleKnowledgeBase);
    }
    // Initialize Feather icons
    if (window.feather) {
        feather.replace();
    }

    // Set up modal functionality
    setupModals();

    // Load initial data
    loadConversations();
    loadDocuments();
    loadIncidents();
    loadAutomations();
    loadDashboards();
    loadLogs();
    loadKnowledgeBase();

    // Set up chat form submission handler
    const chatForm = document.getElementById('chat-form');
    if (chatForm) {
        chatForm.addEventListener('submit', handleChatSubmit);
    }

    // Set up new chat button handler
    const newChatBtn = document.getElementById('new-chat-btn');
    if (newChatBtn) {
        newChatBtn.addEventListener('click', createNewChat);
    }

    // Set up delete chat button handler
    const deleteChatBtn = document.getElementById('delete-chat-btn');
    if (deleteChatBtn) {
        deleteChatBtn.addEventListener('click', deleteCurrentChat);
    }

    // Set up rename chat button handler
    const renameChatBtn = document.getElementById('rename-chat-btn');
    if (renameChatBtn) {
        renameChatBtn.addEventListener('click', renameCurrentChat);
    }

    // Set up clear all conversations button handler
    const clearAllConversationsBtn = document.getElementById('clear-all-conversations-btn');
    if (clearAllConversationsBtn) {
        clearAllConversationsBtn.addEventListener('click', clearAllConversations);
    }

    // Set up clear all documents button handler
    const clearAllDocumentsBtn = document.getElementById('clear-all-documents-btn');
    if (clearAllDocumentsBtn) {
        clearAllDocumentsBtn.addEventListener('click', clearAllDocuments);
    }

    // Set up knowledge base create button handler
    const createKnowledgeBaseBtn = document.getElementById('create-kb-btn');
    if (createKnowledgeBaseBtn) {
        createKnowledgeBaseBtn.addEventListener('click', createKnowledgeBaseEntry);
    }

    // Set up knowledge base form submit handler
    const kbForm = document.getElementById('kb-form');
    if (kbForm) {
        kbForm.addEventListener('submit', function(event) {
            event.preventDefault();
            saveKnowledgeBaseEntry(this);
        });
    }

    // Set up knowledge base modal close buttons
    const kbModalCloseBtn = document.getElementById('kb-modal-close');
    if (kbModalCloseBtn) {
        kbModalCloseBtn.addEventListener('click', function() {
            document.getElementById('kb-modal').style.display = 'none';
            document.getElementById('kb-overlay').style.display = 'none';
        });
    }

    const kbViewModalCloseBtn = document.getElementById('kb-view-modal-close');
    if (kbViewModalCloseBtn) {
        kbViewModalCloseBtn.addEventListener('click', function() {
            document.getElementById('kb-view-modal').style.display = 'none';
            document.getElementById('kb-view-overlay').style.display = 'none';
        });
    }
});