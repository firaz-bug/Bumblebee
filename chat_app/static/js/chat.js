// Chat.js - Main JavaScript file for the Wells Fargo AI Platform Support Assistant

// Global state
let currentIncidentId = null;

// Helper function to get CSRF token
function getCSRFToken() {
    const cookieValue = document.cookie
        .split('; ')
        .find(row => row.startsWith('csrftoken='))
        ?.split('=')[1];
    return cookieValue || '';
}

// Show notification
function showNotification(message, type = 'info') {
    const notification = document.createElement('div');
    notification.className = `notification ${type}`;
    notification.textContent = message;
    
    // Add to document
    document.body.appendChild(notification);
    
    // Remove after 3 seconds
    setTimeout(() => {
        if (notification.parentNode) {
            notification.parentNode.removeChild(notification);
        }
    }, 3000);
}

// Function to load conversations
async function loadConversations() {
    try {
        const response = await fetch('/api/conversations/');
        if (response.ok) {
            const conversations = await response.json();
            const conversationsList = document.querySelector('.conversations-list');
            if (!conversationsList) return;

            conversationsList.innerHTML = conversations.map(conv => `
                <div class="conversation-item" data-id="${conv.id}">
                    <i class="icon-item icon-message"></i>
                    <span class="conversation-title">${conv.title}</span>
                </div>
            `).join('');

            // Add click handlers to conversation items
            document.querySelectorAll('.conversation-item').forEach(item => {
                item.addEventListener('click', () => switchConversation(item.dataset.id));
            });
        }
    } catch (error) {
        console.error('Error loading conversations:', error);
    }
}

// Function to switch conversation
async function switchConversation(conversationId) {
    try {
        const response = await fetch(`/api/conversations/${conversationId}/`);
        if (response.ok) {
            const conversation = await response.json();

            // Update active conversation
            document.querySelectorAll('.conversation-item').forEach(item => {
                item.classList.remove('active');
                if (item.dataset.id === conversationId) {
                    item.classList.add('active');
                }
            });

            // Display messages
            displayMessages(conversation.messages);
        }
    } catch (error) {
        console.error('Error switching conversation:', error);
    }
}

// Function to display messages
function displayMessages(messages) {
    const chatMessages = document.getElementById('chat-messages');
    if (!chatMessages) return;

    chatMessages.innerHTML = messages.map(msg => `
        <div class="message ${msg.role}-message">
            <div class="message-content">${msg.content}</div>
        </div>
    `).join('');

    chatMessages.scrollTop = chatMessages.scrollHeight;
}

// Function to create new chat
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

        if (response.ok) {
            const newConversation = await response.json();
            await loadConversations();
            switchConversation(newConversation.id);
        }
    } catch (error) {
        console.error('Error creating new chat:', error);
    }
}

// Function to rename current chat
async function renameCurrentChat() {
    const activeChat = document.querySelector('.conversation-item.active');
    if (!activeChat) return;

    const conversationId = activeChat.dataset.id;
    const newTitle = prompt('Enter a new title for this conversation:', activeChat.querySelector('.conversation-title').textContent);
    
    if (!newTitle) return; // User cancelled
    
    try {
        const response = await fetch(`/api/conversations/${conversationId}/`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'X-CSRFToken': getCSRFToken()
            },
            body: JSON.stringify({
                title: newTitle
            })
        });

        if (response.ok) {
            await loadConversations();
        }
    } catch (error) {
        console.error('Error renaming chat:', error);
    }
}

// Function to delete current chat
async function deleteCurrentChat() {
    const activeChat = document.querySelector('.conversation-item.active');
    if (!activeChat) return;

    if (!confirm('Are you sure you want to delete this conversation?')) return;

    const conversationId = activeChat.dataset.id;
    try {
        const response = await fetch(`/api/conversations/${conversationId}/`, {
            method: 'DELETE',
            headers: {
                'X-CSRFToken': getCSRFToken()
            }
        });

        if (response.ok) {
            await loadConversations();
            // Switch to first conversation or create new one if none exist
            const firstConv = document.querySelector('.conversation-item');
            if (firstConv) {
                switchConversation(firstConv.dataset.id);
            } else {
                createNewChat();
            }
        }
    } catch (error) {
        console.error('Error deleting chat:', error);
    }
}

