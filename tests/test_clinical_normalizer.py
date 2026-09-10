"""
Test Suite: Clinical Information Extraction & Normalization Layer

Verifies:
1. Lay expressions and idioms mapping to canonical clinical concepts.
2. Syncope colloquialisms ("fainted", "passed out", "blacked out", "lost consciousness") -> loss_of_consciousness = True.
3. Headache severity quantifiers ("head is killing me", "terrible headache", "extremely painful") -> severity = "severe".
4. Pertinent negation detection ("no chest pain", "haven't fainted") -> relevant_negative_symptoms and discrete False flags.
5. Inability to keep fluids down ("can't keep water down") -> ability_to_keep_fluids_down = False.
6. Strict null semantics: unmentioned fields remain None/null (never hallucinated).
7. Seamless end-to-end piping into the deterministic Red Flag Engine.
"""

import pytest
from red_flag_engine.normalizer import (
    ClinicalConceptNormalizer,
    normalize_clinical_narrative,
    normalize_case_input
)
from red_flag_engine.engine import RedFlagEngine
from red_flag_engine.schemas import ClinicalHistory, SymptomDetail

normalizer = ClinicalConceptNormalizer()
engine = RedFlagEngine()


# =====================================================================
# 1. SYNCOPE / LOSS OF CONSCIOUSNESS COLLOQUIALISMS
# =====================================================================

@pytest.mark.parametrize("phrase", [
    "I fainted yesterday at work",
    "I passed out all of a sudden",
    "I blacked out while walking",
    "I lost consciousness for a few seconds",
    "I fell unconscious on the floor",
    "I had a syncope episode earlier"
])
def test_syncope_colloquialisms_map_to_loss_of_consciousness(phrase):
    history = normalizer.normalize(phrase)
    assert history.loss_of_consciousness is True, f"Failed for phrase: '{phrase}'"


# =====================================================================
# 2. HEADACHE SEVERITY QUANTIFIERS
# =====================================================================

@pytest.mark.parametrize("phrase", [
    "my head is killing me since morning",
    "I have a terrible headache today",
    "extremely painful headache",
    "worst headache of my life, it's unbearable",
    "splitting headache that feels like 10/10"
])
def test_headache_severity_quantifiers_map_to_severe(phrase):
    history = normalizer.normalize(phrase)
    headache_symptoms = [s for s in history.symptoms if s.name == "headache"]
    assert len(headache_symptoms) == 1
    assert headache_symptoms[0].severity == "severe", f"Failed for phrase: '{phrase}'"


def test_mild_headache_quantifier():
    history = normalizer.normalize("I have a slight dull headache since this afternoon")
    headache_symptoms = [s for s in history.symptoms if s.name == "headache"]
    assert len(headache_symptoms) == 1
    assert headache_symptoms[0].severity == "mild"


def test_moderate_headache_quantifier():
    history = normalizer.normalize("I have a moderate headache that is noticeable")
    headache_symptoms = [s for s in history.symptoms if s.name == "headache"]
    assert len(headache_symptoms) == 1
    assert headache_symptoms[0].severity == "moderate"


# =====================================================================
# 3. PERTINENT NEGATIONS PARSING
# =====================================================================

def test_pertinent_negation_chest_pain():
    narrative = "I have a headache since yesterday. No chest pain though."
    history = normalizer.normalize(narrative)
    
    # Active positive symptoms should only contain headache
    symptom_names = [s.name for s in history.symptoms]
    assert "headache" in symptom_names
    assert "chest pain" not in symptom_names
    
    # Pertinent negatives must contain chest pain
    assert "chest pain" in history.relevant_negative_symptoms


def test_pertinent_negation_consciousness():
    narrative = "I have a severe headache, but I didn't faint or lose consciousness."
    history = normalizer.normalize(narrative)
    
    assert history.loss_of_consciousness is False
    assert "loss of consciousness" in history.relevant_negative_symptoms


def test_pertinent_negation_breathing_difficulty():
    narrative = "I have stomach cramps but no shortness of breath."
    history = normalizer.normalize(narrative)
    
    assert history.breathing_difficulty is False
    assert "breathing difficulty" in history.relevant_negative_symptoms


# =====================================================================
# 4. FLUID RETENTION NORMALIZATION
# =====================================================================

def test_inability_to_keep_fluids_down():
    narrative = "I have nausea and I can't keep any water down."
    history = normalizer.normalize(narrative)
    assert history.ability_to_keep_fluids_down is False


