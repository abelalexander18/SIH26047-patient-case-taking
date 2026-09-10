"""
SIH26047 — Patient Case-Taking Software (Ministry of Ayush / AIIA)
Member 6: Red Flag Screening Engine Schemas
Shared contract models for ClinicalHistory and RedFlagResult.
Includes normalization models for granular symptoms, pertinent negatives,
and discrete clinical flags.
"""

from typing import List, Optional, Dict, Any, Union
from pydantic import BaseModel, Field, model_validator


class SymptomItem(BaseModel):
    """Legacy symptom item for backward compatibility."""
    name: str = Field(..., description="Symptom name or short description")
    severity: Optional[str] = Field(default="moderate", description="e.g. mild, moderate, severe")
    duration: Optional[str] = Field(default=None, description="Reported duration")
    details: Optional[str] = Field(default=None, description="Additional contextual details")


class SymptomDetail(BaseModel):
    """Canonical granular symptom detail."""
    name: str = Field(..., description="Canonical symptom concept name (e.g. 'headache', 'chest pain')")
    severity: Optional[str] = Field(default=None, description="'mild', 'moderate', 'severe', or null if unspecified")
    duration: Optional[str] = Field(default=None, description="Reported duration (e.g. '2 days', 'since yesterday')")
    onset: Optional[str] = Field(default=None, description="'sudden', 'gradual', 'acute', or null if unspecified")
    frequency: Optional[str] = Field(default=None, description="'constant', 'intermittent', 'worsening', or null")
    duration_days: Optional[float] = Field(default=None, description="Reported duration in days if numerical")
    associated_symptoms: List[str] = Field(default_factory=list, description="Concurrent secondary symptoms")
    raw_expression: Optional[str] = Field(default=None, description="Verbatim patient statement")


class BleedingDetail(BaseModel):
    """Structured bleeding assessment."""
    present: bool = Field(..., description="Whether active bleeding is reported")
    source: Optional[str] = Field(
        default=None,
        description="'vomit', 'stool', 'rectal', 'cough_hemoptysis', 'urine', 'unspecified'"
    )
    severity: Optional[str] = Field(default=None, description="'mild', 'heavy', 'tarry_melena', or null")
    raw_expression: Optional[str] = Field(default=None, description="Verbatim patient statement")


class VitalsData(BaseModel):
    systolic_bp: Optional[float] = Field(default=None, description="Systolic blood pressure in mmHg")
    diastolic_bp: Optional[float] = Field(default=None, description="Diastolic blood pressure in mmHg")
    heart_rate: Optional[float] = Field(default=None, description="Heart rate in beats per minute")
    respiratory_rate: Optional[float] = Field(default=None, description="Respiratory rate in breaths per minute")
    spo2: Optional[float] = Field(default=None, description="Blood oxygen saturation percentage")
    temperature: Optional[float] = Field(default=None, description="Body temperature (assumed °F)")
    blood_glucose: Optional[float] = Field(default=None, description="Blood glucose level in mg/dL")


class MedicalLabValue(BaseModel):
    test_name: str
    value: float
    unit: str = ""
    reference_low: Optional[float] = None
    reference_high: Optional[float] = None
    source: str = "lab_report"


