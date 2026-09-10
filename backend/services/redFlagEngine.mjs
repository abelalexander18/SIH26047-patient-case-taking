/**
 * Arogya AI — Member 6: Deterministic Red-Flag Intelligence Engine
 * Path: backend/services/redFlagEngine.mjs
 * 
 * ARCHITECTURAL MANDATES:
 * 1. Zero LLM Calls: Purely deterministic, rule-based screening engine.
 * 2. Structured Facts Only: Operates strictly on structured clinical facts.
 * 3. Non-Diagnostic Guardrail: Never claims a medical diagnosis (e.g. "You have X").
 *    Standardized alert wording: "Potential red flag detected. Prompt clinical evaluation may be appropriate."
 * 4. Context-Aware: Does not flag common/mild symptoms (e.g. mild headache, isolated vomiting)
 *    unless critical acute discriminators are explicitly affirmed.
 * 5. Strict Negative Respect: Pertinent negative symptoms (e.g. loss_of_consciousness = false,
 *    or relevant_negative_symptoms containing "fainting") will NEVER trigger a red flag.
 */

export const DISCLAIMER_TEXT = 'This is a screening alert, not a diagnosis.';
export const STANDARD_ALERT_MESSAGE = 'Potential red flag detected. Prompt clinical evaluation may be appropriate.';

/**
 * Normalizes input facts to guarantee null/undefined safety across all attributes.
 * 
 * @param {Object|null|undefined} rawFacts - Input clinical facts object
 * @returns {Object} Sanitized facts object
 */
export function sanitizeClinicalFacts(rawFacts) {
  if (!rawFacts || typeof rawFacts !== 'object') {
    return {
      chief_complaint: null,
      chief_complaints: [],
      symptoms: [],
      duration: null,
      severity: null,
      associated_symptoms: [],
      relevant_negative_symptoms: [],
      medications: [],
      allergies: [],
      past_medical_history: [],
      loss_of_consciousness: null,
      breathing_difficulty: null,
      confusion: null,
      bleeding: null,
      unable_to_keep_fluids: null,
      blood_in_vomit: null,
      blood_in_stool: null,
      neurological_symptoms: null,
      vitals: null,
    };
  }

  const symptomsList = Array.isArray(rawFacts.symptoms)
    ? rawFacts.symptoms
        .filter(s => s && typeof s === 'object')
        .map(s => ({
          name: typeof s.name === 'string' ? s.name.trim().toLowerCase() : '',
          severity: typeof s.severity === 'string' ? s.severity.trim().toLowerCase() : null,
          duration: s.duration || null,
          onset: s.onset || null,
        }))
    : [];

  const chiefComplaintsList = Array.isArray(rawFacts.chief_complaints)
    ? rawFacts.chief_complaints.filter(c => typeof c === 'string').map(c => c.trim().toLowerCase())
    : (typeof rawFacts.chief_complaint === 'string' && rawFacts.chief_complaint.trim()
        ? [rawFacts.chief_complaint.trim().toLowerCase()]
        : []);

  const negativesList = Array.isArray(rawFacts.relevant_negative_symptoms)
    ? rawFacts.relevant_negative_symptoms.filter(n => typeof n === 'string').map(n => n.trim().toLowerCase())
    : [];

  const associatedList = Array.isArray(rawFacts.associated_symptoms)
    ? rawFacts.associated_symptoms.filter(a => typeof a === 'string').map(a => a.trim().toLowerCase())
    : [];

  // Parse bleeding object or boolean
  let bleedingObj = null;
  if (rawFacts.bleeding && typeof rawFacts.bleeding === 'object') {
    bleedingObj = {
      present: Boolean(rawFacts.bleeding.present),
      source: typeof rawFacts.bleeding.source === 'string' ? rawFacts.bleeding.source.trim().toLowerCase() : null,
      severity: typeof rawFacts.bleeding.severity === 'string' ? rawFacts.bleeding.severity.trim().toLowerCase() : null,
    };
  } else if (rawFacts.bleeding === true) {
    bleedingObj = { present: true, source: null, severity: null };
  }

  return {
    chief_complaint: chiefComplaintsList[0] || null,
    chief_complaints: chiefComplaintsList,
    symptoms: symptomsList,
    duration: rawFacts.duration || null,
    severity: typeof rawFacts.severity === 'string' ? rawFacts.severity.trim().toLowerCase() : null,
    associated_symptoms: associatedList,
    relevant_negative_symptoms: negativesList,
    medications: Array.isArray(rawFacts.medications) ? rawFacts.medications : [],
    allergies: Array.isArray(rawFacts.allergies) ? rawFacts.allergies : [],
    past_medical_history: Array.isArray(rawFacts.past_medical_history) ? rawFacts.past_medical_history : [],
    loss_of_consciousness: typeof rawFacts.loss_of_consciousness === 'boolean' ? rawFacts.loss_of_consciousness : null,
    breathing_difficulty: typeof rawFacts.breathing_difficulty === 'boolean' ? rawFacts.breathing_difficulty : null,
    confusion: typeof rawFacts.confusion === 'boolean' ? rawFacts.confusion : null,
    bleeding: bleedingObj,
    unable_to_keep_fluids: typeof rawFacts.unable_to_keep_fluids === 'boolean' ? rawFacts.unable_to_keep_fluids : null,
    blood_in_vomit: typeof rawFacts.blood_in_vomit === 'boolean' ? rawFacts.blood_in_vomit : null,
    blood_in_stool: typeof rawFacts.blood_in_stool === 'boolean' ? rawFacts.blood_in_stool : null,
    neurological_symptoms: rawFacts.neurological_symptoms ?? null,
    vitals: (rawFacts.vitals && typeof rawFacts.vitals === 'object') ? rawFacts.vitals : null,
  };
}

