/**
 * Automated Unit Tests for Continuous Report-Aware Case-Taking Conversation
 * 
 * Verifies:
 * - CASE 1: Normal report continues conversation immediately
 * - CASE 2: Abnormal report values generate cautious, non-diagnostic follow-up questions
 * - CASE 3: Insufficient report information asks for current symptoms
 * - CASE 4: OCR failure / unreadable document allows manual continuation
 * - CASE 5: Multiple report uploads preserve case history and merge findings
 * - CASE 6: Intake without report proceeds normally
 * - Follow-up answer turn: Patient response to report follow-up updates clinical facts
 */

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { generateReportFollowUpTurn, processClinicalDialogue } from '../services/openaiService.mjs';

describe('Continuous Report-Aware Clinical Conversation', () => {

  // CASE 1: Successful Report Upload with Normal Values
  test('CASE 1: Normal report generates immediate conversational follow-up without stopping', async () => {
    const reportData = {
      name: 'normal_health_check.pdf',
      vitals: {
        blood_pressure: { systolic: 120, diastolic: 80, unit: 'mmHg', status: 'normal' },
        temperature: { value: 98.6, unit: '°F', status: 'normal' }
      },
      laboratoryResults: [
        { test_name: 'Fasting Blood Glucose', value: 85, unit: 'mg/dL', status: 'normal' },
        { test_name: 'Hemoglobin', value: 14.5, unit: 'g/dL', status: 'normal' }
      ],
      medications: []
    };

    const result = await generateReportFollowUpTurn({
      reportData,
      reportAnalysis: {
        abnormalCount: 0,
        hasAbnormalValues: false,
        evaluatedAbnormalities: [],
        extractionStatus: 'success'
      }
    });

    assert.ok(result.replyText, 'Must have a replyText');
    assert.match(result.replyText, /within configured reference range/i, 'Mentions parameters are within normal reference range');
    assert.match(result.replyText, /what symptoms or health concerns/i, 'Prompts user to continue conversation');
    assert.ok(Array.isArray(result.chips) && result.chips.length > 0, 'Provides quick-reply chips');
  });

  // CASE 2: Report with Abnormal Values (High BP, Low Hb)
  test('CASE 2: Abnormal report values trigger cautious, non-diagnostic follow-up inquiry', async () => {
    const reportData = {
      name: 'demo_synthetic_report.pdf',
      vitals: {
        blood_pressure: { systolic: 150, diastolic: 95, unit: 'mmHg', status: 'high', value: '150/95 mmHg' },
        temperature: { value: 102, unit: '°F', status: 'high' }
      },
      laboratoryResults: [
        { test_name: 'Hemoglobin', value: 10.2, unit: 'g/dL', status: 'low' },
        { test_name: 'Fasting Blood Glucose', value: 95, unit: 'mg/dL', status: 'normal' }
      ],
      medications: [{ name: 'Paracetamol', dose: '500 mg' }]
    };

    const result = await generateReportFollowUpTurn({
      reportData,
      reportAnalysis: {
        abnormalCount: 2,
        hasAbnormalValues: true,
        evaluatedAbnormalities: [
          { test_name: 'Hemoglobin', value: 10.2, unit: 'g/dL', status: 'low' }
        ],
        extractionStatus: 'success'
      }
    });

    assert.ok(result.replyText, 'Must return replyText');
    // Check that it does NOT make a disease diagnosis
    assert.doesNotMatch(result.replyText, /you have hypertension/i, 'Must never diagnose hypertension');
    assert.doesNotMatch(result.replyText, /you have anemia/i, 'Must never diagnose anemia');
    
    // Check non-diagnostic, respectful phrasing
    assert.match(result.replyText, /150\/95 mmHg/i, 'Mentions exact recorded blood pressure');
    assert.match(result.replyText, /medication.*?blood pressure/i, 'Asks context-aware follow-up question regarding BP medication');
    assert.ok(result.chips.some(c => c.toLowerCase().includes('bp')), 'Contains BP-relevant quick replies');
    assert.ok(result.updatedHistory.medications.some(m => m.includes('Paracetamol')), 'Incorporates report medication into clinical facts');
  });

  // CASE 3: Report with Insufficient Information
  test('CASE 3: Report with insufficient information asks for primary symptoms', async () => {
    const reportData = {
      name: 'scanned_receipt.pdf',
      vitals: {},
      laboratoryResults: [],
      medications: []
    };

    const result = await generateReportFollowUpTurn({
      reportData,
      reportAnalysis: {
        abnormalCount: 0,
        hasAbnormalValues: false,
        evaluatedAbnormalities: [],
        extractionStatus: 'uncertain'
      },
      ocrResult: { rawText: 'Demo clinic receipt payment invoice.' }
    });

    assert.match(result.replyText, /does not appear to contain recent vitals/i, 'Informs user about missing clinical values');
    assert.match(result.replyText, /symptoms or health concerns/i, 'Asks for current symptoms');
    assert.ok(result.chips.length > 0, 'Offers symptom chips');
  });

  // CASE 4: OCR Failure / Unreadable Scan
  test('CASE 4: OCR failure allows user to continue manually', async () => {
    const reportData = {
      name: 'blurry_scan.jpg',
      vitals: {},
      laboratoryResults: [],
      medications: []
    };

    const result = await generateReportFollowUpTurn({
      reportData,
      reportAnalysis: {
        abnormalCount: 0,
        hasAbnormalValues: false,
        evaluatedAbnormalities: [],
        extractionStatus: 'failed'
      },
      ocrResult: { rawText: '', extractionStatus: 'failed' }
    });

    assert.match(result.replyText, /handwriting recognition is not supported/i, 'States honest prototype handwriting/scan limitation');
    assert.match(result.replyText, /current symptoms/i, 'Allows continuing consultation manually');
    assert.ok(result.chips.length > 0, 'Offers symptom choices');
  });

  // CASE 5: Multiple Report Uploads (Second Report)
  test('CASE 5: Second report updates findings without corrupting previous clinical history', async () => {
    // Initial history from first report and patient statement
    const existingHistory = {
      chief_complaint: 'fever',
      symptoms: [{ name: 'fever', severity: 'mild', duration: '2 days', onset: null }],
      medications: ['Paracetamol 500 mg'],
      past_medical_history: ['Hypertension'],
      relevant_negative_symptoms: ['breathing difficulty']
    };

    // Patient uploads a second report with lab results
    const secondReport = {
      name: 'blood_panel.pdf',
      vitals: {},
      laboratoryResults: [
        { test_name: 'Platelet Count', value: 85000, unit: '/uL', status: 'low' }
      ],
      medications: [{ name: 'Azithromycin', dose: '500 mg' }]
    };

    const result = await generateReportFollowUpTurn({
      reportData: secondReport,
      reportAnalysis: {
        abnormalCount: 1,
        hasAbnormalValues: true,
        evaluatedAbnormalities: [{ test_name: 'Platelet Count', value: 85000, unit: '/uL', status: 'low' }],
        extractionStatus: 'success'
      },
      existingHistory
    });

    // Verify previous clinical facts are preserved
    assert.equal(result.updatedHistory.chief_complaint, 'fever', 'Preserves chief complaint');
    assert.ok(result.updatedHistory.medications.some(m => m.includes('Paracetamol')), 'Preserves previous medication');
    assert.ok(result.updatedHistory.medications.some(m => m.includes('Azithromycin')), 'Merges new report medication');
    assert.ok(result.updatedHistory.relevant_negative_symptoms.includes('breathing difficulty'), 'Preserves pertinent negatives');
  });

  // CASE 6: Intake without Report
  test('CASE 6: Intake without report operates completely normally', async () => {
    const result = await processClinicalDialogue({
      patientMessage: 'I have had a bad headache since morning',
      conversationHistory: [],
      structuredHistory: null,
      reportContext: null
    });

    assert.ok(result.clinical_facts, 'Clinical facts extracted');
    assert.equal(result.clinical_facts.chief_complaint, 'headache', 'Headache identified as chief complaint');
    assert.match(result.next_question, /fainting|blackout|loss of consciousness/i, 'Asks standard red flag question');
  });

  // Conversational Continuity: Answering Report Follow-Up Question
  test('Continuity: Patient answer to BP medication question updates clinical facts and advances dialogue', async () => {
    // History where BP was flagged from uploaded report
    const reportContext = {
      reportData: {
        fileName: 'demo_synthetic_report.pdf',
        vitals: {
          blood_pressure: { systolic: 150, diastolic: 95, unit: 'mmHg', status: 'high' }
        },
        laboratoryResults: [
          { test_name: 'Hemoglobin', value: 10.2, unit: 'g/dL', status: 'low' }
        ],
        medications: [{ name: 'Paracetamol', dose: '500 mg' }]
      },
      reportAnalysis: {
        abnormalCount: 2,
        hasAbnormalValues: true
      }
    };

    const structuredHistory = {
      chief_complaint: null,
      symptoms: [],
      medications: ['Paracetamol 500 mg'],
      bp_medication_status: null,
      fatigue_status: null
    };

    // Patient responds to: "Are you currently taking any prescription medication regularly for blood pressure?"
    const patientAnswer = 'Yes, taking daily BP tablets prescribed by my doctor';

    const result = await processClinicalDialogue({
      patientMessage: patientAnswer,
      conversationHistory: [
        { sender: 'ai', text: 'Are you currently taking any prescription medication regularly for blood pressure?' }
      ],
      structuredHistory,
      reportContext
    });

    // Clinical facts updated with answer
    assert.equal(result.clinical_facts.bp_medication_status, 'taking_daily_medication', 'Records BP medication confirmation');
    assert.ok(result.clinical_facts.medications.some(m => m.toLowerCase().includes('blood pressure')), 'Adds BP medication to facts');

    // Dialogue advances to the next relevant report finding (low hemoglobin)
    assert.match(result.next_question, /hemoglobin|fatigue|dizziness/i, 'Advances to follow-up on hemoglobin/fatigue');
    assert.doesNotMatch(result.next_question, /you have anemia/i, 'Maintains non-diagnostic guardrail');
  });

});
