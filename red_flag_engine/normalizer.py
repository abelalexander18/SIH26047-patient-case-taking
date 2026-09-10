"""
SIH26047 — Patient Case-Taking Software (Ministry of Ayush / AIIA)
Member 6: Clinical Information Normalization Layer

Converts natural-language patient expressions, colloquialisms, and idioms
into a standardized, structured ClinicalHistory representation before passing
to the deterministic Red Flag Engine.

Key Architectural Guarantees:
1. Concept Normalization: Maps diverse lay idioms to canonical clinical concepts.
2. Severity & Onset Quantifiers: Normalizes descriptors without rigid exact-phrase matches.
3. Pertinent Negation Parsing: Routes explicitly denied symptoms to relevant_negative_symptoms
   and marks discrete flags as False, avoiding false-positive alerts.
4. Strict Null Semantics: Unmentioned clinical dimensions remain null/None. Never infer or hallucinate.
"""

import re
from typing import Dict, Any, List, Optional, Tuple, Union

from red_flag_engine.schemas import (
    ClinicalHistory,
    SymptomDetail,
    BleedingDetail,
    VitalsData,
    MedicalLabValue
)

# =====================================================================
# CONCEPT LEXICONS & COLLOQUIAL PATTERNS
# =====================================================================

CONCEPT_LEXICONS = {
    "headache": [
        r"\bheadache\b",
        r"\bheadaches\b",
        r"\bhead is killing me\b",
        r"\bhead hurts\b",
        r"\bhead pain\b",
        r"\bpain in (?:my )?head\b",
        r"\bsplitting headache\b",
        r"\bpounding head\b",
        r"\bmigraine\b",
        r"\bthunderclap headache\b",
        r"\bthrobbing head\b"
    ],
    "chest_pain": [
        r"\bchest pain\b",
        r"\bchest pressure\b",
        r"\bchest tightness\b",
        r"\bchest heaviness\b",
        r"\bchest discomfort\b",
        r"\belephant (?:sitting )?on (?:my )?chest\b",
        r"\bpain in (?:my )?chest\b",
        r"\bcardiac pain\b",
        r"\bretrosternal pain\b",
        r"\bsqueezing in (?:my )?chest\b"
    ],
    "breathing_difficulty": [
        r"\bbreathing difficulty\b",
        r"\bdifficulty breathing\b",
        r"\bshortness of breath\b",
        r"\bbreathless(?:ness)?\b",
        r"\bcan\'?t breathe\b",
        r"\bcan\'?t catch (?:my )?breath\b",
        r"\btrouble breathing\b",
        r"\bgasping(?: for air)?\b",
        r"\bwinded\b",
        r"\bdyspnea\b",
        r"\bair hunger\b",
        r"\bchoking sensation\b",
        r"\bwheezing\b",
        r"\bout of breath\b"
    ],
    "loss_of_consciousness": [
        r"\bfaint(?:ed|ing)?\b",
        r"\bpass(?:ed)? out\b",
        r"\bpassing out\b",
        r"\bblack(?:ed)? out\b",
        r"\bblacking out\b",
        r"\blost consciousness\b",
        r"\blose consciousness\b",
        r"\bloss of consciousness\b",
        r"\bfell unconscious\b",
        r"\bbecame unconscious\b",
        r"\bsyncope\b",
        r"\bcollapsed and (?:was )?unaware\b",
        r"\bsaw darkness and fell\b",
        r"\bunresponsive\b"
    ],
    "abdominal_pain": [
        r"\babdominal pain\b",
        r"\bstomach pain\b",
        r"\bstomach cramp(?:s)?\b",
        r"\btummy cramp(?:s)?\b",
        r"\bbelly pain\b",
        r"\btummy pain\b",
        r"\bgut pain\b",
        r"\bstomach ache\b",
        r"\bbelly ache\b",
        r"\bpain in (?:my )?(?:stomach|belly|abdomen)\b"
    ],
    "fever": [
        r"\bhigh fever\b",
        r"\bfever\b",
        r"\bburning up\b",
        r"\bchills and fever\b",
        r"\bfeverish\b",
        r"\belevated temp(?:erature)?\b",
        r"\bpyrexia\b"
    ],
    "confusion": [
        r"\bconfusion\b",
        r"\bconfused\b",
        r"\bdisoriented\b",
        r"\bdisorientation\b",
        r"\bbrain fog\b",
        r"\bfeeling foggy\b",
        r"\bnot making sense\b",
        r"\bdelirious\b",
        r"\bdelirium\b",
        r"\baltered mental state\b",
        r"\bdrowsy and disoriented\b"
    ],
    "allergic_reaction": [
        r"\bswelling of lips\b",
        r"\blip swelling\b",
        r"\bswelling of tongue\b",
        r"\btongue swelling\b",
        r"\bthroat closing\b",
        r"\bthroat tightness\b",
        r"\bthroat swelling\b",
        r"\bhives with swelling\b",
        r"\banaphylaxis\b",
        r"\bsevere allergic reaction\b",
        r"\bangioedema\b",
        r"\bstridor\b"
    ],
    "vomiting": [
        r"\bvomit(?:ing|ed)?\b",
        r"\bthrowing up\b",
        r"\bthrew up\b",
        r"\bpuking\b",
        r"\bemesis\b"
    ],
    "blood_in_vomit": [
        r"\bthrowing up (?:dark )?blood\b",
        r"\bvomiting (?:dark )?blood\b",
        r"\bvomited blood\b",
        r"\bblood in (?:my )?vomit\b",
        r"\bhematemesis\b",
        r"\bcoffee ground emesis\b",
        r"\bcoffee[- ]ground(?: looking)? blood\b",
        r"\bthrowing up (?:dark )?coffee[- ]ground\b"
    ],
    "blood_in_stool": [
        r"\bblood in (?:my )?stool(?:s)?\b",
        r"\bbloody stool(?:s)?\b",
        r"\brectal bleeding\b",
        r"\bbleeding from (?:my )?rectum\b",
        r"\bblack stool(?:s)?\b",
        r"\bmelena\b",
        r"\bblack tarry stool(?:s)?\b",
        r"\bpassing blood with stool\b"
    ]
}

