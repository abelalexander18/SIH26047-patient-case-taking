"""
Test Suite: OpenAI API Integration for Patient Case-Taking

Verifies:
1. Structured clinical information extraction with STRICT NULL PRESERVATION (no hallucinations).
2. Missing acute discriminators detection based on reported complaints.
3. Generation of exactly ONE context-aware follow-up question.
4. Multi-turn conversational state accumulation.
5. Deterministic red-flag screening handoff (OpenAI extracts, deterministic engine screens).
6. Non-diagnostic doctor intake summary generation.
"""

import pytest
from ai_extraction import AIExtractionService, MockOpenAIClient, OpenAIClientWrapper
from red_flag_engine.schemas import ClinicalHistory, SymptomDetail
from red_flag_engine.engine import RedFlagEngine

# Use mock wrapper for deterministic unit testing
client = OpenAIClientWrapper(force_mock=True)
service = AIExtractionService(client=client)


# =====================================================================
# 1. STRICT NULL PRESERVATION (USER EXAMPLE SCENARIO)
# =====================================================================

def test_extract_unmentioned_fields_remain_null():
    """
    Patient: "I've been vomiting for two days."
    Extraction must contain vomiting and duration 2 days.
    Crucially: blood_in_vomit, unable_to_keep_fluids, dizziness, syncope MUST REMAIN NULL.
    """
    patient_msg = "I've been vomiting for two days."
    extracted = service.extract_clinical_history(patient_msg)

    # 1. Verify extracted facts
    symptom_names = [s.name if isinstance(s, SymptomDetail) else s.get("name") for s in extracted.symptoms]
    assert "vomiting" in symptom_names
    vomit_symptom = next(s for s in extracted.symptoms if (s.name if isinstance(s, SymptomDetail) else s.get("name")) == "vomiting")
    assert vomit_symptom.duration_days == 2.0 or "2 days" in str(vomit_symptom.duration)

    # 2. Verify strict null preservation (no hallucinations)
    assert extracted.blood_in_vomit is None
    assert extracted.unable_to_keep_fluids is None
    assert extracted.ability_to_keep_fluids_down is None
    assert extracted.dizziness is None
    assert extracted.loss_of_consciousness is None
    assert extracted.breathing_difficulty is None
    assert extracted.confusion is None


# =====================================================================
# 2. MISSING CRITICAL INFORMATION & SINGLE FOLLOW-UP QUESTION
# =====================================================================

def test_missing_critical_info_identification():
    """
    Vomiting is reported, but fluid retention and hematemesis are unknown.
    The system must identify these as missing acute safety discriminators.
    """
    history = ClinicalHistory(
        chief_complaints=["vomiting"],
        symptoms=[SymptomDetail(name="vomiting", duration="2 days", duration_days=2.0)],
        blood_in_vomit=None,
        unable_to_keep_fluids=None
    )

    missing = service.identify_missing_critical_info(history)
    assert "unable_to_keep_fluids" in missing
    assert "blood_in_vomit" in missing


def test_single_followup_question_generation():
    """
    Given missing acute discriminators, generates exactly ONE question.
    """
    history = ClinicalHistory(
        chief_complaints=["vomiting"],
        symptoms=[SymptomDetail(name="vomiting", duration="2 days", duration_days=2.0)],
        blood_in_vomit=None,
        unable_to_keep_fluids=None
    )

    missing = service.identify_missing_critical_info(history)
    follow_up = service.generate_followup_question(history, missing)

    assert follow_up is not None
    assert follow_up.target_field == "unable_to_keep_fluids"
    # Ensure it's a single question ending with a question mark
    assert follow_up.question.endswith("?")
    assert "fluid" in follow_up.question.lower() or "water" in follow_up.question.lower() or "drink" in follow_up.question.lower()


# =====================================================================
# 3. MULTI-TURN CONVERSATIONAL STATE ACCUMULATION
# =====================================================================

