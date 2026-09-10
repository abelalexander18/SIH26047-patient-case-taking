"""
Unit and integration tests for Member 6 OCR & Red Flag Intelligence.
"""

import pytest
from fastapi.testclient import TestClient

from member6_intelligence.schemas import (
    PatientCaseInput,
    VitalsInput,
    LabItem,
    TriageSeverity,
    ValueStatus
)
from member6_intelligence.service import (
    screen_patient_case,
    check_vitals_and_labs,
    parse_medical_text
)
from api.app import app

client = TestClient(app)


def test_normal_routine_case():
    case = PatientCaseInput(
        case_id="TEST-001",
        chief_complaints=["Mild gas and abdominal bloating after heavy dinner", "Occasional headache"],
        medical_history=["No major illnesses. Prakriti: Pitta-Kapha"],
        vitals=VitalsInput(
            systolic_bp=118,
            diastolic_bp=78,
            heart_rate=72,
            respiratory_rate=16,
            spo2=99,
            temperature_f=98.4,
            blood_glucose_mg_dl=95,
            blood_glucose_type="fasting"
        )
    )
    result = screen_patient_case(case)
    assert result.overall_triage == TriageSeverity.NORMAL
    assert result.is_emergency is False
    assert len(result.red_flags) == 0
    assert len(result.abnormalities) == 0
    assert result.normal_metrics_count > 0


def test_hypertensive_crisis():
    case = PatientCaseInput(
        case_id="TEST-002",
        chief_complaints=["Severe occipital throbbing headache and blurred vision"],
        vitals=VitalsInput(
            systolic_bp=195,
            diastolic_bp=125,
            heart_rate=88,
            spo2=97,
            temperature_f=98.6
        )
    )
    result = screen_patient_case(case)
    assert result.overall_triage == TriageSeverity.CRITICAL
    assert result.is_emergency is True
    # Verify flag and abnormality
    flag_ids = [f.flag_id for f in result.red_flags]
    assert "RF-CARD-002" in flag_ids
    sys_abnormal = next((a for a in result.abnormalities if a.metric == "systolic_bp"), None)
    assert sys_abnormal is not None
    assert sys_abnormal.status == ValueStatus.CRITICAL_HIGH


def test_acute_coronary_syndrome():
    case = PatientCaseInput(
        case_id="TEST-003",
        chief_complaints=["Severe crushing chest pain radiating to left arm and jaw with profuse sweating"],
        vitals=VitalsInput(
            systolic_bp=145,
            diastolic_bp=90,
            heart_rate=108,
            spo2=96,
            temperature_f=98.6
        )
    )
    result = screen_patient_case(case)
    assert result.overall_triage == TriageSeverity.CRITICAL
    assert result.is_emergency is True
    flag = next((f for f in result.red_flags if f.flag_id == "RF-CARD-001"), None)
    assert flag is not None
    assert "chest pain" in " ".join(flag.matched_cues).lower()


def test_stroke_fast_criteria():
    case = PatientCaseInput(
        case_id="TEST-004",
        chief_complaints=["Patient developed acute right facial droop and slurred speech 40 minutes ago"],
        vitals=VitalsInput(systolic_bp=160, diastolic_bp=95, heart_rate=80, spo2=98)
    )
    result = screen_patient_case(case)
    assert result.overall_triage == TriageSeverity.CRITICAL
    assert result.is_emergency is True
    flag = next((f for f in result.red_flags if f.flag_id == "RF-NEURO-001"), None)
    assert flag is not None
    assert "acute stroke" in flag.title.lower()


def test_severe_hypoxemia():
    case = PatientCaseInput(
        case_id="TEST-005",
        chief_complaints=["Extreme shortness of breath and air hunger"],
        vitals=VitalsInput(
            systolic_bp=120,
            diastolic_bp=80,
            heart_rate=118,
            spo2=86,
            respiratory_rate=32
        )
    )
    result = screen_patient_case(case)
    assert result.overall_triage == TriageSeverity.CRITICAL
    assert result.is_emergency is True
    flag = next((f for f in result.red_flags if f.flag_id == "RF-RESP-001"), None)
    assert flag is not None


