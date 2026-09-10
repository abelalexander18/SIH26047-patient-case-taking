/**
 * Arogya AI — Backend Intelligence Bridge
 * Connects Node.js API Gateway to Member 6 Python Intelligence Microservice (FastAPI on :8006).
 * Orchestrates:
 * 1. OpenAI Natural Language Understanding & Clinical Fact Extraction
 * 2. Deterministic Red Flag Screening (11 Rules)
 * 3. Dynamic Single Follow-Up Questioning for Missing Acute Discriminators
 * 4. Document OCR & Lab Biomarker Abnormality Evaluation
 * 5. Non-diagnostic Physician Intake Summary Generation
 * 
 * Supports automatic offline fallback so the UI never crashes.
 */

const PYTHON_SERVICE_URL = process.env.PYTHON_SERVICE_URL || 'http://127.0.0.1:8006';
import { processClinicalDialogue, generateReportFollowUpTurn } from './services/openaiService.mjs';

export { generateReportFollowUpTurn };

/**
 * Generate contextual suggestion chips based on the active clinical target field.
 */
export const getChipsForTargetField = (targetField) => {
  switch (targetField) {
    case 'unable_to_keep_fluids':
      return [
        'No, I throw up any water immediately.',
        'Yes, I can drink water and fluids normally.'
      ];
    case 'blood_in_vomit':
      return [
        'No blood in my vomit.',
        'Yes, throwing up dark coffee-ground looking blood.'
      ];
    case 'loss_of_consciousness':
      return [
        'No fainting or blackouts.',
        'Yes, I fainted and lost consciousness.'
      ];
    case 'breathing_difficulty':
      return [
        'No shortness of breath.',
        'Yes, I have severe trouble breathing.'
      ];
    case 'headache_severity':
      return [
        'Mild (manageable, dull ache)',
        'Moderate (noticeable discomfort)',
        'Severe (worst headache of my life, 10/10)'
      ];
    case 'neurological_deficits':
      return [
        'No facial drooping or speech problems.',
        'Yes, one-sided weakness or facial drooping.'
      ];
    case 'confusion':
      return [
        'Clear-headed and oriented.',
        'Feeling confused, disoriented, or foggy.'
      ];
    default:
      return [
        'Started since morning',
        'Past 2 to 3 days',
        'Mild to moderate intensity',
        'No prior conditions'
      ];
  }
};

/**
 * Process a conversational intake turn via the Intelligence Microservice.
 * 
 * @param {Object} params
 * @param {string} params.message - Patient statement
 * @param {Object} [params.existingHistory] - Current structured ClinicalHistory state
 * @param {Array} [params.conversationHistory] - Previous conversation messages
 * @returns {Promise<Object>} Formatted intake turn result
 */
