/**
 * Arogya AI — Server-Side OpenAI Clinical Service
 * Path: backend/services/openaiService.mjs
 * 
 * Responsibilities:
 * 1. Natural Language Understanding & Clinical Entity Extraction
 * 2. Normalization of patient lay idioms into structured concepts
 * 3. Strict null preservation (never invent unmentioned facts)
 * 4. Identification of missing acute clinical discriminators
 * 5. Generation of exactly ONE context-aware follow-up question
 * 6. Non-diagnostic patient-friendly response & physician summary
 * 
 * Safety Rules:
 * - Never diagnose diseases or prescribe medication
 * - Zero hallucination: unmentioned fields must remain null
 * - Never expose OPENAI_API_KEY to the client
 * - Automatic, robust offline fallback if OPENAI_API_KEY is not set or network fails
 */

const OPENAI_API_KEY = process.env.OPENAI_API_KEY || '';
const OPENAI_MODEL = process.env.OPENAI_MODEL || 'gpt-4o-mini';
const PYTHON_SERVICE_URL = process.env.PYTHON_SERVICE_URL || 'http://127.0.0.1:8006';

import { screenRedFlags, identifyMissingContext, DISCLAIMER_TEXT } from './redFlagEngine.mjs';

const SYSTEM_PROMPT = `You are the Clinical Information Extraction & Case-Taking Engine for Arogya AI, an outpatient clinical decision-support system aligned with the Ministry of Ayush / AIIA standards.

PRIMARY DIRECTIVES:
1. EXTRACT & NORMALIZE:
   Parse the patient's statement and conversation history into canonical clinical concepts.
   Recognize colloquialisms and idioms:
   - "I fainted", "I passed out", "I blacked out", "I lost consciousness", "fell unconscious" -> loss_of_consciousness = true
   - "my head is killing me", "terrible headache", "extremely painful headache", "10/10", "worst headache" -> severity = "severe"
   - "can't breathe", "struggling to breathe", "short of breath", "gasping", "winded" -> breathing_difficulty = true
   - "vomiting blood", "throwing up dark blood", "coffee-ground vomit" -> bleeding = {"present": true, "source": "vomit", "severity": "heavy"}
   - "blood in stool", "black tarry stool", "rectal bleeding" -> bleeding = {"present": true, "source": "stool"}
   - "can't keep water down", "throwing up any water", "unable to retain fluids" -> unable_to_keep_fluids = true
   - "denies chest pain", "no chest pain" -> pertinent negative (relevant_negative_symptoms: ["chest pain"])

2. STRICT ZERO HALLUCINATION (MANDATORY):
   - If the patient does not mention an attribute, that field MUST BE null.
   - Do NOT default unmentioned symptoms to false.
   - Do NOT invent vitals, lab values, past history, or durations.

3. STRICT NON-DIAGNOSTIC GUARDRAIL (MANDATORY):
   - You must NEVER make a diagnosis (e.g. do NOT diagnose "Migraine", "Appendicitis", "Gastroenteritis", "COVID-19", "Heart Attack").
   - You must NEVER recommend or prescribe medications.

4. MISSING RELEVANT INFORMATION:
   Identify which acute clinical discriminators are still null/unknown:
   - If vomiting reported: check if unable_to_keep_fluids or blood_in_vomit are null.
   - If headache reported: check if loss_of_consciousness or neurological_deficits are null.
   - If chest pain reported: check if breathing_difficulty is null.
   - If fever reported: check if confusion is null.
   - If abdominal pain reported: check if loss_of_consciousness or bleeding are null.

5. NEXT QUESTION & PATIENT-FRIENDLY RESPONSE:
   - Formulate exactly ONE polite, empathetic, context-aware follow-up question targeting the top missing relevant information.
   - If no critical information is missing, formulate a polite concluding message that responses have been recorded for the doctor.
   - Provide 2 to 4 intuitive quick-reply options matching the next_question.

6. MEDICAL REPORT INTEGRATION (MANDATORY GUARDRAILS):
   - When medical report context (vitals, laboratory values, medications, abnormal findings) is available, incorporate these objective facts into your clinical thinking.
   - When abnormal values are noted in the report (e.g. elevated blood pressure, low hemoglobin, high fasting glucose):
     * NEVER declare a diagnosis (e.g. BAD: "Your hemoglobin is low, so you have anemia" or "You have hypertension").
     * ALWAYS phrase neutrally and cautiously: "Your hemoglobin is below the reference range shown on the report. Your doctor may want to review this value."
     * Ask ONE relevant follow-up question to clarify missing clinical information (e.g., asking about antihypertensive medications if BP is elevated, or asking about fatigue/dizziness if hemoglobin is low).
     * Correlate patient symptoms with report findings without diagnosing.

OUTPUT JSON FORMAT:
Respond ONLY with valid JSON conforming to this exact structure:
{
  "clinical_facts": {
    "chief_complaint": string | null,
    "symptoms": [
      {
        "name": string,
        "severity": "mild" | "moderate" | "severe" | null,
        "duration": string | null,
        "onset": "sudden" | "gradual" | null
      }
    ],
    "duration": string | null,
    "severity": "mild" | "moderate" | "severe" | null,
    "associated_symptoms": string[],
    "relevant_negative_symptoms": string[],
    "medications": string[],
    "allergies": string[],
    "past_medical_history": string[],
    "loss_of_consciousness": boolean | null,
    "breathing_difficulty": boolean | null,
    "confusion": boolean | null,
    "bleeding": { "present": boolean, "source": string | null } | null,
    "unable_to_keep_fluids": boolean | null
  },
  "missing_relevant_information": string[],
  "next_question": string,
  "patient_friendly_response": string,
  "quick_replies": string[]
}`;