# Focal neurological symptoms
NEURO_SYMPTOMS_MAP = {
    "facial_droop": [r"\bfacial droop\b", r"\bface drooping\b", r"\bone side of (?:my )?face is drooping\b"],
    "slurred_speech": [r"\bslurred speech\b", r"\bslurring words\b", r"\bdifficulty speaking\b", r"\bcan\'?t speak properly\b"],
    "one_sided_weakness": [r"\bone[- ]sided weakness\b", r"\bweakness on one side\b", r"\barm weakness\b", r"\bleg weakness\b", r"\bhemiparesis\b"],
    "numbness": [r"\bnumbness in (?:my )?(?:arm|face|leg|hand)\b", r"\bloss of sensation\b"],
    "vision_changes": [r"\bvision loss\b", r"\bdouble vision\b", r"\bblurry vision\b", r"\bblind spot\b", r"\bsudden loss of sight\b"],
    "neck_stiffness": [r"\bneck stiffness\b", r"\bstiff neck\b", r"\bunable to bend (?:my )?neck\b"]
}

# Fluid retention phrases
FLUIDS_INABILITY_PATTERNS = [
    r"\b(?:can\'?t|cannot|unable to)\s+keep\s+(?:any\s+)?(?:water|fluids?|liquids?|anything)\s+down\b",
    r"\bcan\'?t even drink water\b",
    r"\bcannot even drink water\b",
    r"\b(?:vomit(?:ing)?|throw(?:ing)?\s+up)\s+(?:everything|all|any\s+(?:water|fluids?|liquids?)|water)\b",
    r"\bthrow(?:ing)?\s+up\s+(?:immediately|after drinking)\b",
    r"\bunable to retain (?:water|fluids?)\b"
]