/**
 * Checks if a specific symptom keyword exists in symptoms or chief complaints.
 */
function hasSymptom(facts, ...keywords) {
  const allNames = [
    ...facts.chief_complaints,
    ...facts.symptoms.map(s => s.name),
    ...facts.associated_symptoms,
  ];

  return keywords.some(kw => {
    const kwLower = kw.toLowerCase();
    return allNames.some(name => name.includes(kwLower));
  });
}

/**
 * Checks if a symptom has been explicitly recorded as a pertinent negative.
 */
function isPertinentNegative(facts, ...keywords) {
  return keywords.some(kw => {
    const kwLower = kw.toLowerCase();
    return facts.relevant_negative_symptoms.some(neg => neg.includes(kwLower));
  });
}

/**
 * Checks if a specific symptom or overall complaint is recorded with 'severe' severity.
 */
function isSevere(facts, symptomKeyword = null) {
  if (facts.severity === 'severe' || facts.severity === 'critical') {
    return true;
  }

  if (symptomKeyword) {
    const kwLower = symptomKeyword.toLowerCase();
    const matching = facts.symptoms.filter(s => s.name.includes(kwLower));
    if (matching.some(s => s.severity === 'severe' || s.severity === 'critical')) {
      return true;
    }
  }

  return false;
}

/**
 * Evaluates neurological deficit indicators (weakness, speech difficulty, facial drooping, vision loss).
 */
function hasNeurologicalDeficits(facts) {
  if (facts.neurological_symptoms === true) return true;
  if (Array.isArray(facts.neurological_symptoms) && facts.neurological_symptoms.length > 0) return true;

  const neuroKeywords = [
    'facial droop', 'facial drooping', 'slurred speech', 'speech difficulty',
    'one-sided weakness', 'hemiparesis', 'numbness', 'vision loss', 'double vision',
    'diplopia', 'confusion', 'paralysis', 'seizure', 'convulsion'
  ];

  return hasSymptom(facts, ...neuroKeywords);
}

/**
 * Evaluates severe allergic / anaphylactoid indicators (hives, angioedema, throat/lip swelling).
 */
function hasSevereAllergicIndicators(facts) {
  const allergicKeywords = [
    'allergic', 'allergy', 'anaphylaxis', 'hives', 'urticaria',
    'throat swelling', 'swollen tongue', 'lip swelling', 'angioedema', 'face swelling'
  ];

  if (hasSymptom(facts, ...allergicKeywords)) return true;

  if (Array.isArray(facts.allergies) && facts.allergies.length > 0) {
    const allergyText = facts.allergies.join(' ').toLowerCase();
    if (allergicKeywords.some(kw => allergyText.includes(kw))) return true;
  }

  return false;
}

/**
 * MAIN SCREENING FUNCTION: Evaluates structured clinical facts against 10 explicit rules.
 * 
 * @param {Object} rawFacts - Structured clinical facts
 * @returns {Object} Standardized RedFlagResult
 */