def test_ability_to_keep_fluids_down_affirmed():
    narrative = "I feel sick but I am drinking water fine and keeping fluids down."
    history = normalizer.normalize(narrative)
    assert history.ability_to_keep_fluids_down is True


def test_fluid_retention_unmentioned_remains_null():
    narrative = "I have a mild sore throat."
    history = normalizer.normalize(narrative)
    assert history.ability_to_keep_fluids_down is None


# =====================================================================
# 5. BLEEDING EXTRACTION
# =====================================================================

def test_vomiting_blood_extraction():
    narrative = "I am throwing up dark coffee-ground looking blood."
    history = normalizer.normalize(narrative)
    
    assert history.bleeding is not None
    assert history.bleeding.present is True
    assert history.bleeding.source == "vomit"
    assert history.bleeding.severity == "heavy"


def test_rectal_bleeding_extraction():
    narrative = "I noticed black tarry stools since yesterday."
    history = normalizer.normalize(narrative)
    
    assert history.bleeding is not None
    assert history.bleeding.present is True
    assert history.bleeding.source == "stool"
    assert history.bleeding.severity == "tarry_melena"


# =====================================================================
# 6. STRICT NULL PRESERVATION (ZERO HALLUCINATION)
# =====================================================================

def test_unmentioned_attributes_remain_null():
    narrative = "I have a slight headache."
    history = normalizer.normalize(narrative)
    
    # Must NOT infer unmentioned dimensions
    assert history.loss_of_consciousness is None
    assert history.breathing_difficulty is None
    assert history.bleeding is None
    assert history.confusion is None
    assert history.neurological_symptoms is None
    assert history.ability_to_keep_fluids_down is None


# =====================================================================
# 7. END-TO-END NORMALIZATION -> DETERMINISTIC RED FLAG ENGINE
# =====================================================================

def test_e2e_severe_headache_killing_me_and_fainted():
    """
    Patient says: 'Doc, my head is killing me and I fainted yesterday. No chest pain.'
    Should normalize to:
      symptoms: [headache, severe]
      loss_of_consciousness: True
      relevant_negative_symptoms: ['chest pain']
    Engine should trigger:
      RF_NEURO_02 (Severe Headache with Loss of Consciousness)
      And NOT trigger RF_CARD_01.
    """
    narrative = "Doc, my head is killing me and I fainted yesterday. No chest pain."
    normalized = normalizer.normalize(narrative)
    
    assert normalized.loss_of_consciousness is True
    assert "chest pain" in normalized.relevant_negative_symptoms
    
    result = engine.screen(normalized)
    assert result["detected"] is True
    assert result["severity"] == "critical"
    assert result["rule_id"] == "RF_NEURO_02"
    assert result["category"] == "neurological"


def test_e2e_chest_pain_idiom_and_dyspnea():
    """
    Patient says: 'It feels like an elephant sitting on my chest and I can't catch my breath.'
    Engine should trigger:
      RF_CARD_02 (Chest Pain with Breathing Difficulty Pattern)
    """
    narrative = "It feels like an elephant sitting on my chest and I can't catch my breath."
    normalized = normalizer.normalize(narrative)
    
    assert normalized.breathing_difficulty is True
    
    result = engine.screen(normalized)
    assert result["detected"] is True
    assert result["severity"] == "critical"
    assert result["rule_id"] == "RF_CARD_02"
    assert result["category"] == "cardiovascular"


def test_e2e_gi_bleeding_and_inability_to_keep_fluids():
    """
    Patient says: 'I am vomiting coffee-ground blood and cannot keep any water down.'
    Engine should trigger:
      RF_GI_01 (Blood in Vomit Pattern)
    """
    narrative = "I am vomiting coffee-ground blood and cannot keep any water down."
    normalized = normalizer.normalize(narrative)
    
    assert normalized.bleeding is not None
    assert normalized.bleeding.source == "vomit"
    assert normalized.ability_to_keep_fluids_down is False
    
    result = engine.screen(normalized)
    assert result["detected"] is True
    assert result["severity"] == "urgent"
    assert result["rule_id"] == "RF_GI_01"


def test_e2e_routine_mild_case_clean_pass():
    """
    Patient says: 'I have a slight headache after looking at my computer screen.'
    Engine should return clean negative screening.
    """
    narrative = "I have a slight headache after looking at my computer screen."
    normalized = normalizer.normalize(narrative)
    
    result = engine.screen(normalized)
    assert result["detected"] is False
    assert result["severity"] == "none"
    assert result["rule_id"] == "NONE"
