"""
SIH26047 — Patient Case-Taking Software (Ministry of Ayush / AIIA)
QA Engineer Test Suite for Red-Flag Screening Engine

Specifically validates the 12 core clinical triage scenarios:
1. Mild headache only -> no red flag
2. Severe headache + loss of consciousness -> red flag
3. Chest pain -> red flag according to configured rule
4. Chest pain + breathing difficulty -> high-priority screening alert
5. Loss of consciousness alone -> alert
6. Severe abdominal pain + loss of consciousness -> alert
7. Fever without concerning associated symptoms -> no red flag
8. Fever + confusion -> alert
9. Missing symptom fields -> system must not crash
10. Empty history -> system must return safe empty result
11. Null values -> system must not crash
12. Multiple simultaneous red flags -> return all applicable flags
"""

import pytest
from red_flag_engine import (
    screen_red_flags,
    screen_all_red_flags,
    ClinicalHistory
)


# Scenario 1: Mild headache only -> no red flag
def test_scenario_01_mild_headache_only():
    case = {
        "patient_id": "QA-001",
        "chief_complaints": ["Mild headache towards the evening", "feeling a bit tired"],
        "symptoms": [{"name": "headache", "severity": "mild"}],
        "vitals": {"temperature": 98.4, "spo2": 99}
    }
    result = screen_red_flags(case)
    assert result["detected"] is False
    assert result["severity"] == "none"
    assert result["rule_id"] == "NONE"
    assert len(result["evidence"]) == 0
    assert "Proceed with standard clinical case-taking" in result["recommendation"]


# Scenario 2: Severe headache + loss of consciousness -> red flag
def test_scenario_02_severe_headache_with_loss_of_consciousness():
    case = {
        "patient_id": "QA-002",
        "chief_complaints": ["Thunderclap severe headache and then passed out on the floor"],
        "symptoms": [
            {"name": "severe headache", "severity": "severe"},
            {"name": "loss of consciousness", "severity": "severe"}
        ]
    }
    result = screen_red_flags(case)
    assert result["detected"] is True
    assert result["severity"] == "critical"
    assert result["category"] == "neurological"
    assert result["rule_id"] in ("RF_NEURO_02", "RF_NEURO_01")
    assert any("headache" in e.lower() or "passed out" in e.lower() for e in result["evidence"])


# Scenario 3: Chest pain -> red flag according to configured rule
def test_scenario_03_chest_pain_alone():
    case = {
        "patient_id": "QA-003",
        "chief_complaints": ["Patient reports chest pain since morning"],
        "vitals": {"heart_rate": 82, "spo2": 97}
    }
    result = screen_red_flags(case)
    assert result["detected"] is True
    assert result["rule_id"] == "RF_CARD_01"
    assert result["severity"] == "critical"
    assert result["category"] == "cardiovascular"
    assert "chest pain" in " ".join(result["evidence"]).lower()


# Scenario 4: Chest pain + breathing difficulty -> high-priority screening alert
def test_scenario_04_chest_pain_with_breathing_difficulty():
    case = {
        "patient_id": "QA-004",
        "chief_complaints": ["Chest tightness accompanied by acute shortness of breath and difficulty breathing"],
        "vitals": {"respiratory_rate": 24, "spo2": 94}
    }
    result = screen_red_flags(case)
    assert result["detected"] is True
    assert result["severity"] == "critical"
    assert result["rule_id"] == "RF_CARD_02"
    assert result["category"] == "cardiovascular"
    # Verify both concepts are cited in evidence
    evidence_text = " ".join(result["evidence"]).lower()
    assert "chest" in evidence_text
    assert "breath" in evidence_text or "dyspnea" in evidence_text


# Scenario 5: Loss of consciousness alone -> alert
def test_scenario_05_loss_of_consciousness_alone():
    case = {
        "patient_id": "QA-005",
        "chief_complaints": ["Sudden fainting episode while standing, lost consciousness"],
        "vitals": {"heart_rate": 78}
    }
    result = screen_red_flags(case)
    assert result["detected"] is True
    assert result["rule_id"] == "RF_NEURO_01"
    assert result["severity"] == "critical"
    assert result["category"] == "neurological"
    assert any("consciousness" in e.lower() or "faint" in e.lower() for e in result["evidence"])


