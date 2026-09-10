/**
 * Arogya AI - Unified Case Store
 * Persistent repository for patient intake cases shared between Patient and Doctor interfaces.
 * Designed to easily transition to PostgreSQL/Supabase database in production.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { MOCK_CASES } from '../../src/data/mockCases.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DATA_DIR = path.resolve(__dirname, '../data');
const CASES_FILE = path.join(DATA_DIR, 'cases.json');

// In-memory cases map: key = case_id
let casesMap = new Map();

/**
 * Normalizes case structure ensuring both camelCase UI properties and snake_case API properties exist.
 */
export function normalizeCase(c) {
  if (!c) return null;

  const id = c.id || c.case_id || `case-${Date.now()}`;
  const intakeId = c.intakeId || c.intake_id || id.replace('case-', '');

  const patient = {
    name: c.patient?.name || 'Live Patient Intake',
    age: c.patient?.age ?? 35,
    gender: c.patient?.gender || 'Not specified',
    phone: c.patient?.phone || '+91 98765 43210',
    abhaId: c.patient?.abhaId || c.patient?.abha_id || '91-4920-8201-9482',
    bloodGroup: c.patient?.bloodGroup || c.patient?.blood_group || 'B+',
    location: c.patient?.location || 'OPD Digital Intake Terminal',
    emergencyContact: c.patient?.emergencyContact || 'Not reported',
  };

  const messages = c.messages || c.conversation || [];
  const reports = c.reports || c.medical_reports || [];
  const redFlags = c.redFlags || c.red_flags || [];
  const abnormalValues = c.abnormal_values || c.abnormalValues || [];
  const structuredHistory = c.structuredHistory || c.clinical_history || {
    chiefComplaint: c.chiefComplaint || 'Not reported',
    historyOfPresentIllness: 'Not reported',
    pastMedicalHistory: 'Not reported',
    currentMedications: 'Not reported',
    allergies: 'Not reported',
    familyHistory: 'Not reported',
    personalSocialHistory: 'Not reported',
    reviewOfSystems: {
      constitutional: 'Not reported',
      respiratory: 'Not reported',
      gastrointestinal: 'Not reported',
      cardiovascular: 'Not reported',
      neurological: 'Not reported',
      musculoskeletal: 'Not reported',
      dermatological: 'Not reported',
    },
    investigations: 'Not reported',
  };

  const hasRedFlags = Boolean(c.hasRedFlags ?? (redFlags.length > 0));

  // Build doctor-oriented AI summary text (Part 10 format)
  const aiSummaryObj = typeof c.aiSummary === 'object' && c.aiSummary !== null ? c.aiSummary : {
    title: 'AI Clinical Intake Summary',
    chiefComplaint: c.chiefComplaint || 'Clinical consultation',
    hpiChronology: 'Intake conducted conversationally.',
    severity: 'As reported during intake.',
    associatedSymptoms: 'See transcript.',
    currentMedications: 'Not reported',
    relevantMedicalHistory: 'Not reported',
    allergies: 'Not reported',
    uploadedReports: reports.length > 0 ? reports.map(r => r.name).join(', ') : 'None uploaded',
    disclaimer: 'AI-synthesized summary to assist physician evaluation. Please verify directly against patient history.',
  };

  const aiSummaryText = typeof c.ai_summary === 'string' && c.ai_summary.length > 0
    ? c.ai_summary
    : formatDoctorSummaryText({
        chiefComplaint: c.chiefComplaint,
        structuredHistory,
        redFlags,
        reports,
        abnormalValues,
      });

  return {
    id,
    case_id: id,
    intakeId,
    patient,
    intakeTime: c.intakeTime || 'Today, ' + new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true }),
    timestamp: c.timestamp || new Date().toISOString(),
    status: c.status || 'in_progress', // 'in_progress' | 'Interview Completed'
    reviewStatus: c.reviewStatus || 'Needs Review', // 'Needs Review' | 'Reviewed' | 'Accepted'
    triageCategory: c.triageCategory || (hasRedFlags ? 'Priority Review' : 'Routine Review'),
    chiefComplaint: c.chiefComplaint || 'Not reported',
    hasRedFlags,
    redFlags,
    red_flags: redFlags,
    abnormal_values: abnormalValues,
    abnormalValues,
    aiSummary: aiSummaryObj,
    ai_summary: aiSummaryText,
    structuredHistory,
    clinical_history: structuredHistory,
    messages,
    conversation: messages,
    reports,
    medical_reports: reports,
    doctorNotes: c.doctorNotes || '',
    provisionalDiagnosis: c.provisionalDiagnosis || '',
    reviewedAt: c.reviewedAt || null,
    clinicalFacts: c.clinicalFacts || c.clinical_facts || null,
    clinical_facts: c.clinicalFacts || c.clinical_facts || null,
  };
}