// Function to handle chat form submission
async function handleChatSubmit(event) {
    event.preventDefault();
    const input = document.getElementById('chat-input');
    if (!input) return;
    
    const message = input.value.trim();
    if (!message) return;

    const activeChat = document.querySelector('.conversation-item.active');
    if (!activeChat) {
        // Create a new conversation if none exists
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

            if (response.ok) {
                const newConversation = await response.json();
                await loadConversations();
                
                // Add active class to the new conversation
                document.querySelectorAll('.conversation-item').forEach(item => {
                    if (item.dataset.id === newConversation.id) {
                        item.classList.add('active');
                    }
                });
                
                // Send message to the new conversation
                sendMessageToConversation(newConversation.id, message, input);
            }
        } catch (error) {
            console.error('Error creating new chat:', error);
        }
    } else {
        // Send to existing conversation
        sendMessageToConversation(activeChat.dataset.id, message, input);
    }
}

// Helper function to send a message to a conversation
async function sendMessageToConversation(conversationId, message, inputElement) {
    try {
        const response = await fetch(`/api/conversations/${conversationId}/messages/`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-CSRFToken': getCSRFToken()
            },
            body: JSON.stringify({
                content: message
            })
        });

        if (response.ok) {
            const messages = await response.json();
            displayMessages(messages);
            inputElement.value = '';
        }
    } catch (error) {
        console.error('Error sending message:', error);
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

// Function to render the documents list
function renderDocumentsList(documents) {
    const documentsList = document.getElementById('documents-list');
    if (!documentsList) return;
    
    if (documents.length === 0) {
        documentsList.innerHTML = '<div class="empty-documents">No documents uploaded yet.</div>';
        return;
    }
    
    let html = '';
    documents.forEach(document => {
        const fileIcon = getFileTypeIcon(document.file_type);
        html += `
            <div class="document-item">
                <div class="document-icon">${fileIcon}</div>
                <div class="document-title">${document.title}</div>
                <button class="document-delete" onclick="deleteDocument('${document.id}')" title="Delete document">
                    <i class="icon-trash"></i>
                </button>
            </div>
        `;
    });
    
    documentsList.innerHTML = html;
}

// Helper function to get appropriate icon for file type
function getFileTypeIcon(fileType) {
    switch(fileType.toLowerCase()) {
        case 'pdf':
            return '<i class="icon-file-pdf"></i>';
        case 'docx':
        case 'doc':
            return '<i class="icon-file-word"></i>';
        case 'txt':
            return '<i class="icon-file-text"></i>';
        default:
            return '<i class="icon-file"></i>';
    }
}

// Function to delete a document
async function deleteDocument(documentId) {
    if (!confirm('Are you sure you want to delete this document?')) {
        return;
    }
    
    try {
        const response = await fetch(`/api/documents/${documentId}/`, {
            method: 'DELETE',
            headers: {
                'X-CSRFToken': getCSRFToken()
            }
        });
        
        if (!response.ok) {
            throw new Error('Network response was not ok');
        }
        
        // Reload the documents list
        loadDocuments();
        showNotification('Document deleted successfully', 'success');
    } catch (error) {
        console.error('Error deleting document:', error);
        showNotification('Failed to delete document', 'error');
    }
}

// Function to render the incidents list
function renderIncidentsList(incidents) {
    const incidentsList = document.getElementById('incidents-list');
    if (!incidentsList) return;
    
    if (incidents.length === 0) {
        incidentsList.innerHTML = '<div class="loading-incidents">No incidents available.</div>';
        return;
    }
    
    let html = '';
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
    fetch(`/api/incidents/${incidentId}/`)
        .then(response => {
            if (!response.ok) {
                throw new Error('Failed to fetch recommendations');
            }
            return response.json();
        })
        .then(data => {
            // Update recommendations
            updateRecommendedAutomations(data.recommended_automations || []);
            updateRecommendedDashboards(data.recommended_dashboards || []);
        })
        .catch(error => {
            console.error('Error fetching recommendations:', error);
        });
}

// Function to highlight selected incident in the list
function highlightIncident(element) {
    // Remove highlight from other incidents
    document.querySelectorAll('.incident-item').forEach(item => {
        item.classList.remove('selected');
    });
    
    // Add highlight to the clicked incident
    element.classList.add('selected');
}

// Function to show status update modal
function showStatusUpdateModal(incidentId, newStatus) {
    const statusModal = document.getElementById('status-update-modal');
    if (statusModal) {
        // Store the incident ID and new status in the modal's dataset
        statusModal.dataset.incidentId = incidentId;
        statusModal.dataset.newStatus = newStatus;
        
        // Show the modal
        statusModal.style.display = 'block';
        
        // Focus on the comments textarea
        const commentsTextarea = document.getElementById('status-comments');
        if (commentsTextarea) {
            commentsTextarea.focus();
        }
        
        // Update modal title based on the status change
        const modalTitle = document.getElementById('status-update-title');
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
        // Prepare request data
        const requestData = {};
        
        // Only add state if it's not an 'add-comments' action
        if (newState !== 'add-comments') {
            requestData.state = parseInt(newState); // Convert to integer since state is stored as an integer
        }

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
            
            if (isStatusUpdate) {
                successMsg.textContent = `Status updated to ${statusMap[newState] || 'new status'}`;
                if (comments) {
                    successMsg.textContent += ' with comments';
                }
            } else {
                successMsg.textContent = 'Comments added successfully';
            }
                
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

// Function to update an incident in the list after changes
function updateIncidentInList(updatedIncident) {
    const incidentItems = document.querySelectorAll('.incident-item');
    incidentItems.forEach(item => {
        if (item.dataset.id === updatedIncident.id) {
            // Update display
            const titleEl = item.querySelector('.incident-title');
            if (titleEl) {
                titleEl.textContent = `${updatedIncident.incident_number}: ${updatedIncident.short_description}`;
            }
            
            // Update severity class if needed
            const severityEl = item.querySelector('.incident-severity');
            if (severityEl && updatedIncident.priority) {
                severityEl.className = `incident-severity ${updatedIncident.priority}`;
                severityEl.textContent = updatedIncident.priority;
            }
        }
    });
}

// Function to update the incidents summary
function updateIncidentsSummary(incidents) {
    const summaryContainer = document.getElementById('incidents-summary');
    if (!summaryContainer) return;
    
    // Count incidents by state
    const states = {
        1: { name: 'New', count: 0 },
        2: { name: 'In Progress', count: 0 },
        3: { name: 'On Hold', count: 0 },
        4: { name: 'Resolved', count: 0 },
        5: { name: 'Closed/Canceled', count: 0 }
    };
    
    // Count incidents by priority
    const priorities = {
        'Critical': 0,
        'High': 0,
        'Medium': 0,
        'Low': 0
    };
    
    // Calculate counts
    incidents.forEach(incident => {
        if (states[incident.state]) {
            states[incident.state].count++;
        }
        
        if (priorities.hasOwnProperty(incident.priority)) {
            priorities[incident.priority]++;
        }
    });
    
    // Create summary HTML
    let html = '<div class="summary-section">';
    
    // State summary
    html += '<div class="summary-states">';
    for (const [stateId, stateInfo] of Object.entries(states)) {
        if (stateInfo.count > 0) {
            html += `<div class="state-count state-${stateId}">
                        <span class="count">${stateInfo.count}</span>
                        <span class="label">${stateInfo.name}</span>
                     </div>`;
        }
    }
    html += '</div>';
    
    // Priority summary
    html += '<div class="summary-priorities">';
    for (const [priority, count] of Object.entries(priorities)) {
        if (count > 0) {
            const priorityClass = priority.toLowerCase();
            html += `<div class="priority-count ${priorityClass}">
                        <span class="count">${count}</span>
                        <span class="label">${priority}</span>
                     </div>`;
        }
    }
    html += '</div>';
    
    html += '</div>';
    
    summaryContainer.innerHTML = html;
}

// Function to load incidents
function loadIncidents() {
    fetch('/api/incidents/')
        .then(response => {
            if (!response.ok) {
                throw new Error('Network response was not ok');
            }
            return response.json();
        })
        .then(incidents => {
            renderIncidentsList(incidents);
            updateIncidentsSummary(incidents);
            
            // If there's a current incident selected, try to maintain that selection
            if (currentIncidentId) {
                const selectedIncident = document.querySelector(`.incident-item[data-id="${currentIncidentId}"]`);
                if (selectedIncident) {
                    highlightIncident(selectedIncident);
                }
            }
        })
        .catch(error => {
            console.error('Error loading incidents:', error);
            const incidentsList = document.getElementById('incidents-list');
            if (incidentsList) {
                incidentsList.innerHTML = '<div class="loading-error">Failed to load incidents. Please try again.</div>';
            }
        });
}

// Function to load automations
function loadAutomations() {
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
            const automationsList = document.getElementById('automations-list');
            if (automationsList) {
                automationsList.innerHTML = '<div class="loading-error">Failed to load automations. Please try again.</div>';
            }
        });
}

// Function to update recommended automations
function updateRecommendedAutomations(automations) {
    const recommendationsContainer = document.getElementById('recommended-automations');
    if (!recommendationsContainer) return;
    
    if (automations.length === 0) {
        recommendationsContainer.innerHTML = '<div class="empty-recommendations">No recommended automations for this incident.</div>';
        return;
    }
    
    let html = '';
    automations.forEach(automation => {
        html += `
            <div class="automation-item" onclick="triggerAutomation('${automation.id}')">
                <div class="automation-icon"><i class="icon-play-circle"></i></div>
                <div class="automation-name">${automation.name}</div>
            </div>
        `;
    });
    
    recommendationsContainer.innerHTML = html;
}

// Function to render automations list
function renderAutomationsList(automations) {
    const automationsList = document.getElementById('automations-list');
    if (!automationsList) return;
    
    if (automations.length === 0) {
        automationsList.innerHTML = '<div class="empty-automations">No automations available.</div>';
        return;
    }
    
    let html = '';
    automations.forEach(automation => {
        html += `
            <div class="automation-item" onclick="triggerAutomation('${automation.id}')">
                <div class="automation-icon"><i class="icon-play-circle"></i></div>
                <div class="automation-name">${automation.name}</div>
                <div class="automation-description">${automation.description}</div>
            </div>
        `;
    });
    
    automationsList.innerHTML = html;
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
            throw new Error('Network response was not ok');
        }
        return response.json();
    })
    .then(data => {
        // Show logs in modal
        showAutomationLogs(data);
        
        // Create a log entry
        createLogEntry('info', 'automation', `Triggered automation ${data.automation?.name || 'unknown'}`);
        
        // Reload logs
        loadLogs();
    })
    .catch(error => {
        console.error('Error triggering automation:', error);
        showNotification('Failed to trigger automation', 'error');
    });
}