export const processIntakeTurn = async ({
  message,
  existingHistory = null,
  conversationHistory = [],
  reportContext = null,
}) => {
  // If reportContext is active, process through the report-aware clinical dialogue service
  if (reportContext && (reportContext.reportAnalysis?.hasAbnormalValues || reportContext.reportData?.vitals || (reportContext.reportData?.laboratoryResults && reportContext.reportData.laboratoryResults.length > 0))) {
    try {
      const aiResult = await processClinicalDialogue({
        patientMessage: message,
        conversationHistory,
        structuredHistory: existingHistory,
        reportContext,
      });

      const hasNext = Boolean(aiResult.next_question && (aiResult.missing_relevant_information || []).length > 0);
      return {
        replyText: aiResult.patient_friendly_response || aiResult.next_question,
        progress: hasNext ? Math.max(35, 100 - (aiResult.missing_relevant_information.length * 25)) : 100,
        chips: (aiResult.quick_replies && aiResult.quick_replies.length > 0)
          ? aiResult.quick_replies
          : (hasNext ? ['Continue'] : ['End Interview & View Summary']),
        stageTitle: hasNext ? `Clinical Clarification: ${aiResult.missing_relevant_information[0]}` : 'Intake Complete',
        updatedHistory: aiResult.clinical_facts,
        screeningResult: aiResult.screening_result,
        missingFields: aiResult.missing_relevant_information || [],
        doctorSummary: aiResult.doctor_summary || '',
        source: aiResult.source || 'node-clinical-dialogue'
      };
    } catch (nodeErr) {
      console.warn('[IntelligenceBridge] Node report processing failed, trying microservice:', nodeErr.message);
    }
  }

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 6000);

    // Map frontend conversation to OpenAI role format
    const formattedHistory = (conversationHistory || [])
      .filter((m) => m && m.text)
      .map((m) => ({
        role: m.sender === 'ai' ? 'assistant' : 'user',
        content: m.text
      }));

    const payload = {
      message: message.trim(),
      existing_history: existingHistory,
      conversation_history: formattedHistory,
      report_context: reportContext
    };

    const response = await fetch(`${PYTHON_SERVICE_URL}/api/ai/intake-message`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      signal: controller.signal
    });

    clearTimeout(timeoutId);

    if (response.ok) {
      const data = await response.json();
      const followUp = data.follow_up_question;
      const screening = data.screening_result || {};
      const missingCount = (data.missing_critical_fields || []).length;

      // Calculate progress adaptively
      let progress = 100;
      let replyText = '';
      let chips = [];

      if (followUp && followUp.question) {
        replyText = followUp.question;
        chips = getChipsForTargetField(followUp.target_field);
        progress = Math.min(90, Math.max(30, 100 - (missingCount * 25)));
      } else {
        replyText = "Dhanyavaad. I have recorded all pertinent clinical details for your attending physician. Your pre-consultation summary is ready for doctor review. Please click 'End Interview' to view your intake report.";
        chips = ["End Interview & View Summary"];
        progress = 100;
      }

      return {
        replyText,
        progress,
        chips,
        stageTitle: followUp ? `Clinical Clarification: ${followUp.target_field?.replace(/_/g, ' ') || 'Symptoms'}` : 'Intake Complete',
        updatedHistory: data.updated_history,
        screeningResult: screening,
        missingFields: data.missing_critical_fields || [],
        doctorSummary: data.doctor_summary || '',
        source: 'openai-intelligence-bridge'
      };
    }
  } catch (err) {
    console.warn('[IntelligenceBridge] Python service call failed or offline, evaluating via Node RedFlagEngine:', err.message);
  }

  // Graceful Fallback via Node Server-Side AI & Deterministic RedFlagEngine
  try {
    const aiResult = await processClinicalDialogue({
      patientMessage: message,
      conversationHistory,
      structuredHistory: existingHistory,
      reportContext,
    });

    const hasNext = Boolean(aiResult.next_question && (aiResult.missing_relevant_information || []).length > 0);
    return {
      replyText: aiResult.patient_friendly_response || aiResult.next_question,
      progress: hasNext ? Math.max(35, 100 - (aiResult.missing_relevant_information.length * 25)) : 100,
      chips: (aiResult.quick_replies && aiResult.quick_replies.length > 0)
        ? aiResult.quick_replies
        : (hasNext ? ['Continue'] : ['End Interview & View Summary']),
      stageTitle: hasNext ? `Clinical Clarification: ${aiResult.missing_relevant_information[0]}` : 'Intake Complete',
      updatedHistory: aiResult.clinical_facts,
      screeningResult: aiResult.screening_result,
      missingFields: aiResult.missing_relevant_information || [],
      doctorSummary: aiResult.doctor_summary || '',
      source: aiResult.source || 'node-redflag-engine'
    };
  } catch (fallbackErr) {
    console.error('[IntelligenceBridge] Node fallback failed, using safe static receipt:', fallbackErr);
    return fallbackResponse(message);
  }
};

/**
 * Process uploaded medical report (PDF, PNG, JPG) through Document OCR & Abnormality Detector.
 * 
 * @param {Buffer} fileBuffer - Raw file buffer
 * @param {string} filename - Original filename
 * @param {string} mimeType - MIME type
 * @returns {Promise<Object>} Evaluated report results
 */
export const processReportDocument = async (fileBuffer, filename, mimeType) => {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000);

    const formData = new FormData();
    const blob = new Blob([fileBuffer], { type: mimeType });
    formData.append('file', blob, filename);

    const response = await fetch(`${PYTHON_SERVICE_URL}/api/ocr/process-report`, {
      method: 'POST',
      body: formData,
      signal: controller.signal
    });

    clearTimeout(timeoutId);

    if (response.ok) {
      const data = await response.json();
      return {
        id: `ocr_rep_${Date.now()}`,
        name: filename,
        documentType: data.document_type,
        extractionStatus: data.extraction_status,
        evaluatedAbnormalities: data.evaluated_abnormalities || [],
        rawTextPreview: (data.raw_text || '').substring(0, 300),
        limitationNotes: data.limitation_notes || [],
        size: `${(fileBuffer.length / 1024).toFixed(1)} KB`,
        source: 'real-ocr-pipeline'
      };
    }
  } catch (err) {
    console.warn('[IntelligenceBridge] OCR microservice call failed, using fallback:', err.message);
  }

  // Graceful fallback receipt with local text extraction & configurable reference-range evaluation
  const rawText = fileBuffer.toString('utf-8');
  const evaluated = evaluateExtractedValues(rawText);
  return {
    id: `ocr_rep_${Date.now()}`,
    name: filename,
    documentType: evaluated.length > 0 ? 'Lab Report' : 'Medical Document',
    extractionStatus: evaluated.length > 0 ? 'success' : 'uncertain',
    evaluatedAbnormalities: evaluated,
    rawTextPreview: rawText.substring(0, 300),
    limitationNotes: [
      'Prototype extraction notice: Designed for printed electronic lab documents; handwriting recognition is not supported.'
    ],
    size: `${(fileBuffer.length / 1024).toFixed(1)} KB`,
    source: 'local-node-ocr-pipeline'
  };
};

