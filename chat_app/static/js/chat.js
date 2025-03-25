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
    if (!currentConversationId) return;
    
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
            throw new Error('Failed to delete conversation');
        }
        
        currentConversationId = null;
        
        // Reload conversations
        await loadConversations();
    } catch (error) {
        console.error('Error deleting conversation:', error);
        alert('Failed to delete conversation. Please try again.');
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
        
        // Fetch updated conversation with assistant response
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
            throw new Error('Failed to delete document');
        }
        
        // Reload documents
        loadDocuments();
    } catch (error) {
        console.error('Error deleting document:', error);
        alert('Failed to delete document. Please try again.');
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
    incidents.forEach(incident => {
        html += `
            <div class="incident-item" data-id="${incident.id}">
                <div class="incident-severity ${incident.severity}">${incident.severity}</div>
                <div class="incident-title">${incident.title}</div>
                <div class="incident-status ${incident.status.toLowerCase().replace(' ', '-')}">${incident.status}</div>
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
    
    // Prepare status options
    const statusOptions = ['Open', 'In Progress', 'Resolved'].map(status => {
        const value = status.toLowerCase().replace(' ', '-');
        const selected = (incident.status.toLowerCase().replace(' ', '-') === value) ? 'selected' : '';
        return `<option value="${value}" ${selected}>${status}</option>`;
    }).join('');
    
    // Format created and updated dates
    const createdDate = new Date(incident.created_at).toLocaleString();
    const updatedDate = new Date(incident.updated_at).toLocaleString();
    
    // Build the HTML for the details section
    let html = `
        <h3>${incident.title}</h3>
        <div class="incident-detail-row">
            <span class="detail-label">Severity:</span>
            <span class="detail-value ${incident.severity}">${incident.severity}</span>
        </div>
        <div class="incident-detail-row">
            <span class="detail-label">Status:</span>
            <select id="incident-status" class="status-select ${incident.status.toLowerCase().replace(' ', '-')}">
                ${statusOptions}
            </select>
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
            <p>${incident.description}</p>
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
    
    detailsContainer.innerHTML = html;
    
    // Add event listener for the status dropdown
    const statusDropdown = document.getElementById('incident-status');
    if (statusDropdown) {
        statusDropdown.addEventListener('change', function() {
            showStatusUpdateModal(incident.id, this.value);
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
        
        // Update modal title
        const modalTitle = modal.querySelector('.modal-title');
        if (modalTitle) {
            const statusText = newStatus.replace('-', ' ');
            modalTitle.textContent = `Update Status to ${statusText.charAt(0).toUpperCase() + statusText.slice(1)}`;
        }
    }
}

// Function to update incident status
function updateIncidentStatus(incidentId, newStatus, comments = '') {
    // Format the status value for the API (convert to title case)
    let apiStatus = newStatus.replace(/-/g, ' ').replace(/\w\S*/g, 
        function(txt) {
            return txt.charAt(0).toUpperCase() + txt.substr(1).toLowerCase();
        }
    );
    
    // Prepare request data
    const requestData = {
        status: apiStatus
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
        successMsg.textContent = `Status updated to ${apiStatus}`;
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
    })
    .catch(error => {
        console.error('Error updating incident status:', error);
        // Show error message
        const detailsContainer = document.getElementById('incident-details');
        const errorMsg = document.createElement('div');
        errorMsg.className = 'status-update-error';
        errorMsg.textContent = 'Failed to update status. Please try again.';
        errorMsg.style.color = 'red';
        errorMsg.style.marginTop = '10px';
        detailsContainer.appendChild(errorMsg);
        
        // Remove error message after 3 seconds
        setTimeout(() => {
            if (errorMsg.parentNode) {
                errorMsg.parentNode.removeChild(errorMsg);
            }
        }, 3000);
    });
}

// Function to update a single incident in the list
function updateIncidentInList(updatedIncident) {
    const incidentElement = document.querySelector(`.incident-item[data-id="${updatedIncident.id}"]`);
    if (incidentElement) {
        const statusElement = incidentElement.querySelector('.incident-status');
        if (statusElement) {
            // Update the status class and text
            const oldStatusClass = statusElement.className.split(' ')[1];
            const newStatusClass = updatedIncident.status.toLowerCase().replace(' ', '-');
            statusElement.classList.remove(oldStatusClass);
            statusElement.classList.add(newStatusClass);
            statusElement.textContent = updatedIncident.status;
        }
    }
}

// Function to update the incidents summary
function updateIncidentsSummary(incidents) {
    const summaryContainer = document.getElementById('incident-summary');
    if (!summaryContainer) return;
    
    // Count incidents by status and severity
    let openIncidents = incidents.filter(inc => inc.status.toLowerCase() === 'open').length;
    let inProgressIncidents = incidents.filter(inc => inc.status.toLowerCase().replace(' ', '-') === 'in-progress').length;
    let resolvedIncidents = incidents.filter(inc => inc.status.toLowerCase() === 'resolved').length;
    let highSeverityIncidents = incidents.filter(inc => inc.severity.toLowerCase() === 'high').length;
    
    // Create the HTML for the incident summary section
    let summaryHTML = `
        <h3>Incidents Overview</h3>
        <div class="summary-content">
            <div class="summary-stats">
                <div class="severity-item high">
                    <span>High Severity</span>
                    <span>${highSeverityIncidents}</span>
                </div>
                <div class="severity-item">
                    <span>Open</span>
                    <span>${openIncidents}</span>
                </div>
                <div class="severity-item">
                    <span>In Progress</span>
                    <span>${inProgressIncidents}</span>
                </div>
                <div class="severity-item">
                    <span>Resolved</span>
                    <span>${resolvedIncidents}</span>
                </div>
            </div>
            
            <div class="summary-note">
                <p>Select an incident for details</p>
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
    
    fetch('/api/incidents/')
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
    
    let html = '<h4>Recommended Automations</h4>';
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
        alert(`Automation triggered successfully: ${data.message || 'Completed'}`);
    })
    .catch(error => {
        console.error('Error triggering automation:', error);
        alert('Failed to trigger automation. Please try again.');
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
    
    let html = '<h4>Recommended Dashboards</h4>';
    dashboards.forEach(dashboard => {
        html += `
            <div class="dashboard-item recommended">
                <div class="dashboard-name">${dashboard.name}</div>
                <div class="dashboard-description">${dashboard.description}</div>
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
                <div class="dashboard-description">${dashboard.description}</div>
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

// Initialize event listeners when DOM is loaded
document.addEventListener('DOMContentLoaded', function() {
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
});