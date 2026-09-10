"""
shared/schemas/clinical_history.py
====================================
Canonical Pydantic model for a structured patient clinical history.

PURPOSE
-------
This model is the single source of truth for structured clinical data in the
SIH26047 Patient Case-Taking system. It is imported by:
  - ai/extraction  : LLM extraction output is validated against this model
  - ai/summary     : Summary generator reads from this model
  - backend        : API routes use this model for request/response typing
  - redflag        : Red-flag engine reads from this model (read-only)

SAFETY NOTICE
-------------
This schema represents information REPORTED or EXTRACTED from a patient intake
conversation only. It does NOT contain and MUST NOT be extended to contain:
  - AI-generated diagnoses
  - Disease predictions
  - Treatment or medication recommendations
  - Prescriptions
  - Autonomous clinical decisions

The doctor remains fully responsible for clinical interpretation.

NULL SEMANTICS
--------------
This schema distinguishes "not mentioned" from an explicit answer.
For Optional[List[...]] fields: None → never mentioned; [] → explicitly none; value → explicitly stated.
For Optional[str] (and other scalar Optional[...]) fields: None → never mentioned; value → explicitly stated (including "no"/"unknown").

Do NOT conflate "not mentioned" with an explicit negative. The extraction module must
preserve this distinction exactly.
"""

from __future__ import annotations

from typing import List, Optional

from pydantic import BaseModel, Field


# ---------------------------------------------------------------------------
# Sub-models
# ---------------------------------------------------------------------------


class HistoryOfPresentIllness(BaseModel):
    """
    The history of the patient's current presenting complaint.

    All fields are Optional[str] or Optional[List[str]].
    None means the topic was never raised. For list fields, an empty list
    means the patient was asked and explicitly reported none. For scalar
    fields, explicit negatives are stored as their string value.
    """

    onset: Optional[str] = Field(
        default=None,
        description=(
            "When the current problem started, as stated by the patient. "
            "Examples: 'yesterday morning', '3 days ago', 'gradually over 2 weeks'. "
            "None if never mentioned."
        ),
    )

    duration: Optional[str] = Field(
        default=None,
        description=(
            "How long the problem has been present, as stated by the patient. "
            "Examples: '3 days', 'about a week', 'for the past month'. "
            "None if never mentioned."
        ),
    )

    severity: Optional[str] = Field(
        default=None,
        description=(
            "Severity of the complaint, exactly as described by the patient. "
            "Stored as a string to preserve patient language: '7 out of 10', "
            "'very severe', 'mild', 'unbearable'. "
            "None if never mentioned."
        ),
    )

    location: Optional[str] = Field(
        default=None,
        description=(
            "Anatomical location of the complaint as stated by the patient. "
            "Examples: 'left side of my chest', 'lower back', 'behind the eyes'. "
            "None if never mentioned."
        ),
    )

    character: Optional[str] = Field(
        default=None,
        description=(
            "Quality or character of the complaint as stated by the patient. "
            "Examples: 'sharp', 'burning', 'throbbing', 'dull ache', 'pressure-like'. "
            "None if never mentioned."
        ),
    )

    aggravating_factors: Optional[List[str]] = Field(
        default=None,
        description=(
            "Factors the patient reports make the problem worse. "
            "None if the topic was never raised. "
            "Empty list [] if patient was asked and explicitly reported none."
        ),
    )

    relieving_factors: Optional[List[str]] = Field(
        default=None,
        description=(
            "Factors the patient reports make the problem better. "
            "None if the topic was never raised. "
            "Empty list [] if patient was asked and explicitly reported none."
        ),
    )

    associated_symptoms: Optional[List[str]] = Field(
        default=None,
        description=(
            "Other symptoms the patient reports alongside the chief complaint. "
            "None if the topic was never raised. "
            "Empty list [] if patient was asked and explicitly denied any."
        ),
    )

    class Config:
        extra = "forbid"


class Medication(BaseModel):
    """
    A single medication as reported by the patient.

    Only name is required because a patient may name a drug without
    knowing or stating the dose and frequency.
    """

    name: str = Field(
        description="Name of the medication as stated by the patient."
    )

    dosage: Optional[str] = Field(
        default=None,
        description=(
            "Dose as stated by the patient. "
            "Examples: '500mg', '10mg', 'one tablet'. "
            "None if not mentioned."
        ),
    )

    frequency: Optional[str] = Field(
        default=None,
        description=(
            "How often the patient takes this medication, as stated. "
            "Examples: 'twice a day', 'at night', 'as needed'. "
            "None if not mentioned."
        ),
    )

    class Config:
        extra = "forbid"