// Function to show automation logs in modal
function showAutomationLogs(data) {
    const logsModal = document.getElementById('automation-logs-modal');
    if (!logsModal) return;
    
    // Set modal title
    const modalTitle = logsModal.querySelector('.modal-title');
    if (modalTitle) {
        modalTitle.textContent = `Automation Results: ${data.automation?.name || 'Automation'}`;
    }
    
    // Generate logs content
    let logsHtml = `
        <div class="logs-section">
            <div class="log-header">Status: <span class="log-status ${data.status}">${data.status}</span></div>
            <div class="log-message">${data.message || 'No message available'}</div>
        </div>
    `;
    
    // Show execution logs if available
    if (data.logs && data.logs.length > 0) {
        logsHtml += '<div class="logs-section"><h4>Execution Logs:</h4><div class="execution-logs">';
        data.logs.forEach(log => {
            logsHtml += `
                <div class="log-entry log-${log.level}">
                    <span class="log-timestamp">${new Date(log.timestamp).toLocaleTimeString()}</span>
                    <span class="log-level">${log.level.toUpperCase()}</span>
                    <span class="log-msg">${log.message}</span>
                </div>
            `;
        });
        logsHtml += '</div></div>';
    }
    
    // Show raw response if available
    if (data.raw_response) {
        logsHtml += `
            <div class="logs-section">
                <h4>Response Data:</h4>
                <pre class="response-data">${typeof data.raw_response === 'object' ? JSON.stringify(data.raw_response, null, 2) : data.raw_response}</pre>
            </div>
        `;
    }
    
    // Update modal content
    const modalContent = logsModal.querySelector('.modal-content');
    if (modalContent) {
        modalContent.innerHTML = logsHtml;
    }
    
    // Show the modal
    logsModal.style.display = 'block';
}