FLUIDS_ABILITY_PATTERNS = [
    r"\b(?:can|able to)\s+drink\s+(?:water|fluids?|liquids?)\b",
    r"\bkeeping\s+(?:fluids?|water)\s+down\b",
    r"\bdrinking water fine\b",
    r"\bable to keep (?:fluids?|water)\s+down\b"
]

# Severity quantifiers
SEVERITY_PATTERNS = {
    "severe": [
        r"\bkilling me\b",
        r"\bterrible\b",
        r"\bunbearable\b",
        r"\bexcruciating\b",
        r"\b10/10\b",
        r"\b9/10\b",
        r"\bworst (?:headache|pain) (?:of my life|ever)\b",
        r"\bintense\b",
        r"\bextreme(?:ly)?\b",
        r"\bextremely painful\b",
        r"\bvery painful\b",
        r"\bseverely painful\b",
        r"\bsevere\b",
        r"\bsplitting\b",
        r"\bagonizing\b",
        r"\bhorrible\b",
        r"\bblinding\b"
    ],
    "moderate": [
        r"\bmoderate\b",
        r"\bfairly bad\b",
        r"\bmedium\b",
        r"\bquite (?:a bit|painful|bad)\b",
        r"\b5/10\b",
        r"\b6/10\b",
        r"\bnoticeable\b"
    ],
    "mild": [
        r"\bmild\b",
        r"\bslight\b",
        r"\ba little bit\b",
        r"\bdull\b",
        r"\bminor\b",
        r"\bbearable\b",
        r"\bnot too bad\b",
        r"\b1/10\b",
        r"\b2/10\b",
        r"\b3/10\b"
    ]
}

# Onset quantifiers
ONSET_PATTERNS = {
    "sudden": [
        r"\bsuddenly\b",
        r"\ball of a sudden\b",
        r"\bout of nowhere\b",
        r"\bthunderclap\b",
        r"\babrupt(?:ly)?\b",
        r"\bhit me like a truck\b",
        r"\brapid onset\b"
    ],
    "gradual": [
        r"\bgradual(?:ly)?\b",
        r"\bslowly\b",
        r"\bbuilding up\b",
        r"\bover time\b",
        r"\bover the past few days\b"
    ]
}

# Frequency quantifiers
FREQUENCY_PATTERNS = {
    "constant": [r"\bconstant\b", r"\bcontinuous(?:ly)?\b", r"\bnon[- ]stop\b", r"\ball the time\b"],
    "intermittent": [r"\bcomes and goes\b", r"\bintermittent\b", r"\bperiodic\b", r"\boff and on\b"],
    "worsening": [r"\bgetting worse\b", r"\bworsening\b", r"\bincreasing\b"]
}

# Duration pattern
DURATION_REGEX = re.compile(
    r"\b(since (?:yesterday|this morning|last night|earlier today|\w+)|"
    r"for (?:the past )?(?:\d+|one|two|three|four|five|six|seven|eight|nine|ten|a couple of)\s+(?:hours?|days?|weeks?|months?)|"
    r"past (?:\d+|one|two|three|four|five|six|seven|eight|nine|ten)\s+(?:hours?|days?|weeks?)|"
    r"(?:\d+|one|two|three|four|five|six|seven|eight|nine|ten)\s+(?:hours?|days?|weeks?)\s+ago|"
    r"this afternoon|this morning|today)\b",
    re.IGNORECASE
)

# Negation scope markers
NEGATION_MARKERS = [
    r"\bno\b",
    r"\bnot\b",
    r"\bwithout\b",
    r"\bdenies\b",
    r"\bdenied\b",
    r"\bnever\b",
    r"\bdidn\'?t\b",
    r"\bdid not\b",
    r"\bhaven\'?t\b",
    r"\bhaven\'?t had\b",
    r"\bhasn\'?t\b",
    r"\bfree of\b",
    r"\bnegative for\b"
]


