"""
Document processing utilities for extracting text from various file formats.
"""
import os
from django.conf import settings
import logging

# Setup logging
logger = logging.getLogger(__name__)

def process_document(document):
    """
    Process an uploaded document and extract its text content.
    
    Args:
        document: Document model instance
        
    Returns:
        tuple: (success_flag, content_or_error_message)
    """
    try:
        file_path = document.file.path
        file_extension = os.path.splitext(file_path)[1].lower()
        
        # Process based on file type
        if file_extension == '.pdf':
            return process_pdf(file_path)
        elif file_extension in ['.docx', '.doc']:
            return process_docx(file_path)
        elif file_extension in ['.txt', '.md']:
            return process_text(file_path)
        else:
            return False, f"Unsupported file type: {file_extension}"
            
    except Exception as e:
        logger.error(f"Error processing document {document.id}: {str(e)}")
        return False, str(e)

def process_pdf(file_path):
    """Extract text from PDF files."""
    try:
        # Use PyPDF2 or pypdf for PDF processing
        from pypdf import PdfReader
        
        reader = PdfReader(file_path)
        text = ""
        
        for page in reader.pages:
            text += page.extract_text() + "\n"
            
        if not text.strip():
            return False, "No text content could be extracted from the PDF"
            
        return True, text
        
    except ImportError:
        return False, "PDF processing library not available. Please install pypdf."
    except Exception as e:
        return False, f"Error processing PDF: {str(e)}"

def process_docx(file_path):
    """Extract text from Word documents."""
    try:
        # Use python-docx for DOCX processing
        import docx
        
        doc = docx.Document(file_path)
        text = "\n".join([paragraph.text for paragraph in doc.paragraphs])
        
        if not text.strip():
            return False, "No text content could be extracted from the document"
            
        return True, text
        
    except ImportError:
        return False, "DOCX processing library not available. Please install python-docx."
    except Exception as e:
        return False, f"Error processing DOCX: {str(e)}"

def process_text(file_path):
    """Process plain text files."""
    try:
        with open(file_path, 'r', encoding='utf-8') as f:
            text = f.read()
            
        if not text.strip():
            return False, "The text file is empty"
            
        return True, text
        
    except UnicodeDecodeError:
        # Try with a different encoding if UTF-8 fails
        try:
            with open(file_path, 'r', encoding='latin-1') as f:
                text = f.read()
            return True, text
        except Exception as e:
            return False, f"Error reading text file with alternative encoding: {str(e)}"
    except Exception as e:
        return False, f"Error processing text file: {str(e)}"
