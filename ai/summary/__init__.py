"""
ai/summary package

Exports the main entry point for the summary generator.
"""
from ai.summary.summary_generator import (
    generate_summary,
    SummaryConfigError,
    SummaryInputError,
    SummaryAPIError,
)

__all__ = [
    "generate_summary",
    "SummaryConfigError",
    "SummaryInputError",
    "SummaryAPIError",
]
