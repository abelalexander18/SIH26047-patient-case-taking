"""
SIH26047 — Patient Case-Taking Software (Ministry of Ayush / AIIA)
Red-Flag Screening Engine
"""

from typing import List, Dict, Any, Set, Tuple
from member6_intelligence.schemas import (
    PatientCaseInput,
    RedFlagItem,
    TriageSeverity,
    VitalsInput,
    SymptomInput
)
from member6_intelligence.rules import get_red_flag_definitions


class RedFlagScreeningEngine:
    """
    Deterministic clinical decision-support engine that screens patient history,
    reported symptoms, chief complaints, and vitals for urgent red flags.
    Generates structured flags, triage severity, and clear clinical rationale.
    """

    def __init__(self):
        self.flag_rules = get_red_flag_definitions()

    def screen(self, case: PatientCaseInput) -> Tuple[List[RedFlagItem], TriageSeverity, bool, str]:
        """
        Screens the patient case and returns:
        (red_flags, overall_triage, is_emergency, summary_headline)
        """
        # Aggregate and normalize all clinical text
        corpus_texts = self._extract_case_text(case)
        normalized_corpus = " ".join(corpus_texts).lower()

        triggered_flags: List[RedFlagItem] = []

        for rule in self.flag_rules:
            matched_cues: List[str] = []

            # 1. Check primary keywords
            matched_keywords = [
                kw for kw in rule.get("keywords", [])
                if kw.lower() in normalized_corpus
            ]

            # 2. Check secondary keywords
            matched_secondaries = [
                kw for kw in rule.get("secondary_keywords", [])
                if kw.lower() in normalized_corpus
            ]

            # 3. Check vital sign threshold triggers
            vital_cues = self._check_vital_triggers(rule.get("vital_triggers", {}), case.vitals)

            # Determine trigger condition:
            has_primary = len(matched_keywords) > 0
            has_vital_trigger = len(vital_cues) > 0

            rule_triggered = False

            if rule["flag_id"] == "RF-CARD-001":
                # ACS: primary keyword (chest pain) + secondary keyword OR vital trigger
                if has_primary:
                    matched_cues.extend(matched_keywords)
                    matched_cues.extend(matched_secondaries)
                    matched_cues.extend(vital_cues)
                    rule_triggered = True

            elif rule["flag_id"] == "RF-CARD-002":
                # Hypertensive crisis: BP criteria + optional symptom
                bp_crit = self._check_hypertensive_crisis_vitals(case.vitals)
                if bp_crit:
                    matched_cues.append(bp_crit)
                    matched_cues.extend(matched_keywords)
                    rule_triggered = True

            elif rule["flag_id"] == "RF-RESP-001":
                # Hypoxemia / respiratory distress
                if has_vital_trigger or has_primary:
                    matched_cues.extend(vital_cues)
                    matched_cues.extend(matched_keywords)
                    rule_triggered = True

            elif rule["flag_id"] == "RF-INF-001":
                # Sepsis: text signs OR multiple vital triggers
                if (has_primary and len(vital_cues) >= 1) or len(vital_cues) >= 2 or has_primary:
                    matched_cues.extend(matched_keywords)
                    matched_cues.extend(vital_cues)
                    rule_triggered = True

            elif rule["flag_id"] == "RF-METAB-001":
                # DKA / Glycemic crisis
                if has_vital_trigger or (has_primary and len(matched_secondaries) > 0):
                    matched_cues.extend(vital_cues)
                    matched_cues.extend(matched_keywords)
                    matched_cues.extend(matched_secondaries)
                    rule_triggered = True

            else:
                # Default rule matching: primary keywords or vital triggers
                if has_primary or has_vital_trigger:
                    matched_cues.extend(matched_keywords)
                    matched_cues.extend(matched_secondaries)
                    matched_cues.extend(vital_cues)
                    rule_triggered = True

            if rule_triggered and matched_cues:
                # Deduplicate cues while preserving order
                seen: Set[str] = set()
                unique_cues = [c for c in matched_cues if not (c in seen or seen.add(c))]

                severity_enum = TriageSeverity(rule.get("severity", "WARNING"))
                triggered_flags.append(
                    RedFlagItem(
                        flag_id=rule["flag_id"],
                        category=rule["category"],
                        severity=severity_enum,
                        title=rule["title"],
                        matched_cues=unique_cues,
                        clinical_rationale=rule["clinical_rationale"],
                        recommended_action=rule["recommended_action"]
                    )
                )

        # Determine overall triage priority
        overall_triage, is_emergency, headline = self._summarize_triage(triggered_flags)

        return triggered_flags, overall_triage, is_emergency, headline

    def _extract_case_text(self, case: PatientCaseInput) -> List[str]:
        """Collects all unstructured and structured text fields into a single list."""
        corpus: List[str] = []

        corpus.extend(case.chief_complaints)
        corpus.extend(case.medical_history)
        corpus.extend(case.current_medications)

        for sym in case.symptoms:
            if isinstance(sym, SymptomInput):
                corpus.append(sym.name)
                if sym.details:
                    corpus.append(sym.details)
            elif isinstance(sym, str):
                corpus.append(sym)

        if case.ayush_context:
            for k, v in case.ayush_context.items():
                corpus.append(f"{k}: {v}")

        return corpus

    def _check_vital_triggers(
        self,
        triggers: Dict[str, Any],
        vitals: VitalsInput | None
    ) -> List[str]:
        """Evaluates numerical vital thresholds specified in red flag definitions."""
        cues: List[str] = []
        if not vitals or not triggers:
            return cues

        if "systolic_bp_min" in triggers and vitals.systolic_bp is not None:
            if vitals.systolic_bp >= triggers["systolic_bp_min"]:
                cues.append(f"Systolic BP marked elevation ({vitals.systolic_bp} mmHg >= {triggers['systolic_bp_min']})")

        if "systolic_bp_max" in triggers and vitals.systolic_bp is not None:
            if vitals.systolic_bp <= triggers["systolic_bp_max"]:
                cues.append(f"Systolic BP marked hypotension ({vitals.systolic_bp} mmHg <= {triggers['systolic_bp_max']})")

        if "heart_rate_max" in triggers and vitals.heart_rate is not None:
            if vitals.heart_rate >= triggers["heart_rate_max"]:
                cues.append(f"Marked tachycardia (Heart rate {vitals.heart_rate} bpm >= {triggers['heart_rate_max']})")

        if "heart_rate_min" in triggers and vitals.heart_rate is not None:
            if vitals.heart_rate >= triggers["heart_rate_min"]:
                cues.append(f"Elevated heart rate ({vitals.heart_rate} bpm >= {triggers['heart_rate_min']})")

        if "spo2_max" in triggers and vitals.spo2 is not None:
            if vitals.spo2 <= triggers["spo2_max"]:
                cues.append(f"Critical hypoxemia (SpO2 {vitals.spo2}% <= {triggers['spo2_max']}%)")

        if "respiratory_rate_min" in triggers and vitals.respiratory_rate is not None:
            if vitals.respiratory_rate >= triggers["respiratory_rate_min"]:
                cues.append(f"Tachypnea (Resp rate {vitals.respiratory_rate}/min >= {triggers['respiratory_rate_min']})")

        if "temperature_f_min" in triggers and vitals.temperature_f is not None:
            if vitals.temperature_f >= triggers["temperature_f_min"]:
                cues.append(f"High pyrexia (Temp {vitals.temperature_f}°F >= {triggers['temperature_f_min']}°F)")

        if "blood_glucose_mg_dl_min" in triggers and vitals.blood_glucose_mg_dl is not None:
            if vitals.blood_glucose_mg_dl >= triggers["blood_glucose_mg_dl_min"]:
                cues.append(f"Critical hyperglycemia ({vitals.blood_glucose_mg_dl} mg/dL >= {triggers['blood_glucose_mg_dl_min']})")

        if "blood_glucose_mg_dl_max" in triggers and vitals.blood_glucose_mg_dl is not None:
            if vitals.blood_glucose_mg_dl <= triggers["blood_glucose_mg_dl_max"]:
                cues.append(f"Critical hypoglycemia ({vitals.blood_glucose_mg_dl} mg/dL <= {triggers['blood_glucose_mg_dl_max']})")

        return cues

    def _check_hypertensive_crisis_vitals(self, vitals: VitalsInput | None) -> str | None:
        if not vitals:
            return None
        sys_crit = vitals.systolic_bp is not None and vitals.systolic_bp >= 180
        dia_crit = vitals.diastolic_bp is not None and vitals.diastolic_bp >= 120
        if sys_crit or dia_crit:
            return f"Blood pressure in crisis range: {vitals.systolic_bp or '--'}/{vitals.diastolic_bp or '--'} mmHg"
        return None

    def _summarize_triage(
        self,
        flags: List[RedFlagItem]
    ) -> Tuple[TriageSeverity, bool, str]:
        """Determines highest priority severity and generates display banner text."""
        if not flags:
            return (
                TriageSeverity.NORMAL,
                False,
                "ROUTINE TRIAGE: No active clinical red flags detected. Proceed with standard outpatient evaluation."
            )

        severities = {f.severity for f in flags}

        if TriageSeverity.CRITICAL in severities:
            count = sum(1 for f in flags if f.severity == TriageSeverity.CRITICAL)
            return (
                TriageSeverity.CRITICAL,
                True,
                f"CRITICAL RED ALERT: {count} life-threatening emergency flag(s) identified. Immediate physician triage mandatory."
            )

        if TriageSeverity.URGENT in severities:
            count = sum(1 for f in flags if f.severity == TriageSeverity.URGENT)
            return (
                TriageSeverity.URGENT,
                True,
                f"URGENT ATTENTION: {count} clinical warning(s) detected. Prompt medical assessment recommended."
            )

        return (
            TriageSeverity.WARNING,
            False,
            f"CLINICAL ADVISORY: {len(flags)} borderline finding(s) noted for physician review."
        )
