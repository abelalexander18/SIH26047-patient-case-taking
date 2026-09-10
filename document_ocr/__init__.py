"""
Medical Document OCR Package.
"""

from document_ocr.schemas import OCRResult, ExtractedLabValue
from document_ocr.extractor import ClinicalTextExtractor
from document_ocr.pipeline import MedicalDocumentOCRPipeline, process_medical_document
from document_ocr.samples import (
    SYNTHETIC_LAB_REPORT_TEXT,
    SYNTHETIC_POOR_QUALITY_TEXT,
    create_synthetic_pdf_bytes,
    create_synthetic_image_bytes
)

__all__ = [
    "OCRResult",
    "ExtractedLabValue",
    "ClinicalTextExtractor",
    "MedicalDocumentOCRPipeline",
    "process_medical_document",
    "SYNTHETIC_LAB_REPORT_TEXT",
    "SYNTHETIC_POOR_QUALITY_TEXT",
    "create_synthetic_pdf_bytes",
    "create_synthetic_image_bytes"
]