def test_multi_turn_conversational_state_accumulation():
    """
    Turn 1: "I've been vomiting for two days."
      -> System extracts vomiting, asks follow up regarding fluids.
    Turn 2: "No, I cannot keep any water down."
      -> System updates history: unable_to_keep_fluids = True, ability_to_keep_fluids_down = False.
      -> Retains previous facts (vomiting, duration 2 days).
    """
    # Turn 1
    turn1 = service.process_conversational_turn(message="I've been vomiting for two days.")
    assert turn1.updated_history.blood_in_vomit is None
    assert turn1.updated_history.unable_to_keep_fluids is None
    assert turn1.follow_up_question is not None
    assert turn1.follow_up_question.target_field == "unable_to_keep_fluids"

    # Turn 2: Patient answers follow-up
    conv_history = [
        {"role": "user", "content": "I've been vomiting for two days."},
        {"role": "assistant", "content": turn1.follow_up_question.question}
    ]
    turn2 = service.process_conversational_turn(
        message="No, I cannot keep any water down at all.",
        existing_history=turn1.updated_history,
        conversation_history=conv_history
    )

    # Verify updated facts
    assert turn2.updated_history.unable_to_keep_fluids is True
    assert turn2.updated_history.ability_to_keep_fluids_down is False

    # Verify previous facts were preserved
    symptom_names = [s.name if isinstance(s, SymptomDetail) else s.get("name") for s in turn2.updated_history.symptoms]
    assert "vomiting" in symptom_names


# =====================================================================
# 4. DETERMINISTIC RED FLAG ENGINE HANDOFF (SAFETY BOUNDARY)
# =====================================================================

def test_deterministic_red_flag_engine_handoff():
    """
    OpenAI extracts structured facts -> validated by Pydantic -> Red Flag Engine screens.
    OpenAI does NOT make the red-flag decision; the deterministic engine does.
    """
    patient_msg = "My head is killing me and I fainted yesterday at work. No chest pain."
    turn_result = service.process_conversational_turn(patient_msg)

    # 1. Extraction verified
    assert turn_result.updated_history.loss_of_consciousness is True
    assert "chest pain" in turn_result.updated_history.relevant_negative_symptoms

    # 2. Deterministic screening verified
    screening = turn_result.screening_result
    assert screening.detected is True
    assert screening.severity == "critical"
    assert screening.rule_id == "RF_NEURO_02"
    assert screening.category == "neurological"
    assert "RF_CARD_01" not in screening.rule_id  # Chest pain rule suppressed by pertinent negative


# =====================================================================
# 5. DOCTOR-FACING SUMMARY IS NON-DIAGNOSTIC
# =====================================================================

def test_doctor_summary_is_non_diagnostic():
    """
    Verifies that the generated summary is objective, structured, and does not diagnose disease.
    """
    history = ClinicalHistory(
        chief_complaints=["Severe crushing chest pain"],
        symptoms=[SymptomDetail(name="chest pain", severity="severe")],
        breathing_difficulty=True,
        relevant_negative_symptoms=["fever"]
    )
    engine = RedFlagEngine()
    screening = engine.screen(history)
    from red_flag_engine.schemas import RedFlagResult
    screening_res = RedFlagResult(**screening)

    summary = service.generate_doctor_summary(history, screening_res)
    assert len(summary) > 20
    summary_lower = summary.lower()
    assert "diagnos" not in summary_lower or "disclaimer" in summary_lower or "not constitute a medical diagnosis" in summary_lower
    assert "prescribe" not in summary_lower


# =====================================================================
# 6. FASTAPI ENDPOINT INTEGRATION
# =====================================================================

def test_fastapi_ai_intake_message_endpoint():
    from fastapi.testclient import TestClient
    from api.app import app
    client_api = TestClient(app)

    payload = {
        "message": "I've been vomiting for two days.",
        "patient_id": "PT-TEST-001"
    }
    response = client_api.post("/api/ai/intake-message", json=payload)
    assert response.status_code == 200
    data = response.json()

    assert data["patient_message"] == "I've been vomiting for two days."
    assert "updated_history" in data
    assert "screening_result" in data
    assert "follow_up_question" in data
    assert data["follow_up_question"] is not None
    assert data["follow_up_question"]["target_field"] == "unable_to_keep_fluids"
    assert "doctor_summary" in data


def test_fastapi_ai_extract_endpoint():
    from fastapi.testclient import TestClient
    from api.app import app
    client_api = TestClient(app)

    payload = {"message": "I have an intense headache that started yesterday."}
    response = client_api.post("/api/ai/extract", json=payload)
    assert response.status_code == 200
    data = response.json()
    assert any(s["name"] == "headache" for s in data["symptoms"])
    assert data["loss_of_consciousness"] is None  # strict null

