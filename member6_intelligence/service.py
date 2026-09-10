"""
SIH26047 — Patient Case-Taking Software (Ministry of Ayush / AIIA)
Member 6: OCR & Red Flag Intelligence
Unified Service Facade for Programmatic Integration
"""

from typing import Union, Dict, Any, List, Optional, Tuple
from member6_intelligence.schemas import (
    PatientCaseInput,
    ScreeningResult,
    VitalsInput,
    LabItem,
    AbnormalityItem,
    DocumentOCRResult,
    TriageSeverity
)
from member6_intelligence.engines import (
    MedicalAbnormalityDetector,
    RedFlagScreeningEngine,
    MedicalDocumentProcessor
)


class IntelligenceService:
    """
    Unified coordinator for red-flag screening, abnormality detection,
    and medical document parsing.
    """

    def __init__(self):
        self.abnormality_detector = MedicalAbnormalityDetector()
        self.red_flag_engine = RedFlagScreeningEngine()
        self.doc_processor = MedicalDocumentProcessor()

    def screen_patient_case(
        self,
        case_data: Union[PatientCaseInput, Dict[str, Any]]
    ) -> ScreeningResult:
        """
        Executes end-to-end clinical triage screening:
        1. Evaluates vitals and lab biomarkers for numerical abnormalities.
        2. Screens symptoms and case history for predefined red flags.
        3. Fuses findings into an overall triage level and physician alert.
        """
        if isinstance(case_data, dict):
            case = PatientCaseInput(**case_data)
        else:
            case = case_data

        # 1. Screen red flags
        red_flags, overall_triage, is_emergency, headline = self.red_flag_engine.screen(case)

        # 2. Detect vitals and lab abnormalities
        abnormalities, normal_count = self.abnormality_detector.evaluate_all(
            vitals=case.vitals,
            labs=case.lab_results
        )

        # 3. Correlate critical abnormalities into overall triage
        has_critical_abnormality = any(a.is_critical for a in abnormalities)
        if has_critical_abnormality:
            is_emergency = True
            if overall_triage in (TriageSeverity.NORMAL, TriageSeverity.WARNING):
                overall_triage = TriageSeverity.CRITICAL
                crit_names = ", ".join(a.display_name for a in abnormalities if a.is_critical)
                headline = f"CRITICAL ALERT: Life-threatening biomarker abnormality detected ({crit_names}). Immediate clinical attention required."

        return ScreeningResult(
            case_id=case.case_id,
            overall_triage=overall_triage,
            is_emergency=is_emergency,
            summary_headline=headline,
            red_flags=red_flags,
            abnormalities=abnormalities,
            normal_metrics_count=normal_count
        )

    def check_vitals_and_labs(
        self,
        vitals: Optional[Union[VitalsInput, Dict[str, Any]]] = None,
        labs: Optional[List[Union[LabItem, Dict[str, Any]]]] = None
    ) -> Tuple[List[AbnormalityItem], int]:
        """Direct check of vitals and lab values without full case context."""
        v_obj: Optional[VitalsInput] = None
        if vitals is not None:
            v_obj = VitalsInput(**vitals) if isinstance(vitals, dict) else vitals

        l_objs: List[LabItem] = []
        if labs:
            for item in labs:
                l_objs.append(LabItem(**item) if isinstance(item, dict) else item)

        return self.abnormality_detector.evaluate_all(vitals=v_obj, labs=l_objs)

    def process_medical_document(
        self,
        file_bytes: bytes,
        filename: str = "document.pdf"
    ) -> DocumentOCRResult:
        """Processes an uploaded PDF or image file into structured clinical metrics."""
        return self.doc_processor.process_file(file_bytes=file_bytes, filename=filename)

    def parse_medical_text(self, text: str) -> DocumentOCRResult:
        """Extracts structured vitals and lab metrics from raw clinical text."""
        return self.doc_processor.parse_clinical_text(text=text)


# Singleton instance for quick module-level imports
default_service = IntelligenceService()

def screen_patient_case(case_data: Union[PatientCaseInput, Dict[str, Any]]) -> ScreeningResult:
    return default_service.screen_patient_case(case_data)

def check_vitals_and_labs(
    vitals: Optional[Union[VitalsInput, Dict[str, Any]]] = None,
    labs: Optional[List[Union[LabItem, Dict[str, Any]]]] = None
) -> Tuple[List[AbnormalityItem], int]:
    return default_service.check_vitals_and_labs(vitals=vitals, labs=labs)

def process_medical_document(file_bytes: bytes, filename: str = "document.pdf") -> DocumentOCRResult:
    return default_service.process_medical_document(file_bytes=file_bytes, filename=filename)

def parse_medical_text(text: str) -> DocumentOCRResult:
    return default_service.parse_medical_text(text=text)