export function screenRedFlags(rawFacts) {
  const facts = sanitizeClinicalFacts(rawFacts);
  const flags = [];

  // -------------------------------------------------------------------------
  // RULE 1: Severe headache + Loss of consciousness (RF-001)
  // -------------------------------------------------------------------------
  const headachePresent = hasSymptom(facts, 'headache', 'head pain', 'migraine');
  const headacheSevere = headachePresent && (isSevere(facts, 'headache') || facts.severity === 'severe');
  const syncopePresent = facts.loss_of_consciousness === true && !isPertinentNegative(facts, 'fainting', 'loss of consciousness', 'blackout');

  if (headacheSevere && syncopePresent) {
    flags.push({
      rule_id: 'RF-001',
      category: 'neurological',
      message: STANDARD_ALERT_MESSAGE,
      evidence: [
        'Severe headache reported',
        'Loss of consciousness confirmed'
      ]
    });
  }

  // -------------------------------------------------------------------------
  // RULE 2: Severe headache + Neurological symptoms (RF-002)
  // -------------------------------------------------------------------------
  const neuroDeficitsPresent = hasNeurologicalDeficits(facts) && !isPertinentNegative(facts, 'neurological', 'speech', 'weakness', 'drooping');
  if (headacheSevere && neuroDeficitsPresent) {
    flags.push({
      rule_id: 'RF-002',
      category: 'neurological',
      message: STANDARD_ALERT_MESSAGE,
      evidence: [
        'Severe headache reported',
        'Concurrent neurological deficits identified'
      ]
    });
  }

  // -------------------------------------------------------------------------
  // RULE 3: Chest pain + Breathing difficulty (RF-003)
  // -------------------------------------------------------------------------
  const chestPainPresent = hasSymptom(facts, 'chest pain', 'chest pressure', 'chest tightness', 'angina') &&
    !isPertinentNegative(facts, 'chest pain', 'chest pressure');
  const dyspneaPresent = facts.breathing_difficulty === true &&
    !isPertinentNegative(facts, 'breathing difficulty', 'shortness of breath');

  if (chestPainPresent && dyspneaPresent) {
    flags.push({
      rule_id: 'RF-003',
      category: 'cardiovascular',
      message: STANDARD_ALERT_MESSAGE,
      evidence: [
        'Chest pain or pressure reported',
        'Concurrent breathing difficulty identified'
      ]
    });
  }

  // -------------------------------------------------------------------------
  // RULE 4: Severe breathing difficulty (RF-004)
  // -------------------------------------------------------------------------
  const breathingSevere = (dyspneaPresent && isSevere(facts, 'breathing')) ||
    (facts.vitals && typeof facts.vitals.spo2 === 'number' && facts.vitals.spo2 < 90) ||
    hasSymptom(facts, 'gasping for air', 'unable to speak', 'severe dyspnea', 'severe breathlessness');

  if (breathingSevere && !isPertinentNegative(facts, 'breathing difficulty', 'shortness of breath')) {
    flags.push({
      rule_id: 'RF-004',
      category: 'respiratory',
      message: STANDARD_ALERT_MESSAGE,
      evidence: [
        'Severe breathing difficulty or marked respiratory distress'
      ]
    });
  }

  // -------------------------------------------------------------------------
  // RULE 5: Loss of consciousness alone (RF-005)
  // (Fires if syncope affirmed and not already captured by RF-001 or RF-008)
  // -------------------------------------------------------------------------
  const abdominalPainSevere = hasSymptom(facts, 'abdominal pain', 'stomach pain', 'belly pain') &&
    (isSevere(facts, 'abdominal') || facts.severity === 'severe');

  if (syncopePresent && !flags.some(f => f.rule_id === 'RF-001') && !(abdominalPainSevere && syncopePresent)) {
    flags.push({
      rule_id: 'RF-005',
      category: 'neurological',
      message: STANDARD_ALERT_MESSAGE,
      evidence: [
        'Loss of consciousness / syncope episode confirmed'
      ]
    });
  }

  // -------------------------------------------------------------------------
  // RULE 6: Blood in vomit (RF-006)
  // -------------------------------------------------------------------------
  const hematemesisPresent = (facts.blood_in_vomit === true || facts.bleeding?.source === 'vomit') &&
    !isPertinentNegative(facts, 'blood in vomit');

  if (hematemesisPresent) {
    flags.push({
      rule_id: 'RF-006',
      category: 'gastrointestinal',
      message: STANDARD_ALERT_MESSAGE,
      evidence: [
        'Blood in vomit (hematemesis) reported'
      ]
    });
  }

  // -------------------------------------------------------------------------
  // RULE 7: Blood in stool (RF-007)
  // -------------------------------------------------------------------------
  const melenaPresent = (facts.blood_in_stool === true || facts.bleeding?.source === 'stool') &&
    !isPertinentNegative(facts, 'blood in stool', 'rectal bleeding');

  if (melenaPresent) {
    flags.push({
      rule_id: 'RF-007',
      category: 'gastrointestinal',
      message: STANDARD_ALERT_MESSAGE,
      evidence: [
        'Blood in stool / melena / rectal bleeding reported'
      ]
    });
  }

  // -------------------------------------------------------------------------
  // RULE 8: Severe abdominal pain + Loss of consciousness (RF-008)
  // -------------------------------------------------------------------------
  if (abdominalPainSevere && syncopePresent) {
    flags.push({
      rule_id: 'RF-008',
      category: 'abdominal',
      message: STANDARD_ALERT_MESSAGE,
      evidence: [
        'Severe abdominal pain reported',
        'Loss of consciousness confirmed'
      ]
    });
  }

  // -------------------------------------------------------------------------
  // RULE 9: High fever + Confusion/altered mental state (RF-009)
  // -------------------------------------------------------------------------
  const feverPresent = hasSymptom(facts, 'fever', 'high fever', 'pyrexia') ||
    (facts.vitals && typeof facts.vitals.temperature === 'number' && facts.vitals.temperature >= 102.0);
  const confusionPresent = facts.confusion === true || hasSymptom(facts, 'confusion', 'disoriented', 'altered mental state');

  if (feverPresent && confusionPresent && !isPertinentNegative(facts, 'confusion')) {
    flags.push({
      rule_id: 'RF-009',
      category: 'sepsis_infection',
      message: STANDARD_ALERT_MESSAGE,
      evidence: [
        'High fever reported or measured (>=102°F)',
        'Confusion or altered mental state identified'
      ]
    });
  }

  // -------------------------------------------------------------------------
  // RULE 10: Severe allergic-type symptoms + Breathing difficulty (RF-010)
  // -------------------------------------------------------------------------
  const severeAllergicPresent = hasSevereAllergicIndicators(facts);
  if (severeAllergicPresent && dyspneaPresent) {
    flags.push({
      rule_id: 'RF-010',
      category: 'allergic_immunologic',
      message: STANDARD_ALERT_MESSAGE,
      evidence: [
        'Severe allergic or anaphylactoid symptoms (swelling/hives) reported',
        'Breathing difficulty identified'
      ]
    });
  }

  // -------------------------------------------------------------------------
  // Assemble final RedFlagResult
  // -------------------------------------------------------------------------
  const detected = flags.length > 0;
  const severity = detected ? 'high' : 'none';

  return {
    detected,
    severity,
    flags,
    disclaimer: DISCLAIMER_TEXT
  };
}

