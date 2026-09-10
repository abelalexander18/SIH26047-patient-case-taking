"""
SIH26047 — Patient Case-Taking Software (Ministry of Ayush / AIIA)
Member 6: OCR & Red Flag Intelligence
Schemas and Data Contracts
"""

from enum import Enum
from typing import List, Optional, Dict, Any, Union
from pydantic import BaseModel, Field
from datetime import datetime, timezone


class TriageSeverity(str, Enum):
    NORMAL = "NORMAL"
    WARNING = "WARNING"
    URGENT = "URGENT"
    CRITICAL = "CRITICAL"


class ValueStatus(str, Enum):
    CRITICAL_LOW = "CRITICAL_LOW"
    LOW = "LOW"
    NORMAL = "NORMAL"
    HIGH = "HIGH"
    CRITICAL_HIGH = "CRITICAL_HIGH"


class DocumentType(str, Enum):
    LAB_REPORT = "LAB_REPORT"
    PRESCRIPTION = "PRESCRIPTION"
    DISCHARGE_SUMMARY = "DISCHARGE_SUMMARY"
    GENERAL_MEDICAL = "GENERAL_MEDICAL"


class VitalsInput(BaseModel):
    systolic_bp: Optional[float] = Field(default=None, description="Systolic Blood Pressure in mmHg")
    diastolic_bp: Optional[float] = Field(default=None, description="Diastolic Blood Pressure in mmHg")
    heart_rate: Optional[float] = Field(default=None, description="Heart Rate / Pulse in beats per minute")
    respiratory_rate: Optional[float] = Field(default=None, description="Respiratory Rate in breaths per minute")
    spo2: Optional[float] = Field(default=None, description="Oxygen Saturation in percentage (SpO2)")
    temperature_f: Optional[float] = Field(default=None, description="Body Temperature in Fahrenheit")
    blood_glucose_mg_dl: Optional[float] = Field(default=None, description="Blood Glucose in mg/dL")
    blood_glucose_type: Optional[str] = Field(default="random", description="'fasting', 'post_prandial', or 'random'")


class LabItem(BaseModel):
    name: str = Field(..., description="Biomarker or test name (e.g. Hemoglobin, Platelets, Creatinine)")
    value: float = Field(..., description="Numerical lab value")
    unit: Optional[str] = Field(default="", description="Unit of measurement (e.g. g/dL, mg/dL, /uL)")
    reference_range_text: Optional[str] = Field(default=None, description="Optional raw reference range text")


class SymptomInput(BaseModel):
    name: str = Field(..., description="Symptom name or short description")
    severity: Optional[str] = Field(default="moderate", description="'mild', 'moderate', or 'severe'")
    duration: Optional[str] = Field(default=None, description="Duration (e.g. '2 hours', '3 days')")
    details: Optional[str] = Field(default=None, description="Additional context or anatomical location")


class PatientDemographics(BaseModel):
    age: Optional[int] = Field(default=None, description="Patient age in years")
    gender: Optional[str] = Field(default=None, description="'male', 'female', or 'other'")
    is_pregnant: Optional[bool] = Field(default=False, description="Whether patient is currently pregnant")


class PatientCaseInput(BaseModel):
    case_id: Optional[str] = Field(default=None, description="Unique case or patient session identifier")
    patient: Optional[PatientDemographics] = Field(default=None, description="Patient demographics")
    chief_complaints: List[str] = Field(default_factory=list, description="List of chief complaints")
    symptoms: List[Union[SymptomInput, str]] = Field(default_factory=list, description="Structured or raw symptoms")
    vitals: Optional[VitalsInput] = Field(default=None, description="Physiological vitals")
    lab_results: List[LabItem] = Field(default_factory=list, description="Laboratory test results")
    medical_history: List[str] = Field(default_factory=list, description="Past medical history / chronic conditions")
    current_medications: List[str] = Field(default_factory=list, description="Current medicines or herbal formulations")
    ayush_context: Optional[Dict[str, Any]] = Field(default=None, description="Ayurvedic observations (prakriti, dosha, etc.)")


class AbnormalityItem(BaseModel):
    metric: str
    display_name: str
    observed_value: float
    unit: str
    status: ValueStatus
    normal_range: str
    clinical_implication: str
    is_critical: bool = False


class RedFlagItem(BaseModel):
    flag_id: str
    category: str
    severity: TriageSeverity
    title: str
    matched_cues: List[str]
    clinical_rationale: str
    recommended_action: str


class DocumentOCRResult(BaseModel):
    extracted_text: str
    detected_document_type: DocumentType
    parsed_vitals: Optional[VitalsInput] = None
    parsed_labs: List[LabItem] = Field(default_factory=list)
    confidence_score: float = 1.0
    extraction_notes: List[str] = Field(default_factory=list)


class ScreeningResult(BaseModel):
    case_id: Optional[str] = None
    overall_triage: TriageSeverity
    is_emergency: bool
    summary_headline: str
    red_flags: List[RedFlagItem] = Field(default_factory=list)
    abnormalities: List[AbnormalityItem] = Field(default_factory=list)
    normal_metrics_count: int = 0
    disclaimer: str = (
        "Clinical Decision Support Prototype for SIH26047 (Ministry of Ayush / AIIA). "
        "Intended solely to assist qualified healthcare professionals in clinical triage. "
        "Does not constitute medical diagnosis, treatment prescription, or autonomous clinical decision-making."
    )
    evaluated_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())
