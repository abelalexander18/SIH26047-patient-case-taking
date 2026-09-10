"""
SIH26047 — Patient Case-Taking Software (Ministry of Ayush / AIIA)
Member 6: Predefined Clinical Red Flag Rules Catalog

This module defines the explicit clinical screening rules completely separate
from the evaluation logic. Rules use explicit concept patterns and trigger
conditions with non-diagnostic recommendations.
"""

from dataclasses import dataclass, field
from typing import List, Optional, Dict, Any


@dataclass
class ScreeningRule:
    rule_id: str
    category: str
    severity: str  # "critical", "urgent", "warning"
    title: str
    message: str
    recommendation: str
    
    # Required concept groups: all inner concept groups must be satisfied (AND of ORs)
    # Each inner group is a list of synonymous phrases (OR)
    required_concept_groups: List[List[str]] = field(default_factory=list)
    
    # Optional vital sign threshold triggers (evaluated alongside text)
    vital_triggers: Dict[str, Any] = field(default_factory=dict)


# --- Explicit Screening Rules Catalog ---

RULES_CATALOG: List[ScreeningRule] = [
    # 1. Chest pain / Severe chest pain
    ScreeningRule(
        rule_id="RF_CARD_01",
        category="cardiovascular",
        severity="critical",
        title="Chest Pain Pattern",
        message="Potential red flag detected: chest pain pattern identified. Prompt clinical evaluation may be appropriate.",
        recommendation=(
            "Potential red flag detected. Prompt clinical evaluation may be appropriate. "
            "Advise immediate in-person physician evaluation, continuous vital monitoring, and urgent 12-lead ECG."
        ),
        required_concept_groups=[
            ["chest pain", "chest pressure", "chest tightness", "chest heaviness", "retrosternal pain", "cardiac pain"]
        ]
    ),

    # 2. Chest pain with breathing difficulty
    ScreeningRule(
        rule_id="RF_CARD_02",
        category="cardiovascular",
        severity="critical",
        title="Chest Pain with Breathing Difficulty Pattern",
        message="Potential red flag detected: concurrent chest pain and breathing difficulty identified. Prompt clinical evaluation may be appropriate.",
        recommendation=(
            "Potential red flag detected. Prompt clinical evaluation may be appropriate. "
            "Stat medical assessment, continuous cardiorespiratory monitoring, and prepare for urgent cardiovascular triage."
        ),
        required_concept_groups=[
            ["chest pain", "chest tightness", "chest pressure", "chest discomfort", "cardiac pain"],
            ["breathing difficulty", "shortness of breath", "difficulty breathing", "breathless", "breathlessness", "dyspnea", "gasping"]
        ]
    ),

    # 3. Loss of consciousness
    ScreeningRule(
        rule_id="RF_NEURO_01",
        category="neurological",
        severity="critical",
        title="Loss of Consciousness Pattern",
        message="Potential red flag detected: episode of loss of consciousness identified. Prompt clinical evaluation may be appropriate.",
        recommendation=(
            "Potential red flag detected. Prompt clinical evaluation may be appropriate. "
            "Assess airway patency, check capillary blood glucose, monitor hemodynamics, and obtain emergency physician evaluation."
        ),
        required_concept_groups=[
            [
                "loss of consciousness", "lost consciousness", "unconscious",
                "passed out", "passing out", "blacked out", "blacking out",
                "syncope", "fainted", "fainting episode", "unresponsive", "unresponsiveness"
            ]
        ]
    ),

    # 4. Severe headache with loss of consciousness
    ScreeningRule(
        rule_id="RF_NEURO_02",
        category="neurological",
        severity="critical",
        title="Severe Headache with Loss of Consciousness Pattern",
        message="Potential red flag detected: severe headache with concurrent loss of consciousness identified. Prompt clinical evaluation may be appropriate.",
        recommendation=(
            "Potential red flag detected. Prompt clinical evaluation may be appropriate. "
            "Immediate emergency triage, assess for acute intracranial pathology, maintain airway, and obtain urgent neuroimaging."
        ),
        required_concept_groups=[
            ["severe headache", "worst headache", "thunderclap headache", "intense headache", "unbearable headache"],
            [
                "loss of consciousness", "lost consciousness", "unconscious",
                "passed out", "blacked out", "syncope", "fainted", "unresponsive"
            ]
        ]
    ),

    # 5. Severe headache with neurological symptoms
    ScreeningRule(
        rule_id="RF_NEURO_03",
        category="neurological",
        severity="critical",
        title="Severe Headache with Neurological Deficits Pattern",
        message="Potential red flag detected: severe headache with focal neurological symptoms identified. Prompt clinical evaluation may be appropriate.",
        recommendation=(
            "Potential red flag detected. Prompt clinical evaluation may be appropriate. "
            "Immediate neurological assessment, evaluate for acute cerebrovascular or intracranial event, and perform urgent brain imaging."
        ),
        required_concept_groups=[
            ["severe headache", "worst headache", "intense headache", "unbearable headache", "thunderclap headache"],
            [
                "facial droop", "slurred speech", "difficulty speaking", "arm weakness",
                "leg weakness", "one-sided weakness", "hemiparesis", "numbness",
                "vision loss", "blurred vision", "double vision", "neck stiffness", "stiff neck", "confusion"
            ]
        ]
    ),

    # 6. Severe breathing difficulty
    ScreeningRule(
        rule_id="RF_RESP_01",
        category="respiratory",
        severity="critical",
        title="Severe Breathing Difficulty Pattern",
        message="Potential red flag detected: severe respiratory compromise identified. Prompt clinical evaluation may be appropriate.",
        recommendation=(
            "Potential red flag detected. Prompt clinical evaluation may be appropriate. "
            "Immediate airway and oxygenation evaluation, continuous pulse oximetry, and stat medical physician evaluation."
        ),
        required_concept_groups=[
            [
                "breathing difficulty", "difficulty breathing", "shortness of breath",
                "breathless", "breathlessness", "dyspnea", "gasping for air", "air hunger", "suffocation"
            ],
            ["severe", "extreme", "unable to breathe", "unable to speak", "gasping", "intense", "acute severe", "severe acute"]
        ],
        vital_triggers={
            "spo2_max": 88.0,
            "respiratory_rate_min": 32.0
        }
    ),

    # 7. Severe allergic-type symptoms involving breathing difficulty
    ScreeningRule(
        rule_id="RF_ALLERG_01",
        category="allergy_airway",
        severity="critical",
        title="Severe Allergic Reaction with Airway Compromise Pattern",
        message="Potential red flag detected: allergic-type symptoms involving breathing difficulty identified. Prompt clinical evaluation may be appropriate.",
        recommendation=(
            "Potential red flag detected. Prompt clinical evaluation may be appropriate. "
            "Stat physician evaluation for impending airway compromise and immediate acute allergic reaction triage."
        ),
        required_concept_groups=[
            [
                "swelling of lips", "lip swelling", "swelling of tongue", "tongue swelling",
                "throat tightness", "throat closing", "anaphylaxis", "allergic reaction",
                "hives with swelling", "angioedema", "stridor"
            ],
            [
                "breathing difficulty", "difficulty breathing", "shortness of breath",
                "wheezing", "dyspnea", "breathless", "choking"
            ]
        ]
    ),

    # 8. Blood in vomit
    ScreeningRule(
        rule_id="RF_GI_01",
        category="gastrointestinal",
        severity="urgent",
        title="Blood in Vomit Pattern",
        message="Potential red flag detected: blood in vomit identified. Prompt clinical evaluation may be appropriate.",
        recommendation=(
            "Potential red flag detected. Prompt clinical evaluation may be appropriate. "
            "Immediate medical review for gastrointestinal bleeding, assess hemodynamic stability and hemoglobin levels."
        ),
        required_concept_groups=[
            ["blood in vomit", "vomiting blood", "vomited blood", "hematemesis", "coffee ground emesis", "blood in vomitus"]
        ]
    ),

    # 9. Blood in stool
    ScreeningRule(
        rule_id="RF_GI_02",
        category="gastrointestinal",
        severity="urgent",
        title="Blood in Stool Pattern",
        message="Potential red flag detected: blood in stool identified. Prompt clinical evaluation may be appropriate.",
        recommendation=(
            "Potential red flag detected. Prompt clinical evaluation may be appropriate. "
            "Prompt gastroenterology or medical assessment, evaluate for gastrointestinal hemorrhage, and monitor blood pressure."
        ),
        required_concept_groups=[
            [
                "blood in stool", "blood in stools", "bleeding in stool", "bloody stool",
                "melena", "black tarry stool", "black stool", "rectal bleeding", "passing blood with stool"
            ]
        ]
    ),

    # 10. Severe abdominal pain with loss of consciousness
    ScreeningRule(
        rule_id="RF_GI_03",
        category="gastrointestinal",
        severity="critical",
        title="Severe Abdominal Pain with Syncope Pattern",
        message="Potential red flag detected: severe abdominal pain with loss of consciousness identified. Prompt clinical evaluation may be appropriate.",
        recommendation=(
            "Potential red flag detected. Prompt clinical evaluation may be appropriate. "
            "Stat surgical and emergency physician evaluation, assess for acute intra-abdominal catastrophe or hemorrhage, and initiate continuous vital monitoring."
        ),
        required_concept_groups=[
            ["abdominal pain", "stomach pain", "belly pain", "tummy pain"],
            ["severe", "intense", "extreme", "unbearable", "excruciating", "acute severe"],
            [
                "loss of consciousness", "lost consciousness", "unconscious",
                "passed out", "blacked out", "syncope", "fainted", "fainting"
            ]
        ]
    ),

    # 11. High fever with confusion/altered mental state
    ScreeningRule(
        rule_id="RF_INF_01",
        category="sepsis_infection",
        severity="critical",
        title="High Fever with Altered Mental State Pattern",
        message="Potential red flag detected: high fever with confusion or altered mental state identified. Prompt clinical evaluation may be appropriate.",
        recommendation=(
            "Potential red flag detected. Prompt clinical evaluation may be appropriate. "
            "Urgent medical evaluation for systemic infection or sepsis, check vital signs, and obtain blood cultures and inflammatory markers."
        ),
        required_concept_groups=[
            ["high fever", "fever", "pyrexia", "elevated temperature", "febrile"],
            [
                "confusion", "confused", "altered mental state", "altered mentation",
                "disorientation", "disoriented", "delirium", "drowsiness", "drowsy",
                "lethargic with fever", "hallucination", "unresponsive"
            ]
        ],
        vital_triggers={
            "temperature_min": 102.0
        }
    )
]


def get_rules() -> List[ScreeningRule]:
    """Returns a shallow copy of the screening rules catalog."""
    return list(RULES_CATALOG)
