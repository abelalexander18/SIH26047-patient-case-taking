"""
ai/conversation/provider.py
===========================
LLM provider abstraction for Member 4: AI Conversational Intelligence.

PURPOSE
-------
Defines the abstract interface for LLM-powered dialogue generation and provides:
1. `MockLLMProvider`: A deterministic mock provider for unit testing and local development.
2. `GeminiProvider`: Production provider using the official `google-genai` SDK with structured JSON output.

DESIGN CONSTRAINTS
------------------
- API key is retrieved from GEMINI_API_KEY environment variable. Never hardcoded.
- Does NOT perform diagnosis, red-flag detection, or clinical extraction.
- Completely isolated from database, backend, and frontend dependencies.
- Provider errors and exceptions never expose API keys or credentials.
"""

from __future__ import annotations

import json
import os
from abc import ABC, abstractmethod
from typing import Any, Dict, List, Optional, Union

from google import genai
from google.genai import types
from pydantic import BaseModel, Field

from ai.conversation.prompts import (
    CLINICAL_INTERVIEW_SYSTEM_PROMPT,
    CONVERSATION_RESPONSE_INSTRUCTIONS,
)
from ai.conversation.schemas import (
    ConversationMessage,
    ConversationStage,
    ConversationState,
    SlotUpdateItem,
    SlotUpdateStatus,
)
from ai.conversation.tracker import STAGE_SLOT_DEFINITIONS


# ---------------------------------------------------------------------------
# Provider Result Contract
# ---------------------------------------------------------------------------


class ProviderResult(BaseModel):
    """
    Standardized result returned by an LLM provider for a single conversational turn.
    """

    reply_text: str = Field(
        description="The conversational text generated for the patient.",
    )

    chips: List[str] = Field(
        default_factory=list,
        description="Suggested quick-reply options presented to the patient.",
    )

    slots_updated: Dict[str, SlotUpdateItem] = Field(
        default_factory=dict,
        description="Structured dialogue slot updates extracted from the turn.",
    )

    raw_response: Optional[Any] = Field(
        default=None,
        description="Optional raw response object or metadata from the provider.",
    )

    class Config:
        extra = "forbid"
        use_enum_values = True


# ---------------------------------------------------------------------------
# Internal Gemini Output Schema
# ---------------------------------------------------------------------------


class _GeminiSlotUpdate(BaseModel):
    """
    Internal schema for slot updates within Gemini structured output.
    Omits extra='forbid' for google-genai schema validation compatibility.
    """

    status: SlotUpdateStatus = Field(
        description="Status of the slot: 'provided' or 'denied'.",
    )

    value: Optional[str] = Field(
        default=None,
        description="Concise description or phrase reported by the patient (or null if denied).",
    )


class _GeminiTurnOutput(BaseModel):
    """
    Internal schema used for Gemini structured JSON output generation.
    Omits extra='forbid' for google-genai schema validation compatibility.
    """

    reply_text: str = Field(
        description="The conversational prompt or reply formulated for the patient.",
    )

    chips: List[str] = Field(
        default_factory=list,
        description="Suggested quick-reply options presented to the patient.",
    )

    slots_updated: Dict[str, _GeminiSlotUpdate] = Field(
        default_factory=dict,
        description="Stage-specific clinical slots updated from the patient's message.",
    )


# ---------------------------------------------------------------------------
# Slot Validation Helpers
# ---------------------------------------------------------------------------


