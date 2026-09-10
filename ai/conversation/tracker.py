"""
ai/conversation/tracker.py
==========================
Dialogue slot-tracking layer for Member 4: AI Conversational Intelligence.

PURPOSE
-------
Maintains turn-by-turn conversational coverage of clinical topics across interview stages.
Tracks whether specific clinical dimensions have been provided, explicitly denied,
or remain unasked.

ARCHITECTURAL BOUNDARIES & NON-GOALS
------------------------------------
- This module is STRICTLY a conversational coverage tracker for dialogue routing.
- It is NOT the final clinical extraction engine and does NOT construct the
  `shared.schemas.clinical_history.ClinicalHistory` model.
- Member 5 (ai/extraction) remains the sole owner of clinical extraction, normalization,
  and canonical validation.
- This module performs ZERO clinical interpretation, medical diagnosis, entity inference,
  or date calculations. It only stores slot updates explicitly provided to it.
"""

from __future__ import annotations

from enum import Enum
from typing import Any, Dict, List, Optional, Union

from pydantic import BaseModel, Field

from ai.conversation.schemas import ConversationStage


# ---------------------------------------------------------------------------
# Slot Status Enum
# ---------------------------------------------------------------------------


class SlotStatus(str, Enum):
    """
    Status of a clinical conversational slot.

    - UNCOVERED: Topic has not yet been addressed or raised in the conversation.
    - PROVIDED : Patient has explicitly mentioned or provided information for this slot.
    - DENIED   : Patient was asked or explicitly denied having symptoms/history in this slot.
    """

    UNCOVERED = "uncovered"
    PROVIDED = "provided"
    DENIED = "denied"


# ---------------------------------------------------------------------------
# Slot Entry Pydantic Model
# ---------------------------------------------------------------------------


class SlotEntry(BaseModel):
    """
    A single clinical slot tracked during the conversational intake.
    """

    name: str = Field(
        description="Canonical identifier of the conversational slot.",
    )

    status: SlotStatus = Field(
        default=SlotStatus.UNCOVERED,
        description="Current status of the slot (UNCOVERED, PROVIDED, or DENIED).",
    )

    value: Optional[str] = Field(
        default=None,
        description="Optional raw text or descriptive snippet as reported by the patient.",
    )

    turn_index: Optional[int] = Field(
        default=None,
        description="Optional turn index at which this slot was updated.",
    )

    class Config:
        extra = "forbid"
        use_enum_values = True


# ---------------------------------------------------------------------------
# Stage Slot Registry
# ---------------------------------------------------------------------------

STAGE_SLOT_DEFINITIONS: Dict[ConversationStage, List[str]] = {
    ConversationStage.CHIEF_COMPLAINT: [
        "primary_symptom",
        "affected_body_part",
    ],
    ConversationStage.HPI: [
        "onset",
        "duration",
        "severity",
        "location",
        "character",
        "aggravating_factors",
        "relieving_factors",
        "associated_symptoms",
    ],
    ConversationStage.MEDICAL_HISTORY: [
        "chronic_conditions",
        "prior_surgeries",
        "prior_hospitalizations",
    ],
    ConversationStage.MEDICATIONS_ALLERGIES: [
        "current_medications",
        "drug_allergies",
        "other_allergies",
    ],
    ConversationStage.SOCIAL_HISTORY: [
        "occupation",
        "tobacco_use",
        "alcohol_use",
    ],
    ConversationStage.REVIEW_OF_SYSTEMS: [
        "constitutional_symptoms",
        "targeted_system_symptoms",
    ],
    ConversationStage.INVESTIGATIONS: [
        "prior_tests_done",
        "reports_available",
    ],
    ConversationStage.INTRODUCTION: [],
    ConversationStage.WRAP_UP: [],
    ConversationStage.COMPLETED: [],
}


# ---------------------------------------------------------------------------
# Slot Tracker Class
# ---------------------------------------------------------------------------


