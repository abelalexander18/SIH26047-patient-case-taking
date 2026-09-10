"""
ai/extraction/history_extractor.py
====================================
Clinical history extraction from patient conversation text.

RESPONSIBILITIES
----------------
- Load configuration from environment variables.
- Call the Google Gemini API with structured output.
- Validate and return a ClinicalHistory Pydantic object.
- Raise named exceptions for all failure modes.

WHAT THIS MODULE DOES NOT DO
-----------------------------
- It does not define HTTP routes.
- It does not write to any database.
- It does not run any red-flag detection.
- It does not generate a summary.
- It does not touch the frontend.

INTEGRATION
-----------
The backend (Member 3) will call:

    from ai.extraction.history_extractor import extract_history

    history = await extract_history(conversation_text)

and then pass `history` to the summary generator and red-flag engine.

ENVIRONMENT VARIABLES REQUIRED
-------------------------------
    GEMINI_API_KEY   — your Google Gemini API key
    GEMINI_MODEL     — model name, e.g. "gemini-2.5-flash"

STRUCTURED OUTPUT
-----------------
Uses Google GenAI API with JSON Schema:
    client.models.generate_content(..., config=types.GenerateContentConfig(response_mime_type="application/json", response_schema=ClinicalHistory))

EXCEPTIONS RAISED
-----------------
    ExtractionConfigError     — missing GEMINI_API_KEY or GEMINI_MODEL
    ExtractionInputError      — empty or invalid conversation_text
    ExtractionAPIError        — Gemini network / authentication / rate-limit error
    ExtractionParseError      — model output could not be parsed into ClinicalHistory
"""

from __future__ import annotations

import os
from typing import Optional

from dotenv import load_dotenv
from pydantic import ValidationError

from shared.schemas import ClinicalHistory
from ai.extraction.prompts import (
    EXTRACTION_SYSTEM_PROMPT,
    EXTRACTION_USER_PROMPT_TEMPLATE,
)

# Load .env file if present (no-op in production where env vars are set externally)
load_dotenv()


# ---------------------------------------------------------------------------
# Custom exceptions
# ---------------------------------------------------------------------------


class ExtractionConfigError(Exception):
    """
    Raised when required environment variables are missing.
    The backend should map this to HTTP 500 (Internal Server Error).
    """


class ExtractionInputError(ValueError):
    """
    Raised when the input conversation_text is empty or unusable.
    The backend should map this to HTTP 400 (Bad Request).
    """


class ExtractionAPIError(Exception):
    """
    Raised when the Gemini API call fails (network, auth, rate limit, etc.).
    The backend should map this to HTTP 502 (Bad Gateway) or HTTP 503.
    The original exception is available via __cause__.
    """


class ExtractionParseError(Exception):
    """
    Raised when the model's response cannot be parsed into a valid ClinicalHistory.
    The backend should map this to HTTP 422 (Unprocessable Entity).
    The original exception is available via __cause__.
    """


# ---------------------------------------------------------------------------
# Internal helpers
# ---------------------------------------------------------------------------


def _load_config() -> tuple[str, str]:
    """
    Read and validate required environment variables.

    Returns:
        (api_key, model_name)

    Raises:
        ExtractionConfigError: if GEMINI_API_KEY or GEMINI_MODEL is not set.
    """
    api_key: Optional[str] = os.environ.get("GEMINI_API_KEY")
    model: Optional[str] = os.environ.get("GEMINI_MODEL")

    if not api_key:
        raise ExtractionConfigError(
            "GEMINI_API_KEY environment variable is not set. "
            "Set it in your .env file or deployment environment."
        )
    if not model:
        raise ExtractionConfigError(
            "GEMINI_MODEL environment variable is not set. "
            "Set it in your .env file (e.g., GEMINI_MODEL=gemini-2.5-flash)."
        )

    return api_key, model


def _validate_conversation(conversation_text: str) -> None:
    """
    Basic validation of the input conversation string.

    Raises:
        ExtractionInputError: if the text is empty or whitespace-only.
    """
    if not isinstance(conversation_text, str):
        raise ExtractionInputError(
            f"conversation_text must be a string, got {type(conversation_text).__name__}."
        )
    if not conversation_text.strip():
        raise ExtractionInputError(
            "conversation_text is empty. Cannot extract clinical history from an empty conversation."
        )