def validate_stage_slots(
    stage: Union[ConversationStage, str],
    slots: Dict[str, Any],
    strict: bool = False,
) -> Dict[str, SlotUpdateItem]:
    """
    Validate that slot updates conform to the active stage's allowed slots and schema.

    Parameters
    ----------
    stage : Union[ConversationStage, str]
        The active conversation stage.
    slots : Dict[str, Any]
        Dictionary of slot names to slot update payloads or SlotUpdateItem instances.
    strict : bool
        If True, raises ValueError when an unknown slot name is encountered.
        If False (default), filters out unknown slot names.

    Returns
    -------
    Dict[str, SlotUpdateItem]
        Validated dictionary containing only allowed slot names for the active stage.
    """
    norm_stage = stage if isinstance(stage, ConversationStage) else ConversationStage(str(stage))
    allowed_slots = set(STAGE_SLOT_DEFINITIONS.get(norm_stage, []))

    validated: Dict[str, SlotUpdateItem] = {}
    for slot_name, payload in (slots or {}).items():
        if slot_name not in allowed_slots:
            if strict:
                raise ValueError(
                    f"Invalid slot name '{slot_name}' for stage '{norm_stage.value}'. "
                    f"Allowed slots: {sorted(list(allowed_slots))}"
                )
            # Filter out invalid slot name so it does not enter structured data
            continue

        if isinstance(payload, SlotUpdateItem):
            validated[slot_name] = payload
        elif isinstance(payload, dict):
            status_val = payload.get("status")
            if isinstance(status_val, str):
                status_val = status_val.lower().strip()
            val = payload.get("value")
            if isinstance(val, str):
                val = val.strip()
            validated[slot_name] = SlotUpdateItem(status=status_val, value=val)
        elif hasattr(payload, "status"):
            status_val = getattr(payload, "status")
            if isinstance(status_val, str):
                status_val = status_val.lower().strip()
            val = getattr(payload, "value", None)
            if isinstance(val, str):
                val = val.strip()
            validated[slot_name] = SlotUpdateItem(status=status_val, value=val)
        else:
            raise ValueError(f"Invalid payload for slot '{slot_name}': {payload}")

    return validated



# ---------------------------------------------------------------------------
# Abstract LLM Provider Interface
# ---------------------------------------------------------------------------


class BaseLLMProvider(ABC):
    """
    Abstract interface for LLM conversation providers (Gemini, OpenAI, Claude, etc.).
    """

    @abstractmethod
    def generate_turn(
        self,
        state: ConversationState,
        stage: ConversationStage,
        topic: str,
        transcript: List[ConversationMessage],
        missing_slots: Optional[List[str]] = None,
        covered_slots: Optional[List[Any]] = None,
    ) -> ProviderResult:
        """
        Generate an adaptive clinical interview response and suggested quick replies.

        Parameters
        ----------
        state : ConversationState
            The current active conversation state.
        stage : ConversationStage
            The active clinical case-taking stage.
        topic : str
            The clinical topic/objective for the turn (e.g. 'history_of_present_illness').
        transcript : List[ConversationMessage]
            Ordered history of dialogue turns exchanged so far.
        missing_slots : Optional[List[str]]
            List of currently uncovered slot names for the active stage.
        covered_slots : Optional[List[Any]]
            List of already covered slot objects or names for the active stage.

        Returns
        -------
        ProviderResult
            Structured result containing generated reply_text, chips, and slots_updated.
        """
        pass


# ---------------------------------------------------------------------------
# Mock LLM Provider Implementation
# ---------------------------------------------------------------------------


