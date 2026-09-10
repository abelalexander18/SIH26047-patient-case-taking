"""
SIH26047 — Patient Case-Taking Software (Ministry of Ayush / AIIA)
Medical Document OCR & Metric Extraction Processor
"""

import io
import re
from typing import Optional, List, Tuple
from member6_intelligence.schemas import (
    DocumentOCRResult,
    DocumentType,
    VitalsInput,
    LabItem
)

# Optional image/PDF library imports with resilient fallback
try:
    import pypdf
    PYPDF_AVAILABLE = True
except ImportError:
    PYPDF_AVAILABLE = False

try:
    from PIL import Image
    import pytesseract
    PYTESSERACT_AVAILABLE = True
except ImportError:
    PYTESSERACT_AVAILABLE = False


class MedicalDocumentProcessor:
    """
    Extracts text from medical documents (electronic PDFs, lab reports, scanned images)
    and uses clinical pattern heuristics to automatically parse vitals and laboratory values.
    Designed for zero-crash fallback during live hackathon demos.
    """

    def process_file(
        self,
        file_bytes: bytes,
        filename: str = "document.pdf"
    ) -> DocumentOCRResult:
        """
        Main processing method accepting file bytes and filename.
        Directs to PDF or Image parser accordingly.
        """
        lower_name = filename.lower()
        extracted_text = ""
        notes: List[str] = []

        if lower_name.endswith(".pdf"):
            extracted_text, notes = self._extract_text_from_pdf(file_bytes)
        elif any(lower_name.endswith(ext) for ext in [".png", ".jpg", ".jpeg", ".tiff", ".bmp", ".webp"]):
            extracted_text, notes = self._extract_text_from_image(file_bytes)
        else:
            # Attempt UTF-8 decode as plain text fallback
            try:
                extracted_text = file_bytes.decode("utf-8")
                notes.append("Decoded raw text stream successfully.")
            except Exception:
                extracted_text = ""
                notes.append("Unsupported file format or unreadable binary.")

        # Parse metrics from extracted text
        return self.parse_clinical_text(extracted_text, notes=notes)

    def parse_clinical_text(
        self,
        text: str,
        notes: Optional[List[str]] = None
    ) -> DocumentOCRResult:
        """
        Parses structured vitals and lab biomarkers from clinical text using regex heuristics.
        """
        if notes is None:
            notes = []

        vitals, parsed_labs = self._extract_metrics(text)
        doc_type = self._classify_document_type(text, parsed_labs)

        confidence = 0.95 if (vitals or parsed_labs) else (0.7 if text.strip() else 0.0)

        if not text.strip():
            notes.append("No readable textual content could be extracted from document.")
        else:
            notes.append(f"Parsed {len(parsed_labs)} lab item(s) and vital metrics successfully.")

        return DocumentOCRResult(
            extracted_text=text.strip(),
            detected_document_type=doc_type,
            parsed_vitals=vitals,
            parsed_labs=parsed_labs,
            confidence_score=confidence,
            extraction_notes=notes
        )

    def _extract_text_from_pdf(self, file_bytes: bytes) -> Tuple[str, List[str]]:
        notes: List[str] = []
        if not PYPDF_AVAILABLE:
            notes.append("pypdf library not available in environment.")
            return "", notes

        try:
            reader = pypdf.PdfReader(io.BytesIO(file_bytes))
            pages_text = []
            for i, page in enumerate(reader.pages):
                txt = page.extract_text() or ""
                if txt:
                    pages_text.append(txt)
            combined = "\n".join(pages_text)
            notes.append(f"Extracted text across {len(reader.pages)} PDF page(s).")
            return combined, notes
        except Exception as e:
            notes.append(f"PDF extraction failed: {str(e)}")
            return "", notes

    def _extract_text_from_image(self, file_bytes: bytes) -> Tuple[str, List[str]]:
        notes: List[str] = []
        if not PYTESSERACT_AVAILABLE:
            notes.append("pytesseract/PIL not available. Running fallback clinical parser.")
            return "", notes

        try:
            image = Image.open(io.BytesIO(file_bytes))
            text = pytesseract.image_to_string(image)
            notes.append("OCR optical character recognition succeeded via Tesseract.")
            return text, notes
        except Exception as e:
            notes.append(f"OCR scan failed or Tesseract binary missing ({str(e)}). Fallback active.")
            return "", notes

    def _extract_metrics(self, text: str) -> Tuple[Optional[VitalsInput], List[LabItem]]:
        """Scans clinical text with regex to identify vital signs and lab tests."""
        vitals = VitalsInput()
        has_vitals = False
        labs: List[LabItem] = []

        # 1. Blood Pressure: e.g. "BP: 130/85", "Blood Pressure: 180 / 110"
        bp_match = re.search(
            r"(?:bp|blood\s*pressure|nadi\s*pariksha)[:\s]*([0-9]{2,3})\s*[/]\s*([0-9]{2,3})",
            text,
            re.IGNORECASE
        )
        if bp_match:
            vitals.systolic_bp = float(bp_match.group(1))
            vitals.diastolic_bp = float(bp_match.group(2))
            has_vitals = True

        # 2. Heart Rate: e.g. "Pulse: 84 bpm", "HR: 92"
        hr_match = re.search(
            r"(?:pulse|heart\s*rate|hr)[:\s]*([0-9]{2,3})\s*(?:bpm)?\b",
            text,
            re.IGNORECASE
        )
        if hr_match:
            vitals.heart_rate = float(hr_match.group(1))
            has_vitals = True

        # 3. SpO2: e.g. "SpO2: 97%", "Oxygen Saturation: 89%"
        spo2_match = re.search(
            r"(?:spo2|oxygen\s*saturation|o2\s*sat)[:\s]*([0-9]{2,3})\s*%?",
            text,
            re.IGNORECASE
        )
        if spo2_match:
            vitals.spo2 = float(spo2_match.group(1))
            has_vitals = True

        # 4. Temperature: e.g. "Temp: 101.2 F", "Temperature: 98.6"
        temp_match = re.search(
            r"(?:temperature|temp)[:\s]*([0-9]{2,3}(?:\.[0-9]+)?)\s*(?:°?F)?\b",
            text,
            re.IGNORECASE
        )
        if temp_match:
            vitals.temperature_f = float(temp_match.group(1))
            has_vitals = True

        # 5. Respiratory Rate: e.g. "RR: 18", "Respiratory Rate: 24/min"
        rr_match = re.search(
            r"(?:respiratory\s*rate|rr)[:\s]*([0-9]{1,2})\s*(?:/min|breaths?/min)?\b",
            text,
            re.IGNORECASE
        )
        if rr_match:
            vitals.respiratory_rate = float(rr_match.group(1))
            has_vitals = True

        # 6. Blood Glucose: e.g. "Blood Glucose: 165 mg/dL", "RBS: 210", "FBS: 95"
        glucose_match = re.search(
            r"(?:blood\s*sugar|blood\s*glucose|glucose|rbs|fbs|ppbs)[:\s]*([0-9]{2,3}(?:\.[0-9]+)?)\s*(?:mg/dl)?\b",
            text,
            re.IGNORECASE
        )
        if glucose_match:
            vitals.blood_glucose_mg_dl = float(glucose_match.group(1))
            matched_word = glucose_match.group(0).lower()
            if "fbs" in matched_word or "fast" in matched_word:
                vitals.blood_glucose_type = "fasting"
            elif "ppbs" in matched_word or "post" in matched_word:
                vitals.blood_glucose_type = "post_prandial"
            else:
                vitals.blood_glucose_type = "random"
            has_vitals = True

        # 7. Hemoglobin: e.g. "Hemoglobin: 11.2 g/dL", "Hb: 8.5"
        hb_match = re.search(
            r"(?:hemoglobin|hb|hgb)[:\s]*([0-9]{1,2}(?:\.[0-9]+)?)\s*(?:g/dl|gm/dl)?\b",
            text,
            re.IGNORECASE
        )
        if hb_match:
            labs.append(
                LabItem(
                    name="Hemoglobin",
                    value=float(hb_match.group(1)),
                    unit="g/dL"
                )
            )

        # 8. Platelets: e.g. "Platelets: 180000", "Platelet Count: 1.5 lakhs", "PLT: 45000"
        plt_match = re.search(
            r"(?:platelet(?:s)?(?:\s*count)?|plt)[:\s]*([0-9]+(?:\.[0-9]+)?)\s*(?:lakhs?|/ul|/cumm)?\b",
            text,
            re.IGNORECASE
        )
        if plt_match:
            val = float(plt_match.group(1))
            # If formatted in Indian lakh units e.g. 1.8 lakhs -> 180,000
            if val < 50:
                val = val * 100000
            labs.append(
                LabItem(
                    name="Platelet Count",
                    value=val,
                    unit="/uL"
                )
            )

        # 9. Total WBC / TLC: e.g. "Total WBC: 12500", "TLC: 8200"
        wbc_match = re.search(
            r"(?:total\s*leukocyte\s*count|wbc(?:\s*count)?|tlc)[:\s]*([0-9]+(?:\.[0-9]+)?)\s*(?:/ul|/cumm)?\b",
            text,
            re.IGNORECASE
        )
        if wbc_match:
            labs.append(
                LabItem(
                    name="Total Leukocyte Count (WBC)",
                    value=float(wbc_match.group(1)),
                    unit="/uL"
                )
            )

        # 10. Serum Creatinine: e.g. "Serum Creatinine: 1.8 mg/dL", "Creatinine: 0.9"
        creat_match = re.search(
            r"(?:serum\s*creatinine|creatinine|creat)[:\s]*([0-9]{1,2}(?:\.[0-9]+)?)\s*(?:mg/dl)?\b",
            text,
            re.IGNORECASE
        )
        if creat_match:
            labs.append(
                LabItem(
                    name="Serum Creatinine",
                    value=float(creat_match.group(1)),
                    unit="mg/dL"
                )
            )

        # 11. Total Bilirubin: e.g. "Total Bilirubin: 2.4 mg/dL", "Bilirubin: 0.8"
        bili_match = re.search(
            r"(?:total\s*bilirubin|bilirubin)[:\s]*([0-9]{1,2}(?:\.[0-9]+)?)\s*(?:mg/dl)?\b",
            text,
            re.IGNORECASE
        )
        if bili_match:
            labs.append(
                LabItem(
                    name="Total Bilirubin",
                    value=float(bili_match.group(1)),
                    unit="mg/dL"
                )
            )

        return (vitals if has_vitals else None), labs

    def _classify_document_type(self, text: str, parsed_labs: List[LabItem]) -> DocumentType:
        lower = text.lower()
        if len(parsed_labs) >= 1 or "pathology" in lower or "laboratory" in lower or "test report" in lower:
            return DocumentType.LAB_REPORT
        if "rx" in lower or "tab." in lower or "syrup" in lower or "mg od" in lower or "b.d." in lower:
            return DocumentType.PRESCRIPTION
        if "discharge summary" in lower or "discharge slip" in lower or "hospital course" in lower:
            return DocumentType.DISCHARGE_SUMMARY
        return DocumentType.GENERAL_MEDICAL
