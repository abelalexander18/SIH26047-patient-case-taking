"""
SIH26047 — Patient Case-Taking Software (Ministry of Ayush / AIIA)
Medical Document OCR Pipeline

Orchestrates:
PDF/Image upload -> OCR text extraction -> Structured metric extraction -> Abnormal-value detection.
Strictly non-diagnostic prototype.
"""

import io
from typing import Optional, List, Dict, Any, Union
from pathlib import Path
import pypdf
from PIL import Image

from document_ocr.schemas import OCRResult, ExtractedLabValue
from document_ocr.extractor import ClinicalTextExtractor
from abnormality_detector import evaluate_value

# Optional pytesseract support
try:
    import pytesseract
    PYTESSERACT_AVAILABLE = True
except ImportError:
    PYTESSERACT_AVAILABLE = False


class MedicalDocumentOCRPipeline:
    """
    Minimal, reliable prototype pipeline for medical document text extraction.
    Uses pypdf for digital lab reports, PIL for image validation, and connects
    directly to the abnormal-value detector.
    """

    def __init__(self):
        self.extractor = ClinicalTextExtractor()

    def process_document(
        self,
        file_bytes: bytes,
        filename: str = "report.pdf",
        custom_config: Optional[Dict[str, Any]] = None
    ) -> OCRResult:
        """
        Processes a PDF or image byte stream through the extraction pipeline.
        Returns an OCRResult containing:
        - raw_text (preserved for physician audit)
        - extracted_values (exposed structured metrics)
        - evaluated_abnormalities (results from abnormal-value detector)
        - extraction_status and clinical prototype notes.
        """
        filename_lower = filename.lower()
        notes: List[str] = [
            "Prototype extraction notice: Designed for printed electronic lab documents; handwriting recognition is not supported."
        ]

        raw_text = ""
        is_image = any(filename_lower.endswith(ext) for ext in [".png", ".jpg", ".jpeg", ".bmp", ".webp", ".tiff"])
        is_pdf = filename_lower.endswith(".pdf")

        # 1. OCR / Text Extraction
        if is_pdf:
            raw_text, pdf_notes = self._extract_from_pdf(file_bytes)
            notes.extend(pdf_notes)
        elif is_image:
            raw_text, img_notes = self._extract_from_image(file_bytes)
            notes.extend(img_notes)
        else:
            # Fallback text stream decoding
            try:
                raw_text = file_bytes.decode("utf-8")
                notes.append("Decoded plain text document stream.")
            except UnicodeDecodeError:
                raw_text = ""
                notes.append(f"Unrecognized file format for '{filename}'.")

        # 2. Pass extracted text to extraction layer
        extracted_values, doc_type = self.extractor.extract_metrics(raw_text)

        # 3. Allow the abnormal-value detector to process extracted values
        evaluated_abnormalities: List[Dict[str, Any]] = []
        for val_item in extracted_values:
            abnormal_result = evaluate_value(
                item=val_item.model_dump(),
                custom_config=custom_config
            )
            evaluated_abnormalities.append(abnormal_result)

        # 4. Determine extraction status defensively
        if extracted_values:
            status = "success"
            notes.append(f"Successfully extracted and evaluated {len(extracted_values)} clinical metric(s).")
        elif raw_text.strip():
            # Text was read, but no structured metrics could be identified (e.g. noisy scan or non-lab text)
            status = "uncertain"
            notes.append(
                "Uncertain extraction: Text was read but no standard laboratory biomarkers could be reliably mapped. "
                "Raw text preserved for manual physician review. Avoided guessing values."
            )
        else:
            status = "failed"
            notes.append("Failed to extract legible text from document.")

        return OCRResult(
            document_type=doc_type,
            raw_text=raw_text,
            extracted_values=extracted_values,
            evaluated_abnormalities=evaluated_abnormalities,
            extraction_status=status,
            notes=notes
        )

    def _extract_from_pdf(self, file_bytes: bytes) -> tuple[str, List[str]]:
        """Extracts text streams from PDF pages using pypdf."""
        notes = []
        try:
            reader = pypdf.PdfReader(io.BytesIO(file_bytes))
            pages_text = []
            for i, page in enumerate(reader.pages):
                txt = page.extract_text() or ""
                if txt.strip():
                    pages_text.append(txt.strip())
            full_text = "\n".join(pages_text)
            notes.append(f"Extracted digital text across {len(reader.pages)} PDF page(s) via pypdf.")
            return full_text, notes
        except Exception as e:
            notes.append(f"PDF extraction encountered error: {str(e)}")
            return "", notes

    def _extract_from_image(self, file_bytes: bytes) -> tuple[str, List[str]]:
        """Handles image input with PIL inspection and optional Tesseract."""
        notes = []
        try:
            image = Image.open(io.BytesIO(file_bytes))
            notes.append(f"Validated image format ({image.format}, {image.size[0]}x{image.size[1]} px).")

            if PYTESSERACT_AVAILABLE:
                try:
                    text = pytesseract.image_to_string(image)
                    notes.append("OCR optical character recognition executed via Tesseract.")
                    return text.strip(), notes
                except Exception as e:
                    notes.append(f"Tesseract OCR execution bypassed ({str(e)}).")
            else:
                notes.append(
                    "Image OCR engine (Tesseract) is not locally installed. "
                    "Handwriting recognition is not supported in this prototype."
                )

            return "", notes
        except Exception as e:
            notes.append(f"Image could not be opened: {str(e)}")
            return "", notes


# Global default instance
_default_pipeline = MedicalDocumentOCRPipeline()


def process_medical_document(
    file_bytes: bytes,
    filename: str = "report.pdf",
    custom_config: Optional[Dict[str, Any]] = None
) -> Dict[str, Any]:
    """Convenience function returning OCRResult dictionary."""
    result = _default_pipeline.process_document(
        file_bytes=file_bytes,
        filename=filename,
        custom_config=custom_config
    )
    return result.model_dump()
