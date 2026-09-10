"""
Comprehensive unit tests for the deterministic Red Flag Screening Engine.
Tests cover:
- Positive cases (all 11 prototype screening patterns)
- Negative cases (clean, mild, and routine cases)
- Combinations (multiple concurrent red flags)
- Missing fields (sparse JSON inputs)
- Null values (None in root and nested fields)
- Contradictory information (conflicting reports and vitals)
- Schema and wording compliance
"""

import pytest
from red_flag_engine import (
    screen_red_flags,
    screen_all_red_flags,
    ClinicalHistory
)


# =====================================================================
# 1. POSITIVE CASES (11 Prototype Patterns)
# =====================================================================

def test_positive_severe_chest_pain():
    case = {
        "chief_complaints": ["Patient reports severe chest pain radiating to left shoulder"],
        "vitals": {"heart_rate": 96}
    }
    result = screen_red_flags(case)
    assert result["detected"] is True
    assert result["rule_id"] == "RF_CARD_01"
    assert result["severity"] == "critical"
    assert result["category"] == "cardiovascular"
    assert "Potential red flag detected" in result["message"]
    assert "Prompt clinical evaluation may be appropriate" in result["recommendation"]
    assert len(result["evidence"]) >= 1


def test_positive_chest_pain_with_breathing_difficulty():
    case = {
        "chief_complaints": ["Chest tightness and severe shortness of breath"],
        "symptoms": [
            {"name": "Chest tightness", "severity": "moderate"},
            {"name": "Difficulty breathing", "severity": "moderate"}
        ]
    }
    result = screen_red_flags(case)
    assert result["detected"] is True
    assert result["rule_id"] in ("RF_CARD_02", "RF_CARD_01")
    assert result["severity"] == "critical"


def test_positive_loss_of_consciousness():
    case = {
        "chief_complaints": ["Sudden syncope episode at work, lost consciousness for 2 minutes"],
        "symptoms": [{"name": "fainted", "severity": "severe"}]
    }
    result = screen_red_flags(case)
    assert result["detected"] is True
    assert result["rule_id"] == "RF_NEURO_01"
    assert result["severity"] == "critical"
    assert result["category"] == "neurological"


def test_positive_severe_headache_with_loss_of_consciousness():
    case = {
        "chief_complaints": ["Worst headache of my life followed by passing out"],
        "symptoms": ["unconscious for 5 minutes"]
    }
    result = screen_red_flags(case)
    assert result["detected"] is True
    # Should catch neurological critical patterns
    assert result["severity"] == "critical"
    assert result["category"] == "neurological"
    all_triggered = screen_all_red_flags(case)
    rule_ids = [r["rule_id"] for r in all_triggered]
    assert "RF_NEURO_02" in rule_ids or "RF_NEURO_01" in rule_ids


def test_positive_severe_headache_with_neurological_symptoms():
    case = {
        "chief_complaints": ["Severe headache with facial droop and slurred speech"]
    }
    result = screen_red_flags(case)
    assert result["detected"] is True
    assert result["rule_id"] == "RF_NEURO_03"
    assert result["severity"] == "critical"
    assert result["category"] == "neurological"


def test_positive_severe_breathing_difficulty_text():
    case = {
        "chief_complaints": ["Severe shortness of breath, gasping for air"],
        "vitals": {"spo2": 92}
    }
    result = screen_red_flags(case)
    assert result["detected"] is True
    assert result["rule_id"] == "RF_RESP_01"
    assert result["severity"] == "critical"
    assert result["category"] == "respiratory"


def test_positive_severe_breathing_difficulty_vitals_spo2():
    # SpO2 <= 88 triggers severe breathing difficulty even if text says mild breathlessness
    case = {
        "chief_complaints": ["Mild breathlessness"],
        "vitals": {"spo2": 85.0}
    }
    result = screen_red_flags(case)
    assert result["detected"] is True
    assert result["rule_id"] == "RF_RESP_01"
    assert result["severity"] == "critical"
    assert any("SpO2" in e for e in result["evidence"])


def test_positive_severe_allergic_breathing_difficulty():
    case = {
        "chief_complaints": ["Acute swelling of lips and tongue with wheezing and difficulty breathing after taking medicine"]
    }
    result = screen_red_flags(case)
    assert result["detected"] is True
    assert result["rule_id"] == "RF_ALLERG_01"
    assert result["severity"] == "critical"
    assert result["category"] == "allergy_airway"


