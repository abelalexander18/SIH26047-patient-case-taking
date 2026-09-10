"""
Member 6: OCR & Red Flag Intelligence Package
SIH26047 — Patient Case-Taking Software (Ministry of Ayush / AIIA)
"""

from member6_intelligence.schemas import (
    TriageSeverity,
    ValueStatus,
    DocumentType,
    VitalsInput,
    LabItem,
    SymptomInput,
    PatientDemographics,
    PatientCaseInput,
    AbnormalityItem,
    RedFlagItem,
    DocumentOCRResult,
    ScreeningResult
)
from member6_intelligence.service import (
    IntelligenceService,
    default_service,
    screen_patient_case,
    check_vitals_and_labs,
    process_medical_document,
    parse_medical_text
)

__version__ = "1.0.0"

__all__ = [
    "TriageSeverity",
    "ValueStatus",
    "DocumentType",
    "VitalsInput",
    "LabItem",
    "SymptomInput",
    "PatientDemographics",
    "PatientCaseInput",
    "AbnormalityItem",
    "RedFlagItem",
    "DocumentOCRResult",
    "ScreeningResult",
    "IntelligenceService",
    "default_service",
    "screen_patient_case",
    "check_vitals_and_labs",
    "process_medical_document",
    "parse_medical_text"
]
