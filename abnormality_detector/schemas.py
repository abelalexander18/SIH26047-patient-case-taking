"""
SIH26047 — Patient Case-Taking Software (Ministry of Ayush / AIIA)
Abnormal Medical-Value Detection Component: Data Contracts

Strictly non-diagnostic schemas for numerical comparison against configured reference limits.
"""

from enum import Enum
from typing import Optional, Any
from pydantic import BaseModel, Field


class ValueStatus(str, Enum):
    LOW = "low"
    NORMAL = "normal"
    HIGH = "high"
    UNKNOWN = "unknown"


class ValueEvaluationInput(BaseModel):
    test_name: str = Field(..., description="Name of the test or physiological metric")
    value: Any = Field(default=None, description="Observed numeric value (or raw string)")
    unit: Optional[str] = Field(default="", description="Unit of measurement (e.g. g/dL, mg/dL)")
    reference_low: Optional[float] = Field(default=None, description="Configured lower reference bound")
    reference_high: Optional[float] = Field(default=None, description="Configured upper reference bound")
    source: Optional[str] = Field(default="lab_report", description="Origin: lab_report, vitals, ocr, etc.")


class ValueEvaluationResult(BaseModel):
    test_name: str
    value: Optional[float] = None
    raw_value: Optional[str] = None
    unit: str = ""
    reference_low: Optional[float] = None
    reference_high: Optional[float] = None
    status: ValueStatus
    message: str
    flagged: bool = False
    source: str = "lab_report"
    disclaimer: str = (
        "Non-diagnostic observation. Value evaluated solely against configured reference range. "
        "Does not constitute a medical diagnosis or disease identification."
    )
