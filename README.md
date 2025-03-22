
# Chat Assistant with Document Analysis

A Django-based chat application that uses OpenAI's API for document analysis and chat functionality.

## Requirements
- Python 3.11 or higher
- OpenAI API key

## Setup Instructions

1. Clone the repository
2. Install dependencies:
   ```
   pip install -r requirements.txt
   ```
3. Set up environment variables:
   - Create a `.env` file in the root directory
   - Add your OpenAI API key:
     ```
     OPENAI_API_KEY=your_api_key_here
     ```

4. Run database migrations:
   ```
   python manage.py migrate
   ```

5. Start the development server:
   ```
   python manage.py runserver 0.0.0.0:5000
   ```

6. Open your browser and navigate to `http://localhost:5000`

## Features
- Chat interface with OpenAI integration
- Document analysis capabilities
- Conversation management
- Vector store for document chunks