// Function to show datasource logs in modal
function showDatasourceLogs(data) {
    const logsModal = document.getElementById('automation-logs-modal');
    if (!logsModal) return;
    
    // Set modal title
    const modalTitle = logsModal.querySelector('.modal-title');
    if (modalTitle) {
        modalTitle.textContent = `Data Source Results: ${data.datasource?.name || 'Query'}`;
    }
    
    // Generate logs content
    let logsHtml = `
        <div class="logs-section">
            <div class="log-header">Status: <span class="log-status ${data.status}">${data.status}</span></div>
            <div class="log-message">${data.message || 'No message available'}</div>
        </div>
    `;
    
    // Show execution logs if available
    if (data.logs && data.logs.length > 0) {
        logsHtml += '<div class="logs-section"><h4>Execution Logs:</h4><div class="execution-logs">';
        data.logs.forEach(log => {
            logsHtml += `
                <div class="log-entry log-${log.level}">
                    <span class="log-timestamp">${new Date(log.timestamp).toLocaleTimeString()}</span>
                    <span class="log-level">${log.level.toUpperCase()}</span>
                    <span class="log-msg">${log.message}</span>
                </div>
            `;
        });
        logsHtml += '</div></div>';
    }
    
    // Show raw response if available
    if (data.raw_response) {
        logsHtml += `
            <div class="logs-section">
                <h4>Response Data:</h4>
                <pre class="response-data">${typeof data.raw_response === 'object' ? JSON.stringify(data.raw_response, null, 2) : data.raw_response}</pre>
            </div>
        `;
    }
    
    // Update modal content
    const modalContent = logsModal.querySelector('.modal-content');
    if (modalContent) {
        modalContent.innerHTML = logsHtml;
    }
    
    // Show the modal
    logsModal.style.display = 'block';
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
    .catch(error => {
        console.error('Error creating log entry:', error);
    });
}

