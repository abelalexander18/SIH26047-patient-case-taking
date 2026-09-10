"""
Unit tests for the Medical Document OCR Pipeline.
Tests verify:
- Synthetic PDF document processing
- Verbatim raw OCR text preservation
- Image upload handling and PIL validation
- Structured medical metric extraction (test_name, value, unit)
- Direct evaluation through the abnormal-value detector (low, normal, high)
- Defensive handling of poor-quality or illegible text (uncertain status, zero invented values)
- Prototype limitations and handwriting disclaimers
"""

import pytest
from document_ocr import (
    process_medical_document,
    create_synthetic_pdf_bytes,
    create_synthetic_image_bytes,
    SYNTHETIC_LAB_REPORT_TEXT,
    SYNTHETIC_POOR_QUALITY_TEXT
)


def test_synthetic_pdf_processing_and_abnormality_linkage():
    # 1. Generate synthetic PDF in memory
    pdf_bytes = create_synthetic_pdf_bytes(SYNTHETIC_LAB_REPORT_TEXT)
    
    # 2. Run through OCR pipeline
    result = process_medical_document(pdf_bytes, filename="synthetic_report.pdf")
    
    # 3. Verify schema structure
    assert result["document_type"] == "lab_report"
    assert result["extraction_status"] == "success"
    assert len(result["raw_text"]) > 0
    assert "ALL INDIA INSTITUTE OF AYURVEDA" in result["raw_text"]

    # 4. Verify structured values are exposed
    extracted = result["extracted_values"]
    assert len(extracted) >= 3

    test_names = [item["test_name"] for item in extracted]
    assert "Hemoglobin" in test_names
    assert "Fasting Blood Glucose" in test_names
    assert "Serum Creatinine" in test_names

    # 5. Verify values were processed through the abnormal-value detector
    abnormalities = result["evaluated_abnormalities"]
    assert len(abnormalities) >= 3

    # Find Hemoglobin (10.2 g/dL) -> Expected status: low
    hb_eval = next(a for a in abnormalities if a["test_name"] == "Hemoglobin")
    assert hb_eval["value"] == 10.2
    assert hb_eval["status"] == "low"
    assert hb_eval["flagged"] is True
    assert "below the configured reference range" in hb_eval["message"]

    # Find Glucose (154.0 mg/dL) -> Expected status: high
    glucose_eval = next(a for a in abnormalities if a["test_name"] == "Fasting Blood Glucose")
    assert glucose_eval["value"] == 154.0
    assert glucose_eval["status"] == "high"
    assert glucose_eval["flagged"] is True
    assert "above the configured reference range" in glucose_eval["message"]

    # Find Creatinine (0.9 mg/dL) -> Expected status: normal
    creat_eval = next(a for a in abnormalities if a["test_name"] == "Serum Creatinine")
    assert creat_eval["value"] == 0.9
    assert creat_eval["status"] == "normal"
    assert creat_eval["flagged"] is False


def test_raw_ocr_text_preservation():
    # Verify raw text is preserved verbatim without alteration
    pdf_bytes = create_synthetic_pdf_bytes(SYNTHETIC_LAB_REPORT_TEXT)
    result = process_medical_document(pdf_bytes, filename="demo_report.pdf")
    
    assert "Hemoglobin" in result["raw_text"]
    assert "10.2" in result["raw_text"]
    assert "Serum Creatinine" in result["raw_text"]
    assert "Platelet Count" in result["raw_text"]


def test_image_input_handling_and_limitation_notes():
    # Pass a synthetic PNG image
    img_bytes = create_synthetic_image_bytes()
    result = process_medical_document(img_bytes, filename="report_scan.png")
    
    # Must not crash
    assert "document_type" in result
    assert "notes" in result
    
    # Check that notes explicitly mention the handwriting limitation
    notes_text = " ".join(result["notes"]).lower()
    assert "handwriting" in notes_text or "image ocr" in notes_text


def test_poor_quality_scan_uncertain_extraction_avoids_inventing_values():
    # Pass noisy/smudged document text
    result = process_medical_document(
        file_bytes=SYNTHETIC_POOR_QUALITY_TEXT.encode("utf-8"),
        filename="scanned_noise.txt"
    )
    
    # Must preserve raw text
    assert len(result["raw_text"]) > 0
    assert "ILLEGIBLE" in result["raw_text"]
    
    # Must mark extraction as uncertain rather than inventing fake numbers
    assert result["extraction_status"] == "uncertain"
    assert len(result["extracted_values"]) == 0
    assert len(result["evaluated_abnormalities"]) == 0
    
    # Must include caution note
    notes_text = " ".join(result["notes"]).lower()
    assert "uncertain" in notes_text or "avoided guessing" in notes_text


def test_disclaimer_and_non_diagnostic_guarantee():
    pdf_bytes = create_synthetic_pdf_bytes(SYNTHETIC_LAB_REPORT_TEXT)
    result = process_medical_document(pdf_bytes, filename="report.pdf")
    
    # Verify top-level disclaimer
    assert "Prototype OCR extraction" in result["disclaimer"]
    assert "verified by a physician" in result["disclaimer"]
    
    # Verify downstream abnormality disclaimers
    for ab in result["evaluated_abnormalities"]:
        assert "Non-diagnostic observation" in ab["disclaimer"]
        # Ensure no disease diagnosis
        msg_lower = ab["message"].lower()
        assert "diagnosed" not in msg_lower
        assert "anemia" not in msg_lower
        assert "diabetes" not in msg_lower
