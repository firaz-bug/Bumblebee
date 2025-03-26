"""
Data Source service for handling external data source queries.
"""
import json
import os
import requests
import logging
from django.conf import settings
from ..models import DataSource

# Setup logging
logger = logging.getLogger(__name__)

class DataSourceService:
    """
    Service for handling data source operations and executing queries.
    """
    
    def __init__(self):
        """Initialize the data source service."""
        # Flag to indicate whether default data sources have been initialized
        self.initialized = False
    
    def _initialize_default_datasources(self):
        """Initialize default data sources in the database."""
        default_datasources = [
            {
                "name": "Weather API",
                "description": "Get weather information for locations",
                "endpoint": "https://api.openweathermap.org/data/2.5/weather",
                "parameters": {
                    "q": "Required - City name",
                    "units": "metric/imperial (default: metric)"
                },
                "auth_required": True
            },
            {
                "name": "User Profile",
                "description": "Get user profile information",
                "endpoint": "/api/user/profile",
                "parameters": {
                    "user_id": "Optional - User ID (defaults to current user)"
                },
                "auth_required": False
            },
            {
                "name": "Stock Prices",
                "description": "Get current stock price information",
                "endpoint": "https://api.marketdata.com/v1/quotes",
                "parameters": {
                    "symbol": "Required - Stock symbol (e.g., AAPL)",
                    "fields": "Optional - Specific fields to return"
                },
                "auth_required": True
            }
        ]
        
        # Add default data sources if they don't exist
        for source in default_datasources:
            DataSource.objects.get_or_create(
                name=source["name"],
                defaults={
                    "description": source["description"],
                    "endpoint": source["endpoint"],
                    "parameters": source["parameters"],
                    "auth_required": source["auth_required"]
                }
            )
        
        self.initialized = True
    
    def handle_datasource_command(self, message):
        """
        Handle @datasource command.
        
        Args:
            message: User message containing the @datasource command
            
        Returns:
            dict or str: Response to the data source command, either a structured 
                  dict with logs and results for queries, or a string for listing/errors
        """
        try:
            # Initialize default data sources if not done already
            if not self.initialized:
                try:
                    self._initialize_default_datasources()
                except Exception as e:
                    logger.error(f"Error initializing data sources: {str(e)}")
                    return "Data source service is initializing. Please try again in a moment."
            
            # Check if it's a general data source inquiry
            if message.strip().lower() == '@datasource':
                return self._list_datasources()
            
            # Check if it's a specific data source request
            if '@datasource' in message.lower():
                # Extract data source name from message
                after_command = message.lower().split('@datasource', 1)[1].strip()
                
                # If empty or just asking for help
                if not after_command or after_command in ['help', '?']:
                    return self._list_datasources()
                
                # Try to find data source by name
                datasources = DataSource.objects.all()
                matching_datasource = None
                
                for source in datasources:
                    if source.name.lower() in after_command.lower():
                        matching_datasource = source
                        break
                
                if matching_datasource:
                    # Found a matching data source
                    return self._describe_datasource(matching_datasource, after_command)
                else:
                    # No matching data source found
                    return f"I couldn't find a data source matching '{after_command}'.\n\n{self._list_datasources()}"
        
        except Exception as e:
            logger.error(f"Error handling data source command: {str(e)}")
            return "Sorry, there was an error processing your data source request."
    
    def _list_datasources(self):
        """
        List all available data sources.
        
        Returns:
            str: Formatted list of available data sources
        """
        try:
            datasources = DataSource.objects.all()
            
            if not datasources:
                return "No data sources are currently available. Please check back later."
            
            response = "**Available Data Sources:**\n\n"
            for source in datasources:
                response += f"- **{source.name}**: {source.description}\n"
            
            response += "\nTo use a data source, type `@datasource [name]`. For example: `@datasource Weather API`"
            
            return response
        except Exception as e:
            logger.error(f"Error listing data sources: {str(e)}")
            return "Failed to list data sources due to an error. Please try again later."
    
    def _describe_datasource(self, datasource, message):
        """
        Describe a specific data source and parse parameters from message.
        
        Args:
            datasource: DataSource object
            message: User message that may contain parameters
            
        Returns:
            str: Data source description and parameter guidance or query result
        """
        # Check if message contains explicit parameters
        contains_explicit_parameters = any(f"{param}=" in message for param in datasource.parameters.keys())
        
        # Always attempt to execute the query, even without parameters
        # But first check if the user is just asking for information about the data source
        if "help" in message.lower() or "info" in message.lower() or "describe" in message.lower() or "?" in message:
            # Just describe the data source without executing
            response = f"**{datasource.name}**\n{datasource.description}\n\nParameters:\n"
            
            for param, description in datasource.parameters.items():
                response += f"- {param}: {description}\n"
            
            response += "\nTo query this data source, you can provide parameters. For example:\n"
            example_params = {}
            for param, desc in datasource.parameters.items():
                if "Required" in desc:
                    if "city" in param.lower() or "location" in param.lower() or param.lower() == "q":
                        example_params[param] = "London"
                    elif "symbol" in param.lower():
                        example_params[param] = "AAPL"
                    else:
                        example_params[param] = f"<your {param}>"
            
            example = f"@datasource {datasource.name}"
            for param, value in example_params.items():
                example += f" {param}={value}"
            
            response += f"`{example}`"
            
            return response
        
        # Try to extract parameters
        params = {}
        for param in datasource.parameters.keys():
            # Look for param=value pattern
            if f"{param}=" in message:
                parts = message.split(f"{param}=", 1)[1]
                # Extract until next parameter or end of message
                value = ""
                for part in parts.split():
                    if "=" in part and part.split("=")[0] in datasource.parameters:
                        break
                    value += f"{part} "
                
                params[param] = value.strip()
        
        # Parameters are optional - we'll show a warning but still proceed
        missing_params = []
        for param, desc in datasource.parameters.items():
            if "Required" in desc and param not in params:
                missing_params.append(param)
        
        # Log a warning but proceed with the call
        from datetime import datetime
        
        if missing_params:
            warnings = f"Note: Some recommended parameters for {datasource.name} are missing: {', '.join(missing_params)}"
            logger.warning(warnings)
        
        # Execute the query with datasource info
        datasource_info = {
            'name': datasource.name,
            'id': str(datasource.id),
            'endpoint': datasource.endpoint,
            'call_type': datasource.call_type
        }
        
        query_result = self.execute_query(
            endpoint=datasource.endpoint, 
            param_schema=datasource.parameters, 
            params=params,
            call_type=datasource.call_type,
            datasource_info=datasource_info
        )
        
        # Create a log entry in the database
        from ..models import Log
        Log.objects.create(
            message=f"Data source query: {datasource.name} - {query_result.get('message', 'No details')}",
            level="info" if query_result.get('status') == 'success' else "error",
            source="datasource_service"
        )
        
        return query_result
    
    def execute_query(self, endpoint, param_schema, params, call_type='GET', datasource_info=None):
        """
        Execute a data source query.
        
        Args:
            endpoint: API endpoint for the data source
            param_schema: Parameter schema with descriptions
            params: Actual parameters to use
            call_type: HTTP method to use for the call (GET or POST)
            datasource_info: Dict with information about the data source for logs
            
        Returns:
            dict: Structured result of the data source query containing:
                - status: 'success' or 'error'
                - message: Human-readable message
                - logs: List of log entries with timestamp, level, and message
                - raw_response: Raw API response data if available
                - datasource: Information about the queried data source
        """
        # Initialize result structure
        result = {
            'status': 'error',
            'message': 'Failed to execute data source query',
            'logs': [],
            'raw_response': None,
            'datasource': datasource_info or {}
        }
        
        # Add initial log entry
        from datetime import datetime
        timestamp = datetime.now().isoformat()
        result['logs'].append({
            'timestamp': timestamp,
            'level': 'info',
            'message': f"Starting data source query for endpoint: {endpoint}"
        })
        
        try:
            # Log the execution attempt
            logger.info(f"Executing data source query with endpoint: {endpoint}, call_type: {call_type}")
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
                    if not api_key:
                        result['logs'].append({
                            'timestamp': datetime.now().isoformat(),
                            'level': 'error',
                            'message': "Weather API key not configured"
                        })
                        result['status'] = 'error'
                        result['message'] = "Weather API key not configured. Please set the OPENWEATHER_API_KEY environment variable."
                        return result
                    
                    # Make actual API call
                    result['logs'].append({
                        'timestamp': datetime.now().isoformat(),
                        'level': 'info',
                        'message': f"Calling weather API for location: {params.get('q', 'London')}"
                    })
                    
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
                        
                        result['logs'].append({
                            'timestamp': datetime.now().isoformat(),
                            'level': 'info',
                            'message': f"Successfully retrieved weather data for {location}"
                        })
                        
                        result['status'] = 'success'
                        result['message'] = f"Weather in {location}: {weather}, Temperature: {temp}°C"
                        result['raw_response'] = data
                        return result
                    else:
                        result['logs'].append({
                            'timestamp': datetime.now().isoformat(),
                            'level': 'error',
                            'message': f"Weather API error: {response.status_code}"
                        })
                        
                        result['status'] = 'error'
                        result['message'] = f"Weather API returned an error: {response.status_code}"
                        result['raw_response'] = response.text
                        return result
                
                # For stock API as example
                elif "marketdata" in endpoint:
                    # Get API key from environment
                    api_key = os.getenv('STOCK_API_KEY')
                    if not api_key:
                        result['logs'].append({
                            'timestamp': datetime.now().isoformat(),
                            'level': 'error',
                            'message': "Stock API key not configured"
                        })
                        
                        result['status'] = 'error'
                        result['message'] = "Stock API key not configured. Please set the STOCK_API_KEY environment variable."
                        return result
                    
                    symbol = params.get('symbol', '').upper()
                    result['logs'].append({
                        'timestamp': datetime.now().isoformat(),
                        'level': 'info',
                        'message': f"Querying stock data for symbol: {symbol}"
                    })
                    
                    # This is for demonstration - would be a real API call in production
                    result['logs'].append({
                        'timestamp': datetime.now().isoformat(),
                        'level': 'info',
                        'message': f"Retrieved market data for {symbol}"
                    })
                    
                    if symbol == 'AAPL':
                        mock_data = {"symbol": symbol, "price": 182.63, "change": 1.2}
                        result['status'] = 'success'
                        result['message'] = f"Stock: {symbol}\nPrice: ${mock_data['price']}\nChange: +{mock_data['change']}%"
                        result['raw_response'] = mock_data
                        return result
                    elif symbol == 'MSFT':
                        mock_data = {"symbol": symbol, "price": 415.32, "change": 0.5}
                        result['status'] = 'success'
                        result['message'] = f"Stock: {symbol}\nPrice: ${mock_data['price']}\nChange: +{mock_data['change']}%"
                        result['raw_response'] = mock_data
                        return result
                    elif symbol == 'GOOG':
                        mock_data = {"symbol": symbol, "price": 148.25, "change": -0.3}
                        result['status'] = 'success'
                        result['message'] = f"Stock: {symbol}\nPrice: ${mock_data['price']}\nChange: {mock_data['change']}%"
                        result['raw_response'] = mock_data
                        return result
                    else:
                        result['status'] = 'error'
                        result['message'] = f"Stock: {symbol}\nNo data available for this symbol."
                        return result
                
                # Generic external API call
                try:
                    result['logs'].append({
                        'timestamp': datetime.now().isoformat(),
                        'level': 'info',
                        'message': f"Making {call_type} request to {endpoint}"
                    })
                    
                    if call_type.upper() == 'GET':
                        response = requests.get(endpoint, params=params)
                    else:  # Default to POST
                        response = requests.post(endpoint, json=params)
                    
                    # Try to parse JSON response
                    try:
                        json_data = response.json()
                        
                        result['logs'].append({
                            'timestamp': datetime.now().isoformat(),
                            'level': 'info' if response.status_code < 400 else 'error',
                            'message': f"Received response with status code: {response.status_code}"
                        })
                        
                        result['status'] = 'success' if response.status_code < 400 else 'error'
                        result['message'] = f"API response (status {response.status_code})"
                        result['raw_response'] = json_data
                        return result
                    except ValueError:
                        # Not a JSON response
                        result['logs'].append({
                            'timestamp': datetime.now().isoformat(),
                            'level': 'info' if response.status_code < 400 else 'error',
                            'message': f"Received non-JSON response with status code: {response.status_code}"
                        })
                        
                        result['status'] = 'success' if response.status_code < 400 else 'error'
                        result['message'] = f"API response (status {response.status_code})"
                        result['raw_response'] = response.text
                        return result
                except Exception as e:
                    logger.error(f"Failed to call external API: {str(e)}")
                    
                    result['logs'].append({
                        'timestamp': datetime.now().isoformat(),
                        'level': 'error',
                        'message': f"API call failed: {str(e)}"
                    })
                    
                    result['status'] = 'error'
                    result['message'] = f"Failed to call external API: {str(e)}"
                    return result
            
            # For internal endpoints
            if endpoint == "/api/user/profile":
                user_id = params.get('user_id', 'current')
                
                result['logs'].append({
                    'timestamp': datetime.now().isoformat(),
                    'level': 'info',
                    'message': f"Fetching user profile for user_id: {user_id}"
                })
                
                # This is for demonstration
                if user_id == 'current':
                    mock_data = {
                        "name": "Demo User",
                        "email": "demo@example.com",
                        "role": "Administrator"
                    }
                    
                    result['status'] = 'success'
                    result['message'] = "User Profile:\nName: Demo User\nEmail: demo@example.com\nRole: Administrator"
                    result['raw_response'] = mock_data
                    return result
                else:
                    mock_data = {
                        "name": f"User {user_id}",
                        "email": f"user{user_id}@example.com",
                        "role": "User"
                    }
                    
                    result['status'] = 'success'
                    result['message'] = f"User Profile (ID: {user_id}):\nName: User {user_id}\nEmail: user{user_id}@example.com\nRole: User"
                    result['raw_response'] = mock_data
                    return result
            
            # Default response for unhandled endpoints
            result['logs'].append({
                'timestamp': datetime.now().isoformat(),
                'level': 'warning',
                'message': f"Unimplemented endpoint: {endpoint}"
            })
            
            result['status'] = 'error'
            result['message'] = f"Query execution for endpoint {endpoint} is not implemented."
            return result
            
        except Exception as e:
            logger.error(f"Error executing data source query: {str(e)}")
            
            result['logs'].append({
                'timestamp': datetime.now().isoformat(),
                'level': 'error',
                'message': f"Query execution error: {str(e)}"
            })
            
            result['status'] = 'error'
            result['message'] = f"Error executing query: {str(e)}"
            return result