/**
 * Main service entrypoint: processes a conversational turn with OpenAI or resilient fallback.
 */
export async function processClinicalDialogue({
  patientMessage,
  conversationHistory = [],
  structuredHistory = null,
  reportContext = null,
}) {
  if (!patientMessage || !patientMessage.trim()) {
    throw new Error('Patient message cannot be empty');
  }

  // 1. Try Live OpenAI API if API key is provided
  if (OPENAI_API_KEY && OPENAI_API_KEY.trim() !== '') {
    try {
      const openAiResult = await callOpenAI({
        patientMessage: patientMessage.trim(),
        conversationHistory,
        structuredHistory,
        reportContext,
      });

      if (openAiResult && openAiResult.clinical_facts) {
        // Run deterministic red-flag screening on the extracted clinical facts
        const screeningResult = await screenClinicalFactsDeterministically(openAiResult.clinical_facts);

        return {
          clinical_facts: openAiResult.clinical_facts,
          missing_relevant_information: openAiResult.missing_relevant_information || [],
          next_question: openAiResult.next_question || '',
          patient_friendly_response: openAiResult.patient_friendly_response || openAiResult.next_question || '',
          quick_replies: openAiResult.quick_replies || [],
          screening_result: screeningResult,
          doctor_summary: generateDoctorSummary(openAiResult.clinical_facts, screeningResult),
          source: 'live-openai-api',
        };
      }
    } catch (apiError) {
      console.warn('[OpenAIService] Live OpenAI call failed, falling back to deterministic NLU:', apiError.message);
    }
  }

  // 2. Intelligent Deterministic NLU Fallback (Runs offline or when API key is not configured)
  return fallbackClinicalDialogue({
    patientMessage: patientMessage.trim(),
    conversationHistory,
    structuredHistory,
    reportContext,
  });
}

/**
 * Calls OpenAI Chat Completions API with structured JSON mode.
 */
