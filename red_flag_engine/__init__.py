"""
Red Flag Screening Engine & Clinical Intelligence Package.
"""

from red_flag_engine.schemas import (
    ClinicalHistory,
    RedFlagResult,
    SymptomDetail,
    SymptomItem,
    BleedingDetail,
    VitalsData,
    MedicalLabValue
)
from red_flag_engine.rules import (
    ScreeningRule,
    RULES_CATALOG,
    get_rules
)
from red_flag_engine.engine import (
    RedFlagEngine,
    screen_red_flags,
    screen_all_red_flags
)
from red_flag_engine.normalizer import (
    ClinicalConceptNormalizer,
    normalize_clinical_narrative,
    normalize_case_input
)

__all__ = [
    "ClinicalHistory",
    "RedFlagResult",
    "SymptomDetail",
    "SymptomItem",
    "BleedingDetail",
    "VitalsData",
    "MedicalLabValue",
    "ScreeningRule",
    "RULES_CATALOG",
    "get_rules",
    "RedFlagEngine",
    "screen_red_flags",
    "screen_all_red_flags",
    "ClinicalConceptNormalizer",
    "normalize_clinical_narrative",
    "normalize_case_input"
]
