"""
ai/summary/summary_generator.py
================================
Module responsible for generating a doctor-readable clinical intake summary
from a structured ClinicalHistory.

RESPONSIBILITIES
----------------
- Reads a validated ClinicalHistory Pydantic object.
- Calls the Google Gemini API to generate a concise, formatted text summary.
- Enforces strict safety rules (no diagnosing, prescribing, or autonomous decisions).
- Preserves the semantic distinction between "not mentioned" and "explicitly denied".

INTEGRATION
-----------
The backend will call:

    from ai.summary.summary_generator import generate_summary

    summary_text = await generate_summary(history_object)

ENVIRONMENT VARIABLES REQUIRED
-------------------------------
    GEMINI_API_KEY   — your Google Gemini API key
    GEMINI_MODEL     — model name, e.g. "gemini-2.5-flash"

EXCEPTIONS RAISED
-----------------
    SummaryConfigError     — missing GEMINI_API_KEY or GEMINI_MODEL
    SummaryInputError      — history is not a ClinicalHistory instance
    SummaryAPIError        — Gemini network / authentication / rate-limit error
"""

import os
from typing import Optional
from dotenv import load_dotenv

from shared.schemas.clinical_history import ClinicalHistory
from ai.summary.prompts import SUMMARY_SYSTEM_PROMPT, SUMMARY_USER_PROMPT_TEMPLATE

# Load .env file if present
load_dotenv()


class SummaryConfigError(Exception):
    """Raised when required environment variables are missing."""


class SummaryInputError(ValueError):
    """Raised when the input is invalid (e.g., not a ClinicalHistory instance)."""


class SummaryAPIError(Exception):
    """Raised when the Gemini API call fails."""


def _load_config() -> tuple[str, str]:
    api_key: Optional[str] = os.environ.get("GEMINI_API_KEY")
    model: Optional[str] = os.environ.get("GEMINI_MODEL")

    if not api_key:
        raise SummaryConfigError(
            "GEMINI_API_KEY environment variable is not set."
        )
    if not model:
        raise SummaryConfigError(
            "GEMINI_MODEL environment variable is not set."
        )

    return api_key, model


async def generate_summary(history: ClinicalHistory) -> str:
    """
    Generate a doctor-readable clinical intake summary from a ClinicalHistory.

    Args:
        history: A validated ClinicalHistory Pydantic instance.

    Returns:
        A concise text summary formatted in standard medical sections.

    Raises:
        SummaryConfigError: GEMINI_API_KEY or GEMINI_MODEL not configured.
        SummaryInputError: history is not a valid ClinicalHistory instance.
        SummaryAPIError: Gemini API request failed.
    """
    if not isinstance(history, ClinicalHistory):
        raise SummaryInputError(
            f"Expected history to be a ClinicalHistory instance, got {type(history).__name__}"
        )

    api_key, model = _load_config()

    try:
        from google import genai
        from google.genai import types
        from google.genai.errors import APIError
    except ImportError as exc:
        raise SummaryConfigError(
            "The 'google-genai' package is not installed."
        ) from exc

    client = genai.Client(api_key=api_key)

    # Convert the structured history to JSON to pass to the LLM
    history_json = history.model_dump_json(exclude_none=False, indent=2)

    user_message = SUMMARY_USER_PROMPT_TEMPLATE.format(history_json=history_json)

    try:
        response = await client.aio.models.generate_content(
            model=model,
            contents=[
                types.Content(role="user", parts=[
                    types.Part.from_text(text=SUMMARY_SYSTEM_PROMPT + "\n\n" + user_message)
                ])
            ],
            config=types.GenerateContentConfig(
                temperature=0.0,
            ),
        )
        summary_text = response.text
        if not summary_text:
            raise SummaryAPIError("Received empty response from Gemini.")
        return summary_text.strip()

    except APIError as exc:
        raise SummaryAPIError(f"Gemini API returned an error: {exc.message}") from exc
    except Exception as exc:
        raise SummaryAPIError(f"Unexpected error during Gemini API call: {exc}") from exc
