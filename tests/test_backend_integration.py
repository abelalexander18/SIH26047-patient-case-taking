"""
End-to-End Backend Integration Tests
Validates:
Flow 1: AI Clinical History -> /api/red-flags/screen -> RedFlagResult -> Doctor Dashboard
Flow 2: Medical Report -> /api/ocr/process-report -> OCRResult with Abnormality Detector linkage
Flow 3: Direct Abnormal Value Evaluation endpoint
"""

import io
import pytest
from fastapi.testclient import TestClient

from api.app import app
from document_ocr.samples import create_synthetic_pdf_bytes, SYNTHETIC_LAB_REPORT_TEXT

client = TestClient(app)


# =====================================================================
# FLOW 1 INTEGRATION TESTS
# =====================================================================

def test_flow_1_ai_clinical_history_to_red_flag_alert():
    """
    Validates Flow 1: AI structured clinical history is processed by
    the Red Flag Engine via REST API and returns RedFlagResult JSON.
    """
    payload = {
        "patient_id": "PT-AI-501",
        "age": 58,
        "gender": "male",
        "chief_complaints": [
            "Severe retrosternal crushing chest pain radiating to left jaw",
            "Shortness of breath and profuse diaphoresis"
        ],
        "vitals": {
            "systolic_bp": 185.0,
            "diastolic_bp": 115.0,
            "heart_rate": 112.0,
            "spo2": 95.0,
            "temperature": 98.6
        }
    }
    response = client.post("/api/red-flags/screen", json=payload)
    assert response.status_code == 200
    data = response.json()

    # Verify agreed schema fields
    assert data["detected"] is True
    assert data["severity"] == "critical"
    assert data["category"] == "cardiovascular"
    assert data["rule_id"] in ("RF_CARD_02", "RF_CARD_01")
    assert "Potential red flag detected" in data["message"]
    assert "Prompt clinical evaluation may be appropriate" in data["recommendation"]
    assert len(data["evidence"]) >= 1
    assert "disclaimer" in data


def test_flow_1_clean_routine_case_returns_safe_negative():
    """
    Validates Flow 1 for routine outpatient case with no red flags.
    """
    payload = {
        "patient_id": "PT-AI-502",
        "age": 34,
        "gender": "female",
        "chief_complaints": ["Mild sluggish digestion (Ajeerna) after oily meals"],
        "symptoms": [{"name": "mild bloating", "severity": "mild"}],
        "vitals": {
            "systolic_bp": 118.0,
            "diastolic_bp": 76.0,
            "heart_rate": 72.0,
            "spo2": 99.0,
            "temperature": 98.4
        }
    }
    response = client.post("/api/red-flags/screen", json=payload)
    assert response.status_code == 200
    data = response.json()

    assert data["detected"] is False
    assert data["severity"] == "none"
    assert data["rule_id"] == "NONE"
    assert len(data["evidence"]) == 0
    assert "Proceed with standard clinical case-taking" in data["recommendation"]


# =====================================================================
# FLOW 2 INTEGRATION TESTS
# =====================================================================

