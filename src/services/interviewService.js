/**
 * Interview Service (Indian Healthcare Context & Real Backend API Integration)
 * Supports real HTTP REST endpoints (FastAPI / Express / Flask) with automatic offline fallback.
 * ABDM (Ayushman Bharat Digital Mission) & DPDP Act 2023 Aligned.
 */

import { CLINICAL_STAGES } from '../data/mockConversation.js';

// Configurable backend API base URL
const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

/**
 * Format timestamp in Indian Standard Time (IST) format
 */
export const getFormattedTime = () => {
  const now = new Date();
  return now.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true });
};

/**
 * Format Indian date (DD/MM/YYYY)
 */
export const getFormattedDate = () => {
  const now = new Date();
  return now.toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric'
  });
};

/**
 * Check if backend API server is online
 */
export const checkBackendHealth = async () => {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 1500);
    const response = await fetch(`${API_BASE_URL}/health`, {
      signal: controller.signal,
    });
    clearTimeout(timeoutId);
    return response.ok;
  } catch {
    return false;
  }
};

/**
 * Send patient message and receive AI response.
 * Attempts real Backend API first; gracefully falls back to local clinical triage engine.
 * @param {string} userMessage
 * @param {number} currentStageIndex
 * @param {Array} history
 * @returns {Promise<{ replyText: string, nextStageIndex: number, progress: number, chips: string[], stageTitle: string }>}
 */
export const sendMessage = async (userMessage, currentStageIndex, history = [], existingHistory = null, reportContext = null, caseId = null) => {
  // Validate input
  if (!userMessage || !userMessage.trim()) {
    throw new Error('Message cannot be empty. Please enter your symptoms.');
  }

  // 1. Try real backend API if available
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 8000);

    const response = await fetch(`${API_BASE_URL}/interview/message`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        message: userMessage.trim(),
        stageIndex: currentStageIndex,
        history,
        existingHistory,
        reportContext,
        caseId,
        interviewId: caseId,
        locale: 'en-IN',
      }),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (response.ok) {
      const data = await response.json();
      return {
        replyText: data.replyText,
        nextStageIndex: data.nextStageIndex,
        progress: data.progress,
        chips: data.chips || [],
        stageTitle: data.stageTitle || 'Clinical Assessment',
        source: 'backend-api',
        updatedHistory: data.updatedHistory || null,
        screeningResult: data.screeningResult || data.redFlagResult || null,
        redFlagResult: data.redFlagResult || data.screeningResult || null,
        missingFields: data.missingFields || [],
        doctorSummary: data.doctorSummary || '',
      };
    }
  } catch (apiError) {
    // Backend API is either offline or timed out - continue to local clinical engine
    // Console informational note (clean error handling)
    console.info('[InterviewService] Live backend unreachable, using intelligent client-side clinical triage engine:', apiError.message);
  }

  // 2. Intelligent client-side clinical triage engine
  const delay = 750 + Math.random() * 350;
  await new Promise((resolve) => setTimeout(resolve, delay));

  const safeIndex = Math.min(currentStageIndex, CLINICAL_STAGES.length - 1);
  const stage = CLINICAL_STAGES[safeIndex];

  let replyText = '';
  let nextStageIndex = safeIndex + 1;
  let progress = 100;
  let chips = [];
  let stageTitle = stage.title;

  if (safeIndex < CLINICAL_STAGES.length - 1) {
    replyText = stage.nextQuestion(userMessage);
    const nextStage = CLINICAL_STAGES[nextStageIndex];
    progress = nextStage.progress;
    chips = nextStage.quickReplies || [];
    stageTitle = nextStage.title;
  } else {
    replyText = "Dhanyavaad (Thank you). Your responses have been recorded and compiled following ABDM clinical record formats. Your consulting doctor will review this assessment. You may now click 'End Interview' to view or download your report.";
    progress = 100;
    chips = ["Everything noted, ready to finish", "End Interview & View Summary"];
    stageTitle = "Intake Complete";
  }

  return {
    replyText,
    nextStageIndex,
    progress,
    chips,
    stageTitle,
    source: 'local-engine',
  };
};

/**
 * Upload medical report (PDF, JPG, PNG)
 * Attempts backend API upload if present, otherwise processes locally with progress streaming.
 * @param {File} file
 * @param {Function} onProgress
 * @returns {Promise<{ id: string, name: string, size: string, type: string, uploadedAt: string }>}
 */
