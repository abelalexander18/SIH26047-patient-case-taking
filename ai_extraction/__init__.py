"""
AI Extraction & Clinical Follow-Up Package.
"""

from ai_extraction.client import OpenAIClientWrapper, MockOpenAIClient
from ai_extraction.service import (
    AIExtractionService,
    FollowUpQuestionResult,
    IntakeTurnResult,
    get_ai_service
)

__all__ = [
    "OpenAIClientWrapper",
    "MockOpenAIClient",
    "AIExtractionService",
    "FollowUpQuestionResult",
    "IntakeTurnResult",
    "get_ai_service"
]