// Function to load dashboards
function loadDashboards() {
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
            const dashboardsList = document.getElementById('dashboards-list');
            if (dashboardsList) {
                dashboardsList.innerHTML = '<div class="loading-error">Failed to load dashboards. Please try again.</div>';
            }
        });
}

// Function to update recommended dashboards
function updateRecommendedDashboards(dashboards) {
    const recommendationsContainer = document.getElementById('recommended-dashboards');
    if (!recommendationsContainer) return;
    
    if (dashboards.length === 0) {
        recommendationsContainer.innerHTML = '<div class="empty-recommendations">No recommended dashboards for this incident.</div>';
        return;
    }
    
    let html = '';
    dashboards.forEach(dashboard => {
        html += `
            <div class="dashboard-item">
                <div class="dashboard-icon"><i class="icon-bar-chart-2"></i></div>
                <div class="dashboard-info">
                    <div class="dashboard-name">${dashboard.name}</div>
                    <a href="${dashboard.link}" target="_blank" class="dashboard-link">Open Dashboard</a>
                </div>
            </div>
        `;
    });
    
    recommendationsContainer.innerHTML = html;
}

// Function to render dashboards list
function renderDashboardsList(dashboards) {
    const dashboardsList = document.getElementById('dashboards-list');
    if (!dashboardsList) return;
    
    if (dashboards.length === 0) {
        dashboardsList.innerHTML = '<div class="empty-dashboards">No dashboards available.</div>';
        return;
    }
    
    let html = '';
    dashboards.forEach(dashboard => {
        html += `
            <div class="dashboard-item">
                <div class="dashboard-icon"><i class="icon-bar-chart-2"></i></div>
                <div class="dashboard-info">
                    <div class="dashboard-name">${dashboard.name}</div>
                    <div class="dashboard-description">${dashboard.description}</div>
                    <a href="${dashboard.link}" target="_blank" class="dashboard-link">Open Dashboard</a>
                </div>
            </div>
        `;
    });
    
    dashboardsList.innerHTML = html;
}

// Function to load logs
function loadLogs() {
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
            const logsList = document.getElementById('logs-list');
            if (logsList) {
                logsList.innerHTML = '<div class="loading-error">Failed to load logs. Please try again.</div>';
            }
        });
}

// Function to render logs list
function renderLogsList(logs) {
    const logsList = document.getElementById('logs-list');
    if (!logsList) return;
    
    if (logs.length === 0) {
        logsList.innerHTML = '<div class="empty-logs">No logs available.</div>';
        return;
    }
    
    // Sort logs by timestamp (newest first)
    logs.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
    
    // Take only the latest 50 logs to avoid overwhelming the UI
    logs = logs.slice(0, 50);
    
    let html = '';
    logs.forEach(log => {
        const timestamp = new Date(log.timestamp).toLocaleString();
        html += `
            <div class="log-item log-${log.level}">
                <div class="log-level">${log.level.toUpperCase()}</div>
                <div class="log-source">${log.source}</div>
                <div class="log-message">${log.message}</div>
                <div class="log-timestamp">${timestamp}</div>
            </div>
        `;
    });
    
    logsList.innerHTML = html;
}

