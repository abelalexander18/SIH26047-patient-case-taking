# SIH26047 — Member 6: OCR & Red Flag Intelligence Module

**Problem Statement:** SIH26047 — Patient Case-Taking Software  
**Organization:** Ministry of Ayush / All India Institute of Ayurveda (AIIA)  
**Role:** Member 6 — OCR & Red Flag Intelligence  

---

## 🛡️ Clinical Decision Support Disclaimer
> **IMPORTANT REGULATORY GUARDRAIL:**  
> This software is a **clinical decision-support prototype** developed to assist healthcare professionals during outpatient triage and case-taking.  
> - **It DOES NOT diagnose diseases.**  
> - **It DOES NOT prescribe medications.**  
> - **It DOES NOT replace a qualified physician.**  
> - **It screens for predefined potential red flags and highlights abnormal physiological values for doctor review.**

---

## 📦 What This Module Delivers
1. **Clinical Red-Flag Screening Engine**: Deterministic detection of cardiovascular, neurological, respiratory, sepsis, acute abdomen, and acute Ayush contraindication emergencies.
2. **Medical Value Abnormality Detector**: Validates vitals (BP, HR, RR, SpO2, Temp, Blood Glucose) and lab tests (Hb, Platelets, WBC, Creatinine, Bilirubin) against established clinical reference standards (AHA / WHO / ICMR), generating `NORMAL`, `LOW`, `HIGH`, `CRITICAL_LOW`, and `CRITICAL_HIGH` badges.
3. **Medical Document OCR & Parser**: Extracts clinical text and auto-parses key metrics from electronic PDFs and medical reports with zero-crash fallback logic.
4. **Backend Integration Interface**: Direct Python import support + lightweight FastAPI REST micro-service + interactive Doctor Triage Demo Dashboard (`/demo`).

---

## 🚀 Quick Start (Demo in 30 Seconds)

### 1. Install Dependencies
```bash
pip install -r requirements.txt
```

### 2. Run Automated Tests
```bash
python -m pytest -v
```
*(All 10 unit tests pass in under 1 second).*

### 3. Launch the Service & Demo Dashboard
```bash
python -m uvicorn api.app:app --host 0.0.0.0 --port 8006 --reload
```

