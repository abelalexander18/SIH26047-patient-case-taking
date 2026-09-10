"""
ai/conversation/schemas.py
==========================
Foundational conversation-state schemas for Member 4: AI Conversational Intelligence.

PURPOSE
-------
Defines canonical Pydantic models for live patient-AI dialogue management,
tracking interview stages, message progression, and intake completion state.

ARCHITECTURAL FIT
-----------------
- Member 4 (AI Conversation Engine) maintains and updates `ConversationState`
  and logs each turn as `ConversationMessage`.
- At interview completion, `ConversationState.messages` (the full transcript)
  is passed to Member 5 (ai/extraction) to be parsed into the canonical
  `shared.schemas.clinical_history.ClinicalHistory` model.
- Member 3 (Backend) uses these schemas for typing turn-by-turn API requests/responses.
"""

from __future__ import annotations

from enum import Enum
from typing import Any, Dict, List, Optional

from pydantic import BaseModel, Field


# ---------------------------------------------------------------------------
# Enums
# ---------------------------------------------------------------------------


class MessageSender(str, Enum):
    """
    Originator of a conversation message.
    """

    PATIENT = "patient"
    AI = "ai"
    SYSTEM = "system"


class SlotUpdateStatus(str, Enum):
    """
    Valid statuses for turn-level conversational slot updates.
    """

    PROVIDED = "provided"
    DENIED = "denied"


class ConversationStage(str, Enum):
    """
    Standard clinical case-taking interview stages.

    Progression follows standard clinical anamnesis protocols:
    from initial rapport and chief complaint exploration down to
    systemic review, prior investigations, and final handoff.
    """

    INTRODUCTION = "introduction"
    CHIEF_COMPLAINT = "chief_complaint"
    HPI = "hpi"
    MEDICAL_HISTORY = "medical_history"
    MEDICATIONS_ALLERGIES = "medications_allergies"
    SOCIAL_HISTORY = "social_history"
    REVIEW_OF_SYSTEMS = "review_of_systems"
    INVESTIGATIONS = "investigations"
    WRAP_UP = "wrap_up"
    COMPLETED = "completed"


# ---------------------------------------------------------------------------
# Message Models
# ---------------------------------------------------------------------------


class ConversationMessage(BaseModel):
    """
    A single message turn in the patient-AI clinical interview.
    """

    id: Optional[str] = Field(
        default=None,
        description="Unique identifier for the message (e.g. UUID or 'msg-123').",
    )

    sender: MessageSender = Field(
        description="Origin of the message: 'patient', 'ai', or 'system'.",
    )

    text: str = Field(
        description="Text content of the message.",
    )

    timestamp: Optional[str] = Field(
        default=None,
        description="Timestamp when the message was recorded (ISO 8601 or local IST formatted string).",
    )

    chips: Optional[List[str]] = Field(
        default=None,
        description="Optional quick-reply chips presented to the patient alongside an AI message.",
    )

    metadata: Optional[Dict[str, Any]] = Field(
        default=None,
        description=(
            "Lightweight turn-level metadata (e.g. detected language, sentiment, "
            "clinical entity tags, or attached file references)."
        ),
    )

    class Config:
        extra = "forbid"
        use_enum_values = True


# Convenient alias
Message = ConversationMessage


# ---------------------------------------------------------------------------
# Conversation State Model
# ---------------------------------------------------------------------------


class ConversationState(BaseModel):
    """
    Live state of a patient clinical intake interview session.

    Tracks active dialogue history, current clinical exploration stage,
    completion progress, and safety escalation indicators.
    """

    session_id: str = Field(
        description="Unique session or interview identifier (e.g. 'MED-48192').",
    )

    stage: ConversationStage = Field(
        default=ConversationStage.INTRODUCTION,
        description="Current clinical stage of the intake interview.",
    )

    messages: List[ConversationMessage] = Field(
        default_factory=list,
        description="Chronological history of all messages exchanged in the session.",
    )

    progress: int = Field(
        default=0,
        ge=0,
        le=100,
        description="Estimated clinical interview progress percentage (0 to 100).",
    )

    interview_complete: bool = Field(
        default=False,
        description="Flag indicating whether the patient intake is concluded and ready for extraction.",
    )

    language: Optional[str] = Field(
        default="en",
        description="Primary language or locale for the conversation (e.g. 'en', 'hi', 'hinglish').",
    )

    red_flags_alert: bool = Field(
        default=False,
        description="Flag indicating if any safety red flag or emergency symptom was flagged.",
    )

    metadata: Optional[Dict[str, Any]] = Field(
        default_factory=dict,
        description="Optional session-level metadata (e.g. patient demographics, source channel).",
    )

    class Config:
        extra = "forbid"
        use_enum_values = True


# ---------------------------------------------------------------------------
# Slot Update Models
# ---------------------------------------------------------------------------


class SlotUpdateItem(BaseModel):
    """
    A single structured conversational slot update reported by an LLM provider.

    Attributes:
    -----------
    status : SlotUpdateStatus
        Whether the patient explicitly provided or denied the information ('provided' or 'denied').
    value : Optional[str]
        Concise raw phrase or description as communicated by the patient (None if denied or omitted).
    """

    status: SlotUpdateStatus = Field(
        description="Status of the slot: 'provided' (information stated) or 'denied' (information denied/ruled out).",
    )

    value: Optional[str] = Field(
        default=None,
        description="Optional concise descriptive snippet or phrasing as communicated by the patient.",
    )

    class Config:
        extra = "forbid"
        use_enum_values = True


# ---------------------------------------------------------------------------
# Engine Response Model
# ---------------------------------------------------------------------------


class ConversationResponse(BaseModel):
    """
    Structured output returned by the ConversationEngine for an interview turn.
    """

    reply_text: str = Field(
        description="The conversational prompt or reply formulated for the patient.",
    )

    stage: ConversationStage = Field(
        description="The active clinical stage of the conversation.",
    )

    next_topic: str = Field(
        description="The clinical topic/intent of the turn.",
    )

    progress: int = Field(
        ge=0,
        le=100,
        description="Estimated intake completion progress (0 to 100).",
    )

    interview_complete: bool = Field(
        description="Whether the intake interview is concluded.",
    )

    chips: List[str] = Field(
        default_factory=list,
        description="Suggested quick-reply options presented to the patient.",
    )

    slots_updated: Dict[str, SlotUpdateItem] = Field(
        default_factory=dict,
        description="Structured dialogue slot updates extracted from the turn.",
    )

    class Config:
        extra = "forbid"
        use_enum_values = True

