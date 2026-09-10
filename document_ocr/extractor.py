"""
SIH26047 — Patient Case-Taking Software (Ministry of Ayush / AIIA)
Clinical Information Extraction Layer

Extracts structured medical biomarkers, values, units, and printed reference
bounds from raw clinical document text using heuristic regex patterns.
"""

import re
import os
from typing import List, Tuple, Optional
from document_ocr.schemas import ExtractedLabValue


class ClinicalTextExtractor:
    """
    Parses unstructured text extracted via OCR into structured medical metrics.
    Supports OpenAI structured extraction with deterministic regex fallback.
    Preserves confidence indicators and avoids inventing values.
    """

    def _extract_with_openai(self, raw_text: str) -> Optional[List[ExtractedLabValue]]:
        """Attempts OpenAI-based extraction of structured medical values if OPENAI_API_KEY is configured."""
        api_key = os.environ.get("OPENAI_API_KEY", "").strip()
        if not api_key:
            return None

        try:
            from ai_extraction.client import OpenAIClientWrapper
            client = OpenAIClientWrapper()
            system_prompt = (
                "You are a clinical laboratory document parsing assistant for Arogya AI. "
                "Extract structured medical and laboratory values from the provided OCR text of a medical report. "
                "RULES:\n"
                "- Extract ONLY values explicitly stated in the text.\n"
                "- Do NOT hallucinate or invent values not present in the text.\n"
                "- Do NOT diagnose any disease.\n"
                "OUTPUT FORMAT: Return a JSON object with 'extracted_values': [ "
                "{ 'test_name': str, 'value': float, 'unit': str, 'reference_low': float|null, 'reference_high': float|null } ]."
            )
            res = client.chat_completion_json(system_prompt, raw_text)
            raw_vals = res.get("extracted_values", [])
            extracted = []
            for v in raw_vals:
                if isinstance(v, dict) and "test_name" in v and "value" in v:
                    try:
                        num_val = float(v["value"])
                        extracted.append(ExtractedLabValue(
                            test_name=str(v["test_name"]).strip(),
                            value=num_val,
                            unit=str(v.get("unit") or "").strip(),
                            reference_low=float(v["reference_low"]) if v.get("reference_low") is not None else None,
                            reference_high=float(v["reference_high"]) if v.get("reference_high") is not None else None,
                            source="ocr-openai"
                        ))
                    except (ValueError, TypeError):
                        continue
            if extracted:
                return extracted
        except Exception:
            pass
        return None

    def extract_metrics(self, raw_text: str) -> Tuple[List[ExtractedLabValue], str]:
        """
        Extracts structured laboratory and vital values from raw text.
        Returns: (extracted_values, document_type)
        """
        extracted: List[ExtractedLabValue] = []
        doc_type = self._classify_document(raw_text)

        # 1. Try OpenAI-based extraction if available
        ai_extracted = self._extract_with_openai(raw_text)
        if ai_extracted:
            return ai_extracted, doc_type

        lines = [line.strip() for line in raw_text.splitlines() if line.strip()]

        # 1. Hemoglobin (Hb)
        # Matches: "Hemoglobin: 10.2 g/dL (Ref: 12.0 - 16.0)" or "Hb 10.2"
        hb_pattern = re.compile(
            r"(?:hemoglobin|hb|hgb)[\s:=]+([0-9]{1,2}(?:\.[0-9]+)?)\s*(g/dl|gm/dl)?(?:.*?\(.*?([0-9]{1,2}(?:\.[0-9]+)?)\s*-\s*([0-9]{1,2}(?:\.[0-9]+)?)\s*(?:g/dl|gm/dl)?\))?",
            re.IGNORECASE
        )
        for line in lines:
            m = hb_pattern.search(line)
            if m:
                val = float(m.group(1))
                unit = m.group(2) or "g/dL"
                ref_low = float(m.group(3)) if m.group(3) else None
                ref_high = float(m.group(4)) if m.group(4) else None
                extracted.append(ExtractedLabValue(
                    test_name="Hemoglobin",
                    value=val,
                    unit="g/dL" if "gm" in unit.lower() else unit,
                    reference_low=ref_low,
                    reference_high=ref_high,
                    source="ocr"
                ))
                break

        # 2. Fasting / Random Blood Glucose
        glucose_pattern = re.compile(
            r"(?:fasting\s*blood\s*(?:sugar|glucose)|fbs|random\s*blood\s*(?:sugar|glucose)|rbs|blood\s*glucose|blood\s*sugar)[\s:=]+([0-9]{2,3}(?:\.[0-9]+)?)\s*(mg/dl|mmol/l)?(?:.*?\(.*?([0-9]{2,3}(?:\.[0-9]+)?)\s*-\s*([0-9]{2,3}(?:\.[0-9]+)?)\s*(?:mg/dl)?\))?",
            re.IGNORECASE
        )
        for line in lines:
            m = glucose_pattern.search(line)
            if m:
                val = float(m.group(1))
                matched_label = line[:m.start() + 15].lower()
                is_fasting = "fasting" in matched_label or "fbs" in matched_label
                test_name = "Fasting Blood Glucose" if is_fasting else "Random Blood Glucose"
                unit = m.group(2) or "mg/dL"
                ref_low = float(m.group(3)) if m.group(3) else None
                ref_high = float(m.group(4)) if m.group(4) else None
                extracted.append(ExtractedLabValue(
                    test_name=test_name,
                    value=val,
                    unit=unit,
                    reference_low=ref_low,
                    reference_high=ref_high,
                    source="ocr"
                ))
                break

        # 3. Serum Creatinine
        creat_pattern = re.compile(
            r"(?:serum\s*creatinine|creatinine|creat)[\s:=]+([0-9]{1,2}(?:\.[0-9]+)?)\s*(mg/dl)?(?:.*?\(.*?([0-9]{1,2}(?:\.[0-9]+)?)\s*-\s*([0-9]{1,2}(?:\.[0-9]+)?)\s*(?:mg/dl)?\))?",
            re.IGNORECASE
        )
        for line in lines:
            m = creat_pattern.search(line)
            if m:
                val = float(m.group(1))
                unit = m.group(2) or "mg/dL"
                ref_low = float(m.group(3)) if m.group(3) else None
                ref_high = float(m.group(4)) if m.group(4) else None
                extracted.append(ExtractedLabValue(
                    test_name="Serum Creatinine",
                    value=val,
                    unit=unit,
                    reference_low=ref_low,
                    reference_high=ref_high,
                    source="ocr"
                ))
                break

        # 4. Platelet Count
        plt_pattern = re.compile(
            r"(?:platelet(?:\s*count)?|plt)[\s:=]+([0-9]+(?:\.[0-9]+)?)\s*(lakhs?|/ul|/cumm)?(?:.*?\(.*?([0-9]+(?:\.[0-9]+)?)\s*-\s*([0-9]+(?:\.[0-9]+)?)\s*(?:lakhs?|/ul|/cumm)?\))?",
            re.IGNORECASE
        )
        for line in lines:
            m = plt_pattern.search(line)
            if m:
                val = float(m.group(1))
                unit_hint = (m.group(2) or "").lower()
                if "lakh" in unit_hint and val < 50:
                    val = val * 100000.0
                ref_low = float(m.group(3)) if m.group(3) else None
                ref_high = float(m.group(4)) if m.group(4) else None
                extracted.append(ExtractedLabValue(
                    test_name="Platelet Count",
                    value=val,
                    unit="/uL",
                    reference_low=ref_low,
                    reference_high=ref_high,
                    source="ocr"
                ))
                break

        # 5. Total Leukocyte Count (WBC)
        wbc_pattern = re.compile(
            r"(?:total\s*leukocyte\s*count|wbc(?:\s*count)?|tlc)[\s:=]+([0-9]+(?:\.[0-9]+)?)\s*(/ul|/cumm)?(?:.*?\(.*?([0-9]+(?:\.[0-9]+)?)\s*-\s*([0-9]+(?:\.[0-9]+)?)\s*(?:/ul|/cumm)?\))?",
            re.IGNORECASE
        )
        for line in lines:
            m = wbc_pattern.search(line)
            if m:
                val = float(m.group(1))
                ref_low = float(m.group(3)) if m.group(3) else None
                ref_high = float(m.group(4)) if m.group(4) else None
                extracted.append(ExtractedLabValue(
                    test_name="Total Leukocyte Count (WBC)",
                    value=val,
                    unit="/uL",
                    reference_low=ref_low,
                    reference_high=ref_high,
                    source="ocr"
                ))
                break

        # 6. Blood Pressure (Systolic / Diastolic)
        bp_pattern = re.compile(
            r"(?:bp|blood\s*pressure)[\s:=]+([0-9]{2,3})\s*[/]\s*([0-9]{2,3})\s*(mm\s*hg)?",
            re.IGNORECASE
        )
        for line in lines:
            m = bp_pattern.search(line)
            if m:
                sys_val = float(m.group(1))
                dia_val = float(m.group(2))
                extracted.append(ExtractedLabValue(
                    test_name="Systolic Blood Pressure",
                    value=sys_val,
                    unit="mmHg",
                    reference_low=90.0,
                    reference_high=120.0,
                    source="ocr"
                ))
                extracted.append(ExtractedLabValue(
                    test_name="Diastolic Blood Pressure",
                    value=dia_val,
                    unit="mmHg",
                    reference_low=60.0,
                    reference_high=80.0,
                    source="ocr"
                ))
                break

        return extracted, doc_type

    def _classify_document(self, text: str) -> str:
        lower = text.lower()
        if any(term in lower for term in ["lab report", "pathology", "clinical laboratory", "reference range", "hemoglobin", "serum creatinine"]):
            return "lab_report"
        if any(term in lower for term in ["rx", "prescription", "tab.", "syrup", "capsule", "dosage"]):
            return "prescription"
        if any(term in lower for term in ["discharge summary", "discharge card", "date of admission", "condition at discharge"]):
            return "discharge_summary"
        return "other"
