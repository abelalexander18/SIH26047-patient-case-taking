"""
SIH26047 — Patient Case-Taking Software (Ministry of Ayush / AIIA)
Member 6: Backend Integration API

Implements the two clinical flows:
Flow 1: AI Extraction -> Red Flag Engine -> RedFlagResult -> Backend -> Doctor Dashboard
Flow 2: Medical Report -> OCR -> Structured Values -> Abnormality Detector -> Backend -> Doctor Dashboard
"""

from typing import Optional, List, Dict, Any, Union
from pathlib import Path
from fastapi import FastAPI, UploadFile, File, HTTPException, Form
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import HTMLResponse, JSONResponse
from pydantic import BaseModel

# Module imports
from red_flag_engine import (
    ClinicalHistory,
    RedFlagResult,
    screen_red_flags,
    screen_all_red_flags,
    normalize_clinical_narrative
)
from abnormality_detector import (
    ValueEvaluationInput,
    ValueEvaluationResult,
    evaluate_value,
    evaluate_report_values
)
from document_ocr import (
    OCRResult,
    process_medical_document
)
from ai_extraction import (
    get_ai_service,
    IntakeTurnResult,
    FollowUpQuestionResult
)

# Backwards-compatibility imports
from member6_intelligence.schemas import PatientCaseInput, ScreeningResult
from member6_intelligence.service import screen_patient_case

app = FastAPI(
    title="SIH26047 — Clinical Red Flag & Abnormality Intelligence Service",
    description=(
        "Member 6 Module: Clinical-support screening engine, physiological abnormality detector, "
        "and medical document OCR parser for AIIA Patient Case-Taking System. "
        "Strictly non-diagnostic decision support."
    ),
    version="1.0.0"
)

# Enable CORS for frontend teammates (Member 1)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

_DEMO_DIR = Path(__file__).resolve().parent.parent / "demo"


# =====================================================================
# SYSTEM & HEALTH
# =====================================================================

@app.get("/health", tags=["System"])
def health_check():
    """Service health check and guardrail metadata."""
    return {
        "status": "healthy",
        "service": "Member 6 — OCR & Red Flag Intelligence",
        "project": "SIH26047 (Ministry of Ayush / AIIA)",
        "version": "1.0.0",
        "role": "Clinical Decision Support (Physician Assisting)",
        "guardrail": "Deterministic safety screening; non-diagnostic and non-prescriptive"
    }


# =====================================================================
# FLOW 1: AI CLINICAL HISTORY -> RED FLAG ENGINE -> DOCTOR DASHBOARD
# =====================================================================

@app.post("/api/red-flags/screen", response_model=RedFlagResult, tags=["Flow 1: Red Flag Screening"])
def api_screen_red_flags(history: ClinicalHistory):
    """
    FLOW 1 PRIMARY ENDPOINT:
    Consumes AI-generated structured ClinicalHistory JSON.
    Executes deterministic clinical red-flag screening.
    Returns standardized RedFlagResult JSON for the Doctor Dashboard.
    """
    try:
        result = screen_red_flags(history)
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Red-flag screening error: {str(e)}")


@app.post("/api/red-flags/screen-all", response_model=List[RedFlagResult], tags=["Flow 1: Red Flag Screening"])
def api_screen_all_red_flags(history: ClinicalHistory):
    """
    Returns ALL triggered red flags if multiple emergency patterns are simultaneously present.
    """
    try:
        results = screen_all_red_flags(history)
        return results
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Red-flag screening error: {str(e)}")


class PatientNarrativeInput(BaseModel):
    text: str
    vitals: Optional[Dict[str, Any]] = None
    patient_id: Optional[str] = None
    age: Optional[int] = None
    gender: Optional[str] = None


