"""
ai/conversation/engine.py
=========================
Conversational Engine interface for Member 4: AI Conversational Intelligence.

PURPOSE
-------
Coordinates dialogue state evaluation and conversational response generation
for the patient case-taking interview.

DESIGN CONSTRAINTS
------------------
- Independent from external LLM providers (OpenAI, Gemini, Anthropic, etc.).
- Does not execute diagnosis, red-flag detection, symptom extraction, or database queries.
- Uses `ConversationFlow` to evaluate stage, progress, and clinical topics.
- Modular architecture: placeholder response generation can be substituted with an LLM
  client without modifying `ConversationState`, `ConversationFlow`, or API contracts.
"""

from __future__ import annotations

from typing import Any, Dict, List, Optional

from ai.conversation.flow import ConversationFlow
from ai.conversation.provider import BaseLLMProvider, ProviderResult
from ai.conversation.schemas import (
    ConversationResponse,
    ConversationStage,
    ConversationState,
)



# ---------------------------------------------------------------------------
# Stage Placeholder Prompts & Suggested Quick Replies
# ---------------------------------------------------------------------------

# Stage-specific placeholder clinical prompts
STAGE_PROMPTS: Dict[ConversationStage, str] = {
    ConversationStage.INTRODUCTION: (
        "Hello. I'll ask you a few questions about your health today. What brings you in?"
    ),
    ConversationStage.CHIEF_COMPLAINT: (
        "What is the main problem or symptom you are experiencing?"
    ),
    ConversationStage.HPI: (
        "Can you tell me more about when this problem started and how it has changed?"
    ),
    ConversationStage.MEDICAL_HISTORY: (
        "Have you had any significant medical conditions or surgeries in the past?"
    ),
    ConversationStage.MEDICATIONS_ALLERGIES: (
        "Are you currently taking any medications, and do you have any known allergies?"
    ),
    ConversationStage.SOCIAL_HISTORY: (
        "Could you tell me a little about your occupation and lifestyle?"
    ),
    ConversationStage.REVIEW_OF_SYSTEMS: (
        "Apart from what you've mentioned, are you experiencing any other symptoms?"
    ),
    ConversationStage.INVESTIGATIONS: (
        "Have you had any tests, scans, or medical reports related to this problem?"
    ),
    ConversationStage.WRAP_UP: (
        "Thank you. Is there anything else you would like the doctor to know?"
    ),
    ConversationStage.COMPLETED: (
        "Thank you for completing this intake. Your pre-consultation summary has been prepared for your doctor."
    ),
}

# Stage-specific placeholder quick-reply chips
STAGE_CHIPS: Dict[ConversationStage, List[str]] = {
    ConversationStage.INTRODUCTION: [
        "Fever with chills & body ache",
        "Severe headache & dizziness",
        "Acidity, gas & stomach upset",
        "Persistent cough & sore throat",
    ],
    ConversationStage.CHIEF_COMPLAINT: [
        "Started since morning",
        "Past 2 to 3 days",
        "About a week ago",
        "Comes and goes intermittently",
    ],
    ConversationStage.HPI: [
        "Mild (manageable, able to work)",
        "Moderate (noticeable discomfort)",
        "Severe (unable to work / rest needed)",
        "Worsens with movement",
    ],
    ConversationStage.MEDICAL_HISTORY: [
        "No prior medical conditions",
        "Hypertension (high blood pressure)",
        "Type 2 Diabetes",
        "Past surgery / hospitalization",
    ],
    ConversationStage.MEDICATIONS_ALLERGIES: [
        "No regular medications",
        "Taking daily BP / diabetes tablets",
        "Took Paracetamol recently",
        "No known allergies",
        "Allergic to Penicillin",
    ],
    ConversationStage.SOCIAL_HISTORY: [
        "Non-smoker / non-drinker",
        "Desk job / sedentary work",
        "Active physical work",
    ],
    ConversationStage.REVIEW_OF_SYSTEMS: [
        "No other symptoms",
        "Fatigue / body weakness",
        "Loss of appetite",
        "Nausea or dizziness",
    ],
    ConversationStage.INVESTIGATIONS: [
        "No tests or scans done yet",
        "Blood test done recently",
        "X-ray / scan reports available",
    ],
    ConversationStage.WRAP_UP: [
        "Ready for doctor review",
        "Nothing else to add",
    ],
    ConversationStage.COMPLETED: [
        "End Interview & View Summary",
    ],
}


# ---------------------------------------------------------------------------
# Conversation Engine
# ---------------------------------------------------------------------------