- **Interactive Doctor Triage UI:** Open [http://localhost:8006/demo](http://localhost:8006/demo) in your browser.
- **FastAPI Swagger Docs:** Open [http://localhost:8006/docs](http://localhost:8006/docs) for full interactive API testing.

---

## 🔌 Integration Guide for Teammates

### Option A: Direct Python Import (For Backend Teammates)
If your backend is written in Python (FastAPI, Flask, or Django), simply import and call the service directly:

```python
from member6_intelligence import screen_patient_case, check_vitals_and_labs

# Example 1: Full Case Screening
case_data = {
    "case_id": "CASE-101",
    "chief_complaints": [
        "Crushing retrosternal chest pain radiating to left arm",
        "Profuse sweating and shortness of breath"
    ],
    "medical_history": ["Hypertension for 5 years"],
    "vitals": {
        "systolic_bp": 190,
        "diastolic_bp": 115,
        "heart_rate": 112,
        "spo2": 95,
        "temperature_f": 98.6
    }
}

result = screen_patient_case(case_data)

print(result.overall_triage)     # "CRITICAL"
print(result.is_emergency)       # True
print(result.summary_headline)   # "CRITICAL RED ALERT: 2 life-threatening emergency flag(s) identified..."

for flag in result.red_flags:
    print(f"[{flag.severity}] {flag.title} -> Action: {flag.recommended_action}")

for abnormal in result.abnormalities:
    print(f"{abnormal.display_name}: {abnormal.observed_value} ({abnormal.status})")
```

```python
# Example 2: Quick Vitals Check Only
from member6_intelligence import check_vitals_and_labs

abnormals, normal_count = check_vitals_and_labs(
    vitals={"systolic_bp": 185, "diastolic_bp": 115, "spo2": 87}
)
```

---

### Option B: REST API Endpoints (For Node.js / React / Next.js Teammates)

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/health` | Service health status & clinical guardrails metadata |
| `POST` | `/api/screen-case` | Full clinical case screening (symptoms + vitals + history) |
| `POST` | `/api/check-vitals` | Check vitals & lab metrics for abnormalities |
| `POST` | `/api/ocr-document` | Upload PDF or image document -> parsed vitals & labs |
| `POST` | `/api/parse-text` | Parse raw clinical note text -> vitals & labs |
| `GET` | `/api/reference-ranges` | View clinical reference ranges catalog |
| `GET` | `/api/red-flags-catalog` | View catalog of all predefined red flags |
| `GET` | `/demo` | Standalone interactive web dashboard |

#### Example REST Call:
```bash
curl -X POST http://localhost:8006/api/screen-case \
  -H "Content-Type: application/json" \
  -d '{
    "chief_complaints": ["Crushing chest pain radiating to arm", "sweating"],
    "vitals": {
      "systolic_bp": 190,
      "diastolic_bp": 115,
      "heart_rate": 110
    }
  }'
```

---

## 🗂️ Project Structure
```
c:\5th sem\SIH\
│
├── member6_intelligence/               # Core Member 6 Package
│   ├── __init__.py                     # Clean package exports
│   ├── schemas.py                      # Pydantic data models & triage enums
│   ├── service.py                      # Unified programmatic facade
│   ├── rules/
│   │   ├── __init__.py                 # Rules accessors
│   │   ├── red_flags.json              # Curated clinical red-flag definitions & trigger rules
│   │   └── reference_ranges.json       # Physiological & lab reference limits (AHA, WHO)
│   └── engines/
│       ├── __init__.py
│       ├── abnormality_detector.py     # Range checking (Low / Normal / High / Critical)
│       ├── red_flag_engine.py          # Predefined symptom & vital emergency screening
│       └── ocr_processor.py            # PDF/image medical text & regex metric extractor
│
├── api/
│   ├── __init__.py
│   └── app.py                          # FastAPI REST API & CORS configuration
│
├── demo/
│   └── index.html                      # Interactive 1-click test dashboard for presentation
│
├── tests/
│   ├── __init__.py
│   └── test_intelligence.py            # Comprehensive pytest test suite (10 test cases)
│
├── requirements.txt                    # Lightweight dependencies
└── README.md                           # Documentation & integration guide
```

---

## 🩺 Red-Flag Categories Covered
1. **Cardiovascular Emergencies**: Acute Coronary Syndrome (crushing chest pain + radiation + diaphoresis), Hypertensive Crisis (BP >= 180/120 mmHg).
2. **Neurological Emergencies**: Acute Stroke / TIA (FAST criteria: unilateral droop, arm drift, slurred speech), Thunderclap Headache / Meningism.
3. **Respiratory Failure**: Critical Hypoxemia (SpO2 < 90%), severe tachypnea / bradypnea, gasping.
4. **Allergic & Airway**: Anaphylaxis / angioedema with mucosal swelling and airway tightness.
5. **Gastrointestinal & Acute Abdomen**: Peritoneal irritation (rigid board-like abdomen), active upper GI hemorrhage (hematemesis, melena).
6. **Sepsis & Severe Infection**: Systemic inflammatory response syndrome (fever, tachycardia, tachypnea, hypotension, altered mentation).
7. **Metabolic Crisis**: Severe hypoglycemia (<55 mg/dL), DKA / Hyperglycemia crisis (>350 mg/dL with Kussmaul breathing).
8. **Ayush Clinical Triage Contraindications**: Acute trauma, active hemorrhage, status epilepticus (mandatory emergency department diversion before routine outpatient Ayurvedic therapies).
