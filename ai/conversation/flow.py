"""
ai/conversation/flow.py
=======================
Deterministic conversation flow and state machine for Member 4: AI Conversational Intelligence.

PURPOSE
-------
Manages deterministic progression through standard clinical case-taking interview stages,
calculates standardized completion progress, determines the next clinical topic to explore,
and coordinates with the dialogue SlotTracker.

DESIGN CONSTRAINTS
------------------
- Independent from external APIs, LLM providers, backend routes, and database engines.
- Operates directly on the Pydantic schemas in `ai.conversation.schemas`.
- Does NOT inspect or interpret raw patient text; receives structured slot updates only.
- Does NOT store SlotTracker inside `ConversationState.metadata`.
- Maintains independent SlotTracker instances across ConversationFlow objects.
"""

from __future__ import annotations

import uuid
from typing import Any, Dict, List, Optional, Union

from ai.conversation.schemas import (
    ConversationMessage,
    ConversationStage,
    ConversationState,
    MessageSender,
)
from ai.conversation.tracker import SlotEntry, SlotTracker


# ---------------------------------------------------------------------------
# Centralized Stage Configurations
# ---------------------------------------------------------------------------

# Deterministic order of clinical anamnesis:
# INTRODUCTION -> CHIEF_COMPLAINT -> HPI -> MEDICAL_HISTORY -> MEDICATIONS_ALLERGIES ->
# SOCIAL_HISTORY -> REVIEW_OF_SYSTEMS -> INVESTIGATIONS -> WRAP_UP -> COMPLETED
STAGE_ORDER: List[ConversationStage] = [
    ConversationStage.INTRODUCTION,
    ConversationStage.CHIEF_COMPLAINT,
    ConversationStage.HPI,
    ConversationStage.MEDICAL_HISTORY,
    ConversationStage.MEDICATIONS_ALLERGIES,
    ConversationStage.SOCIAL_HISTORY,
    ConversationStage.REVIEW_OF_SYSTEMS,
    ConversationStage.INVESTIGATIONS,
    ConversationStage.WRAP_UP,
    ConversationStage.COMPLETED,
]

# Centralized progress percentages (0 - 100)
STAGE_PROGRESS: Dict[ConversationStage, int] = {
    ConversationStage.INTRODUCTION: 5,
    ConversationStage.CHIEF_COMPLAINT: 15,
    ConversationStage.HPI: 35,
    ConversationStage.MEDICAL_HISTORY: 50,
    ConversationStage.MEDICATIONS_ALLERGIES: 65,
    ConversationStage.SOCIAL_HISTORY: 75,
    ConversationStage.REVIEW_OF_SYSTEMS: 85,
    ConversationStage.INVESTIGATIONS: 92,
    ConversationStage.WRAP_UP: 98,
    ConversationStage.COMPLETED: 100,
}

# Structured clinical topic mapping
STAGE_TOPICS: Dict[ConversationStage, str] = {
    ConversationStage.INTRODUCTION: "patient_greeting_and_rapport",
    ConversationStage.CHIEF_COMPLAINT: "chief_complaint",
    ConversationStage.HPI: "history_of_present_illness",
    ConversationStage.MEDICAL_HISTORY: "past_medical_history",
    ConversationStage.MEDICATIONS_ALLERGIES: "medications_and_allergies",
    ConversationStage.SOCIAL_HISTORY: "personal_and_social_history",
    ConversationStage.REVIEW_OF_SYSTEMS: "review_of_systems",
    ConversationStage.INVESTIGATIONS: "prior_investigations_and_reports",
    ConversationStage.WRAP_UP: "intake_wrap_up",
    ConversationStage.COMPLETED: "interview_completed",
}


# ---------------------------------------------------------------------------
# Conversation Flow Manager
# ---------------------------------------------------------------------------