/**
 * Formats doctor-oriented summary distinguishing patient reported vs report extracted vs screening alert.
 */
function formatDoctorSummaryText({ chiefComplaint, structuredHistory, redFlags, reports, abnormalValues }) {
  const lines = [];
  lines.push(`Chief Complaint: ${chiefComplaint || 'Not reported'}`);
  lines.push('');
  lines.push(`History (Reported by Patient):`);
  lines.push(`• HPI: ${structuredHistory?.historyOfPresentIllness || 'Recorded during pre-consultation intake.'}`);
  if (structuredHistory?.currentMedications && structuredHistory.currentMedications !== 'Not reported') {
    lines.push(`• Medications: ${structuredHistory.currentMedications}`);
  }
  if (structuredHistory?.allergies && structuredHistory.allergies !== 'Not reported') {
    lines.push(`• Allergies: ${structuredHistory.allergies}`);
  }
  lines.push('');

  lines.push(`Potential Red Flags (Screening Alert — Not a Diagnosis):`);
  if (redFlags && redFlags.length > 0) {
    for (const rf of redFlags) {
      lines.push(`• [${(rf.severity || 'HIGH').toUpperCase()}] ${rf.title || rf.message || rf.rule_id}: ${(rf.evidence || []).join(', ')}`);
    }
  } else {
    lines.push(`• None detected in pre-consultation intake screening.`);
  }
  lines.push('');

  lines.push(`Report Findings (Extracted from Report):`);
  if (reports && reports.length > 0) {
    for (const r of reports) {
      lines.push(`• Document: ${r.name} (${r.status || 'Attached'})`);
    }
    if (abnormalValues && abnormalValues.length > 0) {
      lines.push(`• Abnormal Values Outside Configured Reference Ranges:`);
      for (const a of abnormalValues) {
        lines.push(`  - ${a.test_name || a.parameter}: ${a.value} ${a.unit || ''} (${String(a.status).toUpperCase()}) [Ref: ${a.reference_low ?? ''} - ${a.reference_high ?? ''} ${a.unit || ''}] — Physician review recommended.`);
      }
    } else {
      lines.push(`• Laboratory values within configured reference ranges.`);
    }
  } else {
    lines.push(`• No external medical reports uploaded.`);
  }

  lines.push('');
  lines.push(`* Notice: Non-diagnostic AI clinical intake summary. Attending physician evaluation required.`);
  return lines.join('\n');
}

/**
 * Initialize storage from persistent JSON file or seed from MOCK_CASES.
 */
export function initCaseStore() {
  casesMap.clear();

  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }

    if (fs.existsSync(CASES_FILE)) {
      const fileData = fs.readFileSync(CASES_FILE, 'utf-8');
      const loaded = JSON.parse(fileData);
      if (Array.isArray(loaded) && loaded.length > 0) {
        for (const item of loaded) {
          const norm = normalizeCase(item);
          casesMap.set(norm.id, norm);
        }
        return;
      }
    }
  } catch (err) {
    console.warn('[CaseStore] Error reading saved cases file, falling back to seed data:', err.message);
  }

  // Seed from MOCK_CASES
  for (const c of MOCK_CASES) {
    const norm = normalizeCase(c);
    casesMap.set(norm.id, norm);
  }

  saveCaseStore();
}

/**
 * Save current cases to JSON file.
 */
export function saveCaseStore() {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    const all = Array.from(casesMap.values());
    fs.writeFileSync(CASES_FILE, JSON.stringify(all, null, 2), 'utf-8');
  } catch (err) {
    console.error('[CaseStore] Error saving cases to disk:', err.message);
  }
}

/**
 * Get all cases sorted by timestamp descending.
 */
export function getAllCases() {
  return Array.from(casesMap.values()).sort((a, b) => {
    return new Date(b.timestamp || 0).getTime() - new Date(a.timestamp || 0).getTime();
  });
}

/**
 * Get a single case by ID or intakeId.
 */
export function getCaseById(idOrIntakeId) {
  if (!idOrIntakeId) return null;
  if (casesMap.has(idOrIntakeId)) {
    return casesMap.get(idOrIntakeId);
  }
  for (const c of casesMap.values()) {
    if (c.intakeId === idOrIntakeId || c.id === idOrIntakeId || c.id === `case-${idOrIntakeId}`) {
      return c;
    }
  }
  return null;
}

