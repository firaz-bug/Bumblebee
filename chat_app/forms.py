from django import forms
from .models import Document

class DocumentUploadForm(forms.ModelForm):
    class Meta:
        model = Document
        fields = ['file']
        
    def is_valid(self):
        """
        Check if form is valid and print debugging info if not.
        """
        is_valid = super().is_valid()
        if not is_valid:
            print(f"Form errors: {self.errors}")
        return is_valid
