// Chat.js - Main JavaScript file for the Wells Fargo AI Platform Support Assistant

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
        if (response.ok) {
            const conversations = await response.json();
            const conversationsList = document.querySelector('.conversations-list');
            if (!conversationsList) return;

            conversationsList.innerHTML = conversations.map(conv => `
                <div class="conversation-item" data-id="${conv.id}">
                    <i data-feather="message-square"></i>
                    <span class="conversation-title">${conv.title}</span>
                </div>
            `).join('');

            // Re-initialize Feather icons
            if (window.feather) {
                feather.replace();
            }

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
        const response = await fetch(`/api/conversations/${conversationId}/messages/`);
        if (response.ok) {
            const messages = await response.json();

            // Update active conversation
            document.querySelectorAll('.conversation-item').forEach(item => {
                item.classList.remove('active');
                if (item.dataset.id === conversationId) {
                    item.classList.add('active');
                }
            });

            // Display messages
            displayMessages(messages);
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

// Function to delete current chat
async function deleteCurrentChat() {
    const activeChat = document.querySelector('.conversation-item.active');
    if (!activeChat) return;

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
    const message = input.value.trim();
    if (!message) return;

    const activeChat = document.querySelector('.conversation-item.active');
    if (!activeChat) {
        alert('Please select or create a conversation first');
        return;
    }

    try {
        const response = await fetch(`/api/conversations/${activeChat.dataset.id}/messages/`, {
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
            input.value = '';
        }
    } catch (error) {
        console.error('Error sending message:', error);
    }
}

// Initialize event listeners when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    // Load initial conversations
    loadConversations();

    // Set up form submission handler
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
});


async function loadDocuments() {
    const documentsList = document.getElementById('documents-list');
    if (!documentsList) return;
    
    fetch('/api/documents/')
        .then(response => {
            if (!response.ok) {
                throw new Error('Network response was not ok');
            }
            return response.json();
        })
        .then(documents => {
            renderDocumentsList(documents);
        })
        .catch(error => {
            console.error('Error loading documents:', error);
            documentsList.innerHTML = '<div class="loading-error">Failed to load documents. Please try again.</div>';
        });
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
        html += `
            <div class="document-item">
                <div class="document-title">${document.title}</div>
                <div class="document-type">${document.file_type}</div>
                <div class="document-date">${new Date(document.uploaded_at).toLocaleDateString()}</div>
                <button class="delete-btn" onclick="deleteDocument('${document.id}')">Delete</button>
            </div>
        `;
    });
    
    documentsList.innerHTML = html;
}

// Function to delete a document
function deleteDocument(documentId) {
    if (!confirm('Are you sure you want to delete this document?')) {
        return;
    }
    
    fetch(`/api/documents/${documentId}/`, {
        method: 'DELETE',
        headers: {
            'X-CSRFToken': getCSRFToken()
        }
    })
    .then(response => {
        if (!response.ok) {
            throw new Error('Network response was not ok');
        }
        
        // Reload the documents list
        loadDocuments();
    })
    .catch(error => {
        console.error('Error deleting document:', error);
        alert('Failed to delete document. Please try again.');
    });
}

// Function to render the incidents list
function renderIncidentsList(incidents) {
    const incidentsList = document.getElementById('incidents-list');
    if (!incidentsList) return;
    
    if (incidents.length === 0) {
        incidentsList.innerHTML = '<div class="loading-incidents">No incidents available.</div>';
        return;
    }
    
    // Sort incidents by severity and status
    // Critical/High severity open incidents first, then medium, then low
    incidents.sort((a, b) => {
        // First sort by status (open > in-progress > resolved)
        const statusOrder = { 'open': 0, 'in-progress': 1, 'resolved': 2 };
        const statusA = statusOrder[a.status.toLowerCase().replace(' ', '-')] || 99;
        const statusB = statusOrder[b.status.toLowerCase().replace(' ', '-')] || 99;
        
        if (statusA !== statusB) return statusA - statusB;
        
        // Then by severity (high > medium > low)
        const severityOrder = { 'high': 0, 'medium': 1, 'low': 2 };
        const sevA = severityOrder[a.severity.toLowerCase()] || 99;
        const sevB = severityOrder[b.severity.toLowerCase()] || 99;
        
        if (sevA !== sevB) return sevA - sevB;
        
        // Finally by creation date (newest first)
        return new Date(b.created_at) - new Date(a.created_at);
    });
    
    let html = '';
    incidents.forEach(incident => {
        const severityClass = incident.severity.toLowerCase();
        const statusClass = incident.status.toLowerCase().replace(' ', '-');
        
        html += `
            <div class="incident-item" data-id="${incident.id}" onclick="showIncidentDetails(${JSON.stringify(incident).replace(/"/g, '&quot;')}); highlightIncident(this);">
                <div class="incident-severity ${severityClass}">${incident.severity}</div>
                <div class="incident-title">${incident.title}</div>
                <div class="incident-status ${statusClass}">${incident.status}</div>
                <div class="incident-time">${new Date(incident.created_at).toLocaleString()}</div>
            </div>
        `;
    });
    
    incidentsList.innerHTML = html;
}

