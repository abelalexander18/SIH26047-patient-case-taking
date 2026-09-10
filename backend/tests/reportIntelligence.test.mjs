/**
 * Arogya AI — Medical Report Intelligence Pipeline Unit Tests
 * Test Runner: node --test backend/tests/reportIntelligence.test.mjs
 * 
 * Verifies:
 * 1. End-to-end processing of synthetic medical report
 * 2. Schema compliance (patient, vitals, labs, medications, diagnoses)
 * 3. Reference range checker logic (LOW, NORMAL, HIGH, UNKNOWN)
 * 4. Report reference range priority over configured fallback
 * 5. Unit incompatibility safety (no silent conversion)
 * 6. Non-diagnostic message guardrails
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { extractTextFromDocument } from '../services/ocrService.mjs';
import { deterministicReportExtractor, sanitizeReportExtraction } from '../services/medicalReportExtractor.mjs';
import { evaluateSingleMetric, checkAllReferenceRanges } from '../services/referenceRangeChecker.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const SAMPLE_TXT_PATH = path.resolve(__dirname, '../samples/demo_synthetic_report.txt');
const SAMPLE_PDF_PATH = path.resolve(__dirname, '../samples/demo_synthetic_report.pdf');

describe('Medical Report Intelligence: Text Extraction & OCR', () => {
  it('extracts plain text synthetic report with 100% fidelity', async () => {
    const buffer = fs.readFileSync(SAMPLE_TXT_PATH);
    const result = await extractTextFromDocument(buffer, 'demo_synthetic_report.txt', 'text/plain');

    assert.equal(result.success, true);
    assert.equal(result.fileType, 'text');
    assert.match(result.rawText, /Demo Patient/i);
    assert.match(result.rawText, /Hemoglobin/i);
    assert.match(result.rawText, /Paracetamol/i);
  });

  it('extracts digital PDF synthetic report text via pypdf helper', async () => {
    const buffer = fs.readFileSync(SAMPLE_PDF_PATH);
    const result = await extractTextFromDocument(buffer, 'demo_synthetic_report.pdf', 'application/pdf');

    assert.equal(result.success, true);
    assert.equal(result.fileType, 'pdf');
    assert.ok(result.rawText.length > 50);
    assert.match(result.rawText, /Hemoglobin/i);
  });

  it('handles empty buffer gracefully without throwing', async () => {
    const result = await extractTextFromDocument(Buffer.alloc(0), 'empty.pdf', 'application/pdf');
    assert.equal(result.success, false);
    assert.equal(result.extractionStatus, 'failed');
  });
});

describe('Medical Report Intelligence: Structured Information Extraction', () => {
  it('extracts patient metadata, vitals, lab results, and medications from synthetic text', () => {
    const rawText = fs.readFileSync(SAMPLE_TXT_PATH, 'utf-8');
    const extracted = deterministicReportExtractor(rawText);

    // Patient
    assert.equal(extracted.patient.name, 'Demo Patient');
    assert.equal(extracted.patient.age, '52');
    assert.equal(extracted.patient.sex, 'Male');
    assert.equal(extracted.report_date, '2026-09-10');

    // Vitals
    const bp = extracted.vitals.find((v) => v.name.toLowerCase().includes('blood pressure'));
    assert.ok(bp, 'Blood Pressure vital should be extracted');
    assert.equal(bp.value, '150/95');

    const temp = extracted.vitals.find((v) => v.name.toLowerCase().includes('temperature'));
    assert.ok(temp, 'Temperature vital should be extracted');
    assert.equal(temp.value, 102);
    assert.equal(temp.unit, '°F');

    // Lab Results
    const hb = extracted.laboratory_results.find((l) => l.test_name.toLowerCase().includes('hemoglobin'));
    assert.ok(hb, 'Hemoglobin should be extracted');
    assert.equal(hb.value, 10.2);
    assert.equal(hb.reference_low, 12.0);
    assert.equal(hb.reference_high, 16.0);

    const glucose = extracted.laboratory_results.find((l) => l.test_name.toLowerCase().includes('glucose'));
    assert.ok(glucose, 'Glucose should be extracted');
    assert.equal(glucose.value, 95);
    assert.equal(glucose.reference_low, 70.0);
    assert.equal(glucose.reference_high, 100.0);

    // Medications
    const med = extracted.medications.find((m) => m.name.toLowerCase().includes('paracetamol'));
    assert.ok(med, 'Paracetamol medication should be extracted');
    assert.match(med.dose, /500\s*mg/i);
  });

  it('preserves null for unmentioned attributes without inventing values', () => {
    const sparseText = 'Hemoglobin: 13.5 g/dL';
    const extracted = deterministicReportExtractor(sparseText);

    assert.equal(extracted.patient.name, null);
    assert.equal(extracted.patient.age, null);
    assert.equal(extracted.vitals.length, 0);
    assert.equal(extracted.medications.length, 0);
    assert.equal(extracted.diagnoses_mentioned_in_report.length, 0);
  });
});

describe('Medical Report Intelligence: Deterministic Reference Range Checker', () => {
  it('evaluates Hemoglobin 10.2 (Ref: 12-16) as LOW', () => {
    const evaluated = evaluateSingleMetric({
      test_name: 'Hemoglobin',
      value: 10.2,
      unit: 'g/dL',
      reference_low: 12.0,
      reference_high: 16.0
    });

    assert.equal(evaluated.status, 'low');
    assert.equal(evaluated.range_source, 'report');
    assert.equal(evaluated.flagged, true);
    assert.match(evaluated.message, /Outside configured reference range/i);
    assert.match(evaluated.message, /physician review recommended/i);
  });

  it('evaluates Glucose 95 (Ref: 70-100) as NORMAL', () => {
    const evaluated = evaluateSingleMetric({
      test_name: 'Glucose',
      value: 95,
      unit: 'mg/dL',
      reference_low: 70.0,
      reference_high: 100.0
    });

    assert.equal(evaluated.status, 'normal');
    assert.equal(evaluated.range_source, 'report');
    assert.equal(evaluated.flagged, false);
    assert.match(evaluated.message, /Within configured reference range/i);
  });

  it('evaluates Blood Pressure 150/95 mmHg as HIGH', () => {
    const evaluated = evaluateSingleMetric({
      test_name: 'Blood Pressure',
      value: '150/95',
      unit: 'mmHg'
    });

    assert.equal(evaluated.status, 'high');
    assert.equal(evaluated.flagged, true);
    assert.match(evaluated.message, /Outside configured reference range/i);
  });

  it('evaluates Temperature 102 °F as HIGH', () => {
    const evaluated = evaluateSingleMetric({
      test_name: 'Temperature',
      value: 102,
      unit: '°F'
    });

    assert.equal(evaluated.status, 'high');
    assert.equal(evaluated.flagged, true);
    assert.match(evaluated.message, /Outside configured reference range/i);
  });

  it('prioritizes report-printed range over configured fallback range', () => {
    // Report specifies custom reference 11.0 - 14.0 instead of standard 12.0 - 16.0
    const evaluated = evaluateSingleMetric({
      test_name: 'Hemoglobin',
      value: 11.5,
      unit: 'g/dL',
      reference_low: 11.0,
      reference_high: 14.0
    });

    assert.equal(evaluated.range_source, 'report');
    assert.equal(evaluated.status, 'normal'); // 11.5 is normal for 11-14, but would be low in 12-16
  });

  it('falls back to configured reference ranges when report range is omitted', () => {
    const evaluated = evaluateSingleMetric({
      test_name: 'Serum Creatinine',
      value: 2.1,
      unit: 'mg/dL',
      reference_low: null,
      reference_high: null
    });

    assert.equal(evaluated.range_source, 'configured_fallback');
    assert.equal(evaluated.reference_low, 0.6);
    assert.equal(evaluated.reference_high, 1.3);
    assert.equal(evaluated.status, 'high');
  });

  it('handles incompatible units safely by marking status UNKNOWN without silent conversion', () => {
    const evaluated = evaluateSingleMetric({
      test_name: 'Hemoglobin',
      value: 120, // in mmol/L or mismatched unit
      unit: 'mmol/L',
      reference_low: null,
      reference_high: null
    });

    assert.equal(evaluated.status, 'unknown');
    assert.match(evaluated.message, /insufficient/i);
  });

  it('evaluates entire synthetic report end-to-end', () => {
    const rawText = fs.readFileSync(SAMPLE_TXT_PATH, 'utf-8');
    const extracted = deterministicReportExtractor(rawText);
    const evaluated = checkAllReferenceRanges(extracted);

    assert.equal(evaluated.has_abnormal_values, true);
    assert.ok(evaluated.abnormal_count >= 3); // BP (150/95), Temp (102), Hemoglobin (10.2)

    const hbResult = evaluated.laboratory_results.find((l) => l.test_name === 'Hemoglobin');
    assert.equal(hbResult.status, 'low');

    const glucoseResult = evaluated.laboratory_results.find((l) => l.test_name === 'Fasting Blood Glucose');
    assert.equal(glucoseResult.status, 'normal');
  });
});