class ConversationEngine:
    """
    Core conversational engine for Member 4.

    Evaluates the conversation state and produces structured interview responses.
    Can operate in deterministic mode (default) or leverage a pluggable LLM provider.
    """

    def __init__(
        self,
        flow: Optional[ConversationFlow] = None,
        provider: Optional[BaseLLMProvider] = None,
        auto_advance: bool = True,
    ) -> None:
        self.flow = flow or ConversationFlow()
        self.provider = provider
        self.auto_advance = auto_advance

    def _call_provider(
        self,
        state: ConversationState,
        stage: ConversationStage,
        topic: str,
        missing_slots: Optional[List[str]] = None,
        covered_slots: Optional[List[Any]] = None,
    ) -> ProviderResult:
        """
        Invoke the configured provider with backwards-compatibility for legacy providers.
        """
        if self.provider is None:
            raise RuntimeError("Provider is not configured")
        try:
            return self.provider.generate_turn(
                state=state,
                stage=stage,
                topic=topic,
                transcript=state.messages,
                missing_slots=missing_slots,
                covered_slots=covered_slots,
            )
        except TypeError:
            return self.provider.generate_turn(
                state=state,
                stage=stage,
                topic=topic,
                transcript=state.messages,
            )

    def generate_response(self, state: ConversationState) -> ConversationResponse:
        """
        Generate the next conversational response for the patient based on current state.

        If a provider is configured, delegates reply text and chip generation to it.
        Passes any structured slot updates returned by the provider to ConversationFlow.
        When a stage becomes sufficient, automatically advances to the subsequent stage
        and generates an appropriate transition prompt.
        If provider is not configured, falls back to deterministic stage-based placeholders.
        Stage, topic, progress, and completion are always managed by ConversationFlow.
        """
        current_stage = self.flow.get_current_stage(state)
        topic_info = self.flow.get_next_topic_info(state)
        is_complete = self.flow.is_complete(state)

        # Handle terminal completed state
        if is_complete:
            return ConversationResponse(
                reply_text=self._get_reply_text(ConversationStage.COMPLETED),
                stage=ConversationStage.COMPLETED,
                next_topic=topic_info["next_topic"],
                progress=100,
                interview_complete=True,
                chips=self._get_chips(ConversationStage.COMPLETED),
                slots_updated={},
            )

        slots_updated: Dict[str, Any] = {}

        if self.provider is not None:
            missing_slots = self.flow.get_missing_slots(state, current_stage)
            covered_slots = self.flow.get_covered_slots(state, current_stage)

            result = self._call_provider(
                state=state,
                stage=current_stage,
                topic=topic_info["next_topic"],
                missing_slots=missing_slots,
                covered_slots=covered_slots,
            )
            reply_text = result.reply_text
            chips = result.chips
            slots_updated = result.slots_updated or {}

            # Integrate structured slot updates into the flow's SlotTracker
            if slots_updated:
                delta = {
                    k: (
                        {"status": v.status, "value": v.value}
                        if hasattr(v, "status")
                        else v
                    )
                    for k, v in slots_updated.items()
                }
                self.flow.update_slots(
                    state=state,
                    delta=delta,
                    stage=current_stage,
                    turn_index=len(state.messages),
                )

            # Check if stage has become sufficient and should auto-advance
            if self.auto_advance and self.flow.should_advance_stage(state, current_stage):
                state = self.flow.advance_stage(state, require_sufficient=True)
                new_stage = self.flow.get_current_stage(state)
                new_topic_info = self.flow.get_next_topic_info(state)
                is_complete = self.flow.is_complete(state)

                # Formulate response for the NEW stage
                new_missing = self.flow.get_missing_slots(state, new_stage)
                new_covered = self.flow.get_covered_slots(state, new_stage)
                try:
                    transition_result = self._call_provider(
                        state=state,
                        stage=new_stage,
                        topic=new_topic_info["next_topic"],
                        missing_slots=new_missing,
                        covered_slots=new_covered,
                    )
                    reply_text = transition_result.reply_text
                    chips = transition_result.chips
                except Exception:
                    reply_text = self._get_reply_text(new_stage)
                    chips = self._get_chips(new_stage)

                current_stage = new_stage
                topic_info = new_topic_info
        else:
            # Deterministic fallback mode
            if self.auto_advance and self.flow.should_advance_stage(state, current_stage):
                state = self.flow.advance_stage(state, require_sufficient=True)
                current_stage = self.flow.get_current_stage(state)
                topic_info = self.flow.get_next_topic_info(state)
                is_complete = self.flow.is_complete(state)

            reply_text = self._get_reply_text(current_stage)
            chips = self._get_chips(current_stage)

        return ConversationResponse(
            reply_text=reply_text,
            stage=current_stage,
            next_topic=topic_info["next_topic"],
            progress=topic_info["progress"],
            interview_complete=is_complete,
            chips=chips,
            slots_updated=slots_updated,
        )

    def _get_reply_text(self, stage: ConversationStage) -> str:
        """
        Return the fallback conversational text for the active stage.
        """
        return STAGE_PROMPTS.get(
            stage,
            "Could you please share more details regarding your symptoms?",
        )

    def _get_chips(self, stage: ConversationStage) -> List[str]:
        """
        Return fallback quick-reply suggestions for the active stage.
        """
        return list(STAGE_CHIPS.get(stage, []))