class MockLLMProvider(BaseLLMProvider):
    """
    Deterministic mock LLM provider for local testing and architectural validation.
    Simulates adaptive clinical responses without requiring external network calls or API keys.
    """

    def __init__(
        self,
        custom_responses: Optional[Dict[ConversationStage, ProviderResult]] = None,
        prefix: str = "[Mock AI] ",
        turn_handler: Optional[Any] = None,
    ) -> None:
        self.custom_responses = custom_responses or {}
        self.prefix = prefix
        self.turn_handler = turn_handler
        self.last_missing_slots: Optional[List[str]] = None
        self.last_covered_slots: Optional[List[Any]] = None

    def generate_turn(
        self,
        state: ConversationState,
        stage: ConversationStage,
        topic: str,
        transcript: List[ConversationMessage],
        missing_slots: Optional[List[str]] = None,
        covered_slots: Optional[List[Any]] = None,
    ) -> ProviderResult:
        """
        Generate a deterministic mock response based on the active stage and transcript.
        """
        self.last_missing_slots = missing_slots
        self.last_covered_slots = covered_slots

        if self.turn_handler is not None:
            return self.turn_handler(
                state=state,
                stage=stage,
                topic=topic,
                transcript=transcript,
                missing_slots=missing_slots,
                covered_slots=covered_slots,
            )

        # Allow pre-configured custom stage overrides
        if stage in self.custom_responses:
            return self.custom_responses[stage]

        # Extract last patient message if available for mock contextual acknowledgement
        last_patient_text = None
        for msg in reversed(transcript):
            if msg.sender == "patient":
                last_patient_text = msg.text
                break

        ack = ""
        if last_patient_text:
            short_text = last_patient_text[:32] + ("..." if len(last_patient_text) > 32 else "")
            ack = f"Understood regarding '{short_text}'. "

        stage_mock_data: Dict[ConversationStage, tuple[str, List[str]]] = {
            ConversationStage.INTRODUCTION: (
                f"{self.prefix}Namaste. I am your clinical intake assistant. What primary symptoms bring you in today?",
                ["Fever & chills", "Severe headache", "Stomach pain / acidity", "General consultation"],
            ),
            ConversationStage.CHIEF_COMPLAINT: (
                f"{self.prefix}{ack}Could you tell me more about your main symptom and when you first noticed it?",
                ["Started since morning", "Past 2 to 3 days", "About a week ago", "Comes and goes"],
            ),
            ConversationStage.HPI: (
                f"{self.prefix}{ack}On a scale of mild, moderate, to severe, how intense is it? Does anything make it better or worse?",
                ["Mild (manageable)", "Moderate discomfort", "Severe, cannot work", "Worsens with movement"],
            ),
            ConversationStage.MEDICAL_HISTORY: (
                f"{self.prefix}Do you have any existing health conditions like high blood pressure, diabetes, or prior surgeries?",
                ["No prior conditions", "Hypertension (BP)", "Type 2 Diabetes", "Asthma"],
            ),
            ConversationStage.MEDICATIONS_ALLERGIES: (
                f"{self.prefix}Are you currently taking any prescription medications or over-the-counter pills? Any known drug allergies?",
                ["No regular medications", "Daily BP / diabetes tablets", "Took Paracetamol recently", "Allergic to Penicillin"],
            ),
            ConversationStage.SOCIAL_HISTORY: (
                f"{self.prefix}Could you tell me a little about your daily work and whether you consume tobacco or alcohol?",
                ["Desk job / sedentary", "Active physical work", "Non-smoker, non-drinker", "Occasional alcohol"],
            ),
            ConversationStage.REVIEW_OF_SYSTEMS: (
                f"{self.prefix}Are you noticing any other symptoms like unusual fatigue, breathing difficulty, dizziness, or nausea?",
                ["No other symptoms", "Mild fatigue / weakness", "Loss of appetite", "Nausea or dizziness"],
            ),
            ConversationStage.INVESTIGATIONS: (
                f"{self.prefix}Have you had any recent lab tests, blood reports, or X-rays related to this issue?",
                ["No tests done yet", "Blood test done recently", "Have reports to upload"],
            ),
            ConversationStage.WRAP_UP: (
                f"{self.prefix}Thank you. Is there anything else you would like your consulting doctor to know before your visit?",
                ["Ready for doctor review", "Nothing else to add"],
            ),
            ConversationStage.COMPLETED: (
                f"{self.prefix}Intake complete. Your pre-consultation summary has been compiled for your doctor.",
                ["End Interview & View Summary"],
            ),
        }

        reply_text, chips = stage_mock_data.get(
            stage,
            (
                f"{self.prefix}Could you share a little more detail regarding your health?",
                ["Yes", "No"],
            ),
        )

        return ProviderResult(reply_text=reply_text, chips=chips)


# ---------------------------------------------------------------------------
# Google Gemini LLM Provider Implementation
# ---------------------------------------------------------------------------