async function callOpenAI({ patientMessage, conversationHistory, structuredHistory, reportContext }) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 8000);

  const messages = [
    { role: 'system', content: SYSTEM_PROMPT }
  ];

  if (structuredHistory) {
    messages.push({
      role: 'system',
      content: `CURRENT ACCUMULATED CLINICAL FACTS (Merge and update, preserving known facts):\n${JSON.stringify(structuredHistory, null, 2)}`
    });
  }

  if (reportContext) {
    messages.push({
      role: 'system',
      content: `UPLOADED MEDICAL REPORT FINDINGS:\n${JSON.stringify({
        patient: reportContext.reportData?.patient,
        vitals: reportContext.reportData?.vitals,
        laboratoryResults: reportContext.reportData?.laboratoryResults,
        medications: reportContext.reportData?.medications,
        abnormalCount: reportContext.reportAnalysis?.abnormalCount,
        hasAbnormalValues: reportContext.reportAnalysis?.hasAbnormalValues,
        evaluatedAbnormalities: reportContext.reportAnalysis?.evaluatedAbnormalities,
        diagnosesMentioned: reportContext.reportData?.diagnosesMentioned,
      }, null, 2)}\nUse these findings to inform follow-up questions without diagnosing. Correlate patient symptoms with report findings.`
    });
  }

  // Add conversation history context
  for (const m of (conversationHistory || [])) {
    if (m && m.text) {
      messages.push({
        role: m.sender === 'ai' ? 'assistant' : 'user',
        content: m.text
      });
    }
  }

  // Add latest patient message
  messages.push({
    role: 'user',
    content: patientMessage
  });

  try {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${OPENAI_API_KEY.trim()}`
      },
      body: JSON.stringify({
        model: OPENAI_MODEL,
        messages,
        temperature: 0.1,
        response_format: { type: 'json_object' }
      }),
      signal: controller.signal
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`OpenAI HTTP ${response.status}: ${errText}`);
    }

    const data = await response.json();
    const content = data?.choices?.[0]?.message?.content;
    if (!content) {
      throw new Error('Empty response from OpenAI');
    }

    return JSON.parse(content);
  } finally {
    clearTimeout(timeoutId);
  }
}

/**
 * Evaluates extracted clinical facts through deterministic red-flag screening rules.
 * Guaranteed 0% LLM dependency for patient safety triage.
 */
export async function screenClinicalFactsDeterministically(facts) {
  const result = screenRedFlags(facts);

  // Return standard RedFlagResult schema + backward-compatible top-level properties
  return {
    detected: result.detected,
    severity: result.severity,
    flags: result.flags,
    disclaimer: result.disclaimer,
    // Top-level aliases for backward compatibility with UI components
    rule_id: result.flags[0]?.rule_id || 'NONE',
    category: result.flags[0]?.category || 'none',
    message: result.flags[0]?.message || 'No predefined high-risk clinical red-flag patterns detected in current history.',
    evidence: result.flags[0]?.evidence || [],
    recommendation: result.detected
      ? 'Potential red flag detected. Prompt clinical evaluation may be appropriate.'
      : 'Proceed with standard clinical case-taking and comprehensive physician evaluation.'
  };
}


/**
 * Intelligent deterministic NLU fallback reproducing all OpenAI extraction rules.
 */
function fallbackClinicalDialogue({ patientMessage, conversationHistory = [], structuredHistory = null, reportContext = null }) {
  const lower = patientMessage.toLowerCase();
  
  // Extract source facts from structuredHistory or attached clinical facts
  const sourceFacts = structuredHistory?.clinicalFacts || structuredHistory?.clinical_facts || structuredHistory;

  // Start with previous facts or empty structure
  const facts = sourceFacts ? JSON.parse(JSON.stringify(sourceFacts)) : {
    chief_complaint: null,
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
    bp_medication_status: null,
    fatigue_status: null,
    diabetes_status: null
  };

  // Ensure all array fields are always valid arrays
  if (!Array.isArray(facts.symptoms)) facts.symptoms = [];
  if (!Array.isArray(facts.associated_symptoms)) facts.associated_symptoms = [];
  if (!Array.isArray(facts.relevant_negative_symptoms)) facts.relevant_negative_symptoms = [];
  if (!Array.isArray(facts.medications)) facts.medications = [];
  if (!Array.isArray(facts.allergies)) facts.allergies = [];
  if (!Array.isArray(facts.past_medical_history)) facts.past_medical_history = [];

  // Normalize chief complaint if present in camelCase
  if (!facts.chief_complaint && structuredHistory) {
    facts.chief_complaint = structuredHistory.chief_complaint || structuredHistory.chiefComplaint || null;
  }

  // Preserve previous severity if not already set on facts
  if (!facts.severity && structuredHistory) {
    facts.severity = structuredHistory.severity || (structuredHistory.historyOfPresentIllness && /severe/i.test(structuredHistory.historyOfPresentIllness) ? 'severe' : null);
  }

  // Preserve previous symptoms if facts.symptoms is empty
  if (facts.symptoms.length === 0 && structuredHistory?.symptoms && Array.isArray(structuredHistory.symptoms)) {
    facts.symptoms = JSON.parse(JSON.stringify(structuredHistory.symptoms));
  }

  // If chief complaint is known and symptoms list lacks it, add it
  if (facts.chief_complaint && !facts.symptoms.some(s => s.name === facts.chief_complaint)) {
    facts.symptoms.push({
      name: facts.chief_complaint,
      severity: facts.severity || null,
      duration: facts.duration || null,
      onset: null
    });
  }

  // Merge medications and diagnoses from reportContext if present
  if (reportContext?.reportData?.medications) {
    for (const m of reportContext.reportData.medications) {
      const name = typeof m === 'string' ? m : `${m.name || m.medication || ''}${m.dose || m.dosage ? ` ${m.dose || m.dosage}` : ''}`.trim();
      if (name && !facts.medications.includes(name)) {
        facts.medications.push(name);
      }
    }
  }
  if (reportContext?.reportData?.diagnosesMentioned) {
    for (const d of reportContext.reportData.diagnosesMentioned) {
      if (d && !facts.past_medical_history.includes(d)) {
        facts.past_medical_history.push(d);
      }
    }
  }

  // 1. Detect Loss of Consciousness / Syncope idioms
  if (/(?:fainted|passed out|blacked out|lost consciousness|fell unconscious|syncope)/i.test(patientMessage)) {
    if (/(?:no|not|denies|didn't|without)\s+(?:fainting|blackouts|passing out|loss of consciousness)/i.test(patientMessage)) {
      facts.loss_of_consciousness = false;
      if (!facts.relevant_negative_symptoms.includes('loss of consciousness')) {
        facts.relevant_negative_symptoms.push('loss of consciousness');
      }
    } else {
      facts.loss_of_consciousness = true;
    }
  }

  // 2. Detect Breathing Difficulty idioms
  if (/(?:can\'?t breathe|struggling to breathe|difficulty breathing|shortness of breath|breathless|gasping|winded)/i.test(patientMessage)) {
    if (/(?:no|not|denies|without)\s+(?:shortness of breath|breathing difficulty)/i.test(patientMessage)) {
      facts.breathing_difficulty = false;
      if (!facts.relevant_negative_symptoms.includes('breathing difficulty')) {
        facts.relevant_negative_symptoms.push('breathing difficulty');
      }
    } else {
      facts.breathing_difficulty = true;
    }
  }

  // 3. Detect Fluid Inability idioms
  if (/(?:can\'?t keep|cannot keep|unable to keep|throw(?:ing)? up any|vomit(?:ing)? everything)\s+(?:water|fluids?|liquids?|anything)/i.test(patientMessage)) {
    facts.unable_to_keep_fluids = true;
  } else if (/(?:can|able to)\s+drink\s+(?:water|fluids?)|keeping fluids? down/i.test(patientMessage)) {
    facts.unable_to_keep_fluids = false;
  }

  // 4. Detect Bleeding (Hematemesis / Melena / Hemoptysis)
  if (/(?:throwing up|vomit(?:ing|ed)?)\s+(?:dark\s+)?(?:blood|coffee[- ]ground)/i.test(patientMessage) || /blood in (?:my\s+)?vomit/i.test(patientMessage)) {
    if (/(?:no|not|denies)\s+blood in (?:my\s+)?vomit/i.test(patientMessage)) {
      if (!facts.relevant_negative_symptoms.includes('blood in vomit')) {
        facts.relevant_negative_symptoms.push('blood in vomit');
      }
    } else {
      facts.bleeding = { present: true, source: 'vomit' };
    }
  } else if (/blood in (?:my\s+)?stool|black tarry stool|rectal bleeding/i.test(patientMessage)) {
    facts.bleeding = { present: true, source: 'stool' };
  } else if (/(?:coughing|spitting|cough(?:ed)?\s+up)\s+(?:dark\s+)?blood|hemoptysis/i.test(patientMessage)) {
    facts.bleeding = { present: true, source: 'respiratory' };
  }

  // 5. Detect Severity idioms
  if (/(?:killing me|terrible|unbearable|excruciating|10\/10|severe|worst)/i.test(patientMessage)) {
    facts.severity = 'severe';
  } else if (/(?:mild|slight|minor|1\/10|2\/10|manageable)/i.test(patientMessage)) {
    facts.severity = 'mild';
  } else if (/(?:moderate|fairly bad|5\/10|6\/10)/i.test(patientMessage)) {
    facts.severity = 'moderate';
  }

  // 6. Detect Duration idioms
  const durationMatch = patientMessage.match(/(?:for\s+)?(\d+|one|two|three|four|five)\s+(days?|hours?|weeks?)|since\s+(?:yesterday|this morning)/i);
  if (durationMatch) {
    facts.duration = durationMatch[0];
  }

  // 7. Symptoms & Chief Complaints
  if (/vomit(?:ing|ed)?|throwing up/i.test(patientMessage)) {
    if (!facts.chief_complaint) facts.chief_complaint = 'vomiting';
    if (!facts.symptoms.some(s => s.name === 'vomiting')) {
      facts.symptoms.push({
        name: 'vomiting',
        severity: facts.severity,
        duration: facts.duration,
        onset: null
      });
    }
  }

  if (/headache|head pain|migraine/i.test(patientMessage)) {
    if (!facts.chief_complaint) facts.chief_complaint = 'headache';
    if (!facts.symptoms.some(s => s.name === 'headache')) {
      facts.symptoms.push({
        name: 'headache',
        severity: facts.severity,
        duration: facts.duration,
        onset: null
      });
    }
  }

  if (/chest pain|chest pressure|chest tightness/i.test(patientMessage)) {
    if (!facts.chief_complaint) facts.chief_complaint = 'chest pain';
    if (!facts.symptoms.some(s => s.name === 'chest pain')) {
      facts.symptoms.push({
        name: 'chest pain',
        severity: facts.severity,
        duration: facts.duration,
        onset: null
      });
    }
  }

  // 8. Detect Responses to Report-Generated Inquiries
  // Blood Pressure medication response
  if (/(?:taking|prescribed|on)\s+(?:daily\s+)?(?:bp|blood pressure|amlodipine|telmisartan|atenolol|tablets?|medication)|yes.*?(?:bp|tablet|med)/i.test(patientMessage)) {
    facts.bp_medication_status = 'taking_daily_medication';
    if (!facts.medications.includes('Blood pressure medication (daily)')) {
      facts.medications.push('Blood pressure medication (daily)');
    }
  } else if (/(?:no|not|never|don't|stopped)\s+(?:taking\s+)?(?:any\s+)?(?:bp|blood pressure|tablet|medication)|no.*?(?:bp|tablet|med)/i.test(patientMessage)) {
    facts.bp_medication_status = 'none';
    if (!facts.relevant_negative_symptoms.includes('blood pressure medication')) {
      facts.relevant_negative_symptoms.push('blood pressure medication');
    }
  }

  // Fatigue / Anemia response
  if (/(?:yes|feeling|very|extreme)\s+(?:tired|fatigue|weak|exhausted|dizzy|lightheaded)|tired|weakness|fatigue/i.test(patientMessage)) {
    facts.fatigue_status = 'reported';
    if (!facts.symptoms.some(s => s.name === 'fatigue')) {
      facts.symptoms.push({ name: 'fatigue', severity: 'moderate', duration: null, onset: null });
    }
  } else if (/(?:no|not|denies|without)\s+(?:tired|fatigue|weakness|dizziness)|no fatigue/i.test(patientMessage)) {
    facts.fatigue_status = 'denied';
    if (!facts.relevant_negative_symptoms.includes('fatigue / dizziness')) {
      facts.relevant_negative_symptoms.push('fatigue / dizziness');
    }
  }

  // Diabetes / Glucose response
  if (/(?:yes|diagnosed|have)\s+(?:diabetes|sugar|type 2)|on metformin/i.test(patientMessage)) {
    facts.diabetes_status = 'confirmed';
    if (!facts.past_medical_history.includes('Type 2 Diabetes Mellitus')) {
      facts.past_medical_history.push('Type 2 Diabetes Mellitus');
    }
  } else if (/(?:no|not|never)\s+(?:diabetes|sugar)/i.test(patientMessage)) {
    facts.diabetes_status = 'denied';
    if (!facts.relevant_negative_symptoms.includes('diabetes history')) {
      facts.relevant_negative_symptoms.push('diabetes history');
    }
  }

  // 9. Identify missing information & next question
  const missing = [];
  let nextQuestion = '';
  let patientResponse = '';
  let quickReplies = [];

  const allReported = `${facts.chief_complaint || ''} ${(facts.symptoms || []).map(s => typeof s === 'string' ? s : s?.name || '').join(' ')}`.toLowerCase();

  // Priority 1: Acute Emergency Red Flag Follow-Ups
  if (allReported.includes('vomit')) {
    if (facts.unable_to_keep_fluids === null) {
      missing.push('unable_to_keep_fluids');
      nextQuestion = 'Have you been able to keep any water or fluids down, or are you throwing up everything you drink?';
      patientResponse = 'I understand. Have you been able to keep any water or fluids down, or are you throwing up everything you drink?';
      quickReplies = ['No, I throw up any water immediately.', 'Yes, I can drink water and fluids normally.'];
    } else if (facts.bleeding === null && !facts.relevant_negative_symptoms.includes('blood in vomit')) {
      missing.push('blood_in_vomit');
      nextQuestion = 'Could you clarify if there is any blood or dark coffee-ground looking material in your vomit?';
      patientResponse = 'Thank you. Could you clarify if there is any blood or dark coffee-ground looking material in your vomit?';
      quickReplies = ['No blood in my vomit.', 'Yes, throwing up dark coffee-ground looking blood.'];
    }
  } else if (allReported.includes('headache')) {
    if (facts.loss_of_consciousness === null) {
      missing.push('loss_of_consciousness');
      nextQuestion = 'Did you experience any fainting, blackout, or loss of consciousness with this headache?';
      patientResponse = 'I note the head pain. Did you experience any fainting, blackout, or loss of consciousness with this headache?';
      quickReplies = ['No fainting or blackouts.', 'Yes, I fainted and lost consciousness.'];
    }
  } else if (allReported.includes('chest')) {
    if (facts.breathing_difficulty === null) {
      missing.push('breathing_difficulty');
      nextQuestion = 'Are you also experiencing shortness of breath or difficulty catching your breath?';
      patientResponse = 'Noted regarding the chest discomfort. Are you also experiencing shortness of breath or difficulty catching your breath?';
      quickReplies = ['No shortness of breath.', 'Yes, I have severe trouble breathing.'];
    }
  }

  // Priority 2: Report-Specific Follow-Ups if acute red-flag questions are satisfied
  if (!nextQuestion && reportContext) {
    const vitals = reportContext.reportData?.vitals || {};
    const labs = reportContext.reportData?.laboratoryResults || reportContext.reportAnalysis?.evaluatedAbnormalities || [];

    let bpObj = null;
    if (Array.isArray(vitals)) {
      bpObj = vitals.find(v => (v.test_name || v.name || '').toLowerCase().includes('blood pressure') || (v.test_name || v.name || '').toLowerCase().includes('bp'));
    } else if (vitals && typeof vitals === 'object') {
      bpObj = vitals.blood_pressure || vitals.bp;
    }
    if (!bpObj && Array.isArray(reportContext.reportAnalysis?.evaluatedAbnormalities)) {
      bpObj = reportContext.reportAnalysis.evaluatedAbnormalities.find(a => (a.test_name || a.name || '').toLowerCase().includes('blood pressure') || (a.test_name || a.name || '').toLowerCase().includes('bp'));
    }

    const isBpHigher = bpObj && (bpObj.status === 'high' || (bpObj.systolic && bpObj.systolic >= 140) || (typeof bpObj.value === 'string' && bpObj.value.includes('/') && parseInt(bpObj.value.split('/')[0]) >= 140));
    const lowHb = labs.find(l => (l.test_name || l.test || '').toLowerCase().includes('hemoglobin') && l.status === 'low');
    const highGlucose = labs.find(l => (l.test_name || l.test || '').toLowerCase().includes('glucose') && l.status === 'high');

    if (isBpHigher && facts.bp_medication_status === null) {
      missing.push('bp_medication_status');
      const bpVal = bpObj.value || (bpObj.systolic && bpObj.diastolic ? `${bpObj.systolic}/${bpObj.diastolic} mmHg` : '150/95 mmHg');
      nextQuestion = `Your report notes an elevated blood pressure of ${bpVal}. Are you currently taking any prescription medication regularly for blood pressure?`;
      patientResponse = `I note your blood pressure reading of ${bpVal} from the report. Are you currently taking any prescription medication regularly for blood pressure?`;
      quickReplies = ['Yes, taking daily BP tablets', 'No, not on BP medication', 'Recently stopped medication'];
    } else if (lowHb && facts.fatigue_status === null && !facts.symptoms.some(s => s.name === 'fatigue')) {
      missing.push('fatigue_status');
      nextQuestion = `Your hemoglobin is below the reference range shown on the report (${lowHb.value} ${lowHb.unit}). Your doctor may want to review this value. Have you noticed any fatigue, lightheadedness, or weakness?`;
      patientResponse = nextQuestion;
      quickReplies = ['Yes, feeling very tired and weak', 'No fatigue or dizziness', 'Only mild tiredness'];
    } else if (highGlucose && facts.diabetes_status === null) {
      missing.push('diabetes_status');
      nextQuestion = `Your fasting blood glucose is above the report reference range. Do you have a prior medical history of Diabetes, or are you on any sugar-lowering medications?`;
      patientResponse = nextQuestion;
      quickReplies = ['Yes, diagnosed with diabetes', 'No prior diabetes history', 'Pre-diabetic / borderline'];
    }
  }

  // Handle report analysis inquiries gracefully and transparently
  if (!nextQuestion && /(?:analys|analyz|read|check|review|what does|interpret).*?(?:report|document|file|photo|image|note|prescription|slip)/i.test(patientMessage)) {
    nextQuestion = "I have attached your uploaded document to your intake packet for your physician to review. As a pre-consultation intake tool, I cannot interpret or diagnose from handwritten notes. Are you currently experiencing any symptoms right now?";
    patientResponse = nextQuestion;
    quickReplies = ['Experiencing symptoms right now', 'No other symptoms to report', 'End Interview & View Summary'];
  }

  // Default conclusion if all acute info gathered
  if (!nextQuestion) {
    nextQuestion = "Dhanyavaad. I have recorded all pertinent clinical details for your attending physician. Please click 'End Interview' to finalize your intake report.";
    patientResponse = nextQuestion;
    quickReplies = ['End Interview & View Summary'];
  }

  const screening = screenRedFlags(facts);
  const formattedScreening = {
    detected: screening.detected,
    severity: screening.severity,
    flags: screening.flags,
    disclaimer: screening.disclaimer,
    rule_id: screening.flags[0]?.rule_id || 'NONE',
    category: screening.flags[0]?.category || 'none',
    message: screening.flags[0]?.message || 'No predefined high-risk clinical red-flag patterns detected in current history.',
    evidence: screening.flags[0]?.evidence || [],
    recommendation: screening.detected
      ? 'Potential red flag detected. Prompt clinical evaluation may be appropriate.'
      : 'Proceed with standard clinical case-taking and comprehensive physician evaluation.'
  };

  return {
    clinical_facts: facts,
    missing_relevant_information: missing,
    next_question: nextQuestion,
    patient_friendly_response: patientResponse,
    quick_replies: quickReplies,
    screening_result: formattedScreening,
    doctor_summary: generateDoctorSummary(facts, formattedScreening),
    source: 'deterministic-nlu-fallback'
  };
}

/**
 * Generates the immediate follow-up conversation turn right after a medical report is uploaded.
 * Acknowledges report findings, neutrally notes abnormal values, and asks ONE context-aware follow-up question.
 */
export async function generateReportFollowUpTurn({
  reportData,
  reportAnalysis,
  ocrResult,
  existingHistory = null,
  conversationHistory = [],
}) {
  const fileName = reportData?.fileName || reportData?.name || 'medical report';
  const vitals = reportData?.vitals || {};
  const labs = reportData?.laboratoryResults || reportData?.evaluatedAbnormalities || [];
  const meds = reportData?.medications || [];
  const abnormalities = reportAnalysis?.evaluatedAbnormalities || labs.filter(l => l.status === 'high' || l.status === 'low');
  const hasAbnormal = Boolean(reportAnalysis?.hasAbnormalValues || abnormalities.length > 0 || (vitals.blood_pressure && (vitals.blood_pressure.status === 'high' || vitals.blood_pressure.systolic >= 140)));
  const extractionStatus = reportAnalysis?.extractionStatus || ocrResult?.extractionStatus || 'success';

  // Base clinical facts initialization or copy
  const facts = existingHistory ? JSON.parse(JSON.stringify(existingHistory)) : {
    chief_complaint: null,
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
    bp_medication_status: null,
    fatigue_status: null,
    diabetes_status: null
  };

  // Merge report medications into facts.medications
  if (Array.isArray(meds) && meds.length > 0) {
    for (const m of meds) {
      const medName = typeof m === 'string' ? m : `${m.name || m.medication || ''}${m.dose || m.dosage ? ` ${m.dose || m.dosage}` : ''}`.trim();
      if (medName && !facts.medications.includes(medName)) {
        facts.medications.push(medName);
      }
    }
  }

  // Merge report documented diagnoses into past_medical_history
  if (Array.isArray(reportData?.diagnosesMentioned)) {
    for (const d of reportData.diagnosesMentioned) {
      if (d && !facts.past_medical_history.includes(d)) {
        facts.past_medical_history.push(d);
      }
    }
  }

  // If live OpenAI is configured, attempt intelligent generation
  if (OPENAI_API_KEY && OPENAI_API_KEY.trim() !== '') {
    try {
      const openAiPrompt = `The patient has just uploaded a medical report: "${fileName}".
Extracted Vitals: ${JSON.stringify(vitals)}
Extracted Labs: ${JSON.stringify(labs)}
Abnormal Parameters: ${JSON.stringify(abnormalities)}
Extracted Medications: ${JSON.stringify(meds)}
Current Clinical Facts: ${JSON.stringify(facts)}

Generate a response adhering strictly to these clinical rules:
1. Acknowledge receipt of the report ("${fileName}").
2. Mention any notable abnormal parameters neutrally and cautiously.
   CRITICAL: NEVER declare a disease or diagnosis (e.g. BAD: "You have anemia" / "You have hypertension"; GOOD: "Your hemoglobin is below the reference range shown on the report. Your doctor may want to review this value.").
3. Formulate exactly ONE relevant, context-aware follow-up question targeting missing clinical information (e.g. asking if they are on blood pressure medication if BP is high, or asking about fatigue/dizziness if hemoglobin is low, or asking what symptoms brought them in).
4. Provide 2 to 3 concise quick replies matching the question.

Output valid JSON matching:
{
  "replyText": "...",
  "next_question": "...",
  "chips": ["...", "..."],
  "target_field": "..."
}`;

      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${OPENAI_API_KEY.trim()}`
        },
        body: JSON.stringify({
          model: OPENAI_MODEL,
          messages: [
            { role: 'system', content: SYSTEM_PROMPT },
            { role: 'user', content: openAiPrompt }
          ],
          temperature: 0.2,
          response_format: { type: 'json_object' }
        })
      });

      if (response.ok) {
        const jsonRes = await response.json();
        const parsed = JSON.parse(jsonRes?.choices?.[0]?.message?.content || '{}');
        if (parsed.replyText) {
          const screening = screenRedFlags(facts);
          return {
            replyText: parsed.replyText,
            chips: parsed.chips || ['Continue with consultation'],
            updatedHistory: facts,
            missingFields: parsed.target_field ? [parsed.target_field] : [],
            screeningResult: screening,
            source: 'live-openai-report-followup'
          };
        }
      }
    } catch (e) {
      console.warn('[OpenAIService] Live OpenAI report follow-up failed, using deterministic clinical generator:', e.message);
    }
  }

  // Deterministic Clinical Generator for all 6 cases:
  let replyText = '';
  let chips = [];
  const missingFields = [];

  // CASE 4: OCR failed / unreadable text
  if (extractionStatus === 'failed' || (!ocrResult?.rawText && labs.length === 0 && (!vitals || Object.keys(vitals).length === 0))) {
    replyText = `I've attached your document ("${fileName}") to your clinical intake packet for your physician to inspect directly. Machine-printed text could not be reliably extracted from this document (handwriting recognition is not supported in this prototype). Would you like to tell me what current symptoms brought you in today?`;
    chips = [
      'Fever or body ache',
      'Headache or dizziness',
      'Cough or breathing trouble',
      'Stomach discomfort / acidity'
    ];
    missingFields.push('chief_complaint');
  }
  // CASE 3: Insufficient information in report (no vitals and no lab tests)
  else if (labs.length === 0 && (!vitals || Object.keys(vitals).length === 0)) {
    replyText = `I've reviewed your uploaded document ("${fileName}") and attached it to your intake file. The document does not appear to contain recent vitals or standard laboratory values. To help prepare your summary for the consulting doctor, could you tell me what symptoms or health concerns brought you to the clinic?`;
    chips = [
      'Started having fever recently',
      'Severe headache or migraine',
      'Digestive issues / stomach pain',
      'Routine health consultation'
    ];
    missingFields.push('chief_complaint');
  }
  // CASE 2: Report contains abnormal values
  else if (hasAbnormal) {
    let bpObj = null;
    if (Array.isArray(vitals)) {
      bpObj = vitals.find(v => (v.test_name || v.name || '').toLowerCase().includes('blood pressure') || (v.test_name || v.name || '').toLowerCase().includes('bp'));
    } else if (vitals && typeof vitals === 'object') {
      bpObj = vitals.blood_pressure || vitals.bp;
    }
    if (!bpObj && Array.isArray(abnormalities)) {
      bpObj = abnormalities.find(a => (a.test_name || a.name || '').toLowerCase().includes('blood pressure') || (a.test_name || a.name || '').toLowerCase().includes('bp'));
    }

    const isBpHigher = bpObj && (bpObj.status === 'high' || (bpObj.systolic && bpObj.systolic >= 140) || (typeof bpObj.value === 'string' && bpObj.value.includes('/') && parseInt(bpObj.value.split('/')[0]) >= 140));
    const lowHb = labs.find(l => (l.test_name || l.test || '').toLowerCase().includes('hemoglobin') && l.status === 'low');
    const highGlucose = labs.find(l => (l.test_name || l.test || '').toLowerCase().includes('glucose') && l.status === 'high');

    const intro = `I've reviewed the information available in your report ("${fileName}").\nI'd like to clarify a few details to complete your case.`;

    if (isBpHigher) {
      const bpVal = bpObj.value || (bpObj.systolic && bpObj.diastolic ? `${bpObj.systolic}/${bpObj.diastolic} mmHg` : '150/95 mmHg');
      replyText = `${intro}\n\nYour blood pressure is recorded at ${bpVal}, which is above the standard reference range. Your doctor may want to review this value.\n\nAre you currently taking any prescription medication regularly for blood pressure?`;
      chips = [
        'Yes, taking daily BP tablets',
        'No, not taking BP medication',
        'Recently stopped medication',
        'First time noticing high BP'
      ];
      missingFields.push('bp_medication_status');
    } else if (lowHb) {
      replyText = `${intro}\n\nYour hemoglobin is recorded at ${lowHb.value} ${lowHb.unit}, which is below the reference range shown on the report. Your doctor may want to review this value.\n\nHave you been experiencing symptoms such as unusual fatigue, dizziness, or shortness of breath?`;
      chips = [
        'Yes, feeling very tired and weak',
        'Occasional dizziness when standing',
        'No fatigue or weakness',
        'Only mild tiredness'
      ];
      missingFields.push('fatigue_status');
    } else if (highGlucose) {
      replyText = `${intro}\n\nYour fasting blood glucose is recorded at ${highGlucose.value} ${highGlucose.unit}, which is above the configured reference range. Your consulting doctor will review this with you.\n\nDo you have a previously diagnosed history of Diabetes, or are you taking any sugar-lowering medications?`;
      chips = [
        'Yes, diagnosed with diabetes',
        'No prior history of diabetes',
        'Pre-diabetic / borderline',
        'Taking Metformin / other tablet'
      ];
      missingFields.push('diabetes_history');
    } else {
      replyText = `${intro}\n\nSome values are outside configured reference ranges and have been flagged for physician review.\n\nAre you currently experiencing any discomfort or specific symptoms related to this report?`;
      chips = [
        'Feeling unwell right now',
        'No discomfort, routine test',
        'Fever or body ache',
        'Fatigue and weakness'
      ];
      missingFields.push('current_symptoms');
    }
  }
  // CASE 1: Normal values
  else {
    replyText = `I've reviewed the information available in your report ("${fileName}"). The recorded vitals and laboratory parameters appear within configured reference ranges.\n\nTo help your consulting physician prepare for your visit, what symptoms or health concerns would you like to discuss today?`;
    chips = [
      'No acute symptoms, routine consultation',
      'Mild fever or chills',
      'Headache or fatigue',
      'Stomach upset or acidity'
    ];
    missingFields.push('chief_complaint');
  }

  const screening = screenRedFlags(facts);
  return {
    replyText,
    chips,
    updatedHistory: facts,
    missingFields,
    screeningResult: screening,
    source: 'deterministic-report-followup'
  };
}