class SlotTracker:
    """
    Stateful conversational slot manager.

    Maintains conversational presence/absence of clinical facts to help the
    dialogue engine avoid redundant questions and guide topic progression.
    """

    def __init__(self) -> None:
        self._slots: Dict[ConversationStage, Dict[str, SlotEntry]] = {}
        self.reset()

    def reset(self) -> None:
        """Initialize all defined conversational slots to UNCOVERED status."""
        self._slots = {}
        for stage, slot_names in STAGE_SLOT_DEFINITIONS.items():
            self._slots[stage] = {
                name: SlotEntry(name=name, status=SlotStatus.UNCOVERED)
                for name in slot_names
            }

    @staticmethod
    def normalize_stage(stage: Union[ConversationStage, str]) -> ConversationStage:
        """
        Validate and convert stage input to ConversationStage enum.
        Raises ValueError if stage is unknown.
        """
        if isinstance(stage, ConversationStage):
            return stage
        try:
            return ConversationStage(str(stage))
        except ValueError:
            valid_stages = [s.value for s in ConversationStage]
            raise ValueError(
                f"Invalid conversation stage '{stage}'. Supported stages: {valid_stages}"
            )

    @staticmethod
    def normalize_status(status: Union[SlotStatus, str]) -> SlotStatus:
        """
        Validate and convert status input to SlotStatus enum.
        Raises ValueError if status is unknown.
        """
        if isinstance(status, SlotStatus):
            return status
        try:
            return SlotStatus(str(status).lower())
        except ValueError:
            valid_statuses = [s.value for s in SlotStatus]
            raise ValueError(
                f"Invalid slot status '{status}'. Supported statuses: {valid_statuses}"
            )

    def get_stage_slots(self, stage: Union[ConversationStage, str]) -> List[SlotEntry]:
        """Return all SlotEntry objects defined for the given stage."""
        norm_stage = self.normalize_stage(stage)
        return list(self._slots.get(norm_stage, {}).values())

    def get_slot(self, stage: Union[ConversationStage, str], slot_name: str) -> SlotEntry:
        """
        Retrieve a specific SlotEntry for a stage.
        Raises ValueError if slot_name does not exist for the stage.
        """
        norm_stage = self.normalize_stage(stage)
        stage_slots = self._slots.get(norm_stage, {})
        if slot_name not in stage_slots:
            valid_names = list(stage_slots.keys())
            raise ValueError(
                f"Invalid slot '{slot_name}' for stage '{norm_stage.value}'. Allowed slots: {valid_names}"
            )
        return stage_slots[slot_name]

    def is_slot_covered(self, stage: Union[ConversationStage, str], slot_name: str) -> bool:
        """
        Determine if a slot has been addressed.
        A slot is covered if its status is either PROVIDED or DENIED.
        """
        slot = self.get_slot(stage, slot_name)
        return slot.status in (SlotStatus.PROVIDED, SlotStatus.DENIED)

    def get_missing_slots(self, stage: Union[ConversationStage, str]) -> List[str]:
        """
        Return names of slots in the stage that remain UNCOVERED.
        """
        norm_stage = self.normalize_stage(stage)
        return [
            entry.name
            for entry in self._slots.get(norm_stage, {}).values()
            if entry.status == SlotStatus.UNCOVERED
        ]

    def get_covered_slots(self, stage: Union[ConversationStage, str]) -> List[SlotEntry]:
        """
        Return SlotEntry objects in the stage that have been PROVIDED or DENIED.
        """
        norm_stage = self.normalize_stage(stage)
        return [
            entry
            for entry in self._slots.get(norm_stage, {}).values()
            if entry.status in (SlotStatus.PROVIDED, SlotStatus.DENIED)
        ]

    def update_slot(
        self,
        stage: Union[ConversationStage, str],
        slot_name: str,
        status: Union[SlotStatus, str],
        value: Optional[str] = None,
        turn_index: Optional[int] = None,
    ) -> SlotEntry:
        """
        Update an individual slot's status, value, and turn index.
        """
        norm_stage = self.normalize_stage(stage)
        norm_status = self.normalize_status(status)

        slot = self.get_slot(norm_stage, slot_name)
        slot.status = norm_status
        slot.value = value
        slot.turn_index = turn_index

        return slot

    def update_from_dict(
        self,
        stage: Union[ConversationStage, str],
        delta: Dict[str, Any],
        turn_index: Optional[int] = None,
    ) -> List[SlotEntry]:
        """
        Update multiple slots in a stage using a dictionary payload.

        Supported structure:
        {
            "onset": {
                "status": "provided",
                "value": "since 8 AM"
            },
            "associated_symptoms": {
                "status": "denied",
                "value": "nausea and vomiting"
            }
        }
        """
        norm_stage = self.normalize_stage(stage)
        updated_entries: List[SlotEntry] = []

        for slot_name, payload in delta.items():
            if isinstance(payload, dict):
                status_raw = payload.get("status", SlotStatus.PROVIDED)
                val = payload.get("value")
            elif isinstance(payload, str):
                # Convenient fallback: string value implies provided
                status_raw = SlotStatus.PROVIDED
                val = payload
            else:
                raise ValueError(
                    f"Invalid payload for slot '{slot_name}': {payload}. "
                    "Expected dict with 'status' and 'value'."
                )

            updated = self.update_slot(
                stage=norm_stage,
                slot_name=slot_name,
                status=status_raw,
                value=val,
                turn_index=turn_index,
            )
            updated_entries.append(updated)

        return updated_entries

    def is_stage_complete(self, stage: Union[ConversationStage, str]) -> bool:
        """
        Deterministic completion check for a clinical stage.

        DETERMINISTIC RULE:
        A stage is considered complete when ALL defined conversational slots
        for that stage are covered (i.e. status is either PROVIDED or DENIED).
        Stages with no defined slots (e.g. INTRODUCTION, WRAP_UP, COMPLETED)
        return True by default.
        """
        slots = self.get_stage_slots(stage)
        if not slots:
            return True
        return all(entry.status in (SlotStatus.PROVIDED, SlotStatus.DENIED) for entry in slots)