/**
 * Create or link a new intake case.
 */
export function createCase(initialData = {}) {
  const intakeId = initialData.intakeId || initialData.intake_id || `MED-${Math.floor(10000 + Math.random() * 90000)}`;
  const id = initialData.id || initialData.case_id || `case-${intakeId.toLowerCase().replace(/[^a-z0-9]/g, '')}`;

  // If already exists, return existing
  const existing = getCaseById(id) || getCaseById(intakeId);
  if (existing) {
    return existing;
  }

  const newCase = normalizeCase({
    id,
    case_id: id,
    intakeId,
    patient: initialData.patient || {
      name: initialData.patientName || 'Live Patient Intake',
      age: initialData.patientAge || 32,
      gender: initialData.patientGender || 'Not specified',
      phone: '+91 (Live Session)',
      abhaId: 'ABHA-IN-LIVE',
      bloodGroup: 'Not reported',
      location: 'OPD Digital Intake Terminal',
      emergencyContact: 'Not reported',
    },
    intakeTime: 'Just now',
    timestamp: new Date().toISOString(),
    status: 'in_progress',
    reviewStatus: 'Needs Review',
    triageCategory: 'Routine Review',
    chiefComplaint: initialData.chiefComplaint || 'Pre-consultation clinical intake',
    hasRedFlags: false,
    redFlags: [],
    abnormal_values: [],
    messages: initialData.messages || [],
    reports: [],
    doctorNotes: '',
    provisionalDiagnosis: '',
    reviewedAt: null,
  });

  casesMap.set(id, newCase);
  saveCaseStore();
  return newCase;
}

/**
 * Update case with partial fields.
 */
export function updateCase(idOrIntakeId, patch = {}) {
  const existing = getCaseById(idOrIntakeId);
  if (!existing) return null;

  const updated = normalizeCase({
    ...existing,
    ...patch,
    id: existing.id,
    intakeId: existing.intakeId,
  });

  casesMap.set(existing.id, updated);
  saveCaseStore();
  return updated;
}

/**
 * Record a patient message and AI reply into the case transcript, updating clinical facts, red flags, and summary.
 */