@app.post("/api/normalization/normalize", response_model=ClinicalHistory, tags=["Flow 1: Normalization Layer"])
def api_normalize_patient_narrative(payload: PatientNarrativeInput):
    """
    NORMALIZATION LAYER ENDPOINT:
    Converts conversational patient speech / text into structured ClinicalHistory.
    Preserves strict nulls for unmentioned symptoms, maps lay expressions to clinical concepts,
    and extracts pertinent negative symptoms.
    """
    try:
        normalized = normalize_clinical_narrative(
            text=payload.text,
            vitals=payload.vitals,
            patient_id=payload.patient_id,
            age=payload.age,
            gender=payload.gender
        )
        return normalized
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Clinical normalization error: {str(e)}")


@app.post("/api/red-flags/screen-narrative", tags=["Flow 1: Normalization Layer"])
def api_screen_patient_narrative(payload: PatientNarrativeInput):
    """
    END-TO-END PIPELINE:
    Patient Language -> Normalization Layer -> Structured ClinicalHistory -> Red Flag Screening.
    """
    try:
        normalized = normalize_clinical_narrative(
            text=payload.text,
            vitals=payload.vitals,
            patient_id=payload.patient_id,
            age=payload.age,
            gender=payload.gender
        )
        screening = screen_red_flags(normalized)
        return {
            "normalized_history": normalized.model_dump(),
            "screening_result": screening
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Narrative screening error: {str(e)}")


# =====================================================================
# FLOW 3: CONVERSATIONAL INTAKE & SINGLE FOLLOW-UP (OPENAI INTEGRATION)
# =====================================================================

class AIIntakeMessageRequest(BaseModel):
    message: str
    patient_id: Optional[str] = None
    existing_history: Optional[ClinicalHistory] = None
    conversation_history: Optional[List[Dict[str, str]]] = None
    vitals: Optional[Dict[str, Any]] = None


@app.post("/api/ai/intake-message", response_model=IntakeTurnResult, tags=["Flow 3: OpenAI Conversational Intake"])
def api_ai_intake_message(payload: AIIntakeMessageRequest):
    """
    PRIMARY CONVERSATIONAL INTAKE ENDPOINT:
    1. Ingests patient message (with optional multi-turn conversation context and existing history).
    2. Uses OpenAI to extract structured clinical facts (strict zero hallucination; unmentioned = null).
    3. Runs deterministic RedFlagEngine on the structured facts.
    4. Evaluates missing acute safety discriminators.
    5. If information is incomplete, OpenAI formulates exactly ONE targeted follow-up question.
    6. Formulates an objective, non-diagnostic physician intake summary.
    """
    try:
        service = get_ai_service()
        turn_result = service.process_conversational_turn(
            message=payload.message,
            existing_history=payload.existing_history,
            conversation_history=payload.conversation_history,
            vitals=payload.vitals
        )
        return turn_result
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Conversational intake error: {str(e)}")


@app.post("/api/ai/extract", response_model=ClinicalHistory, tags=["Flow 3: OpenAI Conversational Intake"])
def api_ai_extract_history(payload: AIIntakeMessageRequest):
    """Direct extraction of structured ClinicalHistory from patient text via OpenAI."""
    try:
        service = get_ai_service()
        extracted = service.extract_clinical_history(
            patient_message=payload.message,
            existing_history=payload.existing_history,
            conversation_history=payload.conversation_history,
            vitals=payload.vitals
        )
        return extracted
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"AI extraction error: {str(e)}")


class AIFollowUpRequest(BaseModel):
    history: ClinicalHistory
    conversation_history: Optional[List[Dict[str, str]]] = None