const CONFIGURABLE_REFERENCE_RANGES = [
  {
    test_name: 'Hemoglobin',
    pattern: /(?:hemoglobin|hb|hgb)[\s:=]+([0-9]{1,2}(?:\.[0-9]+)?)/i,
    low: 12.0,
    high: 16.0,
    unit: 'g/dL'
  },
  {
    test_name: 'Fasting Blood Glucose',
    pattern: /(?:fasting\s*blood\s*(?:sugar|glucose)|fbs|blood\s*glucose|blood\s*sugar)[\s:=]+([0-9]{2,3}(?:\.[0-9]+)?)/i,
    low: 70.0,
    high: 100.0,
    unit: 'mg/dL'
  },
  {
    test_name: 'Serum Creatinine',
    pattern: /(?:serum\s*creatinine|creatinine|creat)[\s:=]+([0-9]{1,2}(?:\.[0-9]+)?)/i,
    low: 0.6,
    high: 1.3,
    unit: 'mg/dL'
  },
  {
    test_name: 'Platelet Count',
    pattern: /(?:platelet(?:\s*count)?|plt)[\s:=]+([0-9]+)/i,
    low: 150000,
    high: 450000,
    unit: '/uL'
  },
  {
    test_name: 'Total Leukocyte Count (WBC)',
    pattern: /(?:total\s*leukocyte\s*count|wbc(?:\s*count)?|tlc)[\s:=]+([0-9]+)/i,
    low: 4000,
    high: 11000,
    unit: '/uL'
  }
];

function evaluateExtractedValues(rawText) {
  const evaluated = [];
  for (const ref of CONFIGURABLE_REFERENCE_RANGES) {
    const match = rawText.match(ref.pattern);
    if (match) {
      const val = parseFloat(match[1]);
      if (!isNaN(val)) {
        let status = 'normal';
        let flagged = false;
        let message = 'Value is within the configured reference range.';

        if (val < ref.low) {
          status = 'low';
          flagged = true;
          message = 'Outside configured reference range — physician review recommended.';
        } else if (val > ref.high) {
          status = 'high';
          flagged = true;
          message = 'Outside configured reference range — physician review recommended.';
        }

        evaluated.push({
          test_name: ref.test_name,
          value: val,
          raw_value: String(val),
          unit: ref.unit,
          reference_low: ref.low,
          reference_high: ref.high,
          status,
          message,
          flagged,
          source: 'ocr',
          disclaimer: 'Non-diagnostic observation. Value evaluated solely against configured reference range. Does not constitute a medical diagnosis or disease identification.'
        });
      }
    }
  }
  return evaluated;
}


/**
 * Built-in safety fallback when Python microservice is temporarily unreachable.
 */
function fallbackResponse(text) {
  const lower = (text || '').toLowerCase();
  let replyText = "Thank you for sharing that. How long have you experienced these symptoms, and does anything make them better or worse?";
  let chips = [
    "Started since morning",
    "Past 2 to 3 days",
    "Comes and goes intermittently",
    "Mild to moderate"
  ];

  if (lower.includes('fever') || lower.includes('bukhar')) {
    replyText = "Noted regarding the fever. When did the fever start, and are you experiencing chills or body ache?";
    chips = ["Fever started today", "High fever with chills", "Low grade fever"];
  } else if (lower.includes('headache') || lower.includes('sir dard')) {
    replyText = "I understand you have head pain. Did you experience any dizziness, nausea, or loss of consciousness?";
    chips = ["No fainting or blackouts", "Mild dizziness", "Severe headache"];
  } else if (lower.includes('vomit') || lower.includes('nausea')) {
    replyText = "Noted regarding the vomiting. Have you been able to keep any water or fluids down?";
    chips = ["Can drink water fine", "Cannot keep fluids down", "No blood in vomit"];
  }

  return {
    replyText,
    progress: 50,
    chips,
    stageTitle: 'Symptom Assessment',
    updatedHistory: null,
    screeningResult: {
      detected: false,
      severity: 'none',
      category: 'none',
      message: 'System running on local fallback mode.',
      recommendation: 'Standard physician consultation recommended.'
    },
    missingFields: [],
    doctorSummary: 'Intake recorded under local fallback mode.',
    source: 'local-fallback'
  };
}