export function addMessageTurnToCase({ caseId, patientMessage, aiReply, facts, screeningResult, chips }) {
  let targetCase = getCaseById(caseId);
  if (!targetCase) {
    targetCase = createCase({ id: caseId, intakeId: caseId?.replace('case-', '') });
  }

  const nowTime = new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true });

  const newMessages = [...targetCase.messages];

  if (patientMessage) {
    newMessages.push({
      id: `patient-${Date.now()}`,
      sender: 'patient',
      text: patientMessage,
      timestamp: nowTime,
    });
  }

  if (aiReply) {
    newMessages.push({
      id: `ai-${Date.now()}`,
      sender: 'ai',
      text: aiReply,
      timestamp: nowTime,
      chips: chips || [],
      screeningResult: screeningResult || null,
      redFlagResult: screeningResult || null,
    });
  }

  // Update chief complaint from first patient message or extracted facts
  let chiefComplaint = targetCase.chiefComplaint;
  if (chiefComplaint === 'Pre-consultation clinical intake' || chiefComplaint === 'Not reported') {
    if (facts?.chief_complaint) {
      chiefComplaint = facts.chief_complaint;
    } else if (patientMessage) {
      chiefComplaint = patientMessage;
    }
  }

  // Red flags integration
  let redFlags = [...(targetCase.redFlags || [])];
  let hasRedFlags = targetCase.hasRedFlags;
  if (screeningResult && screeningResult.detected) {
    hasRedFlags = true;
    const rawFlags = Array.isArray(screeningResult.flags) && screeningResult.flags.length > 0
      ? screeningResult.flags
      : (screeningResult.rule_id ? [screeningResult] : []);
    for (const f of rawFlags) {
      if (!redFlags.some(rf => rf.rule_id === f.rule_id)) {
        redFlags.push({
          id: `rf-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
          rule_id: f.rule_id,
          title: f.title || 'Potential red flag detected — requires prompt review',
          severity: f.severity || 'high',
          description: f.message || 'Potential red flag detected. Prompt clinical evaluation may be appropriate.',
          message: f.message || 'Potential red flag detected. Prompt clinical evaluation may be appropriate.',
          category: f.category || 'Clinical Triage Alert',
          evidence: f.evidence || [],
          clinicalGuidance: f.clinicalGuidance || 'Prompt clinical evaluation advised. Verify vital signs and history.',
        });
      }
    }
  }

  // Update structured clinical history
  const structuredHistory = {
    ...targetCase.structuredHistory,
    chiefComplaint,
    severity: facts?.severity || targetCase.structuredHistory?.severity || targetCase.clinicalFacts?.severity || null,
    symptoms: (facts?.symptoms && facts.symptoms.length > 0) ? facts.symptoms : (targetCase.structuredHistory?.symptoms || targetCase.clinicalFacts?.symptoms || []),
    loss_of_consciousness: typeof facts?.loss_of_consciousness === 'boolean' ? facts.loss_of_consciousness : (targetCase.structuredHistory?.loss_of_consciousness ?? targetCase.clinicalFacts?.loss_of_consciousness ?? null),
    breathing_difficulty: typeof facts?.breathing_difficulty === 'boolean' ? facts.breathing_difficulty : (targetCase.structuredHistory?.breathing_difficulty ?? targetCase.clinicalFacts?.breathing_difficulty ?? null),
    historyOfPresentIllness: facts
      ? `${facts.chief_complaint || chiefComplaint}. Symptoms: ${(facts.symptoms || []).map(s => `${s.name}${s.severity ? ` (${s.severity})` : ''}`).join(', ') || 'Reported'}.${(facts.duration ? ` Duration: ${facts.duration}.` : '')}`
      : targetCase.structuredHistory.historyOfPresentIllness,
    currentMedications: facts?.medications?.length > 0 ? facts.medications.join(', ') : targetCase.structuredHistory.currentMedications,
    pastMedicalHistory: facts?.past_medical_history?.length > 0 ? facts.past_medical_history.join(', ') : targetCase.structuredHistory.pastMedicalHistory,
    allergies: facts?.allergies?.length > 0 ? facts.allergies.join(', ') : targetCase.structuredHistory.allergies,
    reviewOfSystems: {
      ...targetCase.structuredHistory.reviewOfSystems,
      neurological: facts?.loss_of_consciousness ? 'Patient experienced syncope/loss of consciousness' : (facts?.loss_of_consciousness === false ? 'Denies loss of consciousness' : targetCase.structuredHistory.reviewOfSystems.neurological),
      respiratory: facts?.breathing_difficulty ? 'Patient reported difficulty breathing' : (facts?.breathing_difficulty === false ? 'Denies breathing difficulty' : targetCase.structuredHistory.reviewOfSystems.respiratory),
    }
  };

  const clinicalFacts = {
    ...(targetCase.clinicalFacts || {}),
    ...(facts || {}),
  };
  if (facts?.symptoms && Array.isArray(facts.symptoms) && facts.symptoms.length > 0) {
    clinicalFacts.symptoms = facts.symptoms;
  }

  const triageCategory = hasRedFlags ? 'Priority Review' : targetCase.triageCategory;

  const aiSummaryObj = {
    ...targetCase.aiSummary,
    chiefComplaint,
    hpiChronology: structuredHistory.historyOfPresentIllness,
    associatedSymptoms: (facts?.symptoms || []).map(s => s.name).join(', ') || 'Recorded in dialogue',
    currentMedications: structuredHistory.currentMedications,
    relevantMedicalHistory: structuredHistory.pastMedicalHistory,
    allergies: structuredHistory.allergies,
  };

  const aiSummaryText = formatDoctorSummaryText({
    chiefComplaint,
    structuredHistory,
    redFlags,
    reports: targetCase.reports,
    abnormalValues: targetCase.abnormal_values,
  });

  return updateCase(targetCase.id, {
    chiefComplaint,
    hasRedFlags,
    redFlags,
    triageCategory,
    messages: newMessages,
    conversation: newMessages,
    structuredHistory,
    clinical_history: structuredHistory,
    clinicalFacts,
    clinical_facts: clinicalFacts,
    aiSummary: aiSummaryObj,
    ai_summary: aiSummaryText,
  });
}

/**
 * Attach an uploaded & evaluated report to the case.
 */
export function addReportToCase({ caseId, reportPayload }) {
  let targetCase = getCaseById(caseId);
  if (!targetCase) {
    targetCase = createCase({ id: caseId, intakeId: caseId?.replace('case-', '') });
  }

  const reportId = reportPayload.id || `rep_${Date.now()}`;
  const reportName = reportPayload.name || reportPayload.fileName || 'Medical Report';
  const rawText = reportPayload.rawText || reportPayload.rawTextPreview || '';

  // Transform evaluated laboratory parameters into UI extractedData format
  const labResults = reportPayload.laboratoryResults || reportPayload.evaluatedAbnormalities || [];
  const vitals = reportPayload.vitals || [];

  const allMetrics = [...vitals, ...labResults];
  const extractedData = allMetrics.map((m) => {
    const isOutside = m.status === 'high' || m.status === 'low' || m.status === 'Outside reference range';
    const rangeStr = (m.reference_low !== undefined && m.reference_high !== undefined)
      ? `${m.reference_low} - ${m.reference_high} ${m.unit || ''}`
      : (m.referenceRange || 'Reference range not specified on report');

    return {
      parameter: m.test_name || m.parameter || m.name || 'Laboratory Parameter',
      value: `${m.value} ${m.unit || ''}`.trim(),
      referenceRange: rangeStr,
      status: isOutside ? 'Outside reference range' : (m.status === 'unknown' ? 'Unknown reference range' : 'Within reference range'),
      clinicalNote: isOutside
        ? `${m.status === 'high' ? 'Above' : 'Below'} configured reference range — physician review recommended.`
        : 'Within configured reference range.',
      rawMetric: m,
    };
  });

  // Extract abnormal values for case.abnormal_values
  const newAbnormal = allMetrics
    .filter(m => m.status === 'high' || m.status === 'low')
    .map(m => ({
      test_name: m.test_name || m.name,
      value: m.value,
      unit: m.unit || '',
      reference_low: m.reference_low ?? null,
      reference_high: m.reference_high ?? null,
      status: m.status,
      source: 'report',
      note: `${m.status === 'high' ? 'Above' : 'Below'} configured reference range — physician review recommended.`
    }));

  const combinedAbnormal = [...(targetCase.abnormal_values || [])];
  for (const ab of newAbnormal) {
    if (!combinedAbnormal.some(x => x.test_name === ab.test_name)) {
      combinedAbnormal.push(ab);
    }
  }

  const newReportEntry = {
    id: reportId,
    name: reportName,
    type: reportPayload.fileType || 'application/pdf',
    size: reportPayload.size || '15 KB',
    uploadedAt: new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true }),
    status: reportPayload.extractionStatus === 'failed' ? 'Attached (Manual Review Required)' : 'Verified Document',
    documentCategory: reportPayload.documentType || 'Diagnostic Lab Report',
    laboratory: reportPayload.laboratory || 'Clinical Diagnostic Record',
    rawText,
    extractedData,
    vitals,
    laboratoryResults: labResults,
  };

  const updatedReports = [...(targetCase.reports || []), newReportEntry];

  // Update structuredHistory with investigation notes
  const structuredHistory = {
    ...targetCase.structuredHistory,
    investigations: updatedReports.map(r => `${r.name} (${r.extractedData.length} parameters extracted)`).join('; '),
  };

  const aiSummaryText = formatDoctorSummaryText({
    chiefComplaint: targetCase.chiefComplaint,
    structuredHistory,
    redFlags: targetCase.redFlags,
    reports: updatedReports,
    abnormalValues: combinedAbnormal,
  });

  const aiSummaryObj = {
    ...targetCase.aiSummary,
    uploadedReports: updatedReports.map(r => `${r.name} (${r.size})`).join(', '),
  };

  return updateCase(targetCase.id, {
    reports: updatedReports,
    medical_reports: updatedReports,
    abnormal_values: combinedAbnormal,
    abnormalValues: combinedAbnormal,
    structuredHistory,
    clinical_history: structuredHistory,
    aiSummary: aiSummaryObj,
    ai_summary: aiSummaryText,
  });
}

/**
 * Save physician clinical notes and provisional diagnosis.
 */
export function saveDoctorNotes(caseId, { doctorNotes, provisionalDiagnosis, reviewStatus = 'Reviewed' }) {
  const targetCase = getCaseById(caseId);
  if (!targetCase) return null;

  const reviewedAt = `${new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })} at ${new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true })} (IST) by Dr. Ananya Sharma`;

  return updateCase(targetCase.id, {
    doctorNotes: doctorNotes !== undefined ? doctorNotes : targetCase.doctorNotes,
    provisionalDiagnosis: provisionalDiagnosis !== undefined ? provisionalDiagnosis : targetCase.provisionalDiagnosis,
    reviewStatus,
    reviewedAt,
  });
}

// Automatically initialize store on module load
initCaseStore();