class PersonalSocialHistory(BaseModel):
    """
    Personal and social history as reported by the patient.

    smoking and alcohol are Optional[str], NOT bool, because the patient
    may describe nuanced usage: 'ex-smoker', '10 cigarettes a day',
    'occasional social drinking'. A boolean cannot represent this.

    None means the topic was never raised in the conversation.
    """

    smoking: Optional[str] = Field(
        default=None,
        description=(
            "Smoking status as described by the patient. "
            "Examples: 'never smoked', 'ex-smoker, quit 5 years ago', "
            "'smokes about 10 cigarettes a day'. "
            "None if never mentioned."
        ),
    )

    alcohol: Optional[str] = Field(
        default=None,
        description=(
            "Alcohol use as described by the patient. "
            "Examples: 'does not drink', 'occasional social drinking', "
            "'drinks daily'. "
            "None if never mentioned."
        ),
    )

    occupation: Optional[str] = Field(
        default=None,
        description=(
            "Patient's occupation as stated. "
            "Examples: 'software engineer', 'farmer', 'retired teacher'. "
            "None if never mentioned."
        ),
    )

    class Config:
        extra = "forbid"


# ---------------------------------------------------------------------------
# Root model
# ---------------------------------------------------------------------------


class ClinicalHistory(BaseModel):
    """
    Canonical structured clinical history extracted from a patient intake
    conversation.

    This is the primary data contract shared across all modules. Do NOT
    create duplicate versions of this model in other modules. Always import
    from shared.schemas.

    All top-level fields are Optional. None means that section of the
    clinical history was never addressed in the conversation. An empty
    list [] means the patient was asked and explicitly reported nothing
    in that category.
    """

    chief_complaint: Optional[str] = Field(
        default=None,
        description=(
            "The patient's primary reason for seeking care, in their own words. "
            "Examples: 'chest pain', 'I have been having headaches for 3 days'. "
            "None if the patient never stated a complaint."
        ),
    )

    history_of_present_illness: Optional[HistoryOfPresentIllness] = Field(
        default=None,
        description=(
            "Structured details about the current presenting complaint. "
            "None if HPI was never discussed."
        ),
    )

    past_medical_history: Optional[List[str]] = Field(
        default=None,
        description=(
            "Medical conditions, surgeries, or hospitalisations the patient "
            "reports having had in the past. "
            "None if the topic was never raised. "
            "Empty list [] if patient was asked and explicitly denied any history."
        ),
    )

    medications: Optional[List[Medication]] = Field(
        default=None,
        description=(
            "Medications the patient reports currently taking. "
            "None if the topic was never raised. "
            "Empty list [] if patient was asked and explicitly denied taking any."
        ),
    )

    allergies: Optional[List[str]] = Field(
        default=None,
        description=(
            "Allergies the patient reports, including drug, food, and environmental. "
            "None if the topic was never raised. "
            "Empty list [] if patient was asked and explicitly denied any allergies."
        ),
    )

    family_history: Optional[List[str]] = Field(
        default=None,
        description=(
            "Relevant medical conditions in the patient's family, as reported. "
            "Examples: 'father had diabetes', 'mother had hypertension'. "
            "None if the topic was never raised. "
            "Empty list [] if patient was asked and explicitly denied any."
        ),
    )

    personal_social_history: Optional[PersonalSocialHistory] = Field(
        default=None,
        description=(
            "Personal and social background as reported by the patient. "
            "None if this section was never discussed."
        ),
    )

    review_of_systems: Optional[List[str]] = Field(
        default=None,
        description=(
            "Positive findings from a review of systems, as reported by the patient. "
            "Each entry is a symptom or finding in a particular body system. "
            "Examples: ['shortness of breath', 'occasional palpitations']. "
            "None if a formal review of systems was never conducted. "
            "Empty list [] if reviewed with no positive findings reported."
        ),
    )

    investigations: Optional[List[str]] = Field(
        default=None,
        description=(
            "Tests, scans, or investigations the patient reports having had. "
            "This captures what the patient MENTIONS — not the actual report content "
            "(which is handled by the OCR module). "
            "Examples: ['blood test last week', 'chest X-ray in June', 'ECG done today']. "
            "None if never mentioned. "
            "Empty list [] if patient was asked and denied having any."
        ),
    )

    class Config:
        extra = "forbid"