def test_flow_2_medical_report_ocr_to_abnormality_detector():
    """
    Validates Flow 2: Uploaded medical PDF is processed through OCR,
    structured into medical values, and evaluated by the abnormality detector.
    """
    # 1. Create synthetic in-memory PDF
    pdf_bytes = create_synthetic_pdf_bytes(SYNTHETIC_LAB_REPORT_TEXT)
    files = {
        "file": ("synthetic_report.pdf", io.BytesIO(pdf_bytes), "application/pdf")
    }

    # 2. Call the Flow 2 endpoint
    response = client.post("/api/ocr/process-report", files=files)
    assert response.status_code == 200
    data = response.json()

    # 3. Verify raw OCR text is preserved
    assert data["document_type"] == "lab_report"
    assert data["extraction_status"] == "success"
    assert "ALL INDIA INSTITUTE OF AYURVEDA" in data["raw_text"]

    # 4. Verify extracted values are exposed
    extracted = data["extracted_values"]
    assert len(extracted) >= 3
    extracted_names = [e["test_name"] for e in extracted]
    assert "Hemoglobin" in extracted_names
    assert "Fasting Blood Glucose" in extracted_names
    assert "Serum Creatinine" in extracted_names

    # 5. Verify abnormal-value detector evaluated the extracted values
    abnormalities = data["evaluated_abnormalities"]
    assert len(abnormalities) >= 3

    # Hemoglobin was 10.2 -> low
    hb = next(a for a in abnormalities if a["test_name"] == "Hemoglobin")
    assert hb["value"] == 10.2
    assert hb["status"] == "low"
    assert "below the configured reference range" in hb["message"]

    # Fasting Glucose was 154.0 -> high
    glu = next(a for a in abnormalities if a["test_name"] == "Fasting Blood Glucose")
    assert glu["value"] == 154.0
    assert glu["status"] == "high"
    assert "above the configured reference range" in glu["message"]

    # Creatinine was 0.9 -> normal
    creat = next(a for a in abnormalities if a["test_name"] == "Serum Creatinine")
    assert creat["value"] == 0.9
    assert creat["status"] == "normal"


# =====================================================================
# FLOW 3: STANDALONE ABNORMAL VALUE EVALUATION TESTS
# =====================================================================

def test_standalone_abnormal_value_evaluation_endpoint():
    """
    Tests direct evaluation of single value via REST.
    """
    item = {
        "test_name": "Hemoglobin",
        "value": 10.2,
        "unit": "g/dL",
        "reference_low": 12.0,
        "reference_high": 16.0
    }
    response = client.post("/api/abnormal-values/evaluate", json=item)
    assert response.status_code == 200
    data = response.json()

    assert data["test_name"] == "Hemoglobin"
    assert data["value"] == 10.2
    assert data["status"] == "low"
    assert data["flagged"] is True
    assert "anemia" not in data["message"].lower()
    assert "Physician review recommended" in data["message"]


def test_batch_abnormal_values_evaluation_endpoint():
    """
    Tests batch evaluation of multiple values via REST.
    """
    items = [
        {"test_name": "Hemoglobin", "value": 10.2, "unit": "g/dL", "reference_low": 12.0, "reference_high": 16.0},
        {"test_name": "Serum Creatinine", "value": 0.9, "unit": "mg/dL", "reference_low": 0.6, "reference_high": 1.3}
    ]
    response = client.post("/api/abnormal-values/evaluate-batch", json=items)
    assert response.status_code == 200
    data = response.json()
    assert len(data) == 2
    assert data[0]["status"] == "low"
    assert data[1]["status"] == "normal"


def test_health_check_endpoint():
    """
    Tests /health endpoint.
    """
    response = client.get("/health")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "healthy"
    assert "SIH26047" in data["project"]


def test_api_normalize_patient_narrative():
    """
    Tests /api/normalization/normalize endpoint.
    """
    payload = {
        "text": "Doc, my head is killing me and I fainted yesterday. No chest pain.",
        "patient_id": "PT-NORM-01",
        "age": 45,
        "gender": "female"
    }
    response = client.post("/api/normalization/normalize", json=payload)
    assert response.status_code == 200
    data = response.json()
    assert data["patient_id"] == "PT-NORM-01"
    assert data["loss_of_consciousness"] is True
    assert "chest pain" in data["relevant_negative_symptoms"]
    assert any(s["name"] == "headache" and s["severity"] == "severe" for s in data["symptoms"])


def test_api_screen_patient_narrative_e2e():
    """
    Tests /api/red-flags/screen-narrative endpoint.
    """
    payload = {
        "text": "It feels like an elephant sitting on my chest and I can't catch my breath.",
        "patient_id": "PT-NORM-02"
    }
    response = client.post("/api/red-flags/screen-narrative", json=payload)
    assert response.status_code == 200
    data = response.json()
    assert "normalized_history" in data
    assert "screening_result" in data
    assert data["normalized_history"]["breathing_difficulty"] is True
    assert data["screening_result"]["detected"] is True
    assert data["screening_result"]["rule_id"] == "RF_CARD_02"
    assert data["screening_result"]["severity"] == "critical"

