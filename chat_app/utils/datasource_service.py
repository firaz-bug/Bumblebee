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
            str: Response to the data source command
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
        # Check if message contains a proper request with parameters
        contains_parameters = any(param in message for param in datasource.parameters.keys())
        
        if not contains_parameters:
            # Just describe the data source
            response = f"**{datasource.name}**\n{datasource.description}\n\nParameters:\n"
            
            for param, description in datasource.parameters.items():
                response += f"- {param}: {description}\n"
            
            response += "\nTo query this data source, provide the required parameters. For example:\n"
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
        
        # Check if required parameters are provided
        missing_params = []
        for param, desc in datasource.parameters.items():
            if "Required" in desc and param not in params:
                missing_params.append(param)
        
        if missing_params:
            response = f"To query {datasource.name}, the following required parameters are missing:\n"
            for param in missing_params:
                response += f"- {param}: {datasource.parameters[param]}\n"
            return response
        
        # Execute the query
        query_result = self.execute_query(datasource.endpoint, datasource.parameters, params)
        
        return f"**{datasource.name}** query result:\n\n{query_result}"
    
    def execute_query(self, endpoint, param_schema, params):
        """
        Execute a data source query.
        
        Args:
            endpoint: API endpoint for the data source
            param_schema: Parameter schema with descriptions
            params: Actual parameters to use
            
        Returns:
            str: Result of the data source query
        """
        try:
            # For external endpoints (starting with http)
            if endpoint.startswith(('http://', 'https://')):
                # For weather API as an example
                if "openweathermap" in endpoint:
                    # Get API key from environment
                    api_key = os.getenv('OPENWEATHER_API_KEY')
                    if not api_key:
                        return "Weather API key not configured. Please set the OPENWEATHER_API_KEY environment variable."
                    
                    # Make actual API call
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
                        
                        return f"Weather in {location}: {weather}, Temperature: {temp}°C"
                    else:
                        return f"Weather API returned an error: {response.status_code} - {response.text}"
                
                # For stock API as example
                elif "marketdata" in endpoint:
                    # Get API key from environment
                    api_key = os.getenv('STOCK_API_KEY')
                    if not api_key:
                        return "Stock API key not configured. Please set the STOCK_API_KEY environment variable."
                    
                    # This is a mock implementation since we don't have a real API
                    symbol = params.get('symbol', '').upper()
                    if symbol == 'AAPL':
                        return f"Stock: {symbol}\nPrice: $182.63\nChange: +1.2%"
                    elif symbol == 'MSFT':
                        return f"Stock: {symbol}\nPrice: $415.32\nChange: +0.5%"
                    elif symbol == 'GOOG':
                        return f"Stock: {symbol}\nPrice: $148.25\nChange: -0.3%"
                    else:
                        return f"Stock: {symbol}\nNo data available for this symbol."
                
                # Generic external API call
                try:
                    response = requests.get(endpoint, params=params)
                    return f"API response (status {response.status_code}):\n{response.text[:500]}"
                except Exception as e:
                    return f"Failed to call external API: {str(e)}"
            
            # For internal endpoints
            if endpoint == "/api/user/profile":
                user_id = params.get('user_id', 'current')
                # This is a mock implementation
                if user_id == 'current':
                    return "User Profile:\nName: Demo User\nEmail: demo@example.com\nRole: Administrator"
                else:
                    return f"User Profile (ID: {user_id}):\nName: User {user_id}\nEmail: user{user_id}@example.com\nRole: User"
            
            # Default response for unhandled endpoints
            return f"Query execution for endpoint {endpoint} is not implemented."
            
        except Exception as e:
            logger.error(f"Error executing data source query: {str(e)}")
            return f"Error executing query: {str(e)}"