class ConversationFlow:
    """
    Deterministic state machine for managing patient intake progression.
    Owns an independent SlotTracker to track conversational coverage.
    """

    def __init__(
        self,
        stage_order: Optional[List[ConversationStage]] = None,
        tracker: Optional[SlotTracker] = None,
    ) -> None:
        self.stage_order = stage_order or STAGE_ORDER
        self.tracker = tracker if tracker is not None else SlotTracker()

    @staticmethod
    def generate_session_id() -> str:
        """Generate a random unique intake session identifier."""
        return f"MED-{uuid.uuid4().hex[:8].upper()}"

    def start_interview(
        self,
        session_id: Optional[str] = None,
        language: str = "en",
        metadata: Optional[Dict[str, Any]] = None,
    ) -> ConversationState:
        """
        Initialize a new clinical intake conversation state at the introduction stage.
        Resets the internal slot tracker so every interview starts with a fresh state.
        """
        self.tracker.reset()
        sid = session_id or self.generate_session_id()
        initial_stage = self.stage_order[0]
        initial_progress = STAGE_PROGRESS.get(initial_stage, 5)

        return ConversationState(
            session_id=sid,
            stage=initial_stage,
            messages=[],
            progress=initial_progress,
            interview_complete=False,
            language=language,
            metadata=metadata or {},
        )

    def normalize_stage(self, stage: Union[ConversationStage, str]) -> ConversationStage:
        """
        Validate and normalize a stage input to a ConversationStage enum.
        Raises ValueError if the stage is unrecognized.
        """
        if isinstance(stage, ConversationStage):
            return stage
        try:
            return ConversationStage(str(stage))
        except ValueError:
            valid_stages = [s.value for s in self.stage_order]
            raise ValueError(
                f"Invalid conversation stage '{stage}'. Supported stages: {valid_stages}"
            )

    def get_current_stage(self, state: ConversationState) -> ConversationStage:
        """Return the current normalized stage from state."""
        return self.normalize_stage(state.stage)

    def get_progress_for_stage(self, stage: Union[ConversationStage, str]) -> int:
        """Return the centralized progress percentage for a given stage."""
        normalized = self.normalize_stage(stage)
        return STAGE_PROGRESS.get(normalized, 0)

    def is_complete(self, state: ConversationState) -> bool:
        """Determine whether the interview has concluded."""
        return state.interview_complete or self.get_current_stage(state) == ConversationStage.COMPLETED

    def get_next_stage(self, stage: Union[ConversationStage, str]) -> Optional[ConversationStage]:
        """
        Return the subsequent stage in the progression sequence.
        Returns None if already at or beyond the terminal completed stage.
        """
        normalized = self.normalize_stage(stage)
        try:
            idx = self.stage_order.index(normalized)
            if idx + 1 < len(self.stage_order):
                return self.stage_order[idx + 1]
            return None
        except ValueError:
            return None

    # -----------------------------------------------------------------------
    # Slot Tracking & Stage Sufficiency Methods
    # -----------------------------------------------------------------------

    def get_missing_slots(
        self,
        state: ConversationState,
        stage: Optional[Union[ConversationStage, str]] = None,
    ) -> List[str]:
        """
        Return the currently uncovered conversational slots for the requested stage,
        defaulting to the state's active stage.
        """
        target_stage = self.get_current_stage(state) if stage is None else self.normalize_stage(stage)
        return self.tracker.get_missing_slots(target_stage)

    def get_covered_slots(
        self,
        state: ConversationState,
        stage: Optional[Union[ConversationStage, str]] = None,
    ) -> List[SlotEntry]:
        """
        Return the covered SlotEntry objects (PROVIDED or DENIED) for the requested stage,
        defaulting to the state's active stage.
        """
        target_stage = self.get_current_stage(state) if stage is None else self.normalize_stage(stage)
        return self.tracker.get_covered_slots(target_stage)

    def update_slots(
        self,
        state: ConversationState,
        delta: Dict[str, Any],
        stage: Optional[Union[ConversationStage, str]] = None,
        turn_index: Optional[int] = None,
    ) -> List[SlotEntry]:
        """
        Pass explicitly supplied slot updates to the SlotTracker.
        Does NOT inspect or interpret raw patient text.
        Does NOT automatically advance the conversation stage.
        """
        target_stage = self.get_current_stage(state) if stage is None else self.normalize_stage(stage)
        return self.tracker.update_from_dict(target_stage, delta, turn_index=turn_index)

    def is_stage_sufficient(
        self,
        state: ConversationState,
        stage: Optional[Union[ConversationStage, str]] = None,
    ) -> bool:
        """
        Check whether the target stage has gathered sufficient conversational information.
        Delegates to SlotTracker's deterministic completion check (all stage slots covered).
        """
        target_stage = self.get_current_stage(state) if stage is None else self.normalize_stage(stage)
        return self.tracker.is_stage_complete(target_stage)

    def can_auto_advance(self, stage: Union[ConversationStage, str]) -> bool:
        """
        Determine whether a stage is eligible for automatic progression based on slot coverage.

        Stages without defined conversational slots (INTRODUCTION, WRAP_UP, COMPLETED)
        cannot auto-advance solely based on slot coverage and require deliberate stage transitions.
        """
        norm = self.normalize_stage(stage)
        return norm not in (
            ConversationStage.INTRODUCTION,
            ConversationStage.WRAP_UP,
            ConversationStage.COMPLETED,
        )

    def should_advance_stage(
        self,
        state: ConversationState,
        stage: Optional[Union[ConversationStage, str]] = None,
    ) -> bool:
        """
        Evaluate whether the conversation state should automatically advance from the target stage.

        Returns True if:
        1. The stage is eligible for automatic progression (can_auto_advance is True).
        2. All defined clinical slots for that stage have been covered (PROVIDED or DENIED).
        """
        target = self.get_current_stage(state) if stage is None else self.normalize_stage(stage)
        if not self.can_auto_advance(target):
            return False
        return self.is_stage_sufficient(state, stage=target)

    def get_stage_status(
        self,
        state: ConversationState,
        stage: Optional[Union[ConversationStage, str]] = None,
    ) -> Dict[str, Any]:
        """
        Return a JSON-serializable dictionary summarizing conversational slot coverage.

        Example return:
        {
            "stage": "hpi",
            "missing_slots": ["onset", "duration", "severity"],
            "covered_slots": [
                {"name": "location", "status": "provided", "value": "right side"}
            ],
            "is_sufficient": false
        }
        """
        target_stage = self.get_current_stage(state) if stage is None else self.normalize_stage(stage)
        missing = self.get_missing_slots(state, stage=target_stage)
        covered_entries = self.get_covered_slots(state, stage=target_stage)
        covered_list = [
            {
                "name": e.name,
                "status": e.status.value if hasattr(e.status, "value") else str(e.status),
                "value": e.value,
            }
            for e in covered_entries
        ]
        is_sufficient = self.is_stage_sufficient(state, stage=target_stage)

        return {
            "stage": target_stage.value,
            "missing_slots": missing,
            "covered_slots": covered_list,
            "is_sufficient": is_sufficient,
        }

    # -----------------------------------------------------------------------
    # Stage Advancement & Routing
    # -----------------------------------------------------------------------

    def advance_stage(
        self,
        state: ConversationState,
        require_sufficient: bool = False,
    ) -> ConversationState:
        """
        Advance the conversation state to the next clinical intake stage.

        Parameters
        ----------
        state : ConversationState
            The active conversation state to advance.
        require_sufficient : bool
            If True, checks if the current stage is sufficient before advancing.
            If the stage has unfilled slots and is not sufficient, advancement is blocked
            and the unchanged state is returned.
            If False (default), advances unconditionally (backwards-compatible).

        Edge cases handled:
        - If already completed: remains completed with 100% progress.
        - If advancing to final stage (COMPLETED): sets interview_complete to True.
        - Invalid/unrecognized stage: raises ValueError with clear diagnosis.
        """
        current_stage = self.get_current_stage(state)

        # Edge case: already completed
        if self.is_complete(state):
            state.stage = ConversationStage.COMPLETED
            state.interview_complete = True
            state.progress = 100
            return state

        # Check sufficiency if requested
        if require_sufficient and not self.is_stage_sufficient(state, current_stage):
            return state

        next_stage = self.get_next_stage(current_stage)

        if next_stage is None or next_stage == ConversationStage.COMPLETED:
            state.stage = ConversationStage.COMPLETED
            state.interview_complete = True
            state.progress = 100
        else:
            state.stage = next_stage
            state.progress = self.get_progress_for_stage(next_stage)
            state.interview_complete = False

        return state

    def get_next_topic_info(self, state: ConversationState) -> Dict[str, Any]:
        """
        Return a structured representation of the active topic and interview progress.

        Example return:
        {
            "stage": "hpi",
            "next_topic": "history_of_present_illness",
            "progress": 35,
            "interview_complete": false
        }
        """
        current_stage = self.get_current_stage(state)
        topic = STAGE_TOPICS.get(current_stage, current_stage.value)
        completed = self.is_complete(state)

        return {
            "stage": current_stage.value,
            "next_topic": topic,
            "progress": 100 if completed else state.progress,
            "interview_complete": completed,
        }

    def add_message(
        self,
        state: ConversationState,
        sender: Union[MessageSender, str],
        text: str,
        timestamp: Optional[str] = None,
        chips: Optional[List[str]] = None,
        metadata: Optional[Dict[str, Any]] = None,
    ) -> ConversationMessage:
        """
        Record a message turn in the conversation state.
        """
        if isinstance(sender, str):
            try:
                sender = MessageSender(sender)
            except ValueError:
                raise ValueError(
                    f"Invalid message sender '{sender}'. Must be 'patient', 'ai', or 'system'."
                )

        msg = ConversationMessage(
            id=f"msg-{len(state.messages) + 1}",
            sender=sender,
            text=text,
            timestamp=timestamp,
            chips=chips,
            metadata=metadata,
        )
        state.messages.append(msg)
        return msg
