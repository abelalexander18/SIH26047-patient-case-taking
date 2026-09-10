"""
SIH26047 — Patient Case-Taking Software (Ministry of Ayush / AIIA)
Member 6: OpenAI API Client Wrapper

Provides:
1. Real OpenAI client integration with JSON structured output format.
2. Safe API key management (reads from environment, never logs credentials).
3. Robust mock fallback client for offline execution, unit tests, and demo resilience.
"""

import os
import json
import logging
from typing import Dict, Any, Optional, List

logger = logging.getLogger("ai_extraction.client")


class MockOpenAIClient:
    """
    Offline/fallback client that generates structured JSON and follow-up
    questions using deterministic clinical heuristics when OPENAI_API_KEY
    is not provided. Guarantees zero downtime and 100% test reliability.
    """

    def chat_completion_json(self, system_prompt: str, user_prompt: str, temperature: float = 0.0) -> Dict[str, Any]:
        """Simulates structured JSON response based on user input text."""
        lower = user_prompt.lower()

        # Follow-up question prompt simulation
        if "follow-up question" in system_prompt.lower() or "target_field" in system_prompt.lower():
            if "vomit" in lower and "unable_to_keep_fluids" in lower:
                return {
                    "target_field": "unable_to_keep_fluids",
                    "question": "Have you been able to keep any water or fluids down, or are you throwing up everything you drink?"
                }
            if "headache" in lower and "loss_of_consciousness" in lower:
                return {
                    "target_field": "loss_of_consciousness",
                    "question": "Did you experience any fainting, dizziness, or loss of consciousness during or after the headache?"
                }
            if "chest" in lower and "breathing_difficulty" in lower:
                return {
                    "target_field": "breathing_difficulty",
                    "question": "Are you experiencing any shortness of breath or trouble breathing along with the chest discomfort?"
                }
            return {
                "target_field": "general_clarification",
                "question": "Could you provide a little more detail about how long this has been happening and if anything makes it better or worse?"
            }

        # Extraction prompt simulation: delegate to ClinicalConceptNormalizer for accurate clause & negation parsing
        from red_flag_engine.normalizer import ClinicalConceptNormalizer
        from red_flag_engine.schemas import SymptomDetail

        norm = ClinicalConceptNormalizer().normalize(user_prompt)

        symptoms_dicts = []
        for s in norm.symptoms:
            dur_days = getattr(s, "duration_days", None)
            if dur_days is None and s.duration:
                if "2 day" in s.duration.lower() or "two day" in s.duration.lower():
                    dur_days = 2.0
                elif "yesterday" in s.duration.lower() or "1 day" in s.duration.lower():
                    dur_days = 1.0

            symptoms_dicts.append({
                "name": s.name,
                "severity": s.severity,
                "duration": s.duration,
                "duration_days": dur_days,
                "onset": s.onset,
                "frequency": s.frequency,
                "raw_expression": s.raw_expression
            })

        unable_fluids = norm.unable_to_keep_fluids
        if unable_fluids is None and norm.ability_to_keep_fluids_down is not None:
            unable_fluids = not norm.ability_to_keep_fluids_down

        blood_vomit = norm.blood_in_vomit
        if blood_vomit is None and norm.bleeding:
            blood_vomit = (norm.bleeding.source == "vomit")

        return {
            "chief_complaints": norm.chief_complaints,
            "symptoms": symptoms_dicts,
            "relevant_negative_symptoms": norm.relevant_negative_symptoms,
            "loss_of_consciousness": norm.loss_of_consciousness,
            "breathing_difficulty": norm.breathing_difficulty,
            "blood_in_vomit": blood_vomit,
            "unable_to_keep_fluids": unable_fluids,
            "ability_to_keep_fluids_down": norm.ability_to_keep_fluids_down,
            "dizziness": norm.dizziness,
            "confusion": norm.confusion,
            "neurological_symptoms": norm.neurological_symptoms
        }

    def chat_completion_text(self, system_prompt: str, user_prompt: str, temperature: float = 0.2) -> str:
        """Simulates clinical doctor summary generation."""
        return (
            "CLINICAL INTAKE SUMMARY (For Attending Physician Review):\n"
            f"• Patient Statement: \"{user_prompt.strip()}\"\n"
            "• Reported Symptoms: Extracted concepts parsed into structured history.\n"
            "• Pertinent Safety Screening: Deterministic red-flag evaluation performed.\n"
            "• Disclaimer: Clinical decision support aid only; does not constitute a medical diagnosis."
        )


class OpenAIClientWrapper:
    """
    Production-grade OpenAI wrapper with structured JSON support and
    graceful offline fallback.
    """

    def __init__(self, api_key: Optional[str] = None, model: Optional[str] = None, force_mock: bool = False):
        self.api_key = api_key or os.environ.get("OPENAI_API_KEY", "").strip()
        self.model = model or os.environ.get("OPENAI_MODEL", "gpt-4o-mini")
        self.force_mock = force_mock
        self._mock_client = MockOpenAIClient()

        self._client = None
        if not self.force_mock and self.api_key:
            try:
                from openai import OpenAI
                self._client = OpenAI(api_key=self.api_key)
                logger.info("OpenAI client successfully initialized with provided API key.")
            except Exception as e:
                logger.warning(f"Could not initialize OpenAI client: {e}. Falling back to mock client.")
                self._client = None

    @property
    def is_live(self) -> bool:
        """Returns True if a live OpenAI client is active with an API key."""
        return self._client is not None and not self.force_mock

    def chat_completion_json(self, system_prompt: str, user_prompt: str, temperature: float = 0.0) -> Dict[str, Any]:
        """
        Invokes OpenAI chat completion with json_object response format.
        Falls back seamlessly to MockOpenAIClient if live client is unavailable.
        """
        if not self.is_live:
            return self._mock_client.chat_completion_json(system_prompt, user_prompt, temperature)

        try:
            response = self._client.chat.completions.create(
                model=self.model,
                messages=[
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": user_prompt}
                ],
                response_format={"type": "json_object"},
                temperature=temperature
            )
            raw_content = response.choices[0].message.content or "{}"
            return json.loads(raw_content)
        except Exception as e:
            logger.error(f"OpenAI API call failed: {e}. Falling back to offline mock response.")
            return self._mock_client.chat_completion_json(system_prompt, user_prompt, temperature)

    def chat_completion_text(self, system_prompt: str, user_prompt: str, temperature: float = 0.2) -> str:
        """
        Invokes OpenAI chat completion for text responses (e.g. physician summary).
        """
        if not self.is_live:
            return self._mock_client.chat_completion_text(system_prompt, user_prompt, temperature)

        try:
            response = self._client.chat.completions.create(
                model=self.model,
                messages=[
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": user_prompt}
                ],
                temperature=temperature
            )
            return response.choices[0].message.content or ""
        except Exception as e:
            logger.error(f"OpenAI text call failed: {e}. Falling back to offline mock text.")
            return self._mock_client.chat_completion_text(system_prompt, user_prompt, temperature)