@app.post("/api/ai/follow-up", tags=["Flow 3: OpenAI Conversational Intake"])
def api_ai_generate_follow_up(payload: AIFollowUpRequest):
    """Generates ONE targeted follow-up question if clinical facts are incomplete."""
    try:
        service = get_ai_service()
        missing = service.identify_missing_critical_info(payload.history)
        follow_up = service.generate_followup_question(
            history=payload.history,
            missing_fields=missing,
            conversation_history=payload.conversation_history
        )
        return {
            "missing_critical_fields": missing,
            "follow_up_question": follow_up.model_dump() if follow_up else None
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Follow-up generation error: {str(e)}")


class AISummaryRequest(BaseModel):
    history: ClinicalHistory
    screening_result: Optional[RedFlagResult] = None


@app.post("/api/ai/summarize", tags=["Flow 3: OpenAI Conversational Intake"])
def api_ai_summarize_intake(payload: AISummaryRequest):
    """Generates an objective, non-diagnostic physician summary."""
    try:
        service = get_ai_service()
        summary = service.generate_doctor_summary(
            history=payload.history,
            screening_result=payload.screening_result
        )
        return {"summary": summary}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Summary generation error: {str(e)}")



# =====================================================================
# FLOW 2: MEDICAL REPORT -> OCR -> ABNORMALITY DETECTOR -> DOCTOR DASHBOARD
# =====================================================================

@app.post("/api/ocr/process-report", response_model=OCRResult, tags=["Flow 2: Medical Document OCR"])
async def api_process_medical_report(file: UploadFile = File(...)):
    """
    FLOW 2 PRIMARY ENDPOINT:
    Accepts uploaded medical document (PDF or image).
    1. Extracts raw OCR text (preserved verbatim for physician review).
    2. Parses structured medical values.
    3. Pipes extracted values directly through the Abnormal Value Detector.
    Returns structured OCRResult JSON for the Doctor Dashboard.
    """
    try:
        content = await file.read()
        result = process_medical_document(
            file_bytes=content,
            filename=file.filename or "medical_report.pdf"
        )
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Document OCR processing error: {str(e)}")


# =====================================================================
# STANDALONE ABNORMAL VALUE DETECTION
# =====================================================================

@app.post("/api/abnormal-values/evaluate", response_model=ValueEvaluationResult, tags=["Abnormal Value Detection"])
def api_evaluate_abnormal_value(item: ValueEvaluationInput):
    """
    Compares an individual numerical medical value against configured reference bounds.
    Returns low, normal, high, or unknown with non-diagnostic physician recommendations.
    """
    try:
        result = evaluate_value(item)
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Value evaluation error: {str(e)}")


@app.post("/api/abnormal-values/evaluate-batch", response_model=List[ValueEvaluationResult], tags=["Abnormal Value Detection"])
def api_evaluate_abnormal_values_batch(items: List[ValueEvaluationInput]):
    """
    Batch evaluation of a list of medical values against configured reference bounds.
    """
    try:
        results = evaluate_report_values(items)
        return results
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Batch evaluation error: {str(e)}")


# =====================================================================
# BACKWARDS COMPATIBILITY & COMBINED ENDPOINT
# =====================================================================

class VitalsAndLabsCheckRequest(BaseModel):
    vitals: Optional[Dict[str, Any]] = None
    labs: List[Dict[str, Any]] = []


@app.post("/api/check-vitals", tags=["Legacy / Combined Screening"])
def api_check_vitals(payload: VitalsAndLabsCheckRequest):
    """Legacy vitals check endpoint for backwards compatibility."""
    from member6_intelligence.service import check_vitals_and_labs
    abnormals, normal_count = check_vitals_and_labs(
        vitals=payload.vitals,
        labs=payload.labs
    )
    has_critical = any(a.is_critical for a in abnormals)
    return {
        "abnormalities": [a.model_dump() for a in abnormals],
        "normal_metrics_count": normal_count,
        "has_critical": has_critical
    }


@app.post("/api/screen-case", response_model=ScreeningResult, tags=["Legacy / Combined Screening"])
def api_screen_patient_case(case: PatientCaseInput):
    """Combined case screening endpoint for backwards compatibility."""
    return screen_patient_case(case)


# =====================================================================
# DEMO DASHBOARD HARNESS
# =====================================================================

@app.get("/demo", response_class=HTMLResponse, tags=["Demo Harness"])
def serve_demo_page():
    """Serves the interactive single-page Doctor Triage Dashboard."""
    demo_file = _DEMO_DIR / "index.html"
    if demo_file.exists():
        with open(demo_file, "r", encoding="utf-8") as f:
            return HTMLResponse(content=f.read())
    return HTMLResponse("<h3>Demo UI loading...</h3>")
