"""
ai/extraction/history_extractor.py
====================================
Clinical history extraction from patient conversation text.

RESPONSIBILITIES
----------------
- Load configuration from environment variables.
- Call the OpenAI API with structured output.
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
    OPENAI_API_KEY   — your OpenAI secret key
    OPENAI_MODEL     — model name, e.g. "gpt-4o-mini"

STRUCTURED OUTPUT
-----------------
Uses openai>=1.66.0 Responses API:
    client.responses.parse(input=messages, text_format=ClinicalHistory)

This returns a response object whose `.output_parsed` attribute is
already a validated ClinicalHistory Pydantic instance.
No manual JSON parsing required.

If the model returns malformed output, `.output_parsed` will be None —
this is handled explicitly.

EXCEPTIONS RAISED
-----------------
    ExtractionConfigError     — missing OPENAI_API_KEY or OPENAI_MODEL
    ExtractionInputError      — empty or invalid conversation_text
    ExtractionAPIError        — OpenAI network / authentication / rate-limit error
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
    Raised when the OpenAI API call fails (network, auth, rate limit, etc.).
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
        ExtractionConfigError: if OPENAI_API_KEY or OPENAI_MODEL is not set.
    """
    api_key: Optional[str] = os.environ.get("OPENAI_API_KEY")
    model: Optional[str] = os.environ.get("OPENAI_MODEL")

    if not api_key:
        raise ExtractionConfigError(
            "OPENAI_API_KEY environment variable is not set. "
            "Set it in your .env file or deployment environment."
        )
    if not model:
        raise ExtractionConfigError(
            "OPENAI_MODEL environment variable is not set. "
            "Set it in your .env file (e.g., OPENAI_MODEL=gpt-4o-mini)."
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
        ExtractionConfigError:  OPENAI_API_KEY or OPENAI_MODEL not configured.
        ExtractionInputError:   conversation_text is empty or not a string.
        ExtractionAPIError:     OpenAI API request failed.
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

    messages = [
        {"role": "system", "content": EXTRACTION_SYSTEM_PROMPT},
        {"role": "user", "content": user_message},
    ]

    # 4. Call OpenAI Responses API with structured output
    # Import here to avoid import-time side effects when the module is loaded
    # without OPENAI_API_KEY (e.g., during testing with mocks).
    try:
        from openai import AsyncOpenAI
        import openai as _openai_module
    except ImportError as exc:
        raise ExtractionConfigError(
            "The 'openai' package is not installed. "
            "Run: pip install openai>=1.66.0"
        ) from exc

    client = AsyncOpenAI(api_key=api_key)

    try:
        response = await client.responses.parse(
            model=model,
            input=messages,
            text_format=ClinicalHistory,
        )
    except _openai_module.AuthenticationError as exc:
        raise ExtractionAPIError(
            "OpenAI authentication failed. Check that OPENAI_API_KEY is correct."
        ) from exc
    except _openai_module.RateLimitError as exc:
        raise ExtractionAPIError(
            "OpenAI rate limit exceeded. The request could not be completed."
        ) from exc
    except _openai_module.APIConnectionError as exc:
        raise ExtractionAPIError(
            "Could not connect to OpenAI API. Check network connectivity."
        ) from exc
    except _openai_module.APIStatusError as exc:
        raise ExtractionAPIError(
            f"OpenAI API returned an error (status {exc.status_code}): {exc.message}"
        ) from exc
    except Exception as exc:
        raise ExtractionAPIError(
            f"Unexpected error during OpenAI API call: {exc}"
        ) from exc

    # 5. Extract and validate the parsed result
    # response.output_parsed is already a validated ClinicalHistory instance
    # because we passed text_format=ClinicalHistory to .parse()
    if response.output_parsed is None:
        raise ExtractionParseError(
            "The model returned a response but it could not be parsed into "
            "a valid ClinicalHistory."
        )

    history: ClinicalHistory = response.output_parsed

    return history