def test_sepsis_detection():
    case = PatientCaseInput(
        case_id="TEST-006",
        chief_complaints=["High fever with severe chills and acute confusion", "Drowsiness"],
        vitals=VitalsInput(
            systolic_bp=82,
            diastolic_bp=50,
            heart_rate=125,
            respiratory_rate=26,
            temperature_f=103.4
        )
    )
    result = screen_patient_case(case)
    assert result.overall_triage == TriageSeverity.CRITICAL
    assert result.is_emergency is True
    flag = next((f for f in result.red_flags if f.flag_id == "RF-INF-001"), None)
    assert flag is not None


def test_ayush_contraindication_referral():
    case = PatientCaseInput(
        case_id="TEST-007",
        chief_complaints=["Patient came after road traffic accident with suspected compound fracture and active hemorrhage"],
        vitals=VitalsInput(systolic_bp=110, diastolic_bp=70, heart_rate=90)
    )
    result = screen_patient_case(case)
    assert result.is_emergency is True
    flag = next((f for f in result.red_flags if f.flag_id == "RF-AYUSH-001"), None)
    assert flag is not None


def test_lab_abnormalities():
    labs = [
        LabItem(name="Hemoglobin", value=6.2, unit="g/dL"),
        LabItem(name="Platelet Count", value=18000, unit="/uL"),
        LabItem(name="Serum Creatinine", value=4.5, unit="mg/dL")
    ]
    abnormals, normals = check_vitals_and_labs(vitals=None, labs=labs)
    assert len(abnormals) == 3
    for a in abnormals:
        assert a.is_critical is True
        assert a.status in (ValueStatus.CRITICAL_LOW, ValueStatus.CRITICAL_HIGH)


def test_clinical_text_parsing():
    sample_text = """
    Patient OPD Slip:
    Vitals: BP: 140/90 mmHg, Pulse: 94 bpm, SpO2: 95%, Temp: 101.4 F, RR: 22
    Blood Sugar: 215 mg/dL
    Lab findings:
    Hb: 9.2 g/dL
    Platelets: 1.8 lakhs
    Serum Creatinine: 1.6 mg/dL
    """
    result = parse_medical_text(sample_text)
    assert result.parsed_vitals is not None
    assert result.parsed_vitals.systolic_bp == 140
    assert result.parsed_vitals.diastolic_bp == 90
    assert result.parsed_vitals.heart_rate == 94
    assert result.parsed_vitals.spo2 == 95
    assert result.parsed_vitals.temperature_f == 101.4
    assert result.parsed_vitals.blood_glucose_mg_dl == 215

    assert len(result.parsed_labs) >= 2
    lab_names = [l.name for l in result.parsed_labs]
    assert "Hemoglobin" in lab_names
    assert "Platelet Count" in lab_names


def test_fastapi_endpoints():
    # Health endpoint
    r_health = client.get("/health")
    assert r_health.status_code == 200
    assert r_health.json()["status"] == "healthy"

    # Screen case endpoint
    payload = {
        "case_id": "API-TEST-001",
        "chief_complaints": ["Crushing chest pain radiating to left arm", "diaphoresis"],
        "vitals": {
            "systolic_bp": 185,
            "diastolic_bp": 110,
            "heart_rate": 115
        }
    }
    r_screen = client.post("/api/screen-case", json=payload)
    assert r_screen.status_code == 200
    data = r_screen.json()
    assert data["overall_triage"] == "CRITICAL"
    assert data["is_emergency"] is True
    assert len(data["red_flags"]) >= 1

    # Check vitals endpoint
    v_payload = {
        "vitals": {
            "systolic_bp": 190,
            "diastolic_bp": 125,
            "heart_rate": 45
        },
        "labs": []
    }
    r_vitals = client.post("/api/check-vitals", json=v_payload)
    assert r_vitals.status_code == 200
    v_data = r_vitals.json()
    assert v_data["has_critical"] is True
    assert len(v_data["abnormalities"]) >= 2