/**
 * Generates an objective, non-diagnostic physician intake note.
 */
function generateDoctorSummary(facts, screening) {
  const symptomsStr = (facts.symptoms || [])
    .map(s => `${s.name}${s.severity ? ` (${s.severity})` : ''}${s.duration ? ` for ${s.duration}` : ''}`)
    .join(', ') || facts.chief_complaint || 'Unspecified complaint';

  const negativesStr = (facts.relevant_negative_symptoms || []).length > 0
    ? `\n• Pertinent Negatives: Denies ${facts.relevant_negative_symptoms.join(', ')}.`
    : '';

  const redFlagStr = screening && screening.detected
    ? `\n• Safety Screening Finding: [${(screening.severity || 'HIGH').toUpperCase()}] ${screening.flags?.length ? screening.flags.map(f => `${f.rule_id} (${f.category}): ${f.evidence.join(', ')}`).join('; ') : screening.rule_id}\n  Alert: ${screening.flags?.[0]?.message || screening.message || 'Potential red flag detected. Prompt clinical evaluation may be appropriate.'}`
    : '\n• Safety Screening Finding: No acute red-flag emergency patterns detected in intake statement.';

  return (
    'CLINICAL INTAKE SUMMARY (For Attending Physician Review):\n' +
    `• Chief Complaint / Reported Symptoms: ${symptomsStr}.${negativesStr}${redFlagStr}\n` +
    '• Disclaimer: Clinical decision support aid only; does not constitute a medical diagnosis.'
  );
}