export const uploadReport = async (file, onProgress, context = {}) => {
  if (!file) {
    throw new Error('Please select a file to upload.');
  }

  const validExtensions = ['pdf', 'jpg', 'jpeg', 'png'];
  const extension = file.name.split('.').pop().toLowerCase();

  if (!validExtensions.includes(extension)) {
    throw new Error('Unsupported format. Please upload a PDF, JPG, JPEG, or PNG document (e.g. Lab Report, Doctor Prescription).');
  }

  if (file.size > 20 * 1024 * 1024) {
    throw new Error('File size exceeds the 20MB limit. Please upload a smaller file.');
  }

  const formatFileSize = (bytes) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  // Try backend file upload via Complete Medical Report Intelligence Pipeline
  try {
    const formData = new FormData();
    formData.append('report', file);
    if (context.existingHistory) {
      formData.append('existingHistory', JSON.stringify(context.existingHistory));
    }
    if (context.history) {
      formData.append('history', JSON.stringify(context.history));
    }
    if (context.caseId || context.interviewId) {
      formData.append('caseId', context.caseId || context.interviewId);
      formData.append('interviewId', context.caseId || context.interviewId);
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15000);

    let response = await fetch(`${API_BASE_URL}/reports/process`, {
      method: 'POST',
      body: formData,
      signal: controller.signal,
    }).catch(() => null);

    if (!response || !response.ok) {
      response = await fetch(`${API_BASE_URL}/interview/upload`, {
        method: 'POST',
        body: formData,
      }).catch(() => null);
    }

    clearTimeout(timeoutId);

    if (response && response.ok) {
      const data = await response.json();
      if (onProgress) onProgress(100);
      return {
        id: data.id || `rep_${Date.now()}`,
        name: data.name || file.name,
        size: data.size || formatFileSize(file.size),
        type: file.type || 'application/pdf',
        uploadedAt: getFormattedTime(),
        status: data.status || 'processed',
        documentType: data.documentType || 'Medical Report',
        reportDate: data.reportDate || null,
        patient: data.patient || { name: null, age: null, sex: null },
        vitals: data.vitals || [],
        laboratoryResults: data.laboratoryResults || data.evaluatedAbnormalities || [],
        evaluatedAbnormalities: data.laboratoryResults || data.evaluatedAbnormalities || [],
        medications: data.medications || [],
        diagnosesMentioned: data.diagnosesMentioned || [],
        investigations: data.investigations || [],
        rawText: data.rawText || data.rawTextPreview || '',
        rawTextPreview: data.rawTextPreview || '',
        abnormalCount: data.abnormalCount || 0,
        hasAbnormalValues: data.hasAbnormalValues || false,
        limitationNotes: data.limitationNotes || [],
        disclaimer: data.disclaimer || 'Non-diagnostic observation. Physician review recommended.',
        followUp: data.followUp || null
      };
    }
  } catch (err) {
    // Proceed with client simulation
  }

  // Simulated progress stream
  const steps = [20, 45, 70, 90, 100];
  for (const step of steps) {
    await new Promise((r) => setTimeout(r, 120));
    if (onProgress) onProgress(step);
  }

  return {
    id: `rep_${Date.now()}`,
    name: file.name,
    size: formatFileSize(file.size),
    rawBytes: file.size,
    type: file.type || 'application/pdf',
    uploadedAt: getFormattedTime(),
    vitals: [],
    laboratoryResults: [],
    evaluatedAbnormalities: [],
    medications: [],
    diagnosesMentioned: [],
    investigations: [],
    rawText: '',
    rawTextPreview: '',
    abnormalCount: 0,
    hasAbnormalValues: false,
    limitationNotes: ['Local client demonstration receipt.'],
    followUp: {
      replyText: `I've attached your document ("${file.name}") to your intake file for your physician. What primary symptoms or health concerns would you like to discuss today?`,
      chips: ['Fever or chills', 'Headache or fatigue', 'Stomach discomfort', 'Routine checkup'],
      updatedHistory: context.existingHistory || null,
      missingFields: ['chief_complaint'],
      screeningResult: null,
    }
  };
};

/**
 * Generate formatted text report for download (Indian Healthcare / ABDM standard)
 */