# Scenario 6: Severe abdominal pain + loss of consciousness -> alert
def test_scenario_06_severe_abdominal_pain_with_loss_of_consciousness():
    case = {
        "patient_id": "QA-006",
        "chief_complaints": ["Severe abdominal pain followed by syncope and blacking out"],
        "symptoms": [
            {"name": "Severe stomach pain", "severity": "severe"},
            {"name": "fainted", "severity": "severe"}
        ]
    }
    result = screen_red_flags(case)
    assert result["detected"] is True
    assert result["severity"] == "critical"
    assert result["rule_id"] == "RF_GI_03"
    assert result["category"] == "gastrointestinal"
    all_flags = screen_all_red_flags(case)
    flag_ids = [f["rule_id"] for f in all_flags]
    assert "RF_GI_03" in flag_ids
    assert "RF_NEURO_01" in flag_ids


# Scenario 7: Fever without concerning associated symptoms -> no red flag
def test_scenario_07_isolated_fever_without_concerning_symptoms():
    case = {
        "patient_id": "QA-007",
        "chief_complaints": ["Fever for 2 days", "mild body ache"],
        "symptoms": [
            {"name": "fever", "severity": "moderate"}
        ],
        "vitals": {"temperature": 100.4, "spo2": 98, "heart_rate": 84}
    }
    result = screen_red_flags(case)
    assert result["detected"] is False
    assert result["severity"] == "none"
    assert result["rule_id"] == "NONE"


# Scenario 8: Fever + confusion -> alert
def test_scenario_08_fever_with_confusion():
    case = {
        "patient_id": "QA-008",
        "chief_complaints": ["High fever and patient is acting confused and disoriented"],
        "vitals": {"temperature": 102.5}
    }
    result = screen_red_flags(case)
    assert result["detected"] is True
    assert result["rule_id"] == "RF_INF_01"
    assert result["severity"] == "critical"
    assert result["category"] == "sepsis_infection"
    evidence_text = " ".join(result["evidence"]).lower()
    assert "fever" in evidence_text or "temperature" in evidence_text
    assert "confus" in evidence_text or "disorient" in evidence_text


# Scenario 9: Missing symptom fields -> system must not crash
def test_scenario_09_missing_symptom_fields():
    case = {
        "patient_id": "QA-009",
        "age": 42
        # No symptoms, no chief_complaints, no vitals
    }
    result = screen_red_flags(case)
    assert result["detected"] is False
    assert result["rule_id"] == "NONE"
    assert result["severity"] == "none"


# Scenario 10: Empty history -> system must return safe empty result
def test_scenario_10_empty_history():
    result = screen_red_flags({})
    assert result["detected"] is False
    assert result["rule_id"] == "NONE"
    assert result["severity"] == "none"
    assert result["category"] == "none"
    assert isinstance(result["evidence"], list)
    assert len(result["evidence"]) == 0
    assert "disclaimer" in result


# Scenario 11: Null values -> system must not crash
def test_scenario_11_null_values():
    case = {
        "patient_id": None,
        "age": None,
        "gender": None,
        "chief_complaints": None,
        "symptoms": [None, {"name": None, "severity": None}],
        "vitals": {"temperature": None, "spo2": None, "systolic_bp": None},
        "lab_values": None,
        "medical_history": None
    }
    result = screen_red_flags(case)
    assert result["detected"] is False
    assert result["rule_id"] == "NONE"
    assert result["severity"] == "none"


# Scenario 12: Multiple simultaneous red flags -> return all applicable flags
def test_scenario_12_multiple_simultaneous_red_flags():
    case = {
        "patient_id": "QA-012",
        "chief_complaints": [
            "Chest pain since 1 hour",
            "Severe shortness of breath",
            "Patient passed out",
            "Vomiting blood"
        ],
        "vitals": {"spo2": 85.0}
    }
    # screen_all_red_flags MUST return all applicable flags
    all_flags = screen_all_red_flags(case)
    assert len(all_flags) >= 4

    rule_ids = {f["rule_id"] for f in all_flags}
    assert "RF_CARD_01" in rule_ids  # Chest pain
    assert "RF_RESP_01" in rule_ids  # Severe shortness of breath / SpO2 85%
    assert "RF_NEURO_01" in rule_ids # Passed out / syncope
    assert "RF_GI_01" in rule_ids    # Vomiting blood

    # screen_red_flags returns primary with concurrent alerts cross-referenced
    primary = screen_red_flags(case)
    assert primary["detected"] is True
    assert primary["severity"] == "critical"
    assert any("Concurrent alert" in e for e in primary["evidence"])