def test_positive_blood_in_vomit():
    case = {
        "chief_complaints": ["Patient had 2 episodes of coffee ground emesis and vomiting blood today"],
        "medical_history": ["Gastric ulcer history"]
    }
    result = screen_red_flags(case)
    assert result["detected"] is True
    assert result["rule_id"] == "RF_GI_01"
    assert result["severity"] == "urgent"
    assert result["category"] == "gastrointestinal"


def test_positive_blood_in_stool():
    case = {
        "chief_complaints": ["Passing black tarry stool for 2 days"],
        "symptoms": ["melena"]
    }
    result = screen_red_flags(case)
    assert result["detected"] is True
    assert result["rule_id"] == "RF_GI_02"
    assert result["severity"] == "urgent"
    assert result["category"] == "gastrointestinal"


def test_positive_severe_abdominal_pain_with_loss_of_consciousness():
    case = {
        "chief_complaints": ["Severe stomach pain with fainting episode and loss of consciousness"]
    }
    result = screen_red_flags(case)
    assert result["detected"] is True
    assert result["severity"] == "critical"
    assert result["category"] in ("gastrointestinal", "neurological")
    all_rules = screen_all_red_flags(case)
    rule_ids = [r["rule_id"] for r in all_rules]
    assert "RF_GI_03" in rule_ids


def test_positive_high_fever_with_confusion_text():
    case = {
        "chief_complaints": ["High fever with severe confusion and drowsiness"]
    }
    result = screen_red_flags(case)
    assert result["detected"] is True
    assert result["rule_id"] == "RF_INF_01"
    assert result["severity"] == "critical"
    assert result["category"] == "sepsis_infection"


def test_positive_high_fever_vital_temp_with_confusion():
    case = {
        "chief_complaints": ["Patient is disoriented and lethargic"],
        "vitals": {"temperature": 103.4}
    }
    result = screen_red_flags(case)
    assert result["detected"] is True
    assert result["rule_id"] == "RF_INF_01"
    assert result["severity"] == "critical"
    assert any("Temperature 103.4" in e for e in result["evidence"])


# =====================================================================
# 2. NEGATIVE CASES (Routine / Mild Cases)
# =====================================================================

def test_negative_routine_ayurvedic_consultation():
    case = {
        "patient_id": "P-101",
        "chief_complaints": ["Mild bloating after meals for 3 weeks", "Occasional gas"],
        "symptoms": [
            {"name": "Bloating", "severity": "mild", "duration": "3 weeks"}
        ],
        "vitals": {
            "systolic_bp": 120.0,
            "diastolic_bp": 80.0,
            "heart_rate": 72.0,
            "spo2": 99.0,
            "temperature": 98.4
        },
        "ayush_context": {"prakriti": "Vata-Pitta"}
    }
    result = screen_red_flags(case)
    assert result["detected"] is False
    assert result["severity"] == "none"
    assert result["category"] == "none"
    assert result["rule_id"] == "NONE"
    assert len(result["evidence"]) == 0
    assert "Proceed with standard clinical case-taking" in result["recommendation"]


def test_negative_mild_headache_without_deficits():
    case = {
        "chief_complaints": ["Mild headache at end of work day", "eye strain"],
        "symptoms": [{"name": "headache", "severity": "mild"}]
    }
    result = screen_red_flags(case)
    assert result["detected"] is False


def test_negative_common_cold():
    case = {
        "chief_complaints": ["Runny nose and sneezing for 2 days"],
        "vitals": {"temperature": 99.0, "spo2": 98}
    }
    result = screen_red_flags(case)
    assert result["detected"] is False


# =====================================================================
# 3. COMBINATIONS (Multiple Concurrent Red Flags)
# =====================================================================

def test_combination_multiple_red_flags():
    # Patient with severe chest pain + severe breathing difficulty + syncope
    case = {
        "chief_complaints": [
            "Severe crushing chest pain",
            "Severe shortness of breath",
            "Episode of loss of consciousness"
        ],
        "vitals": {"spo2": 86.0}
    }
    # screen_all_red_flags must catch all individual rules
    all_flags = screen_all_red_flags(case)
    assert len(all_flags) >= 3
    rule_ids = {f["rule_id"] for f in all_flags}
    assert "RF_CARD_01" in rule_ids
    assert "RF_RESP_01" in rule_ids
    assert "RF_NEURO_01" in rule_ids

    # screen_red_flags returns the top critical rule with concurrent alerts noted
    primary = screen_red_flags(case)
    assert primary["detected"] is True
    assert primary["severity"] == "critical"
    assert any("Concurrent alert" in e for e in primary["evidence"])