// Function to show incident details when clicked
function showIncidentDetails(incident) {
    const detailsContainer = document.getElementById('incident-details');
    if (!detailsContainer) return;
    
    // Store current incident ID for status updates
    window.currentIncidentId = incident.id;
    
    // Format the date
    const createdDate = new Date(incident.created_at).toLocaleString();
    const updatedDate = new Date(incident.updated_at).toLocaleString();
    
    // Generate impact summary
    const impactSummary = getIncidentImpactSummary(incident);
    
    // Create the HTML for the incident details
    let html = `
        <h3>${incident.title}</h3>
        <div class="incident-detail-row">
            <div class="incident-severity ${incident.severity.toLowerCase()}">${incident.severity}</div>
            <div class="incident-status ${incident.status.toLowerCase().replace(' ', '-')}">${incident.status}</div>
        </div>
        <div class="incident-description">${incident.description}</div>
        <div class="incident-impact">${impactSummary}</div>
        <div class="incident-timestamps">
            <div>Created: ${createdDate}</div>
            <div>Last Updated: ${updatedDate}</div>
        </div>
    `;
    
    // Add comments section if available
    if (incident.comments) {
        html += `
            <div class="incident-comments">
                <h4>Comments:</h4>
                <div class="comments-content">${incident.comments}</div>
            </div>
        `;
    }
    
    // Add status update controls
    html += `
        <div id="incident-status-controls" class="incident-status-update" style="display: flex;">
            <label for="status-select">Status:</label>
            <select id="status-select" class="status-select">
                <option value="open">Open</option>
                <option value="in-progress">In Progress</option>
                <option value="resolved">Resolved</option>
            </select>
            <button id="update-status-btn" class="update-status-btn">Update</button>
        </div>
    `;
    
    // Get the newly created status controls
    detailsContainer.innerHTML = html;
    
    const statusSelect = document.getElementById('status-select');
    
    // Set current status as selected
    if (statusSelect) {
        console.log("Found status select:", statusSelect);
        // Convert status to lowercase and replace spaces with hyphens to match option values
        const currentStatus = incident.status.toLowerCase().replace(' ', '-');
        
        // Find and select the matching option
        for (let i = 0; i < statusSelect.options.length; i++) {
            if (statusSelect.options[i].value === currentStatus) {
                statusSelect.selectedIndex = i;
                break;
            }
        }
    }
    
    // Set up event listener for the update button
    const updateButton = document.getElementById('update-status-btn');
    if (updateButton) {
        // Remove previous event listeners by cloning and replacing
        const newUpdateBtn = updateButton.cloneNode(true);
        updateButton.parentNode.replaceChild(newUpdateBtn, updateButton);
        
        // Add new event listener
        newUpdateBtn.addEventListener('click', () => {
            const newStatus = document.getElementById('status-select').value;
            
            // Store the current incident ID and status in the form for later use
            const statusModal = document.getElementById('status-update-modal');
            statusModal.dataset.incidentId = currentIncidentId;
            statusModal.dataset.newStatus = newStatus;
            
            // Show the comments modal
            statusModal.style.display = 'block';
        });
    }
    
    // Fetch incident details with recommendations
    fetch(`/api/incidents/${incident.id}/`)
        .then(response => {
            if (!response.ok) {
                throw new Error('Network response was not ok');
            }
            return response.json();
        })
        .then(data => {
            // Update recommendations based on incident
            updateRecommendedAutomations(data.recommended_automations || []);
            updateRecommendedDashboards(data.recommended_dashboards || []);
        })
        .catch(error => {
            console.error('Error fetching incident recommendations:', error);
        });
    
    // We keep the incidents overview visible
}

// Helper function to generate impact summary based on incident severity and status
function getIncidentImpactSummary(incident) {
    if (incident.severity === 'high' && incident.status === 'open') {
        return 'This incident requires immediate attention as it may be causing significant service disruption.';
    } else if (incident.severity === 'high' && incident.status === 'resolved') {
        return 'This critical incident has been resolved. A post-mortem analysis is recommended.';
    } else if (incident.severity === 'medium') {
        return 'This incident has moderate impact on services and should be addressed promptly.';
    } else if (incident.severity === 'low') {
        return 'This is a low-impact incident that should be monitored but is not causing significant issues.';
    } else {
        return 'Monitor this incident for any changes or escalations that may require attention.';
    }
}

function highlightIncident(element) {
    // Remove highlight from other incidents
    document.querySelectorAll('.incident-item').forEach(item => {
        item.style.backgroundColor = 'white';
    });
    // Highlight clicked incident
    element.style.backgroundColor = '#f0f0f0';
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

function updateIncidentsSummary(incidents) {
    const summaryContainer = document.getElementById('incident-summary');
    if (!summaryContainer) return;
    
    // Count incidents by status and severity
    let openIncidents = incidents.filter(inc => inc.status === 'open').length;
    let inProgressIncidents = incidents.filter(inc => inc.status === 'in-progress').length;
    let resolvedIncidents = incidents.filter(inc => inc.status === 'resolved').length;
    let highSeverityIncidents = incidents.filter(inc => inc.severity === 'high').length;
    
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

// Update loadIncidents function to include summary
function loadIncidents() {
    const incidentsList = document.getElementById('incidents-list');
    if (!incidentsList) return;
    
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
        })
        .catch(error => {
            console.error('Error loading incidents:', error);
            incidentsList.innerHTML = '<div class="loading-incidents">Failed to load incidents. Please try again.</div>';
        });
}

// Function to load automations for the recommendations column
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
            automationsList.innerHTML = '<div class="loading-automations">Failed to load automations. Please try again.</div>';
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

// Function to load dashboards for the recommendations column
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
            dashboardsList.innerHTML = '<div class="loading-dashboards">Failed to load dashboards. Please try again.</div>';
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
            logsList.innerHTML = '<div class="loading-logs">Failed to load logs. Please try again.</div>';
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