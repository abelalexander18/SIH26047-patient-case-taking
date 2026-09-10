"""
SIH26047 — Patient Case-Taking Software (Ministry of Ayush / AIIA)
Medical Document OCR Pipeline Schemas

Data contracts for raw OCR preservation, structured metric extraction,
and downstream abnormality detector linkage.
"""

from typing import List, Optional, Dict, Any
from pydantic import BaseModel, Field


class ExtractedLabValue(BaseModel):
    test_name: str = Field(..., description="Canonical or extracted test name")
    value: float = Field(..., description="Parsed numeric value")
    unit: str = Field(default="", description="Parsed or matched measurement unit")
    reference_low: Optional[float] = Field(default=None, description="Configured or printed lower bound")
    reference_high: Optional[float] = Field(default=None, description="Configured or printed upper bound")
    source: str = Field(default="ocr", description="Data origin tag")


class OCRResult(BaseModel):
    document_type: str = Field(default="lab_report", description="lab_report, prescription, discharge_summary, other")
    raw_text: str = Field(default="", description="Verbatim raw OCR text preserved for audit and physician inspection")
    extracted_values: List[ExtractedLabValue] = Field(default_factory=list, description="Exposed structured numerical metrics")
    evaluated_abnormalities: List[Dict[str, Any]] = Field(default_factory=list, description="Processed results from abnormal-value detector")
    extraction_status: str = Field(default="success", description="success, partial, uncertain, failed")
    notes: List[str] = Field(default_factory=list, description="System notes regarding quality and limitations")
    disclaimer: str = (
        "Prototype OCR extraction for SIH26047. Designed for printed electronic documents only. "
        "Handwriting recognition is not supported. All extracted values must be clinically verified by a physician."
    )