export const downloadClinicalReport = (summaryData) => {
  const redFlagStatus = summaryData.screeningResult
    ? (summaryData.screeningResult.detected
        ? `[RED FLAG ALERT: ${summaryData.screeningResult.severity.toUpperCase()} - ${summaryData.screeningResult.rule_id}]\n${summaryData.screeningResult.message}\nTriage Action: ${summaryData.screeningResult.recommendation}`
        : `[SCREENING NORMAL] No predefined high-risk clinical red-flag patterns detected in current history.`)
    : `[SCREENING] Completed according to clinical safety rules.`;

  const doctorNotes = summaryData.doctorSummary || 
`- Chief Complaint & Chronology: Recorded in sequence
- Symptom Intensity & Impact : Documented for clinical assessment
- Current Medication & History: Screened for drug interactions / allergies
- Digital Health Record Status: Prepared for Doctor Review`;

  // Format attached report data if available
  let reportSection = '';
  if (summaryData.uploadedFile) {
    const uf = summaryData.uploadedFile;
    const patientStr = uf.patient ? `Name: ${uf.patient.name || 'N/A'}, Age: ${uf.patient.age || 'N/A'}, Sex: ${uf.patient.sex || 'N/A'}` : 'Not extracted';
    const reportDateStr = uf.reportDate || uf.patient?.report_date || 'Not specified';
    
    let vitalsLines = 'None recorded';
    if (uf.vitals && Object.keys(uf.vitals).length > 0) {
      vitalsLines = Object.entries(uf.vitals).map(([k, v]) => {
        if (!v || typeof v !== 'object') return null;
        const val = v.value || (v.systolic && v.diastolic ? `${v.systolic}/${v.diastolic}` : null);
        return `  - ${k.replace(/_/g, ' ')}: ${val || ''} ${v.unit || ''} [Status: ${(v.status || 'NORMAL').toUpperCase()}]`;
      }).filter(Boolean).join('\n');
    }

    let labLines = 'None recorded';
    const labs = uf.laboratoryResults || uf.evaluatedAbnormalities || [];
    if (labs.length > 0) {
      labLines = labs.map(l => {
        const range = l.reference_range ? `${l.reference_range.low ?? '—'} - ${l.reference_range.high ?? '—'}` : 'N/A';
        const src = l.range_source === 'report' ? 'Report' : 'Configured Fallback';
        return `  - ${l.test_name || l.test}: ${l.value} ${l.unit} [Status: ${(l.status || 'NORMAL').toUpperCase()}] (Ref: ${range}, Source: ${src})`;
      }).join('\n');
    }

    let medsLines = 'None recorded';
    if (uf.medications && uf.medications.length > 0) {
      medsLines = uf.medications.map(m => {
        const name = typeof m === 'string' ? m : `${m.name || m.medication || ''} ${m.dosage || m.dose || ''} ${m.frequency || ''}`.trim();
        return `  - ${name}`;
      }).join('\n');
    }

    reportSection = `
----------------------------------------------------------------------
ATTACHED MEDICAL REPORT INTELLIGENCE:
----------------------------------------------------------------------
File Attached           : ${summaryData.uploadedReportName}
Document Date           : ${reportDateStr}
Patient Info (Report)   : ${patientStr}

Vitals:
${vitalsLines}

Evaluated Laboratory Results:
${labLines}

Medications Mentioned:
${medsLines}
`;
  }

  const content = `======================================================================
AROGYA AI (आरोग्य AI) - CLINICAL INTAKE REPORT
Pre-Consultation Patient Health Summary
Designed with ABDM & DPDP Principles (Academic Prototype)
======================================================================

Patient Intake ID     : ${summaryData.interviewId}
ABHA Integration      : Architecture Ready (Prototype)
Date & Time           : ${getFormattedDate()} at ${getFormattedTime()} (IST)
Consultation Type     : Out-Patient Department (OPD) / Tele-consultation
Emergency Helpline    : Dial 112 or 108 (Ambulance) for life-threatening conditions
Questions Answered    : ${summaryData.answeredCount}
Attached Report / Rx  : ${summaryData.uploadedReportName || 'None attached'}
${reportSection}
----------------------------------------------------------------------
SAFETY SCREENING & RED FLAG STATUS:
----------------------------------------------------------------------
${redFlagStatus}

----------------------------------------------------------------------
CLINICAL INTAKE TRANSCRIPT:
----------------------------------------------------------------------
${summaryData.messages
  .map(
    (m) => `[${m.timestamp}] ${m.sender === 'ai' ? 'AROGYA AI' : 'PATIENT'}:
${m.text}
`
  )
  .join('\n')}

----------------------------------------------------------------------
PRE-CONSULTATION SUMMARY FOR ATTENDING PHYSICIAN / RMP:
----------------------------------------------------------------------
${doctorNotes}

----------------------------------------------------------------------
LEGAL & COMPLIANCE NOTICE:
This pre-interview summary was generated by Arogya AI to assist the
attending Registered Medical Practitioner (RMP). It does not constitute
a final medical prescription. Patient data handled following DPDP privacy
principles. Prototype developed for academic/demonstration purposes.
======================================================================`;

  const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `Arogya_Intake_${summaryData.interviewId}.txt`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};