# =====================================================================
# 4. MISSING FIELDS (Sparse JSON Inputs)
# =====================================================================

def test_missing_fields_completely_empty_dict():
    result = screen_red_flags({})
    assert result["detected"] is False
    assert result["rule_id"] == "NONE"


def test_missing_fields_only_age_and_gender():
    result = screen_red_flags({"age": 52, "gender": "female"})
    assert result["detected"] is False


def test_missing_vitals_field():
    case = {
        "chief_complaints": ["Severe chest pain"]
    }
    result = screen_red_flags(case)
    assert result["detected"] is True
    assert result["rule_id"] == "RF_CARD_01"


def test_missing_complaints_with_vitals_only():
    case = {
        "vitals": {"spo2": 98.0, "temperature": 98.6}
    }
    result = screen_red_flags(case)
    assert result["detected"] is False


# =====================================================================
# 5. NULL VALUES (Defensive Null Safety)
# =====================================================================

def test_null_root_and_nested_fields():
    case = {
        "patient_id": None,
        "age": None,
        "gender": None,
        "chief_complaints": None,
        "symptoms": None,
        "vitals": None,
        "medical_history": None,
        "current_medications": None,
        "ayush_context": None
    }
    result = screen_red_flags(case)
    assert result["detected"] is False
    assert result["rule_id"] == "NONE"


def test_null_elements_inside_collections():
    case = {
        "chief_complaints": [None, "", "  "],
        "symptoms": [None, {"name": None, "severity": None}, ""],
        "vitals": {"temperature": None, "spo2": None, "heart_rate": None}
    }
    result = screen_red_flags(case)
    assert result["detected"] is False


def test_null_vitals_with_positive_complaint():
    case = {
        "chief_complaints": ["Severe crushing chest pain"],
        "vitals": {"spo2": None, "temperature": None}
    }
    result = screen_red_flags(case)
    assert result["detected"] is True
    assert result["rule_id"] == "RF_CARD_01"


# =====================================================================
# 6. CONTRADICTORY INFORMATION
# =====================================================================

def test_contradictory_complaint_vs_symptom_severity():
    # Complaint says "severe chest pain", but symptoms list says "chest pain" with severity "none"
    case = {
        "chief_complaints": ["Patient has severe chest pain radiating to back"],
        "symptoms": [{"name": "chest pain", "severity": "none"}]
    }
    # Safety engine must prioritize safety and trigger the alert
    result = screen_red_flags(case)
    assert result["detected"] is True
    assert result["rule_id"] == "RF_CARD_01"
    assert result["severity"] == "critical"


def test_contradictory_normal_vitals_with_emergency_complaints():
    # Vitals are completely normal, but complaints report sudden syncope and severe chest pain
    case = {
        "chief_complaints": ["Sudden severe chest pain and passed out"],
        "vitals": {
            "systolic_bp": 120.0,
            "diastolic_bp": 80.0,
            "heart_rate": 72.0,
            "spo2": 99.0,
            "temperature": 98.4
        }
    }
    result = screen_red_flags(case)
    assert result["detected"] is True
    assert result["severity"] == "critical"


# =====================================================================
# 7. SCHEMA & NON-DIAGNOSTIC WORDING CONFORMANCE
# =====================================================================

def test_schema_and_wording_conformance():
    case = {
        "chief_complaints": ["High fever and patient is disoriented and confused"]
    }
    result = screen_red_flags(case)
    
    # Required keys in contract
    expected_keys = {
        "detected", "severity", "category", "rule_id",
        "message", "evidence", "recommendation", "disclaimer"
    }
    assert expected_keys.issubset(set(result.keys()))
    
    # Non-diagnostic wording checks
    assert "Potential red flag detected" in result["message"]
    assert "Prompt clinical evaluation may be appropriate" in result["recommendation"]
    
    # Must NOT claim a definitive disease diagnosis
    message_lower = result["message"].lower()
    recommendation_lower = result["recommendation"].lower()
    assert "diagnosis:" not in message_lower
    assert "patient is diagnosed with" not in message_lower
    assert "prescribe" not in recommendation_lower

    # Disclaimer check
    assert "Clinical decision-support aid" in result["disclaimer"]
    assert "Does not constitute a medical diagnosis" in result["disclaimer"]