class GeminiProvider(BaseLLMProvider):
    """
    Google Gemini LLM provider implementation for Member 4: AI Conversational Intelligence.
    Uses the official `google-genai` SDK with native JSON structured output.
    """

    DEFAULT_MODEL = "gemini-3.6-flash"

    def __init__(
        self,
        api_key: Optional[str] = None,
        model: Optional[str] = None,
        temperature: float = 0.2,
        client: Optional[Any] = None,
    ) -> None:
        """
        Initialize GeminiProvider.

        Parameters
        ----------
        api_key : Optional[str]
            Gemini API key. Defaults to the GEMINI_API_KEY environment variable.
        model : Optional[str]
            Gemini model identifier (default: 'gemini-3.6-flash').
        temperature : float
            Sampling temperature for generation (default: 0.2).
        client : Optional[Any]
            Pre-configured google.genai.Client instance (useful for testing/injection).
        """
        self.api_key = api_key or os.environ.get("GEMINI_API_KEY")
        self.model = model or self.DEFAULT_MODEL
        self.temperature = temperature
        self._client = client

    def _get_client(self) -> genai.Client:
        """
        Retrieve or initialize the google.genai.Client instance safely.
        Raises ValueError if GEMINI_API_KEY is not configured.
        """
        if self._client is not None:
            return self._client

        if not self.api_key:
            raise ValueError(
                "GEMINI_API_KEY is not set. Please set the GEMINI_API_KEY "
                "environment variable or pass an api_key argument."
            )

        try:
            self._client = genai.Client(api_key=self.api_key)
            return self._client
        except Exception as exc:
            # Never expose keys in error messages
            err_msg = str(exc)
            if self.api_key and self.api_key in err_msg:
                err_msg = err_msg.replace(self.api_key, "[REDACTED]")
            raise RuntimeError(f"Failed to initialize Google GenAI client: {err_msg}") from None

    def _build_turn_prompt(
        self,
        state: ConversationState,
        stage: ConversationStage,
        topic: str,
        transcript: List[ConversationMessage],
        missing_slots: Optional[List[str]] = None,
        covered_slots: Optional[List[Any]] = None,
    ) -> str:
        """
        Assemble the clinical turn prompt context from conversation state, transcript,
        and conversational slot coverage.
        """
        formatted_turns: List[str] = []
        for msg in transcript:
            sender_tag = "PATIENT" if msg.sender == "patient" else "ASSISTANT" if msg.sender == "ai" else "SYSTEM"
            formatted_turns.append(f"[{sender_tag}]: {msg.text}")

        history_text = (
            "\n".join(formatted_turns)
            if formatted_turns
            else "(No prior turns. This is the opening introduction turn.)"
        )

        stage_val = stage.value if hasattr(stage, "value") else str(stage)
        try:
            norm_stage = stage if isinstance(stage, ConversationStage) else ConversationStage(stage_val)
            allowed_slots = STAGE_SLOT_DEFINITIONS.get(norm_stage, [])
        except ValueError:
            allowed_slots = []
        allowed_slots_str = ", ".join(allowed_slots) if allowed_slots else "(none for this stage)"

        # Format ALREADY COVERED section
        covered_lines: List[str] = []
        if covered_slots:
            for s in covered_slots:
                if hasattr(s, "name"):
                    status_info = f" ({s.status.value if hasattr(s.status, 'value') else str(s.status)})"
                    val_info = f": '{s.value}'" if getattr(s, "value", None) else ""
                    covered_lines.append(f"- {s.name}{status_info}{val_info}")
                else:
                    covered_lines.append(f"- {s}")
        covered_text = "\n".join(covered_lines) if covered_lines else "(none yet)"

        # Format STILL MISSING section
        missing_lines: List[str] = []
        if missing_slots:
            for s in missing_slots:
                slot_name = s if isinstance(s, str) else getattr(s, "name", str(s))
                missing_lines.append(f"- {slot_name}")
        missing_text = "\n".join(missing_lines) if missing_lines else "(none - all stage slots covered)"

        return (
            f"ACTIVE CLINICAL STAGE: {stage_val}\n"
            f"ACTIVE CLINICAL TOPIC: {topic}\n"
            f"ALLOWED SLOTS FOR THIS STAGE: {allowed_slots_str}\n"
            f"INTERVIEW PROGRESS: {state.progress}%\n"
            f"INTERVIEW COMPLETE: {state.interview_complete}\n\n"
            f"CONVERSATIONAL SLOT COVERAGE:\n"
            f"ALREADY COVERED:\n{covered_text}\n\n"
            f"STILL MISSING:\n{missing_text}\n\n"
            f"PATIENT INTAKE CONVERSATION HISTORY:\n"
            f"{history_text}\n\n"
            f"QUESTIONING RULES FOR THIS TURN:\n"
            f"- Prefer asking about a relevant missing slot from the STILL MISSING list.\n"
            f"- Never ask for information already explicitly covered in ALREADY COVERED unless the patient corrects or clarifies it.\n"
            f"- Ask only ONE focused question at a time. Do not ask about every missing slot at once.\n"
            f"- Acknowledge any new information reported in the latest patient turn.\n"
            f"- In 'slots_updated', extract any stage-appropriate slots that the patient explicitly provided or denied in their latest message. ONLY use slot names from the allowed slots list. If no new information was communicated, return an empty object {{}}.\n"
            f"- Multiple Slots: If the patient communicates multiple distinct clinical details in a single message, extract all of them into slots_updated.\n"
            f"- Corrections: If the patient explicitly corrects a previous statement, update the corresponding slot with the new corrected value.\n"
            f"- Unknown / Cannot Remember: If the patient says they don't know, are not sure, or don't remember ('I don't know', 'no idea', 'can't remember'), do NOT mark the slot as provided and do NOT mark it as denied. Leave it uncovered and politely ask about a different missing slot.\n"
            f"- Explicit Denial vs Generic No: Only mark a slot as 'denied' when the patient explicitly denies or rules out that specific entity. 'No idea' to 'What makes it worse?' is NOT a denial of aggravating factors. Do not deny unrelated slots with a generic 'no'.\n"
            f"- Ambiguity: Do not extract vague single-word answers ('sometimes', 'maybe') as confirmed slot values; ask a gentle clarifying question instead.\n"
            f"- Non-Answers: If the patient mentions unrelated concerns instead of answering the asked question, do not force the statement into the asked slot.\n"
            f"- Repetition Avoidance: If the patient says 'I already told you', courteously acknowledge the information and pivot to an uncovered slot from STILL MISSING.\n"
            f"- Do not treat a slot as covered merely because the assistant asked about it. Only explicit patient statements can update slots.\n"
            f"- Do not infer or guess medical information that the patient did not state.\n"
            f"- Provide 2 to 4 realistic quick-reply chips for the patient (or an empty list if open-ended).\n"
            f"- Respond in strictly valid JSON conforming to the requested schema."
        )

    def _parse_and_validate(
        self,
        response: Any,
        stage: Optional[ConversationStage] = None,
    ) -> ProviderResult:
        """
        Parse and validate the raw response into a ProviderResult model.
        Restricts extracted slots to allowed slots for the active stage.
        """
        raw_text = getattr(response, "text", "")
        if not raw_text or not raw_text.strip():
            raise RuntimeError("Gemini API returned an empty response.")

        raw_text = raw_text.strip()
        # Clean any surrounding markdown code block if present
        if raw_text.startswith("```"):
            lines = raw_text.splitlines()
            if lines and lines[0].startswith("```"):
                lines = lines[1:]
            if lines and lines[-1].startswith("```"):
                lines = lines[:-1]
            raw_text = "\n".join(lines).strip()

        try:
            parsed = _GeminiTurnOutput.model_validate_json(raw_text)
        except Exception as exc:
            raise RuntimeError(
                f"Failed to validate Gemini response against structured schema: {exc}"
            ) from None

        if not parsed.reply_text or not parsed.reply_text.strip():
            raise RuntimeError("Gemini returned an empty reply_text.")

        # Validate and filter slot updates against the active stage
        if stage is not None:
            validated_slots = validate_stage_slots(
                stage=stage,
                slots=parsed.slots_updated,
                strict=False,
            )
        else:
            validated_slots = {}
            for k, v in (parsed.slots_updated or {}).items():
                validated_slots[k] = SlotUpdateItem(
                    status=v.status,
                    value=v.value,
                )

        return ProviderResult(
            reply_text=parsed.reply_text.strip(),
            chips=parsed.chips or [],
            slots_updated=validated_slots,
            raw_response=response,
        )

    def generate_turn(
        self,
        state: ConversationState,
        stage: ConversationStage,
        topic: str,
        transcript: List[ConversationMessage],
        missing_slots: Optional[List[str]] = None,
        covered_slots: Optional[List[Any]] = None,
    ) -> ProviderResult:
        """
        Generate an adaptive clinical interview response using the Google Gemini API.
        """
        client = self._get_client()

        system_instruction = (
            f"{CLINICAL_INTERVIEW_SYSTEM_PROMPT}\n\n{CONVERSATION_RESPONSE_INSTRUCTIONS}"
        )
        user_prompt = self._build_turn_prompt(
            state=state,
            stage=stage,
            topic=topic,
            transcript=transcript,
            missing_slots=missing_slots,
            covered_slots=covered_slots,
        )

        config = types.GenerateContentConfig(
            system_instruction=system_instruction,
            temperature=self.temperature,
            response_mime_type="application/json",
            response_schema=_GeminiTurnOutput,
        )

        try:
            response = client.models.generate_content(
                model=self.model,
                contents=user_prompt,
                config=config,
            )
        except ValueError:
            raise
        except Exception as exc:
            err_msg = str(exc)
            if self.api_key and self.api_key in err_msg:
                err_msg = err_msg.replace(self.api_key, "[REDACTED]")
            raise RuntimeError(f"Gemini API request failed: {err_msg}") from None

        return self._parse_and_validate(response, stage=stage)