class ClinicalHistory(BaseModel):
    """
    Standardized, normalized clinical case-taking representation.
    Strict null semantics: unmentioned attributes remain null/None.
    """
    patient_id: Optional[str] = None
    age: Optional[int] = None
    gender: Optional[str] = None
    chief_complaints: List[str] = Field(default_factory=list)
    
    # Granular structured symptoms (supports SymptomDetail, legacy SymptomItem, or raw dicts/strings)
    symptoms: List[Union[SymptomDetail, SymptomItem, Dict[str, Any], str]] = Field(default_factory=list)
    
    # Pertinent Negatives (Explicitly denied by the patient)
    relevant_negative_symptoms: List[str] = Field(default_factory=list)
    
    # Treatments & Allergies
    medications: List[str] = Field(default_factory=list)
    allergies: List[str] = Field(default_factory=list)
    current_medications: List[str] = Field(default_factory=list)
    
    # Discrete Normalized Clinical Flags (Null if not mentioned by patient)
    loss_of_consciousness: Optional[bool] = Field(
        default=None,
        description="True if patient experienced syncope/blackout; False if explicitly denied; null if unmentioned"
    )
    breathing_difficulty: Optional[bool] = Field(
        default=None,
        description="True if dyspnea/shortness of breath; False if explicitly denied; null if unmentioned"
    )
    bleeding: Optional[Union[BleedingDetail, Dict[str, Any]]] = Field(
        default=None,
        description="Bleeding evaluation if reported; null if unmentioned"
    )
    confusion: Optional[bool] = Field(
        default=None,
        description="True if altered mental state/disorientation; False if denied; null if unmentioned"
    )
    neurological_symptoms: Optional[List[str]] = Field(
        default=None,
        description="List of focal neurological deficits (e.g. ['facial_droop', 'slurred_speech']); null if unmentioned"
    )
    ability_to_keep_fluids_down: Optional[bool] = Field(
        default=None,
        description="False if persistent vomiting/unable to retain water; True if retaining; null if unmentioned"
    )
    unable_to_keep_fluids: Optional[bool] = Field(
        default=None,
        description="True if unable to keep fluids down; False if retaining fluids; null if unmentioned"
    )
    blood_in_vomit: Optional[bool] = Field(
        default=None,
        description="True if blood present in vomit; False if denied; null if unmentioned"
    )
    dizziness: Optional[bool] = Field(
        default=None,
        description="True if lightheaded/dizzy; False if denied; null if unmentioned"
    )
    
    # Vitals, Labs & Context
    vitals: Optional[Union[VitalsData, Dict[str, Any]]] = None
    lab_values: List[Union[MedicalLabValue, Dict[str, Any]]] = Field(default_factory=list)
    medical_history: List[str] = Field(default_factory=list)
    ayush_context: Optional[Dict[str, Any]] = None

    @model_validator(mode="after")
    def sync_medications_and_flags(self):
        """Keep medications, fluids, and bleeding flags synced for backwards compatibility."""
        if self.current_medications and not self.medications:
            self.medications = list(self.current_medications)
        elif self.medications and not self.current_medications:
            self.current_medications = list(self.medications)

        # Sync unable_to_keep_fluids and ability_to_keep_fluids_down
        if self.unable_to_keep_fluids is not None and self.ability_to_keep_fluids_down is None:
            self.ability_to_keep_fluids_down = not self.unable_to_keep_fluids
        elif self.ability_to_keep_fluids_down is not None and self.unable_to_keep_fluids is None:
            self.unable_to_keep_fluids = not self.ability_to_keep_fluids_down

        # Sync blood_in_vomit and bleeding
        if self.blood_in_vomit is True and self.bleeding is None:
            self.bleeding = BleedingDetail(present=True, source="vomit")
        elif isinstance(self.bleeding, (BleedingDetail, dict)):
            source = getattr(self.bleeding, "source", None) or (self.bleeding.get("source") if isinstance(self.bleeding, dict) else None)
            present = getattr(self.bleeding, "present", False) or (self.bleeding.get("present", False) if isinstance(self.bleeding, dict) else False)
            if source == "vomit" and present and self.blood_in_vomit is None:
                self.blood_in_vomit = True

        return self


class RedFlagResult(BaseModel):
    detected: bool
    severity: str = Field(
        ...,
        description="'critical', 'urgent', 'warning', or 'none'"
    )
    category: str = Field(
        ...,
        description="'cardiovascular', 'neurological', 'respiratory', 'allergy_airway', 'gastrointestinal', 'sepsis_infection', 'none'"
    )
    rule_id: str = Field(
        ...,
        description="Unique identifier for the screening rule (e.g. 'RF_CARD_01')"
    )
    message: str = Field(
        ...,
        description="Standardized red-flag finding statement"
    )
    evidence: List[str] = Field(
        default_factory=list,
        description="Specific matched textual and vital cues"
    )
    recommendation: str = Field(
        ...,
        description="Action-oriented clinical triage step (non-diagnostic)"
    )
    disclaimer: str = (
        "Clinical decision-support aid for SIH26047. "
        "Does not constitute a medical diagnosis or replace clinical judgment."
    )