class ClinicalConceptNormalizer:
    """
    Normalizes conversational natural language patient statements into
    a structured ClinicalHistory representation with strict null preservation.
    """

    def normalize(
        self,
        text: str,
        vitals: Optional[Dict[str, Any]] = None,
        patient_id: Optional[str] = None,
        age: Optional[int] = None,
        gender: Optional[str] = None,
        lab_values: Optional[List[Dict[str, Any]]] = None,
        medical_history: Optional[List[str]] = None,
        medications: Optional[List[str]] = None,
        allergies: Optional[List[str]] = None
    ) -> ClinicalHistory:
        """
        Main entrypoint: parses narrative text into structured ClinicalHistory.
        """
        clean_text = text.strip() if text else ""
        if not clean_text:
            return ClinicalHistory(
                patient_id=patient_id,
                age=age,
                gender=gender,
                vitals=vitals,
                lab_values=lab_values or [],
                medical_history=medical_history or [],
                medications=medications or [],
                allergies=allergies or []
            )

        # 1. Break text into logical clauses / sentences
        clauses = self._split_into_clauses(clean_text)

        symptoms: List[SymptomDetail] = []
        relevant_negatives: List[str] = []
        chief_complaints: List[str] = []

        # Discrete clinical flags: default to None (unknown)
        loss_of_consciousness: Optional[bool] = None
        breathing_difficulty: Optional[bool] = None
        bleeding: Optional[BleedingDetail] = None
        confusion: Optional[bool] = None
        neurological_symptoms: Optional[List[str]] = None
        ability_to_keep_fluids_down: Optional[bool] = None
        unable_to_keep_fluids: Optional[bool] = None
        blood_in_vomit: Optional[bool] = None

        # 2. Check fluid retention explicitly
        fluid_inability = self._matches_any_pattern(clean_text, FLUIDS_INABILITY_PATTERNS)
        fluid_ability = self._matches_any_pattern(clean_text, FLUIDS_ABILITY_PATTERNS)
        if fluid_inability:
            ability_to_keep_fluids_down = False
            unable_to_keep_fluids = True
        elif fluid_ability:
            ability_to_keep_fluids_down = True
            unable_to_keep_fluids = False

        # 3. Check focal neurological symptoms
        found_neuro: List[str] = []
        for neuro_concept, patterns in NEURO_SYMPTOMS_MAP.items():
            for clause in clauses:
                if self._is_clause_negated(clause):
                    continue
                if self._matches_any_pattern(clause, patterns):
                    if neuro_concept not in found_neuro:
                        found_neuro.append(neuro_concept)
        if found_neuro:
            neurological_symptoms = found_neuro

        # 4. Evaluate each concept against clauses, detecting affirmative vs negative mentions
        for concept_name, patterns in CONCEPT_LEXICONS.items():
            for clause in clauses:
                clause_matched = self._matches_any_pattern(clause, patterns)
                if not clause_matched:
                    continue

                is_negated = self._is_clause_negated(clause)

                if is_negated:
                    canonical_name = self._to_human_symptom_name(concept_name)
                    if canonical_name not in relevant_negatives:
                        relevant_negatives.append(canonical_name)

                    # Update discrete flags if explicitly negated
                    if concept_name == "loss_of_consciousness":
                        loss_of_consciousness = False
                    elif concept_name == "breathing_difficulty":
                        breathing_difficulty = False
                    elif concept_name == "confusion":
                        confusion = False
                    elif concept_name == "blood_in_vomit":
                        blood_in_vomit = False
                else:
                    # Affirmative mention
                    if concept_name == "loss_of_consciousness":
                        loss_of_consciousness = True
                    elif concept_name == "breathing_difficulty":
                        breathing_difficulty = True
                    elif concept_name == "confusion":
                        confusion = True
                    elif concept_name == "blood_in_vomit":
                        blood_in_vomit = True
                        bleeding = BleedingDetail(
                            present=True,
                            source="vomit",
                            severity="heavy" if ("dark" in clause.lower() or "coffee" in clause.lower()) else "mild",
                            raw_expression=clause.strip()
                        )
                    elif concept_name == "blood_in_stool":
                        bleeding = BleedingDetail(
                            present=True,
                            source="stool",
                            severity="tarry_melena" if ("black" in clause.lower() or "melena" in clause.lower()) else "mild",
                            raw_expression=clause.strip()
                        )

                    # Build detailed symptom record
                    symptom = self._extract_symptom_detail(concept_name, clause)
                    if not any(s.name == symptom.name for s in symptoms):
                        symptoms.append(symptom)
                        if symptom.name not in chief_complaints:
                            chief_complaints.append(symptom.name)

        return ClinicalHistory(
            patient_id=patient_id,
            age=age,
            gender=gender,
            chief_complaints=chief_complaints,
            symptoms=symptoms,
            relevant_negative_symptoms=relevant_negatives,
            medications=medications or [],
            allergies=allergies or [],
            current_medications=medications or [],
            loss_of_consciousness=loss_of_consciousness,
            breathing_difficulty=breathing_difficulty,
            bleeding=bleeding,
            confusion=confusion,
            neurological_symptoms=neurological_symptoms,
            ability_to_keep_fluids_down=ability_to_keep_fluids_down,
            unable_to_keep_fluids=unable_to_keep_fluids,
            blood_in_vomit=blood_in_vomit,
            vitals=vitals,
            lab_values=lab_values or [],
            medical_history=medical_history or []
        )

    def _split_into_clauses(self, text: str) -> List[str]:
        """Splits multi-sentence or multi-clause patient statements."""
        # Split on sentence boundaries, semicolons, or conjunctions like 'but', 'however', 'and'
        raw_parts = re.split(r"[\.\?!;\n]|\b(?:but|however|though|except)\b", text, flags=re.IGNORECASE)
        clauses = [p.strip() for p in raw_parts if p.strip()]
        return clauses if clauses else [text]

    def _is_clause_negated(self, clause: str) -> bool:
        """Determines if the clause contains an explicit negation polarity marker."""
        lower = clause.lower()
        for marker in NEGATION_MARKERS:
            if re.search(marker, lower):
                return True
        return False

    def _matches_any_pattern(self, text: str, patterns: List[str]) -> bool:
        """Checks if text matches any regex pattern in list."""
        lower = text.lower()
        for pat in patterns:
            if re.search(pat, lower):
                return True
        return False

    def _extract_symptom_detail(self, concept_name: str, clause: str) -> SymptomDetail:
        """Extracts severity, duration, onset, and frequency from a clause."""
        lower = clause.lower()

        # Severity
        severity: Optional[str] = None
        for sev_level, patterns in SEVERITY_PATTERNS.items():
            if self._matches_any_pattern(lower, patterns):
                severity = sev_level
                break

        # Onset
        onset: Optional[str] = None
        for on_type, patterns in ONSET_PATTERNS.items():
            if self._matches_any_pattern(lower, patterns):
                onset = on_type
                break

        # Frequency
        frequency: Optional[str] = None
        for freq_type, patterns in FREQUENCY_PATTERNS.items():
            if self._matches_any_pattern(lower, patterns):
                frequency = freq_type
                break

        # Duration
        duration: Optional[str] = None
        duration_days: Optional[float] = None
        dur_match = DURATION_REGEX.search(lower)
        if dur_match:
            duration = dur_match.group(1).strip()
            dur_lower = duration.lower()
            if "two day" in dur_lower or "2 day" in dur_lower:
                duration_days = 2.0
            elif "one day" in dur_lower or "1 day" in dur_lower or "yesterday" in dur_lower:
                duration_days = 1.0
            elif "three day" in dur_lower or "3 day" in dur_lower:
                duration_days = 3.0
            else:
                d_match = re.search(r"(\d+)\s+day", dur_lower)
                if d_match:
                    try:
                        duration_days = float(d_match.group(1))
                    except ValueError:
                        pass

        canonical_name = self._to_human_symptom_name(concept_name)

        return SymptomDetail(
            name=canonical_name,
            severity=severity,
            duration=duration,
            duration_days=duration_days,
            onset=onset,
            frequency=frequency,
            associated_symptoms=[],
            raw_expression=clause.strip()
        )

    def _to_human_symptom_name(self, concept_name: str) -> str:
        """Translates internal concept key to canonical clinical name."""
        mapping = {
            "headache": "headache",
            "chest_pain": "chest pain",
            "breathing_difficulty": "breathing difficulty",
            "loss_of_consciousness": "loss of consciousness",
            "abdominal_pain": "abdominal pain",
            "vomiting": "vomiting",
            "fever": "fever",
            "confusion": "confusion",
            "allergic_reaction": "allergic reaction",
            "blood_in_vomit": "blood in vomit",
            "blood_in_stool": "blood in stool"
        }
        return mapping.get(concept_name, concept_name.replace("_", " "))


