"""
SIH26047 — Patient Case-Taking Software (Ministry of Ayush / AIIA)
Member 6: AI Extraction & Follow-Up Questioning Service

Coordinates:
1. Structured clinical information extraction via OpenAI (strict zero hallucination, null for unknowns).
2. Missing critical information detection based on reported complaints.
3. Generation of exactly ONE context-aware follow-up question.
4. Deterministic red-flag screening via RedFlagEngine.
5. Objective, non-diagnostic doctor-facing intake summary.
"""

import json
from typing import Dict, Any, List, Optional, Union
from pydantic import BaseModel, Field

from red_flag_engine.schemas import (
    ClinicalHistory,
    RedFlagResult,
    SymptomDetail,
    BleedingDetail
)
from red_flag_engine.engine import RedFlagEngine, screen_red_flags
from ai_extraction.client import OpenAIClientWrapper
from ai_extraction.prompts import (
    EXTRACTION_SYSTEM_PROMPT,
    FOLLOWUP_SYSTEM_PROMPT,
    SUMMARY_SYSTEM_PROMPT
)


class FollowUpQuestionResult(BaseModel):
    target_field: str = Field(..., description="Clinical field being clarified (e.g. 'unable_to_keep_fluids')")
    question: str = Field(..., description="The single polite follow-up question to present to the patient")
    rationale: Optional[str] = Field(default=None, description="Clinical triage rationale for asking this question")


class IntakeTurnResult(BaseModel):
    patient_message: str
    updated_history: ClinicalHistory
    screening_result: RedFlagResult
    missing_critical_fields: List[str] = Field(default_factory=list)
    follow_up_question: Optional[FollowUpQuestionResult] = None
    doctor_summary: str
    requires_immediate_attention: bool = False


# Critical clinical safety priorities for follow-up questioning
CRITICAL_SAFETY_DEPENDENCIES = {
    "vomiting": ["unable_to_keep_fluids", "blood_in_vomit"],
    "headache": ["loss_of_consciousness", "severity", "neurological_deficits"],
    "chest pain": ["breathing_difficulty", "radiation"],
    "abdominal pain": ["loss_of_consciousness", "blood_in_stool", "severity"],
    "fever": ["confusion", "stiff_neck"],
    "allergic": ["breathing_difficulty", "throat_tightness"]
}


