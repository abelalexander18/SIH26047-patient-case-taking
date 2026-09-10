"""
SIH26047 — Patient Case-Taking Software (Ministry of Ayush / AIIA)
Member 6: Deterministic Rule-Based Red Flag Screening Engine

This engine evaluates ClinicalHistory inputs against explicit screening rules.
It executes purely deterministic matching against structured facts, discrete
clinical concepts, and pertinent negatives.
No LLM is used to make final safety decisions.
"""

import re
from typing import Dict, Any, List, Optional, Tuple, Union

from red_flag_engine.schemas import ClinicalHistory, RedFlagResult
from red_flag_engine.rules import get_rules, ScreeningRule
from red_flag_engine.normalizer import normalize_case_input

SEVERITY_WEIGHTS = {
    "critical": 3,
    "urgent": 2,
    "warning": 1,
    "none": 0
}

DISCLAIMER_TEXT = (
    "Clinical decision-support aid for SIH26047. "
    "Does not constitute a medical diagnosis or replace clinical judgment."
)


class RedFlagEngine:
    """
    Deterministic rule-based clinical safety screening engine.
    Integrates with the Clinical Concept Normalization Layer.
    """

    def __init__(self, rules: Optional[List[ScreeningRule]] = None):
        # Rules catalog is decoupled and injectable
        self.rules: List[ScreeningRule] = rules if rules is not None else get_rules()

    def screen(self, history: Union[ClinicalHistory, Dict[str, Any]]) -> Dict[str, Any]:
        """
        Consumes ClinicalHistory JSON and returns the agreed RedFlagResult JSON.
        If multiple rules trigger, returns the primary (highest severity) result,
        referencing any concurrent red flags in evidence.
        """
        all_results = self.screen_all(history)
        if not all_results:
            return self._build_negative_result()

        # Sort by severity descending: critical > urgent > warning, tie-break by evidence count (specificity)
        all_results.sort(
            key=lambda r: (
                SEVERITY_WEIGHTS.get(r.get("severity", "none"), 0),
                len(r.get("evidence", []))
            ),
            reverse=True
        )

        primary = all_results[0]

        # If there are additional concurrent red flags, append cross-references to evidence
        if len(all_results) > 1:
            concurrent_notes = [
                f"Concurrent alert: {r['rule_id']} - {r['category'].title()} ({r['severity'].upper()})"
                for r in all_results[1:]
            ]
            primary_evidence = list(primary.get("evidence", [])) + concurrent_notes
            primary = dict(primary)
            primary["evidence"] = primary_evidence

        return primary

    def screen_all(self, history: Union[ClinicalHistory, Dict[str, Any]]) -> List[Dict[str, Any]]:
        """
        Evaluates history against all rules and returns a list of all triggered RedFlagResult dicts.
        """
        safe_data = self._normalize_input(history)
        corpus_items = self._extract_corpus(safe_data)
        vitals = safe_data.get("vitals") or {}

        triggered: List[Dict[str, Any]] = []

        for rule in self.rules:
            is_match, evidence_list = self._evaluate_rule(rule, corpus_items, vitals, safe_data)
            if is_match:
                triggered.append({
                    "detected": True,
                    "severity": rule.severity,
                    "category": rule.category,
                    "rule_id": rule.rule_id,
                    "message": rule.message,
                    "evidence": evidence_list,
                    "recommendation": rule.recommendation,
                    "disclaimer": DISCLAIMER_TEXT
                })

        return triggered

    def _normalize_input(self, history: Union[ClinicalHistory, Dict[str, Any]]) -> Dict[str, Any]:
        """
        Safely normalizes input into a plain dictionary with concept normalization,
        guarding against nulls and arbitrary input structures.
        """
        if isinstance(history, ClinicalHistory):
            # If discrete flags are not populated, run normalizer to map any free-text expressions
            if (
                history.loss_of_consciousness is None
                and history.breathing_difficulty is None
                and history.bleeding is None
                and (history.chief_complaints or history.symptoms)
            ):
                norm_hist = normalize_case_input(history)
                return norm_hist.model_dump()
            return history.model_dump()

        if isinstance(history, dict):
            # Run normalization to derive concepts if discrete flags are absent
            if (
                "loss_of_consciousness" not in history
                and "breathing_difficulty" not in history
                and ("chief_complaints" in history or "symptoms" in history)
            ):
                norm_hist = normalize_case_input(history)
                return norm_hist.model_dump()
            return dict(history)

        return {}

    def _extract_corpus(self, data: Dict[str, Any]) -> List[Tuple[str, str]]:
        """
        Extracts all textual statements paired with their clinical source.
        Returns a list of tuples: (normalized_text, source_description).
        """
        corpus: List[Tuple[str, str]] = []

        # 1. Chief Complaints
        raw_complaints = data.get("chief_complaints")
        if isinstance(raw_complaints, list):
            for c in raw_complaints:
                if c is not None and isinstance(c, (str, int, float)):
                    text = str(c).strip()
                    if text:
                        corpus.append((text.lower(), f"Chief complaint: '{text}'"))
        elif isinstance(raw_complaints, str) and raw_complaints.strip():
            corpus.append((raw_complaints.strip().lower(), f"Chief complaint: '{raw_complaints.strip()}'"))

        # 2. Symptoms (can be SymptomDetail dicts, strings, or objects)
        raw_symptoms = data.get("symptoms")
        if isinstance(raw_symptoms, list):
            for s in raw_symptoms:
                if s is None:
                    continue
                if isinstance(s, dict):
                    name = str(s.get("name") or "").strip()
                    severity = str(s.get("severity") or "").strip()
                    details = str(s.get("details") or s.get("raw_expression") or "").strip()
                    parts = [name]
                    if severity and severity.lower() not in ("none", "null"):
                        parts.append(severity)
                    if details:
                        parts.append(details)
                    full_txt = " ".join(filter(None, parts))
                    if full_txt:
                        desc = f"Reported symptom: '{name}' (severity: {severity or 'unspecified'})"
                        corpus.append((full_txt.lower(), desc))
                elif isinstance(s, (str, int, float)):
                    text = str(s).strip()
                    if text:
                        corpus.append((text.lower(), f"Reported symptom: '{text}'"))

        # 3. Medical History
        raw_history = data.get("medical_history")
        if isinstance(raw_history, list):
            for h in raw_history:
                if h is not None and isinstance(h, (str, int, float)):
                    text = str(h).strip()
                    if text:
                        corpus.append((text.lower(), f"Medical history note: '{text}'"))

        # 4. Current Medications
        raw_meds = data.get("current_medications") or data.get("medications")
        if isinstance(raw_meds, list):
            for m in raw_meds:
                if m is not None and isinstance(m, (str, int, float)):
                    text = str(m).strip()
                    if text:
                        corpus.append((text.lower(), f"Medication note: '{text}'"))

        return corpus

    def _evaluate_rule(
        self,
        rule: ScreeningRule,
        corpus_items: List[Tuple[str, str]],
        vitals: Any,
        data: Dict[str, Any]
    ) -> Tuple[bool, List[str]]:
        """
        Evaluates whether all required concept groups of a rule are satisfied.
        Incorporates normalized discrete flags, pertinent negatives, and textual evidence.
        Returns (is_match, evidence_list).
        """
        # =====================================================================
        # PERTINENT NEGATIVE SUPPRESSION
        # =====================================================================
        relevant_negatives = [n.lower() for n in data.get("relevant_negative_symptoms", [])]

        if rule.rule_id in ("RF_CARD_01", "RF_CARD_02") and "chest pain" in relevant_negatives:
            return False, []
        if rule.rule_id in ("RF_NEURO_01", "RF_NEURO_02", "RF_GI_03"):
            if "loss of consciousness" in relevant_negatives or data.get("loss_of_consciousness") is False:
                return False, []
        if rule.rule_id in ("RF_CARD_02", "RF_RESP_01", "RF_ALLERG_01"):
            if "breathing difficulty" in relevant_negatives or data.get("breathing_difficulty") is False:
                return False, []
        if rule.rule_id == "RF_INF_01" and "fever" in relevant_negatives:
            return False, []
        if rule.rule_id in ("RF_NEURO_02", "RF_NEURO_03") and "headache" in relevant_negatives:
            return False, []

        matched_evidence: List[str] = []
        full_corpus_text = " ".join(text for text, _ in corpus_items)

        # Discrete concept flags
        loc_flag = data.get("loss_of_consciousness")
        dyspnea_flag = data.get("breathing_difficulty")
        confusion_flag = data.get("confusion")
        bleeding_data = data.get("bleeding")
        symptoms_list = data.get("symptoms") or []

        # =====================================================================
        # CONCEPT GROUP EVALUATION
        # =====================================================================
        for concept_group in rule.required_concept_groups:
            group_matched = False
            group_match_desc: Optional[str] = None

            # 1. Check normalized discrete concept flags
            # Consciousness concept group
            if any(p in ("loss of consciousness", "syncope", "fainted", "unresponsive") for p in concept_group):
                if loc_flag is True:
                    group_matched = True
                    group_match_desc = "Normalized clinical finding: loss_of_consciousness = True (fainted / syncope episode)"

            # Breathing difficulty concept group
            if not group_matched and any(p in ("breathing difficulty", "dyspnea", "shortness of breath") for p in concept_group):
                if dyspnea_flag is True:
                    group_matched = True
                    group_match_desc = "Normalized clinical finding: breathing_difficulty = True (dyspnea / shortness of breath)"

            # Confusion concept group
            if not group_matched and any(p in ("confusion", "confused", "altered mental state") for p in concept_group):
                if confusion_flag is True:
                    group_matched = True
                    group_match_desc = "Normalized clinical finding: confusion = True (altered mental state / disorientation)"

            # Severe headache concept group
            if not group_matched and any("severe headache" in p for p in concept_group):
                for s in symptoms_list:
                    if isinstance(s, dict) and s.get("name") == "headache" and str(s.get("severity")).lower() == "severe":
                        group_matched = True
                        group_match_desc = "Normalized clinical finding: severe headache (headache with severe pain intensity)"
                        break

            # Severe abdominal pain concept group
            if not group_matched and any(p in ("severe", "intense") for p in concept_group) and rule.rule_id == "RF_GI_03":
                for s in symptoms_list:
                    if isinstance(s, dict) and s.get("name") == "abdominal pain" and str(s.get("severity")).lower() == "severe":
                        group_matched = True
                        group_match_desc = "Normalized clinical finding: severe abdominal pain (abdominal pain with severe intensity)"
                        break

            # Blood in vomit concept group
            if not group_matched and any(p in ("blood in vomit", "hematemesis") for p in concept_group):
                if isinstance(bleeding_data, dict) and bleeding_data.get("present") and bleeding_data.get("source") == "vomit":
                    group_matched = True
                    group_match_desc = "Normalized clinical finding: active hematemesis (blood in vomit)"

            # Blood in stool concept group
            if not group_matched and any(p in ("blood in stool", "melena") for p in concept_group):
                if isinstance(bleeding_data, dict) and bleeding_data.get("present") and bleeding_data.get("source") in ("stool", "rectal", "melena"):
                    group_matched = True
                    group_match_desc = "Normalized clinical finding: gastrointestinal bleeding in stool"

            # 2. Temperature vital trigger for high fever
            if not group_matched and "high fever" in concept_group and isinstance(vitals, dict):
                temp_val = vitals.get("temperature")
                if isinstance(temp_val, (int, float)) and temp_val >= 102.0:
                    group_matched = True
                    group_match_desc = f"Observed vital: Temperature {temp_val}°F (threshold >= 102.0°F)"

            # 3. SpO2 vital trigger for severe respiratory compromise
            if not group_matched and "severe" in concept_group and rule.rule_id == "RF_RESP_01" and isinstance(vitals, dict):
                spo2_val = vitals.get("spo2")
                if isinstance(spo2_val, (int, float)) and spo2_val <= 88.0:
                    group_matched = True
                    group_match_desc = f"Observed vital: SpO2 {spo2_val}% (threshold <= 88%)"

            # 4. Fallback to textual corpus regex matching
            if not group_matched:
                for phrase in concept_group:
                    phrase_clean = phrase.strip().lower()
                    pattern = r"\b" + re.escape(phrase_clean) + r"\b"
                    if re.search(pattern, full_corpus_text):
                        group_matched = True
                        for text, src_desc in corpus_items:
                            if re.search(pattern, text):
                                group_match_desc = f"{src_desc} (matched cue: '{phrase_clean}')"
                                break
                        break

            if not group_matched:
                # If any required concept group is missing, the rule does NOT trigger
                return False, []

            if group_match_desc and group_match_desc not in matched_evidence:
                matched_evidence.append(group_match_desc)

        # =====================================================================
        # VITAL TRIGGERS EVALUATION
        # =====================================================================
        if rule.vital_triggers and isinstance(vitals, dict):
            if "spo2_max" in rule.vital_triggers:
                spo2 = vitals.get("spo2")
                if isinstance(spo2, (int, float)) and spo2 <= rule.vital_triggers["spo2_max"]:
                    vital_note = f"Observed vital: SpO2 {spo2}% (threshold <= {rule.vital_triggers['spo2_max']}%)"
                    if vital_note not in matched_evidence:
                        matched_evidence.append(vital_note)

            if "respiratory_rate_min" in rule.vital_triggers:
                rr = vitals.get("respiratory_rate")
                if isinstance(rr, (int, float)) and rr >= rule.vital_triggers["respiratory_rate_min"]:
                    vital_note = f"Observed vital: Respiratory rate {rr}/min (threshold >= {rule.vital_triggers['respiratory_rate_min']}/min)"
                    if vital_note not in matched_evidence:
                        matched_evidence.append(vital_note)

            if "temperature_min" in rule.vital_triggers:
                temp = vitals.get("temperature")
                if isinstance(temp, (int, float)) and temp >= rule.vital_triggers["temperature_min"]:
                    vital_note = f"Observed vital: Temperature {temp}°F (threshold >= {rule.vital_triggers['temperature_min']}°F)"
                    if vital_note not in matched_evidence:
                        matched_evidence.append(vital_note)

        return True, matched_evidence

    def _build_negative_result(self) -> Dict[str, Any]:
        """Constructs safe default negative response when no red flags trigger."""
        return {
            "detected": False,
            "severity": "none",
            "category": "none",
            "rule_id": "NONE",
            "message": "No predefined high-risk clinical red-flag patterns detected in current history.",
            "evidence": [],
            "recommendation": "Proceed with standard clinical case-taking and comprehensive physician evaluation.",
            "disclaimer": DISCLAIMER_TEXT
        }


_DEFAULT_ENGINE = RedFlagEngine()


def screen_red_flags(history: Union[ClinicalHistory, Dict[str, Any]]) -> Dict[str, Any]:
    """Primary module helper to screen a clinical history for red flags."""
    return _DEFAULT_ENGINE.screen(history)


def screen_all_red_flags(history: Union[ClinicalHistory, Dict[str, Any]]) -> List[Dict[str, Any]]:
    """Helper to return all triggered red flags."""
    return _DEFAULT_ENGINE.screen_all(history)