/**
 * Identifies missing clinical discriminators when broad symptoms are reported
 * so the conversational AI can gather necessary context before triage.
 * 
 * @param {Object} rawFacts - Current clinical facts
 * @returns {Array<string>} List of missing acute context keys
 */
export function identifyMissingContext(rawFacts) {
  const facts = sanitizeClinicalFacts(rawFacts);
  const missing = [];

  const hasVomiting = hasSymptom(facts, 'vomit', 'vomiting', 'nausea', 'throwing up');
  if (hasVomiting) {
    if (facts.unable_to_keep_fluids === null) missing.push('unable_to_keep_fluids');
    if (facts.blood_in_vomit === null && !facts.bleeding) missing.push('blood_in_vomit');
    if (facts.loss_of_consciousness === null) missing.push('loss_of_consciousness');
    const hasAbdominal = hasSymptom(facts, 'abdominal', 'stomach', 'belly');
    if (!hasAbdominal && facts.severity === null) missing.push('severe_abdominal_pain');
  }

  const hasHeadache = hasSymptom(facts, 'headache', 'head pain', 'migraine');
  if (hasHeadache) {
    if (facts.loss_of_consciousness === null) missing.push('loss_of_consciousness');
    if (facts.neurological_symptoms === null) missing.push('neurological_symptoms');
    if (facts.severity === null) missing.push('headache_severity');
  }

  const hasChestPain = hasSymptom(facts, 'chest pain', 'chest discomfort', 'chest');
  if (hasChestPain) {
    if (facts.breathing_difficulty === null) missing.push('breathing_difficulty');
  }

  const hasFever = hasSymptom(facts, 'fever', 'pyrexia', 'bukhar');
  if (hasFever) {
    if (facts.confusion === null) missing.push('confusion');
  }

  const hasAbdominal = hasSymptom(facts, 'abdominal pain', 'stomach pain', 'belly pain');
  if (hasAbdominal) {
    if (facts.loss_of_consciousness === null) missing.push('loss_of_consciousness');
    if (facts.blood_in_stool === null && !facts.bleeding) missing.push('blood_in_stool');
    if (facts.blood_in_vomit === null && !facts.bleeding) missing.push('blood_in_vomit');
  }

  return missing;
}