_DEFAULT_NORMALIZER = ClinicalConceptNormalizer()


def normalize_clinical_narrative(
    text: str,
    vitals: Optional[Dict[str, Any]] = None,
    patient_id: Optional[str] = None,
    age: Optional[int] = None,
    gender: Optional[str] = None
) -> ClinicalHistory:
    """Convenience function to normalize patient speech into ClinicalHistory."""
    return _DEFAULT_NORMALIZER.normalize(
        text=text,
        vitals=vitals,
        patient_id=patient_id,
        age=age,
        gender=gender
    )


def normalize_case_input(data: Union[ClinicalHistory, Dict[str, Any]]) -> ClinicalHistory:
    """
    Accepts either an already-structured ClinicalHistory or a dictionary
    (which may contain raw complaints or unnormalized text) and normalizes it.
    """
    if isinstance(data, ClinicalHistory):
        # If discrete flags are already explicitly populated, return as-is
        if data.loss_of_consciousness is not None or data.breathing_difficulty is not None:
            return data
        # Otherwise run normalizer across complaints and symptoms to fill discrete flags
        complaints_text = " ".join(data.chief_complaints)
        symptoms_text = " ".join(
            s.name if isinstance(s, SymptomDetail) else (s.get("name", "") if isinstance(s, dict) else str(s))
            for s in data.symptoms
        )
        combined_text = f"{complaints_text}. {symptoms_text}".strip()
        if combined_text:
            normalized = _DEFAULT_NORMALIZER.normalize(
                text=combined_text,
                vitals=data.vitals if isinstance(data.vitals, dict) else (data.vitals.model_dump() if data.vitals else None),
                patient_id=data.patient_id,
                age=data.age,
                gender=data.gender,
                lab_values=[l.model_dump() if hasattr(l, "model_dump") else l for l in data.lab_values],
                medical_history=data.medical_history,
                medications=data.medications,
                allergies=data.allergies
            )
            # Retain original structured symptoms if richer
            if data.symptoms and not normalized.symptoms:
                normalized.symptoms = data.symptoms
            return normalized
        return data

    if isinstance(data, dict):
        raw_narrative = ""
        complaints = data.get("chief_complaints", [])
        if isinstance(complaints, list):
            raw_narrative += " ".join(str(c) for c in complaints)
        elif isinstance(complaints, str):
            raw_narrative += complaints

        symptoms_input = data.get("symptoms", [])
        if isinstance(symptoms_input, list):
            for s in symptoms_input:
                if isinstance(s, dict):
                    raw_narrative += f" {s.get('name', '')} {s.get('severity', '')} {s.get('details', '')}"
                elif isinstance(s, str):
                    raw_narrative += f" {s}"

        normalized = _DEFAULT_NORMALIZER.normalize(
            text=raw_narrative.strip(),
            vitals=data.get("vitals"),
            patient_id=data.get("patient_id"),
            age=data.get("age"),
            gender=data.get("gender"),
            lab_values=data.get("lab_values", []),
            medical_history=data.get("medical_history", []),
            medications=data.get("medications", data.get("current_medications", [])),
            allergies=data.get("allergies", [])
        )
        # Check if discrete flags were passed directly in dict
        for flag in [
            "loss_of_consciousness", "breathing_difficulty", "bleeding",
            "confusion", "neurological_symptoms", "ability_to_keep_fluids_down"
        ]:
            if flag in data and data[flag] is not None:
                setattr(normalized, flag, data[flag])

        return normalized

    return ClinicalHistory()
