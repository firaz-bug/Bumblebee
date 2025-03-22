"""
Document processing utilities for extracting text from various file formats and generating citations.
"""
import os
import datetime
from django.conf import settings
import logging
import re

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

def generate_citation(document, style='apa'):
    """
    Generate citation for a document in specified style.
    
    Args:
        document: Document model instance
        style: Citation style ('apa', 'mla', 'chicago', 'harvard')
        
    Returns:
        str: Formatted citation
    """
    try:
        # Extract metadata from the document
        title = document.title
        uploaded_date = document.uploaded_at
        file_extension = os.path.splitext(document.file.name)[1].lower()
        
        # Try to extract author information from the content
        # This is a simple approach, a more advanced implementation would use NLP
        author = extract_author_from_content(document.content)
        
        # Generate citation based on style
        if style == 'apa':
            return generate_apa_citation(title, author, uploaded_date, file_extension)
        elif style == 'mla':
            return generate_mla_citation(title, author, uploaded_date, file_extension)
        elif style == 'chicago':
            return generate_chicago_citation(title, author, uploaded_date, file_extension)
        elif style == 'harvard':
            return generate_harvard_citation(title, author, uploaded_date, file_extension)
        else:
            # Default to APA if style is not recognized
            return generate_apa_citation(title, author, uploaded_date, file_extension)
            
    except Exception as e:
        logger.error(f"Error generating citation for document {document.id}: {str(e)}")
        return f"Unable to generate citation: {str(e)}"

def extract_author_from_content(content):
    """
    Try to extract author information from document content.
    
    Args:
        content: Document content
        
    Returns:
        str: Author name or "Unknown Author"
    """
    # This is a simplified approach - a more robust implementation would use NLP
    if not content:
        return "Unknown Author"
    
    # Check for common author patterns in document content
    author_patterns = [
        r'(?i)author[s]?[\s:]+([A-Za-z\s\.,]+)',
        r'(?i)by[\s:]+([A-Za-z\s\.,]+)',
        r'(?i)written by[\s:]+([A-Za-z\s\.,]+)',
        r'(?i)submitted by[\s:]+([A-Za-z\s\.,]+)',
        r'(?i)prepared by[\s:]+([A-Za-z\s\.,]+)'
    ]
    
    for pattern in author_patterns:
        match = re.search(pattern, content)
        if match:
            author = match.group(1).strip()
            # Limit length to avoid overly long matches
            if 2 < len(author) < 100:
                return author
    
    # If no author found, try to look for name at the beginning of the document
    # This might catch name in a personal statement or letter
    lines = content.split('\n')
    for line in lines[:10]:  # Check first 10 lines
        line = line.strip()
        if 2 < len(line) < 50 and all(c.isalpha() or c.isspace() or c in '.,\'"-' for c in line):
            # This is a simple heuristic for a name line
            return line
    
    return "Unknown Author"

def generate_apa_citation(title, author, date, file_type):
    """Generate APA style citation."""
    year = date.strftime("%Y")
    
    # Format author: Last, F. I.
    author_parts = author.split()
    if len(author_parts) > 1 and author != "Unknown Author":
        last_name = author_parts[-1]
        first_initials = ''.join([name[0] + '.' for name in author_parts[:-1]])
        formatted_author = f"{last_name}, {first_initials}"
    else:
        formatted_author = author
    
    # Create citation
    citation = f"{formatted_author} ({year}). {title}"
    
    # Add type information for non-text documents
    if file_type in ['.pdf', '.docx', '.doc']:
        citation += f" [{file_type[1:].upper()} file]"
    
    return citation

def generate_mla_citation(title, author, date, file_type):
    """Generate MLA style citation."""
    day = date.strftime("%d")
    month = date.strftime("%b")
    year = date.strftime("%Y")
    
    # Format author: Last, First
    author_parts = author.split()
    if len(author_parts) > 1 and author != "Unknown Author":
        last_name = author_parts[-1]
        first_names = ' '.join(author_parts[:-1])
        formatted_author = f"{last_name}, {first_names}"
    else:
        formatted_author = author
    
    # Create citation
    citation = f"{formatted_author}. \"{title}\""
    
    # Add type information
    if file_type in ['.pdf', '.docx', '.doc']:
        citation += f", {file_type[1:].upper()}"
    
    citation += f", {day} {month}. {year}"
    
    return citation

def generate_chicago_citation(title, author, date, file_type):
    """Generate Chicago style citation."""
    day = date.strftime("%d")
    month = date.strftime("%B")
    year = date.strftime("%Y")
    
    # Format author: First Last
    if author != "Unknown Author":
        formatted_author = author
    else:
        formatted_author = author
    
    # Create citation
    citation = f"{formatted_author}. \"{title}.\""
    
    # Add type information
    if file_type in ['.pdf', '.docx', '.doc']:
        citation += f" {file_type[1:].upper()} file"
    
    citation += f", {month} {day}, {year}."
    
    return citation

def generate_harvard_citation(title, author, date, file_type):
    """Generate Harvard style citation."""
    year = date.strftime("%Y")
    
    # Format author: Last, F.
    author_parts = author.split()
    if len(author_parts) > 1 and author != "Unknown Author":
        last_name = author_parts[-1]
        first_initials = ''.join([name[0] + '.' for name in author_parts[:-1]])
        formatted_author = f"{last_name}, {first_initials}"
    else:
        formatted_author = author
    
    # Create citation
    citation = f"{formatted_author} {year}, '{title}'"
    
    # Add type information
    if file_type in ['.pdf', '.docx', '.doc']:
        citation += f", {file_type[1:].upper()} file"
    
    return citation
