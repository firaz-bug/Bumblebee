"""
Automation service for handling automation commands and executing API calls.
"""
import json
import os
import requests
import logging
import uuid
from datetime import datetime
from django.conf import settings
from ..models import Automation

# Setup logging
logger = logging.getLogger(__name__)

class AutomationService:
    """
    Service for handling automation commands and executing automations.
    """
    
    def __init__(self):
        """Initialize the automation service."""
        # Flag to indicate whether default automations have been initialized
        self.initialized = False
        # We'll initialize default automations when first needed, not at startup
        # This prevents database access errors during migration
    
    def _initialize_default_automations(self):
        """Initialize default automations in the database."""
        default_automations = [
            {
                "name": "Weather Check",
                "description": "Get the current weather for a given location",
                "endpoint": "https://api.openweathermap.org/data/2.5/weather",
                "parameters": {
                    "q": "Required - City name",
                    "appid": "API key from environment",
                    "units": "metric"
                }
            },
            {
                "name": "Send Email",
                "description": "Send an email notification",
                "endpoint": "/api/send_email",
                "parameters": {
                    "to": "Required - Recipient email",
                    "subject": "Required - Email subject",
                    "body": "Required - Email body"
                }
            },
            {
                "name": "Create Task",
                "description": "Create a new task in task management system",
                "endpoint": "/api/create_task",
                "parameters": {
                    "title": "Required - Task title",
                    "description": "Task description",
                    "due_date": "Due date (YYYY-MM-DD)",
                    "priority": "Priority (low, medium, high)"
                }
            }
        ]
        
        # Add default automations if they don't exist
        for auto in default_automations:
            Automation.objects.get_or_create(
                name=auto["name"],
                defaults={
                    "description": auto["description"],
                    "endpoint": auto["endpoint"],
                    "parameters": auto["parameters"]
                }
            )
    
    def handle_automation_command(self, message):
        """
        Handle @automation command.
        
        Args:
            message: User message containing the @automation command
            
        Returns:
            str: Response to the automation command
        """
        try:
            # Initialize default automations if not done already
            if not self.initialized:
                try:
                    self._initialize_default_automations()
                    self.initialized = True
                except Exception as e:
                    logger.error(f"Error initializing automations: {str(e)}")
                    return "Automation service is not available at the moment. Please try again later."
            
            # Check if it's a general automation inquiry
            if message.strip().lower() == '@automation':
                return self._list_automations()
            
            # Check if it's a specific automation request
            if '@automation' in message.lower():
                # Extract automation name from message
                after_command = message.lower().split('@automation', 1)[1].strip()
                
                # If empty or just asking for help
                if not after_command or after_command in ['help', '?']:
                    return self._list_automations()
                
                # Try to find automation by name
                automations = Automation.objects.all()
                matching_automation = None
                
                for auto in automations:
                    if auto.name.lower() in after_command.lower():
                        matching_automation = auto
                        break
                
                if matching_automation:
                    # Found a matching automation
                    return self._describe_automation(matching_automation, after_command)
                else:
                    # No matching automation found
                    return f"I couldn't find an automation matching '{after_command}'.\n\n{self._list_automations()}"
            
            return "I'm not sure what automation you're referring to. Use @automation to see available automations."
            
        except Exception as e:
            logger.error(f"Error handling automation command: {str(e)}")
            return "I encountered an error while processing your automation request. Please try again."
    
    def _list_automations(self):
        """
        List all available automations.
        
        Returns:
            str: Formatted list of available automations
        """
        # Initialize default automations if not done already
        if not self.initialized:
            try:
                self._initialize_default_automations()
                self.initialized = True
            except Exception as e:
                logger.error(f"Error initializing automations: {str(e)}")
                return "Automation service is not available at the moment. Please try again later."
                
        try:
            automations = Automation.objects.all()
            
            if not automations.exists():
                return "No automations are currently available. Please check back later."
            
            response = "Available automations:\n\n"
            
            for auto in automations:
                response += f"- **{auto.name}**: {auto.description}\n"
            
            response += "\nTo use an automation, type '@automation <name>' for more details."
            
            return response
            
        except Exception as e:
            logger.error(f"Error listing automations: {str(e)}")
            return "Failed to list automations due to an error. Please try again later."
    
    def _describe_automation(self, automation, message):
        """
        Describe a specific automation and parse parameters from message.
        
        Args:
            automation: Automation object
            message: User message that may contain parameters
            
        Returns:
            str: Automation description and parameter guidance or execution result
        """
        # Check if message contains explicit parameters
        contains_explicit_parameters = any(f"{param}=" in message for param in automation.parameters.keys())
        
        # Always attempt to execute the automation, even without parameters
        # But first check if the user is just asking for information about the automation
        if "help" in message.lower() or "info" in message.lower() or "describe" in message.lower() or "?" in message:
            # Just describe the automation without executing
            response = f"**{automation.name}**\n{automation.description}\n\nParameters:\n"
            
            for param, description in automation.parameters.items():
                response += f"- {param}: {description}\n"
            
            response += "\nTo execute this automation, you can provide parameters. For example:\n"
            example_params = {}
            for param, desc in automation.parameters.items():
                if "Required" in desc:
                    if "email" in param.lower():
                        example_params[param] = "example@example.com"
                    elif "city" in param.lower() or "location" in param.lower():
                        example_params[param] = "London"
                    elif "title" in param.lower():
                        example_params[param] = "My Task Title"
                    elif "subject" in param.lower():
                        example_params[param] = "Meeting Reminder"
                    else:
                        example_params[param] = f"<your {param}>"
            
            example = f"@automation {automation.name}"
            for param, value in example_params.items():
                example += f" {param}={value}"
            
            response += f"`{example}`"
            
            return response
        
        # Try to extract parameters
        params = {}
        for param in automation.parameters.keys():
            # Look for param=value pattern
            if f"{param}=" in message:
                parts = message.split(f"{param}=", 1)[1]
                # Extract until next parameter or end of message
                value = ""
                for part in parts.split():
                    if "=" in part and part.split("=")[0] in automation.parameters:
                        break
                    value += f"{part} "
                
                params[param] = value.strip()
        
        # Parameters are optional - we'll show a warning but still proceed
        missing_params = []
        for param, desc in automation.parameters.items():
            if "Required" in desc and param not in params:
                missing_params.append(param)
        
        # Log a warning but proceed with the call
        if missing_params:
            warnings = f"Note: Some recommended parameters for {automation.name} are missing: {', '.join(missing_params)}"
            logger.warning(warnings)
        
        # Execute the automation with the correct call type
        execution_result = self.execute_automation(
            endpoint=automation.endpoint,
            param_schema=automation.parameters,
            params=params,
            call_type=automation.call_type,  # Use the automation's call_type (GET/POST)
            automation_info={
                'name': automation.name,
                'description': automation.description
            }
        )
        
        # Return a structured response with logs for modals
        automation_info = {
            'name': automation.name,
            'id': str(automation.id),
            'endpoint': automation.endpoint,
            'call_type': automation.call_type,
            'description': automation.description
        }
        
        # Create a log entry in the database
        from ..models import Log
        Log.objects.create(
            message=f"Automation execution: {automation.name} - {execution_result.get('message', 'No details')}",
            level="info" if execution_result.get('status', '') == 'success' else "error",
            source="automation_service"
        )
        
        # If it's already a structured response, just ensure it has all required fields
        if isinstance(execution_result, dict):
            # Ensure the result has all expected fields for the frontend
            if 'automation' not in execution_result:
                execution_result['automation'] = automation_info
            if 'status' not in execution_result:
                execution_result['status'] = 'success'
            if 'logs' not in execution_result:
                execution_result['logs'] = []
            
            # Return the formatted result for chat display
            formatted_message = ""
            if execution_result.get('status') == 'success':
                formatted_message = f"**{automation.name}** execution result:\n\n✅ {execution_result.get('message', 'Execution completed successfully')}"
            else:
                formatted_message = f"**{automation.name}** execution result:\n\n❌ {execution_result.get('message', 'Execution failed')}"
            
            execution_result['formatted_message'] = formatted_message
            return execution_result
        
        # Create a structured response for string or other types
        else:
            message = str(execution_result) if execution_result else "Execution completed successfully"
            formatted_message = f"**{automation.name}** execution result:\n\n{message}"
            
            return {
                'automation': automation_info,
                'status': 'success',
                'message': message,
                'formatted_message': formatted_message,
                'logs': [{
                    'timestamp': datetime.now().isoformat(),
                    'level': 'info',
                    'message': f"Automation {automation.name} executed"
                }],
                'raw_response': execution_result
            }
    
    def execute_automation(self, endpoint, param_schema, params, call_type='POST', automation_info=None):
        """
        Execute an automation by calling the specified endpoint.
        
        Args:
            endpoint: API endpoint for the automation
            param_schema: Parameter schema with descriptions
            params: Actual parameters to use
            call_type: HTTP method to use for the call (GET or POST)
            automation_info: Dict with information about the automation for logs
            
        Returns:
            dict: Structured result of the automation execution containing:
                - status: 'success' or 'error'
                - message: Human-readable message
                - logs: List of log entries with timestamp, level, and message
                - raw_response: Raw API response data if available
                - automation: Information about the executed automation
        """
        # Initialize result structure
        result = {
            'status': 'error',
            'message': 'Failed to execute automation',
            'logs': [],
            'raw_response': None,
            'automation': automation_info or {}
        }
        
        # Add initial log entry
        timestamp = datetime.now().isoformat()
        result['logs'].append({
            'timestamp': timestamp,
            'level': 'info',
            'message': f"Starting automation execution for endpoint: {endpoint}"
        })
        
        try:
            # Log the execution attempt
            logger.info(f"Executing automation with endpoint: {endpoint}, call_type: {call_type}")
            result['logs'].append({
                'timestamp': datetime.now().isoformat(),
                'level': 'info',
                'message': f"Call type: {call_type}, Parameters: {params}"
            })
            
            # For external endpoints (starting with http)
            if endpoint.startswith(('http://', 'https://')):
                # For weather API as an example
                if "openweathermap" in endpoint:
                    # Get API key from environment
                    api_key = params.get('appid') or os.getenv('OPENWEATHER_API_KEY', 'demo_key')
                    
                    # Make actual API call - always use GET for weather API
                    response = requests.get(endpoint, params={
                        'q': params.get('q', 'London'),
                        'appid': api_key,
                        'units': params.get('units', 'metric')
                    })
                    
                    if response.status_code == 200:
                        data = response.json()
                        weather = data.get('weather', [{}])[0].get('description', 'unknown')
                        temp = data.get('main', {}).get('temp', 'unknown')
                        location = data.get('name', params.get('q', 'unknown location'))
                        
                        return {
                            "status": "success",
                            "message": f"Weather in {location}: {weather}, Temperature: {temp}°C",
                            "raw_response": data
                        }
                    else:
                        return {
                            "status": "error",
                            "message": f"Weather API returned an error: {response.status_code}",
                            "raw_response": response.text
                        }
                
                # Generic external API call
                try:
                    if call_type.upper() == 'GET':
                        response = requests.get(endpoint, params=params)
                    else:  # Default to POST
                        response = requests.post(endpoint, json=params)
                    
                    # Try to parse JSON response
                    try:
                        json_data = response.json()
                        return {
                            "status": "success" if response.status_code < 400 else "error",
                            "message": f"API response (status {response.status_code})",
                            "raw_response": json_data
                        }
                    except ValueError:
                        # Not a JSON response
                        return {
                            "status": "success" if response.status_code < 400 else "error",
                            "message": f"API response (status {response.status_code})",
                            "raw_response": response.text
                        }
                except Exception as e:
                    logger.error(f"Failed to call external API: {str(e)}")
                    return {
                        "status": "error",
                        "message": f"Failed to call external API: {str(e)}",
                        "raw_response": None
                    }
            
            # For internal endpoints
            if endpoint == "/api/send_email":
                to = params.get('to', '')
                subject = params.get('subject', '')
                body = params.get('body', '')
                
                if not all([to, subject, body]):
                    return {
                        "status": "error",
                        "message": "Missing required parameters for sending email.",
                        "raw_response": None
                    }
                
                # In a real app, this would call an email sending service
                return {
                    "status": "success",
                    "message": f"Email would be sent to {to} with subject '{subject}'",
                    "raw_response": {
                        "to": to,
                        "subject": subject,
                        "body_preview": body[:50] + "..." if len(body) > 50 else body,
                        "timestamp": datetime.now().isoformat()
                    }
                }
            
            elif endpoint == "/api/create_task":
                title = params.get('title', '')
                description = params.get('description', '')
                due_date = params.get('due_date', 'Not specified')
                priority = params.get('priority', 'medium')
                
                if not title:
                    return {
                        "status": "error",
                        "message": "Missing required title parameter for creating task.",
                        "raw_response": None
                    }
                
                # In a real app, this would create a task in a task management system
                return {
                    "status": "success",
                    "message": f"Task '{title}' would be created with priority '{priority}' and due date '{due_date}'",
                    "raw_response": {
                        "task_id": str(uuid.uuid4()),
                        "title": title,
                        "description": description,
                        "due_date": due_date,
                        "priority": priority,
                        "created_at": datetime.now().isoformat()
                    }
                }
            
            # System maintenance endpoints
            elif endpoint == "/api/restart_service":
                service_name = params.get('service_name', '')
                
                if not service_name:
                    return {
                        "status": "error",
                        "message": "Missing required service_name parameter.",
                        "raw_response": None
                    }
                
                # In a real app, this would restart a system service
                return {
                    "status": "success",
                    "message": f"Service '{service_name}' would be restarted",
                    "raw_response": {
                        "service": service_name,
                        "action": "restart",
                        "timestamp": datetime.now().isoformat(),
                        "status": "completed"
                    }
                }
            
            # Unknown internal endpoint
            return {
                "status": "error",
                "message": f"Unknown internal endpoint: {endpoint}",
                "raw_response": None
            }
            
        except Exception as e:
            logger.error(f"Error executing automation: {str(e)}")
            return {
                "status": "error",
                "message": f"Error executing automation: {str(e)}",
                "raw_response": None
            }
