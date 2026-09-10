"""
SIH26047 — Patient Case-Taking Software (Ministry of Ayush / AIIA)
Medical Value Abnormality Detector
"""

from typing import List, Tuple, Optional, Dict, Any
from member6_intelligence.schemas import (
    VitalsInput,
    LabItem,
    AbnormalityItem,
    ValueStatus
)
from member6_intelligence.rules import get_reference_ranges


class MedicalAbnormalityDetector:
    """
    Screens quantitative physiological vitals and laboratory biomarkers
    against clinical reference standards (AHA, WHO, ICMR).
    Classifies values into CRITICAL_LOW, LOW, NORMAL, HIGH, CRITICAL_HIGH.
    """

    def __init__(self):
        self.rules = get_reference_ranges()
        self.vitals_ref = self.rules.get("vitals", {})
        self.labs_ref = self.rules.get("labs", {})

    def evaluate_vitals(self, vitals: Optional[VitalsInput]) -> Tuple[List[AbnormalityItem], int]:
        """
        Evaluates physiological vitals and returns (abnormalities, normal_count).
        """
        abnormalities: List[AbnormalityItem] = []
        normal_count = 0

        if not vitals:
            return abnormalities, normal_count

        # Map VitalsInput fields to reference rule keys
        vital_mapping = {
            "systolic_bp": vitals.systolic_bp,
            "diastolic_bp": vitals.diastolic_bp,
            "heart_rate": vitals.heart_rate,
            "respiratory_rate": vitals.respiratory_rate,
            "spo2": vitals.spo2,
            "temperature_f": vitals.temperature_f,
        }

        # Glucose handling based on type
        if vitals.blood_glucose_mg_dl is not None:
            glucose_type = (vitals.blood_glucose_type or "random").lower()
            if "fast" in glucose_type:
                vital_mapping["blood_glucose_fasting"] = vitals.blood_glucose_mg_dl
            else:
                vital_mapping["blood_glucose_random"] = vitals.blood_glucose_mg_dl

        for key, val in vital_mapping.items():
            if val is None:
                continue

            ref = self.vitals_ref.get(key)
            if not ref:
                continue

            item = self._check_single_metric(
                metric_key=key,
                val=float(val),
                ref=ref
            )
            if item:
                abnormalities.append(item)
            else:
                normal_count += 1

        return abnormalities, normal_count

    def evaluate_labs(self, lab_results: List[LabItem]) -> Tuple[List[AbnormalityItem], int]:
        """
        Evaluates laboratory biomarker list against established reference limits.
        """
        abnormalities: List[AbnormalityItem] = []
        normal_count = 0

        if not lab_results:
            return abnormalities, normal_count

        for lab in lab_results:
            matched_ref_key, matched_ref = self._find_lab_ref(lab.name)
            if not matched_ref:
                continue

            unit = lab.unit or matched_ref.get("unit", "")
            item = self._check_single_metric(
                metric_key=matched_ref_key,
                val=lab.value,
                ref=matched_ref,
                custom_unit=unit
            )
            if item:
                abnormalities.append(item)
            else:
                normal_count += 1

        return abnormalities, normal_count

    def evaluate_all(
        self,
        vitals: Optional[VitalsInput],
        labs: List[LabItem]
    ) -> Tuple[List[AbnormalityItem], int]:
        """
        Convenience method to evaluate both vitals and labs.
        """
        vital_abnormals, vital_normals = self.evaluate_vitals(vitals)
        lab_abnormals, lab_normals = self.evaluate_labs(labs)

        return (vital_abnormals + lab_abnormals), (vital_normals + lab_normals)

    def _check_single_metric(
        self,
        metric_key: str,
        val: float,
        ref: Dict[str, Any],
        custom_unit: Optional[str] = None
    ) -> Optional[AbnormalityItem]:
        """
        Checks a single numeric value against critical and threshold ranges.
        Returns AbnormalityItem if abnormal, or None if within normal range.
        """
        crit_low = ref.get("critical_low")
        low_thresh = ref.get("low_threshold")
        high_thresh = ref.get("high_threshold")
        crit_high = ref.get("critical_high")
        norm_min = ref.get("normal_min")
        norm_max = ref.get("normal_max")
        unit = custom_unit or ref.get("unit", "")
        display_name = ref.get("display_name", metric_key.replace("_", " ").title())
        implications = ref.get("implications", {})

        status: Optional[ValueStatus] = None
        is_critical = False

        if crit_low is not None and val < crit_low:
            status = ValueStatus.CRITICAL_LOW
            is_critical = True
        elif low_thresh is not None and val < low_thresh:
            status = ValueStatus.LOW
        elif crit_high is not None and val >= crit_high:
            status = ValueStatus.CRITICAL_HIGH
            is_critical = True
        elif high_thresh is not None and val > high_thresh:
            status = ValueStatus.HIGH

        if status is None:
            return None

        # Build normal range string
        if norm_min is not None and norm_max is not None:
            norm_range_str = f"{norm_min} - {norm_max} {unit}"
        elif norm_min is not None:
            norm_range_str = f"> {norm_min} {unit}"
        elif norm_max is not None:
            norm_range_str = f"< {norm_max} {unit}"
        else:
            norm_range_str = f"Standard {unit}"

        clinical_imp = implications.get(
            status.value,
            f"Observed {val} {unit} outside physiological target range ({norm_range_str})."
        )

        return AbnormalityItem(
            metric=metric_key,
            display_name=display_name,
            observed_value=val,
            unit=unit,
            status=status,
            normal_range=norm_range_str,
            clinical_implication=clinical_imp,
            is_critical=is_critical
        )

    def _find_lab_ref(self, raw_name: str) -> Tuple[Optional[str], Optional[Dict[str, Any]]]:
        """
        Normalizes lab name and matches against configured aliases.
        """
        normalized = raw_name.strip().lower()

        for key, ref in self.labs_ref.items():
            if normalized == key.lower():
                return key, ref
            aliases = [a.lower() for a in ref.get("aliases", [])]
            if normalized in aliases:
                return key, ref
            # Substring match for compound names e.g. "blood hemoglobin level"
            for alias in aliases:
                if alias in normalized:
                    return key, ref

        return None, None