def _build_user_message(conversation_text: str) -> str:
    """
    Format the user prompt with the conversation text inserted.
    """
    return EXTRACTION_USER_PROMPT_TEMPLATE.format(
        conversation_text=conversation_text.strip()
    )


def _clean_schema(schema: dict) -> dict:
    """
    Recursively remove 'additionalProperties' and 'additional_properties' 
    from a JSON schema, as the Gemini API strictly rejects them.
    """
    if not isinstance(schema, dict):
        return schema
        
    cleaned = {}
    for key, value in schema.items():
        if key in ("additionalProperties", "additional_properties"):
            continue
        if isinstance(value, dict):
            cleaned[key] = _clean_schema(value)
        elif isinstance(value, list):
            cleaned[key] = [_clean_schema(item) if isinstance(item, dict) else item for item in value]
        else:
            cleaned[key] = value
    return cleaned


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------


async def extract_history(conversation_text: str) -> ClinicalHistory:
    """
    Extract a structured clinical history from a patient conversation.

    This is the primary entry point for the extraction module. The backend
    and any orchestration layer should call this function.

    Args:
        conversation_text:
            The full patient intake conversation as a plain text string.
            Format: "Patient: ...\nAssistant: ...\n..." or a plain transcript.
            Must not be empty.

    Returns:
        A validated ClinicalHistory Pydantic instance.
        Fields that were not mentioned in the conversation will be None.
        Fields where the patient explicitly denied will be [] (empty lists).

    Raises:
        ExtractionConfigError:  GEMINI_API_KEY or GEMINI_MODEL not configured.
        ExtractionInputError:   conversation_text is empty or not a string.
        ExtractionAPIError:     Gemini API request failed.
        ExtractionParseError:   Model output could not be validated as ClinicalHistory.

    Example:
        >>> history = await extract_history("Patient: I have chest pain...")
        >>> history.chief_complaint
        'chest pain'
    """
    # 1. Validate configuration
    api_key, model = _load_config()

    # 2. Validate input
    _validate_conversation(conversation_text)

    # 3. Build messages
    user_message = _build_user_message(conversation_text)

    # 4. Generate Gemini-compatible JSON schema
    raw_schema = ClinicalHistory.model_json_schema()
    gemini_schema = _clean_schema(raw_schema)

    # 5. Call Gemini API with structured output
    try:
        from google import genai
        from google.genai import types
        from google.genai.errors import APIError
    except ImportError as exc:
        raise ExtractionConfigError(
            "The 'google-genai' package is not installed. "
            "Run: pip install google-genai"
        ) from exc

    client = genai.Client(api_key=api_key)

    try:
        # NOTE: the google-genai SDK provides an async client wrapper or sync client wrapper.
        # client.models.generate_content is synchronous.
        # Since extract_history is async, we should use client.aio.models.generate_content if available,
        # otherwise run in an executor. Using client.aio is standard for google-genai if it's the newer SDK.
        response = await client.aio.models.generate_content(
            model=model,
            contents=[
                types.Content(role="user", parts=[
                    types.Part.from_text(text=EXTRACTION_SYSTEM_PROMPT + "\n\n" + user_message)
                ])
            ],
            config=types.GenerateContentConfig(
                response_mime_type="application/json",
                response_schema=gemini_schema,
            ),
        )
    except APIError as exc:
        raise ExtractionAPIError(
            f"Gemini API returned an error: {exc.message}"
        ) from exc
    except Exception as exc:
        raise ExtractionAPIError(
            f"Unexpected error during Gemini API call: {exc}"
        ) from exc

    if not response.text:
        raise ExtractionParseError(
            "The model returned an empty response."
        )

    # 6. Extract and validate the parsed result
    try:
        # Since we passed a raw dictionary for response_schema, google-genai
        # may not populate response.parsed automatically with our Pydantic model.
        # We must validate the raw JSON text directly against ClinicalHistory.
        history = ClinicalHistory.model_validate_json(response.text)
    except ValidationError as exc:
        raise ExtractionParseError(
            "The model returned a response but it could not be parsed into "
            f"a valid ClinicalHistory: {exc}"
        ) from exc

    return history
