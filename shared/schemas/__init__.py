"""
shared/schemas/__init__.py
===========================
Public exports for the shared.schemas package.

All modules should import ClinicalHistory and its sub-models from here:

    from shared.schemas import ClinicalHistory
    from shared.schemas import HistoryOfPresentIllness, Medication, PersonalSocialHistory

Do NOT create duplicate versions of these models in other modules.
"""

from .clinical_history import (
    ClinicalHistory,
    HistoryOfPresentIllness,
    Medication,
    PersonalSocialHistory,
)

__all__ = [
    "ClinicalHistory",
    "HistoryOfPresentIllness",
    "Medication",
    "PersonalSocialHistory",
]