// Function to set up all modals
function setupModals() {
    // Close buttons for all modals
    document.querySelectorAll('.close-modal').forEach(closeBtn => {
        closeBtn.addEventListener('click', function() {
            const modal = this.closest('.modal');
            if (modal) {
                modal.style.display = 'none';
            }
        });
    });
    
    // Close modal when clicking outside
    window.addEventListener('click', function(event) {
        document.querySelectorAll('.modal').forEach(modal => {
            if (event.target === modal) {
                modal.style.display = 'none';
            }
        });
    });
    
    // Set up document upload form
    const uploadForm = document.getElementById('upload-form');
    if (uploadForm) {
        uploadForm.addEventListener('submit', function(event) {
            event.preventDefault();
            
            const formData = new FormData(this);
            const statusDiv = document.getElementById('upload-status');
            
            if (statusDiv) {
                statusDiv.innerHTML = '<div>Uploading document...</div>';
            }
            
            fetch('/api/documents/', {
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
                if (statusDiv) {
                    statusDiv.innerHTML = '<div class="success">Document uploaded successfully!</div>';
                }
                
                // Clear the file input
                this.reset();
                
                // Close the modal after a delay
                setTimeout(() => {
                    const modal = document.getElementById('upload-modal');
                    if (modal) {
                        modal.style.display = 'none';
                    }
                    
                    // Reload the documents list
                    loadDocuments();
                }, 1500);
            })
            .catch(error => {
                console.error('Error uploading document:', error);
                if (statusDiv) {
                    statusDiv.innerHTML = '<div class="error">Failed to upload document. Please try again.</div>';
                }
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
            
            // Show a loading indication in the submit button
            const submitBtn = this.querySelector('button[type="submit"]');
            if (submitBtn) {
                const originalBtnText = submitBtn.textContent;
                submitBtn.textContent = 'Updating...';
                submitBtn.disabled = true;
                
                // Call the update function and handle the Promise result
                updateIncidentStatus(incidentId, newStatus, comments)
                    .then(() => {
                        // Only close the modal on success
                        statusModal.style.display = 'none';
                        
                        // Clear the comments field for next time
                        document.getElementById('status-comments').value = '';
                        
                        // Show success notification
                        showNotification('Incident updated successfully', 'success');
                    })
                    .catch(error => {
                        console.error('Error updating incident:', error);
                        
                        // Show error message in the modal
                        const errorMsg = document.createElement('div');
                        errorMsg.className = 'status-update-error';
                        errorMsg.textContent = 'Failed to update incident. Please try again.';
                        errorMsg.style.color = 'red';
                        errorMsg.style.marginBottom = '10px';
                        
                        // Add the error message before the form actions
                        const formActions = this.querySelector('.form-actions');
                        if (formActions) {
                            formActions.insertAdjacentElement('beforebegin', errorMsg);
                            
                            // Remove error message after 3 seconds
                            setTimeout(() => {
                                if (errorMsg.parentNode) {
                                    errorMsg.parentNode.removeChild(errorMsg);
                                }
                            }, 3000);
                        }
                    })
                    .finally(() => {
                        // Reset button state regardless of outcome
                        submitBtn.textContent = originalBtnText;
                        submitBtn.disabled = false;
                    });
            } else {
                // Fallback if button isn't found
                updateIncidentStatus(incidentId, newStatus, comments)
                    .then(() => {
                        statusModal.style.display = 'none';
                        document.getElementById('status-comments').value = '';
                    })
                    .catch(error => console.error('Error updating incident:', error));
            }
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
                const commentsTextarea = document.getElementById('status-comments');
                if (commentsTextarea) {
                    commentsTextarea.value = '';
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
            method: 'POST',
            headers: {
                'X-CSRFToken': getCSRFToken()
            }
        });
        
        if (response.ok) {
            await loadConversations();
            
            // Clear chat messages area
            const chatMessages = document.getElementById('chat-messages');
            if (chatMessages) {
                chatMessages.innerHTML = '';
            }
            
            // Show notification
            showNotification('All conversations cleared successfully', 'success');
        } else {
            showNotification('Failed to clear conversations', 'error');
        }
    } catch (error) {
        console.error('Error clearing conversations:', error);
        showNotification('Failed to clear conversations', 'error');
    }
}

// Function to clear all documents
async function clearAllDocuments() {
    if (!confirm('Are you sure you want to delete all documents? This action cannot be undone.')) {
        return;
    }
    
    try {
        const response = await fetch('/api/documents/clear/', {
            method: 'POST',
            headers: {
                'X-CSRFToken': getCSRFToken()
            }
        });
        
        if (response.ok) {
            await loadDocuments();
            showNotification('All documents cleared successfully', 'success');
        } else {
            showNotification('Failed to clear documents', 'error');
        }
    } catch (error) {
        console.error('Error clearing documents:', error);
        showNotification('Failed to clear documents', 'error');
    }
}

// Function to load knowledge base entries
async function loadKnowledgeBase() {
    const kbList = document.getElementById('knowledge-base-list');
    if (!kbList) return;
    
    try {
        const response = await fetch('/api/knowledge-base/');
        if (!response.ok) {
            throw new Error('Network response was not ok');
        }
        const entries = await response.json();
        renderKnowledgeBaseList(entries);
    } catch (error) {
        console.error('Error loading knowledge base:', error);
        kbList.innerHTML = '<div class="loading-error">Failed to load knowledge base. Please try again.</div>';
    }
}

// Function to render knowledge base entries
function renderKnowledgeBaseList(entries) {
    const kbList = document.getElementById('knowledge-base-list');
    if (!kbList) return;
    
    if (entries.length === 0) {
        kbList.innerHTML = '<div class="empty-kb">No knowledge base entries available.</div>';
        return;
    }
    
    let html = '';
    entries.forEach(entry => {
        html += `
            <div class="kb-item">
                <div class="kb-title" onclick="viewKnowledgeBaseEntry('${entry.id}')">${entry.title}</div>
                <div class="kb-category">${entry.category || 'Uncategorized'}</div>
                <div class="kb-actions">
                    <button onclick="editKnowledgeBaseEntry('${entry.id}')" class="btn-small">Edit</button>
                    <button onclick="deleteKnowledgeBaseEntry('${entry.id}')" class="btn-small btn-danger">Delete</button>
                </div>
            </div>
        `;
    });
    
    kbList.innerHTML = html;
}

// Function to create a new knowledge base entry
async function createKnowledgeBaseEntry() {
    const kbModal = document.getElementById('knowledge-base-modal');
    if (!kbModal) return;
    
    // Clear the form for a new entry
    const form = document.getElementById('knowledge-base-form');
    if (form) {
        form.reset();
        form.dataset.mode = 'create';
        form.dataset.id = '';
    }
    
    // Update modal title
    const modalTitle = kbModal.querySelector('.modal-title');
    if (modalTitle) {
        modalTitle.textContent = 'Create Knowledge Base Entry';
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
        
        // Show modal with entry data
        const kbModal = document.getElementById('knowledge-base-modal');
        if (!kbModal) return;
        
        // Set form fields
        const form = document.getElementById('knowledge-base-form');
        if (form) {
            const titleInput = form.querySelector('input[name="title"]');
            const contentInput = form.querySelector('textarea[name="content"]');
            const categoryInput = form.querySelector('input[name="category"]');
            
            if (titleInput) titleInput.value = entry.title;
            if (contentInput) contentInput.value = entry.content;
            if (categoryInput) categoryInput.value = entry.category || '';
            
            form.dataset.mode = 'edit';
            form.dataset.id = entry.id;
        }
        
        // Update modal title
        const modalTitle = kbModal.querySelector('.modal-title');
        if (modalTitle) {
            modalTitle.textContent = 'Edit Knowledge Base Entry';
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
        
        // Show view modal
        const viewModal = document.getElementById('kb-view-modal');
        if (!viewModal) return;
        
        // Set content
        const title = viewModal.querySelector('.kb-view-title');
        const content = viewModal.querySelector('.kb-view-content');
        const category = viewModal.querySelector('.kb-view-category');
        
        if (title) title.textContent = entry.title;
        if (content) content.innerHTML = entry.content.replace(/\n/g, '<br>');
        if (category) category.textContent = entry.category || 'Uncategorized';
        
        // Show the modal
        viewModal.style.display = 'block';
    } catch (error) {
        console.error('Error fetching knowledge base entry:', error);
        showNotification('Failed to load knowledge base entry', 'error');
    }
}

// Function to save a knowledge base entry
async function saveKnowledgeBaseEntry(form) {
    const formData = new FormData(form);
    const data = {
        title: formData.get('title'),
        content: formData.get('content'),
        category: formData.get('category')
    };
    
    const mode = form.dataset.mode;
    const id = form.dataset.id;
    
    try {
        let url = '/api/knowledge-base/';
        let method = 'POST';
        
        if (mode === 'edit' && id) {
            url = `/api/knowledge-base/${id}/`;
            method = 'PUT';
        }
        
        const response = await fetch(url, {
            method: method,
            headers: {
                'Content-Type': 'application/json',
                'X-CSRFToken': getCSRFToken()
            },
            body: JSON.stringify(data)
        });
        
        if (!response.ok) {
            throw new Error('Failed to save knowledge base entry');
        }
        
        // Close modal
        const modal = document.getElementById('knowledge-base-modal');
        if (modal) {
            modal.style.display = 'none';
        }
        
        // Reload knowledge base
        await loadKnowledgeBase();
        
        // Show notification
        showNotification('Knowledge base entry saved successfully', 'success');
    } catch (error) {
        console.error('Error saving knowledge base entry:', error);
        showNotification('Failed to save knowledge base entry', 'error');
    }
}

// Function to delete a knowledge base entry
async function deleteKnowledgeBaseEntry(id) {
    if (!confirm('Are you sure you want to delete this knowledge base entry? This action cannot be undone.')) {
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
        
        // Reload knowledge base
        await loadKnowledgeBase();
        
        // Show notification
        showNotification('Knowledge base entry deleted successfully', 'success');
    } catch (error) {
        console.error('Error deleting knowledge base entry:', error);
        showNotification('Failed to delete knowledge base entry', 'error');
    }
}

// Toggle knowledge base visibility
function toggleKnowledgeBase() {
    const kbSection = document.getElementById('knowledge-base-section');
    if (kbSection) {
        const isHidden = kbSection.style.display === 'none';
        kbSection.style.display = isHidden ? 'block' : 'none';
        
        // Update toggle button text
        const toggleBtn = document.getElementById('toggle-kb-btn');
        if (toggleBtn) {
            toggleBtn.textContent = isHidden ? 'Hide Knowledge Base' : 'Show Knowledge Base';
        }
    }
}

// Initialize everything when DOM is loaded
document.addEventListener('DOMContentLoaded', function() {
    // Load data
    loadConversations();
    loadDocuments();
    loadIncidents();
    loadAutomations();
    loadDashboards();
    loadLogs();
    loadKnowledgeBase();
    
    // Set up form submissions
    const chatForm = document.getElementById('chat-form');
    if (chatForm) {
        chatForm.addEventListener('submit', handleChatSubmit);
    }
    
    // Set up knowledge base form
    const kbForm = document.getElementById('knowledge-base-form');
    if (kbForm) {
        kbForm.addEventListener('submit', function(event) {
            event.preventDefault();
            saveKnowledgeBaseEntry(this);
        });
    }
    
    // Set up event handlers for UI controls
    const newChatBtn = document.getElementById('new-chat-btn');
    if (newChatBtn) {
        newChatBtn.addEventListener('click', createNewChat);
    }
    
    const renameChatBtn = document.getElementById('rename-chat-btn');
    if (renameChatBtn) {
        renameChatBtn.addEventListener('click', renameCurrentChat);
    }
    
    const deleteChatBtn = document.getElementById('delete-chat-btn');
    if (deleteChatBtn) {
        deleteChatBtn.addEventListener('click', deleteCurrentChat);
    }
    
    const newKbBtn = document.getElementById('new-kb-btn');
    if (newKbBtn) {
        newKbBtn.addEventListener('click', createKnowledgeBaseEntry);
    }
    
    const toggleKbBtn = document.getElementById('toggle-kb-btn');
    if (toggleKbBtn) {
        toggleKbBtn.addEventListener('click', toggleKnowledgeBase);
    }
    
    // Set up modals
    setupModals();
    
    // Poll for updates every 30 seconds
    setInterval(() => {
        loadIncidents();
        loadLogs();
    }, 30000);
});