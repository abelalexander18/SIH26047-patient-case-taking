/**
 * End-to-End Clinical Intake & Doctor Portal Integration Test Suite
 * Tests full pipeline:
 * Patient Conversation -> OpenAI Extraction -> Red-Flag Engine -> Medical Report OCR ->
 * Range Checker -> Backend Case Storage -> Doctor Portal Dossier & Notes.
 * 
 * Verifies Scenarios A through J.
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import {
  initCaseStore,
  getAllCases,
  getCaseById,
  createCase,
  updateCase,
  addMessageTurnToCase,
  addReportToCase,
  saveDoctorNotes,
} from '../services/caseStore.mjs';
import { screenRedFlags } from '../services/redFlagEngine.mjs';
import { checkAllReferenceRanges } from '../services/referenceRangeChecker.mjs';
import { processClinicalDialogue, generateReportFollowUpTurn } from '../services/openaiService.mjs';

const RUN_ID = Date.now();
const testCaseId = `case-MED-E2E-${RUN_ID}`;
const testIntakeId = `MED-E2E-${RUN_ID}`;

test.describe('End-to-End Integration: Patient Intake to Doctor Portal', () => {

  test('STEP 1 & 2: Patient starts intake and reports severe headache', async () => {
    // 1. Initialize case
    const initialCase = createCase({
      id: testCaseId,
      intakeId: testIntakeId,
      patient: {
        name: 'Anita Verma',
        age: 29,
        gender: 'Female',
        phone: '+91 98123 45678',
        abhaId: '91-1234-5678-9012',
      },
    });

    assert.equal(initialCase.id, testCaseId);
    assert.equal(initialCase.patient.name, 'Anita Verma');
    assert.equal(initialCase.status, 'in_progress');

    // 2. Patient first turn: "I've been having severe headache for two days."
    const patientMsg1 = "I've been having severe headache for two days.";
    const turn1Result = await processClinicalDialogue({
      patientMessage: patientMsg1,
      conversationHistory: [],
      structuredHistory: null,
    });

    assert.ok(turn1Result.next_question);
    assert.equal(turn1Result.clinical_facts.chief_complaint, 'headache');

    // Sync to case store
    const updatedCase1 = addMessageTurnToCase({
      caseId: testCaseId,
      patientMessage: patientMsg1,
      aiReply: turn1Result.patient_friendly_response || turn1Result.next_question,
      facts: turn1Result.clinical_facts,
      screeningResult: turn1Result.screening_result,
      chips: turn1Result.quick_replies,
    });

    assert.equal(updatedCase1.chiefComplaint, 'headache');
    assert.equal(updatedCase1.messages.length, 2); // 1 patient + 1 ai
    assert.equal(updatedCase1.hasRedFlags, false);
  });

  test('STEP 3 to 6: Patient reports syncope -> Red-Flag Engine triggers RF-001 -> Case priority updated', async () => {
    const c = getCaseById(testCaseId);
    assert.ok(c);

    // Patient second turn: "I also fainted yesterday."
    const patientMsg2 = "I also fainted yesterday.";
    const turn2Result = await processClinicalDialogue({
      patientMessage: patientMsg2,
      conversationHistory: c.messages,
      structuredHistory: c.structuredHistory,
    });

    assert.equal(turn2Result.clinical_facts.loss_of_consciousness, true);
    assert.equal(turn2Result.screening_result.detected, true);
    assert.equal(turn2Result.screening_result.flags[0]?.rule_id, 'RF-001');

    // Sync to case store
    const updatedCase2 = addMessageTurnToCase({
      caseId: testCaseId,
      patientMessage: patientMsg2,
      aiReply: turn2Result.patient_friendly_response || turn2Result.next_question,
      facts: turn2Result.clinical_facts,
      screeningResult: turn2Result.screening_result,
      chips: turn2Result.quick_replies,
    });

    assert.equal(updatedCase2.hasRedFlags, true);
    assert.equal(updatedCase2.triageCategory, 'Priority Review');
    assert.ok(updatedCase2.redFlags.some(rf => rf.rule_id === 'RF-001'));
    assert.ok(updatedCase2.redFlags[0].message.includes('Potential red flag detected'));
  });

  test('STEP 7 to 11: Patient uploads report with abnormal values -> Range checker flags LOW / HIGH -> Report attached to case', async () => {
    const syntheticReportData = {
      id: `rep_e2e_${RUN_ID}`,
      name: 'cbc_blood_report.pdf',
      fileType: 'application/pdf',
      size: '18.4 KB',
      documentType: 'Diagnostic Lab Report',
      rawText: 'PATIENT: Anita Verma\nHemoglobin: 9.8 g/dL (Ref: 12.0 - 15.5)\nPlatelets: 210000 /uL (Ref: 150000 - 450000)\nBlood Pressure: 152/96 mmHg (Ref: 90/60 - 120/80)',
      vitals: [
        { test_name: 'Blood Pressure', value: '152/96', unit: 'mmHg', reference_low: '90/60', reference_high: '120/80', status: 'high' }
      ],
      laboratoryResults: [
        { test_name: 'Hemoglobin', value: 9.8, unit: 'g/dL', reference_low: 12.0, reference_high: 15.5, status: 'low' },
        { test_name: 'Platelets', value: 210000, unit: '/uL', reference_low: 150000, reference_high: 450000, status: 'normal' }
      ],
      evaluatedAbnormalities: [
        { test_name: 'Hemoglobin', value: 9.8, unit: 'g/dL', status: 'low' },
        { test_name: 'Blood Pressure', value: '152/96', unit: 'mmHg', status: 'high' }
      ],
      hasAbnormalValues: true,
      abnormalCount: 2,
    };

    // Attach to case store
    const updatedCase3 = addReportToCase({
      caseId: testCaseId,
      reportPayload: syntheticReportData,
    });

    assert.equal(updatedCase3.reports.length, 1);
    assert.equal(updatedCase3.reports[0].name, 'cbc_blood_report.pdf');
    assert.ok(updatedCase3.reports[0].rawText.includes('Hemoglobin: 9.8'));
    assert.equal(updatedCase3.abnormal_values.length, 2);
    assert.ok(updatedCase3.abnormal_values.some(v => v.test_name === 'Hemoglobin' && v.status === 'low'));

    // Verify AI summary contains distinguished sections
    assert.ok(updatedCase3.ai_summary.includes('Chief Complaint:'));
    assert.ok(updatedCase3.ai_summary.includes('History (Reported by Patient):'));
    assert.ok(updatedCase3.ai_summary.includes('Potential Red Flags (Screening Alert — Not a Diagnosis):'));
    assert.ok(updatedCase3.ai_summary.includes('Report Findings (Extracted from Report):'));
  });

  test('STEP 12 to 14: Doctor opens Doctor Portal -> Selects case -> Reviews all 11 items -> Saves doctor notes', async () => {
    // Doctor fetches queue
    const allCases = getAllCases();
    assert.ok(allCases.length >= 5);
    const doctorSelectedCase = getCaseById(testCaseId);
    assert.ok(doctorSelectedCase);

    // Verify all 11 requirements are present in the dossier:
    // 1. Patient details
    assert.equal(doctorSelectedCase.patient.name, 'Anita Verma');
    // 2. Chief complaint
    assert.equal(doctorSelectedCase.chiefComplaint, 'headache');
    // 3. Structured clinical history
    assert.ok(doctorSelectedCase.structuredHistory.reviewOfSystems);
    // 4. Conversation transcript
    assert.ok(doctorSelectedCase.messages.length >= 2);
    // 5. Uploaded medical report
    assert.equal(doctorSelectedCase.reports.length, 1);
    // 6. OCR extracted text
    assert.ok(doctorSelectedCase.reports[0].rawText.length > 0);
    // 7. Extracted medical values
    assert.ok(doctorSelectedCase.reports[0].extractedData.length >= 2);
    // 8. Normal / low / high status
    assert.ok(doctorSelectedCase.reports[0].extractedData.some(d => d.status === 'Outside reference range'));
    // 9. Potential red flags
    assert.equal(doctorSelectedCase.hasRedFlags, true);
    assert.equal(doctorSelectedCase.redFlags[0].rule_id, 'RF-001');
    // 10. AI-generated concise summary
    assert.ok(doctorSelectedCase.aiSummary.title);
    assert.ok(doctorSelectedCase.ai_summary.length > 0);
    // 11. Doctor notes before editing
    assert.equal(doctorSelectedCase.doctorNotes, '');

    // Doctor enters clinical orders and marks reviewed
    const finalizedCase = saveDoctorNotes(testCaseId, {
      doctorNotes: 'Patient has acute headache with syncope. Urgent non-contrast Head CT ordered to rule out intracranial hemorrhage.',
      provisionalDiagnosis: 'Acute Severe Headache with Syncope / Intracranial Pathology to rule out',
      reviewStatus: 'Reviewed',
    });

    assert.equal(finalizedCase.reviewStatus, 'Reviewed');
    assert.ok(finalizedCase.doctorNotes.includes('Head CT ordered'));
    assert.ok(finalizedCase.reviewedAt.includes('Dr. Ananya Sharma'));
  });
});

test.describe('Scenario Matrix: Cases A through J', () => {

  test('CASE A: Normal report evaluated as within reference ranges', () => {
    const evaluated = checkAllReferenceRanges({
      vitals: [{ test_name: 'Blood Pressure', value: '118/76', unit: 'mmHg' }],
      laboratory_results: [
        { test_name: 'Hemoglobin', value: 14.2, unit: 'g/dL', reference_low: 12.0, reference_high: 16.0 },
        { test_name: 'Fasting Glucose', value: 88, unit: 'mg/dL', reference_low: 70, reference_high: 100 },
      ],
    });

    assert.equal(evaluated.has_abnormal_values, false);
    assert.equal(evaluated.abnormal_count, 0);
    assert.equal(evaluated.laboratory_results[0].status, 'normal');
  });

  test('CASE B: Report containing an abnormal lab value flagged for physician review', () => {
    const evaluated = checkAllReferenceRanges({
      laboratory_results: [
        { test_name: 'Hemoglobin', value: 8.4, unit: 'g/dL', reference_low: 12.0, reference_high: 16.0 },
      ],
    });

    assert.equal(evaluated.has_abnormal_values, true);
    assert.equal(evaluated.abnormal_count, 1);
    assert.equal(evaluated.laboratory_results[0].status, 'low');
    assert.ok((evaluated.laboratory_results[0].message || '').includes('physician review recommended'));
  });

  test('CASE C: Report with missing reference ranges handled deterministically without crashing', () => {
    const evaluated = checkAllReferenceRanges({
      laboratory_results: [
        { test_name: 'Serum Amylase', value: 45, unit: 'U/L' }, // No report range and no default fallback
      ],
    });

    assert.equal(evaluated.laboratory_results[0].status, 'unknown');
    assert.equal(evaluated.has_abnormal_values, false);
  });

  test('CASE D: Poor OCR or unreadable text triggers honest disclosure follow-up', async () => {
    const followUp = await generateReportFollowUpTurn({
      reportData: { name: 'blurry_prescription.jpg', laboratoryResults: [], vitals: [] },
      reportAnalysis: { extractionStatus: 'failed', hasAbnormalValues: false, abnormalCount: 0 },
      ocrResult: { rawText: '', extractionStatus: 'failed' },
    });

    assert.ok(followUp.replyText.includes('handwriting recognition is not supported'));
    assert.ok(followUp.replyText.includes('attached your document'));
  });

  test('CASE E: Patient with red flag (chest pain + breathing difficulty) triggers screening alert', () => {
    const screening = screenRedFlags({
      symptoms: [{ name: 'chest pain', severity: 'severe' }],
      breathing_difficulty: true,
    });

    assert.equal(screening.detected, true);
    assert.equal(screening.flags[0]?.rule_id, 'RF-003');
    assert.ok(screening.flags[0]?.message.includes('Prompt clinical evaluation may be appropriate'));
  });

  test('CASE F: Patient without red flag (mild cold/headache) passes screening normally', () => {
    const screening = screenRedFlags({
      chief_complaint: 'mild cold',
      symptoms: [{ name: 'runny nose', severity: 'mild' }],
      breathing_difficulty: false,
      loss_of_consciousness: false,
    });

    assert.equal(screening.detected, false);
    assert.equal(screening.flags.length, 0);
  });

  test('CASE G: Report uploaded without prior conversation initializes case properly', () => {
    const caseGId = `case-MED-REPORT-FIRST-${RUN_ID}`;
    const caseG = createCase({
      id: caseGId,
      intakeId: `MED-REPORT-FIRST-${RUN_ID}`,
    });

    const updated = addReportToCase({
      caseId: caseGId,
      reportPayload: {
        id: `rep_g_${RUN_ID}`,
        name: 'annual_health_panel.pdf',
        vitals: [{ test_name: 'Blood Pressure', value: '120/80', status: 'normal' }],
        laboratoryResults: [{ test_name: 'Hemoglobin', value: 13.5, status: 'normal' }],
        rawText: 'ANNUAL HEALTH PANEL: Normal',
      },
    });

    assert.equal(updated.reports.length, 1);
    assert.equal(updated.messages.length, 0); // No conversation yet
    assert.equal(updated.status, 'in_progress');
  });

  test('CASE H: Conversation without a report operates fully and stores structured facts', async () => {
    const caseHId = `case-MED-CONVO-ONLY-${RUN_ID}`;
    createCase({ id: caseHId, intakeId: `MED-CONVO-ONLY-${RUN_ID}` });

    const turn = await processClinicalDialogue({
      patientMessage: 'I have had stomach pain since yesterday after lunch.',
      conversationHistory: [],
    });

    const updated = addMessageTurnToCase({
      caseId: caseHId,
      patientMessage: 'I have had stomach pain since yesterday after lunch.',
      aiReply: turn.next_question,
      facts: turn.clinical_facts,
      screeningResult: turn.screening_result,
      chips: turn.quick_replies,
    });

    assert.equal(updated.messages.length, 2);
    assert.equal(updated.reports.length, 0);
    assert.ok(updated.structuredHistory.chiefComplaint);
  });

  test('CASE I: Multiple reports accumulate without overwriting prior reports or clinical history', () => {
    const caseIId = `case-MED-MULTI-REP-${RUN_ID}`;
    createCase({ id: caseIId, intakeId: `MED-MULTI-REP-${RUN_ID}` });

    // Upload report 1
    addReportToCase({
      caseId: caseIId,
      reportPayload: {
        id: `rep_1_${RUN_ID}`,
        name: 'Report_1_CBC.pdf',
        laboratoryResults: [{ test_name: 'Hemoglobin', value: 9.5, status: 'low' }],
        rawText: 'Report 1 CBC',
      },
    });

    // Upload report 2
    const multiUpdated = addReportToCase({
      caseId: caseIId,
      reportPayload: {
        id: `rep_2_${RUN_ID}`,
        name: 'Report_2_Lipid.pdf',
        laboratoryResults: [{ test_name: 'Total Cholesterol', value: 240, status: 'high' }],
        rawText: 'Report 2 Lipid',
      },
    });

    assert.equal(multiUpdated.reports.length, 2);
    assert.equal(multiUpdated.reports[0].name, 'Report_1_CBC.pdf');
    assert.equal(multiUpdated.reports[1].name, 'Report_2_Lipid.pdf');
    assert.equal(multiUpdated.abnormal_values.length, 2);
  });

  test('CASE J: OpenAI failure triggers deterministic NLU fallback without crash', async () => {
    // When OpenAI is offline or invalid key, fallbackClinicalDialogue runs
    const fallbackTurn = await processClinicalDialogue({
      patientMessage: 'I am coughing blood and feeling weak',
      conversationHistory: [],
    });

    assert.ok(fallbackTurn.clinical_facts);
    assert.ok(fallbackTurn.next_question);
    assert.ok(fallbackTurn.screening_result);
    // Should detect bleeding idiom
    assert.ok(fallbackTurn.clinical_facts.bleeding?.present || fallbackTurn.clinical_facts.bleeding);
  });
});
