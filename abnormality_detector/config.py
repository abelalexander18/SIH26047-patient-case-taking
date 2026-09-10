"""
SIH26047 — Patient Case-Taking Software (Ministry of Ayush / AIIA)
Configurable Reference Ranges and Unit Compatibility Rules

Treats reference ranges as configurable baselines rather than universal medical truths.
"""

from typing import Dict, Any, Optional, Set

# Small demo set of standard adult baseline reference ranges
DEFAULT_REFERENCE_RANGES: Dict[str, Dict[str, Any]] = {
    "hemoglobin": {
        "canonical_name": "Hemoglobin",
        "reference_low": 12.0,
        "reference_high": 16.0,
        "unit": "g/dL",
        "aliases": ["hb", "hgb", "hemoglobin"]
    },
    "fasting_blood_glucose": {
        "canonical_name": "Fasting Blood Glucose",
        "reference_low": 70.0,
        "reference_high": 100.0,
        "unit": "mg/dL",
        "aliases": ["fasting blood glucose", "fasting blood sugar", "fbs"]
    },
    "random_blood_glucose": {
        "canonical_name": "Random Blood Glucose",
        "reference_low": 70.0,
        "reference_high": 140.0,
        "unit": "mg/dL",
        "aliases": ["random blood glucose", "blood glucose", "blood sugar", "rbs"]
    },
    "serum_creatinine": {
        "canonical_name": "Serum Creatinine",
        "reference_low": 0.6,
        "reference_high": 1.3,
        "unit": "mg/dL",
        "aliases": ["serum creatinine", "creatinine", "creat"]
    },
    "platelet_count": {
        "canonical_name": "Platelet Count",
        "reference_low": 150000.0,
        "reference_high": 450000.0,
        "unit": "/uL",
        "aliases": ["platelet count", "platelets", "plt"]
    },
    "total_wbc": {
        "canonical_name": "Total Leukocyte Count (WBC)",
        "reference_low": 4000.0,
        "reference_high": 11000.0,
        "unit": "/uL",
        "aliases": ["total leukocyte count", "wbc", "tlc", "white blood cells"]
    },
    "systolic_bp": {
        "canonical_name": "Systolic Blood Pressure",
        "reference_low": 90.0,
        "reference_high": 120.0,
        "unit": "mmHg",
        "aliases": ["systolic bp", "systolic blood pressure", "sys bp"]
    },
    "diastolic_bp": {
        "canonical_name": "Diastolic Blood Pressure",
        "reference_low": 60.0,
        "reference_high": 80.0,
        "unit": "mmHg",
        "aliases": ["diastolic bp", "diastolic blood pressure", "dia bp"]
    }
}

# Unit equivalence families (aliases that represent the same measurement)
UNIT_ALIASES: Dict[str, Set[str]] = {
    "g/dl": {"g/dl", "gm/dl", "g/100ml", "grams/dl"},
    "mg/dl": {"mg/dl", "mg/100ml", "mg%"},
    "mmhg": {"mmhg", "mm hg"},
    "/ul": {"/ul", "/cumm", "cells/ul", "cells/cumm", "per ul", "per cumm", "/mm3"},
    "%": {"%", "percent", "pct"},
    "bpm": {"bpm", "beats/min", "/min"},
    "deg_f": {"°f", "f", "deg f", "fahrenheit"}
}


def normalize_unit(unit: Optional[str]) -> str:
    """Normalizes unit strings for comparison (lowercase, stripped)."""
    if not unit:
        return ""
    return str(unit).strip().lower()


def are_units_compatible(unit_a: Optional[str], unit_b: Optional[str]) -> bool:
    """
    Checks if two unit strings are clinically compatible.
    Returns True if:
    1. Both are empty/unspecified.
    2. Exactly equal after normalization.
    3. Belongs to the same recognized unit alias family.
    Returns False if they represent distinct measurement dimensions (e.g. g/dL vs mg/dL, or mmol/L vs mg/dL).
    """
    norm_a = normalize_unit(unit_a)
    norm_b = normalize_unit(unit_b)

    # If neither unit is specified, assume no unit conflict
    if not norm_a and not norm_b:
        return True

    # If one is specified and the other is not, they are not guaranteed compatible
    if not norm_a or not norm_b:
        return False

    # Direct match
    if norm_a == norm_b:
        return True

    # Check alias families
    for family, aliases in UNIT_ALIASES.items():
        if norm_a in aliases and norm_b in aliases:
            return True

    return False


def get_default_reference(test_name: str) -> Optional[Dict[str, Any]]:
    """Looks up default reference configuration by test name or alias."""
    query = test_name.strip().lower()
    for key, conf in DEFAULT_REFERENCE_RANGES.items():
        if query == key:
            return conf
        if query in [a.lower() for a in conf.get("aliases", [])]:
            return conf
    return None