class AIExtractionService:
    """
    Orchestrates the AI-assisted case-taking loop:
    Patient Language -> OpenAI Extraction -> Schema Validation -> Deterministic Red Flag Engine
    -> Missing Info Check -> Single Follow-up Question -> Doctor Summary.
    """

    def __init__(self, client: Optional[OpenAIClientWrapper] = None, engine: Optional[RedFlagEngine] = None):
        self.client = client or OpenAIClientWrapper()
        self.engine = engine or RedFlagEngine()

    def extract_clinical_history(
        self,
        patient_message: str,
        existing_history: Optional[ClinicalHistory] = None,
        conversation_history: Optional[List[Dict[str, str]]] = None,
        vitals: Optional[Dict[str, Any]] = None
    ) -> ClinicalHistory:
        """
        Extracts structured facts from patient input without hallucinating absent info.
        If existing_history is provided, merges new facts incrementally.
        """
        # Formulate context for OpenAI
        context_parts = []
        if conversation_history:
            context_parts.append("CONVERSATION CONTEXT:")
            for turn in conversation_history:
                context_parts.append(f"{turn.get('role', 'speaker').title()}: {turn.get('content', '')}")
            context_parts.append("\nCURRENT PATIENT MESSAGE:")
        context_parts.append(patient_message)

        user_prompt = "\n".join(context_parts)
        raw_json = self.client.chat_completion_json(EXTRACTION_SYSTEM_PROMPT, user_prompt)

        # Parse symptoms
        raw_symptoms = raw_json.get("symptoms", [])
        parsed_symptoms: List[SymptomDetail] = []
        for s in raw_symptoms:
            if isinstance(s, dict):
                parsed_symptoms.append(SymptomDetail(
                    name=s.get("name", "unspecified"),
                    severity=s.get("severity"),
                    duration=s.get("duration"),
                    duration_days=s.get("duration_days"),
                    onset=s.get("onset"),
                    frequency=s.get("frequency"),
                    raw_expression=s.get("raw_expression")
                ))

        # Check bleeding
        bleeding_obj = None
        if raw_json.get("blood_in_vomit") is True:
            bleeding_obj = BleedingDetail(present=True, source="vomit", severity="heavy")

        new_history = ClinicalHistory(
            chief_complaints=raw_json.get("chief_complaints", []),
            symptoms=parsed_symptoms,
            relevant_negative_symptoms=raw_json.get("relevant_negative_symptoms", []),
            loss_of_consciousness=raw_json.get("loss_of_consciousness"),
            breathing_difficulty=raw_json.get("breathing_difficulty"),
            bleeding=bleeding_obj,
            blood_in_vomit=raw_json.get("blood_in_vomit"),
            unable_to_keep_fluids=raw_json.get("unable_to_keep_fluids"),
            ability_to_keep_fluids_down=raw_json.get("ability_to_keep_fluids_down"),
            dizziness=raw_json.get("dizziness"),
            confusion=raw_json.get("confusion"),
            neurological_symptoms=raw_json.get("neurological_symptoms"),
            vitals=vitals
        )

        # If previous state exists, merge without overwriting known facts with nulls
        if existing_history:
            new_history = self._merge_histories(existing_history, new_history)

        return new_history

    def identify_missing_critical_info(self, history: ClinicalHistory) -> List[str]:
        """
        Determines which acute clinical discriminators are still null/unknown
        based on the patient's reported symptoms.
        """
        missing: List[str] = []
        complaints_lower = [c.lower() for c in history.chief_complaints]
        symptom_names_lower = [
            (s.name if isinstance(s, SymptomDetail) else (s.get("name", "") if isinstance(s, dict) else str(s))).lower()
            for s in history.symptoms
        ]
        all_reported = " ".join(complaints_lower + symptom_names_lower)

        # 1. Vomiting reported
        if "vomit" in all_reported or "throwing up" in all_reported:
            if history.unable_to_keep_fluids is None and history.ability_to_keep_fluids_down is None:
                missing.append("unable_to_keep_fluids")
            if history.blood_in_vomit is None and history.bleeding is None:
                missing.append("blood_in_vomit")

        # 2. Headache reported
        if "headache" in all_reported or "head pain" in all_reported:
            if history.loss_of_consciousness is None:
                missing.append("loss_of_consciousness")
            has_severity = any(
                s.severity is not None for s in history.symptoms if isinstance(s, SymptomDetail) and s.name == "headache"
            )
            if not has_severity:
                missing.append("headache_severity")
            if history.neurological_symptoms is None:
                missing.append("neurological_deficits")

        # 3. Chest pain reported
        if "chest" in all_reported and "pain" in all_reported:
            if history.breathing_difficulty is None:
                missing.append("breathing_difficulty")

        # 4. Abdominal pain reported
        if "abdominal" in all_reported or "stomach" in all_reported or "belly" in all_reported:
            if history.loss_of_consciousness is None:
                missing.append("loss_of_consciousness")

        # 5. Fever reported
        if "fever" in all_reported or "pyrexia" in all_reported:
            if history.confusion is None:
                missing.append("confusion")

        return missing

    def generate_followup_question(
        self,
        history: ClinicalHistory,
        missing_fields: List[str],
        conversation_history: Optional[List[Dict[str, str]]] = None
    ) -> Optional[FollowUpQuestionResult]:
        """
        Uses OpenAI to generate exactly ONE targeted follow-up question for the top missing field.
        """
        if not missing_fields:
            return None

        target_field = missing_fields[0]
        symptoms_summary = ", ".join(
            s.name if isinstance(s, SymptomDetail) else str(s)
            for s in history.symptoms
        ) or "unspecified complaints"

        user_prompt = (
            f"Patient reported symptoms: {symptoms_summary}.\n"
            f"Highest-priority missing clinical discriminator: '{target_field}'.\n"
            "Formulate ONE polite, simple, patient-friendly follow-up question to clarify this specific item."
        )

        raw_json = self.client.chat_completion_json(FOLLOWUP_SYSTEM_PROMPT, user_prompt)
        question_text = raw_json.get("question") or "Could you clarify if you have noticed any other symptoms?"

        return FollowUpQuestionResult(
            target_field=target_field,
            question=question_text,
            rationale=f"Clarifying clinical discriminator: {target_field}"
        )

    def generate_doctor_summary(
        self,
        history: ClinicalHistory,
        screening_result: Optional[RedFlagResult] = None
    ) -> str:
        """
        Generates an objective, non-diagnostic physician summary note.
        """
        user_prompt = f"Patient Clinical History:\n{json.dumps(history.model_dump(), indent=2)}\n"
        if screening_result:
            user_prompt += f"\nScreening Engine Finding:\n{json.dumps(screening_result.model_dump(), indent=2)}\n"

        return self.client.chat_completion_text(SUMMARY_SYSTEM_PROMPT, user_prompt)

    def process_conversational_turn(
        self,
        message: str,
        existing_history: Optional[ClinicalHistory] = None,
        conversation_history: Optional[List[Dict[str, str]]] = None,
        vitals: Optional[Dict[str, Any]] = None
    ) -> IntakeTurnResult:
        """
        Executes the end-to-end conversational turn:
        1. Extract structured ClinicalHistory (strict null for unknowns).
        2. Execute deterministic Red Flag Engine.
        3. Identify missing acute discriminators.
        4. Generate ONE follow-up question if clinical facts are incomplete.
        5. Generate concise doctor summary.
        """
        # 1. Structured extraction
        updated_history = self.extract_clinical_history(
            patient_message=message,
            existing_history=existing_history,
            conversation_history=conversation_history,
            vitals=vitals
        )

        # 2. Deterministic screening
        screening_dict = self.engine.screen(updated_history)
        screening_result = RedFlagResult(**screening_dict)

        # 3. Check for missing clinical discriminators
        missing_fields = self.identify_missing_critical_info(updated_history)

        # 4. Generate follow-up question if appropriate
        follow_up: Optional[FollowUpQuestionResult] = None
        # Only ask follow-up if not already an immediate life-threatening emergency requiring urgent in-person triage
        if missing_fields and screening_result.severity != "critical":
            follow_up = self.generate_followup_question(
                history=updated_history,
                missing_fields=missing_fields,
                conversation_history=conversation_history
            )

        # 5. Doctor-facing summary
        summary = self.generate_doctor_summary(updated_history, screening_result)

        requires_immediate = screening_result.detected and screening_result.severity in ("critical", "urgent")

        return IntakeTurnResult(
            patient_message=message,
            updated_history=updated_history,
            screening_result=screening_result,
            missing_critical_fields=missing_fields,
            follow_up_question=follow_up,
            doctor_summary=summary,
            requires_immediate_attention=requires_immediate
        )

    def _merge_histories(self, old: ClinicalHistory, new: ClinicalHistory) -> ClinicalHistory:
        """Helper to merge updated facts into existing history without overriding with nulls."""
        merged_dict = old.model_dump()
        new_dict = new.model_dump()

        # Update complaints & symptoms
        for comp in new_dict.get("chief_complaints", []):
            if comp not in merged_dict.get("chief_complaints", []):
                merged_dict["chief_complaints"].append(comp)

        # Merge symptoms
        existing_symptom_names = {
            s.get("name") for s in merged_dict.get("symptoms", []) if isinstance(s, dict)
        }
        for s in new_dict.get("symptoms", []):
            if isinstance(s, dict):
                if s.get("name") not in existing_symptom_names:
                    merged_dict["symptoms"].append(s)
                else:
                    # Update attributes of existing symptom if new ones are non-null
                    for target in merged_dict["symptoms"]:
                        if isinstance(target, dict) and target.get("name") == s.get("name"):
                            for k, v in s.items():
                                if v is not None:
                                    target[k] = v

        # Merge pertinent negatives
        for neg in new_dict.get("relevant_negative_symptoms", []):
            if neg not in merged_dict.get("relevant_negative_symptoms", []):
                merged_dict["relevant_negative_symptoms"].append(neg)

        # Merge discrete flags: non-null in new overrides old
        for flag in [
            "loss_of_consciousness", "breathing_difficulty", "blood_in_vomit",
            "unable_to_keep_fluids", "ability_to_keep_fluids_down", "dizziness",
            "confusion", "neurological_symptoms"
        ]:
            if new_dict.get(flag) is not None:
                merged_dict[flag] = new_dict[flag]

        if new_dict.get("bleeding") is not None:
            merged_dict["bleeding"] = new_dict["bleeding"]

        if new.vitals:
            merged_dict["vitals"] = new_dict.get("vitals")

        return ClinicalHistory(**merged_dict)


_DEFAULT_AI_SERVICE = AIExtractionService()


def get_ai_service() -> AIExtractionService:
    return _DEFAULT_AI_SERVICE
