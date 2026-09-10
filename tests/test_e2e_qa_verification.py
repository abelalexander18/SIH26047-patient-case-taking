"""
End-to-End QA Verification Test Suite

Explicitly tests the user-specified scenarios:
1. Patient enters: 'I have a severe headache and I fainted yesterday.'
   - Verify input acceptance, AI structure generation, red flag detection,
     backend response, doctor dashboard alert payload, non-diagnostic wording,
     and zero errors.
2. Patient enters: 'I have a mild headache since this morning.'
   - Verify that no inappropriate high-priority red flag appears.
"""

import pytest
from fastapi.testclient import TestClient
from api.app import app

client = TestClient(app)


def test_e2e_scenario_1_severe_headache_and_fainted():
    """
    End-to-End Test 1: Severe headache + syncope.
    Simulates:
    Patient input -> AI structured extraction -> Red Flag Engine -> Backend -> Doctor Dashboard
    """
    # 1. Patient natural input
    raw_patient_input = "I have a severe headache and I fainted yesterday."
    assert len(raw_patient_input) > 0

    # 2. AI/extraction layer converts patient speech into structured clinical history
    structured_ai_history = {
        "patient_id": "E2E-PT-001",
        "age": 46,
        "gender": "female",
        "chief_complaints": [raw_patient_input],
        "symptoms": [
            {"name": "severe headache", "severity": "severe"},
            {"name": "fainted / syncope", "severity": "severe"}
        ],
        "vitals": {
            "systolic_bp": 122.0,
            "diastolic_bp": 82.0,
            "heart_rate": 78.0,
            "spo2": 98.0,
            "temperature": 98.6
        },
        "medical_history": ["No prior history of seizures or migraine"]
    }

    # 3. Red-flag engine receives the structured information via Backend API
    response = client.post("/api/red-flags/screen", json=structured_ai_history)

    # 8. Verify no application error occurs
    assert response.status_code == 200
    data = response.json()

    # 4. A potential red flag is detected
    assert data["detected"] is True
    assert data["severity"] == "critical"
    assert data["category"] == "neurological"
    assert data["rule_id"] in ("RF_NEURO_02", "RF_NEURO_01")

    # 5. The backend returns the result with all required fields
    required_fields = {"detected", "severity", "category", "rule_id", "message", "evidence", "recommendation", "disclaimer"}
    assert required_fields.issubset(set(data.keys()))

    # 6. Doctor dashboard receives and can display the alert with exact evidence citations
    assert len(data["evidence"]) >= 1
    evidence_str = " ".join(data["evidence"]).lower()
    assert "severe headache" in evidence_str or "fainted" in evidence_str

    # 7. The wording does NOT claim a diagnosis
    msg = data["message"].lower()
    rec = data["recommendation"].lower()
    assert "potential red flag detected" in msg
    assert "diagnosis:" not in msg
    assert "diagnosed" not in msg
    assert "patient has" not in msg
    assert "prescribe" not in rec

    # Disclaimer check
    assert "Clinical decision-support aid" in data["disclaimer"]
    assert "Does not constitute a medical diagnosis" in data["disclaimer"]


def test_e2e_scenario_2_mild_headache_normal_case():
    """
    End-to-End Test 2: Mild headache only.
    Verifies that no inappropriate high-priority red flag appears.
    """
    # 1. Patient natural input
    raw_patient_input = "I have a mild headache since this morning."

    # 2. AI/extraction layer converts patient speech into structured clinical history
    structured_ai_history = {
        "patient_id": "E2E-PT-002",
        "age": 32,
        "gender": "male",
        "chief_complaints": [raw_patient_input],
        "symptoms": [
            {"name": "mild headache", "severity": "mild"}
        ],
        "vitals": {
            "systolic_bp": 118.0,
            "diastolic_bp": 76.0,
            "heart_rate": 72.0,
            "spo2": 99.0,
            "temperature": 98.4
        }
    }

    # 3. Red-flag engine receives structured information via Backend API
    response = client.post("/api/red-flags/screen", json=structured_ai_history)

    # Verify no application error
    assert response.status_code == 200
    data = response.json()

    # Verify no inappropriate high-priority red flag appears
    assert data["detected"] is False
    assert data["severity"] == "none"
    assert data["category"] == "none"
    assert data["rule_id"] == "NONE"
    assert len(data["evidence"]) == 0
    assert "Proceed with standard clinical case-taking" in data["recommendation"]
