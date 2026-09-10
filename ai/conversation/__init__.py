"""
ai/conversation/__init__.py
==========================
Public exports for the ai.conversation package (Member 4 - AI Conversational Intelligence).
"""

from .engine import (
    STAGE_CHIPS,
    STAGE_PROMPTS,
    ConversationEngine,
)
from .flow import (
    STAGE_ORDER,
    STAGE_PROGRESS,
    STAGE_TOPICS,
    ConversationFlow,
)
from .prompts import (
    CLINICAL_INTERVIEW_SYSTEM_PROMPT,
    CONVERSATION_RESPONSE_INSTRUCTIONS,
)
from .provider import (
    BaseLLMProvider,
    GeminiProvider,
    MockLLMProvider,
    ProviderResult,
)
from .schemas import (
    ConversationMessage,
    ConversationResponse,
    ConversationStage,
    ConversationState,
    Message,
    MessageSender,
)
from .tracker import (
    STAGE_SLOT_DEFINITIONS,
    SlotEntry,
    SlotStatus,
    SlotTracker,
)

__all__ = [
    "ConversationMessage",
    "ConversationResponse",
    "ConversationStage",
    "ConversationState",
    "Message",
    "MessageSender",
    "ConversationFlow",
    "STAGE_ORDER",
    "STAGE_PROGRESS",
    "STAGE_TOPICS",
    "ConversationEngine",
    "STAGE_PROMPTS",
    "STAGE_CHIPS",
    "BaseLLMProvider",
    "MockLLMProvider",
    "GeminiProvider",
    "ProviderResult",
    "CLINICAL_INTERVIEW_SYSTEM_PROMPT",
    "CONVERSATION_RESPONSE_INSTRUCTIONS",
    "SlotStatus",
    "SlotEntry",
    "SlotTracker",
    "STAGE_SLOT_DEFINITIONS",
]




