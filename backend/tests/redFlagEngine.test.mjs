/**
 * Unit Tests for Member 6 Deterministic Red-Flag Intelligence Engine
 * Path: backend/tests/redFlagEngine.test.mjs
 * 
 * Run with: node --test backend/tests/redFlagEngine.test.mjs
 */

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import {
  screenRedFlags,
  identifyMissingContext,
  sanitizeClinicalFacts,
  DISCLAIMER_TEXT,
  STANDARD_ALERT_MESSAGE,
} from '../services/redFlagEngine.mjs';

describe('Member 6: Deterministic Red-Flag Engine - Rule Verification', () => {

  // 1. Severe headache + loss of consciousness (RF-001)
  test('Rule 1: Severe headache + loss of consciousness triggers RF-001', () => {
    const facts = {
      chief_complaint: 'headache',
      symptoms: [{ name: 'headache', severity: 'severe' }],
      loss_of_consciousness: true,
      severity: 'severe',
    };

    const result = screenRedFlags(facts);
    assert.equal(result.detected, true);
    assert.equal(result.severity, 'high');
    assert.equal(result.disclaimer, DISCLAIMER_TEXT);

    const flag = result.flags.find(f => f.rule_id === 'RF-001');
    assert.ok(flag, 'Expected RF-001 flag');
    assert.equal(flag.category, 'neurological');
    assert.equal(flag.message, STANDARD_ALERT_MESSAGE);
    assert.ok(flag.evidence.includes('Severe headache reported'));
    assert.ok(flag.evidence.includes('Loss of consciousness confirmed'));
  });

  // 2. Severe headache + neurological symptoms (RF-002)
  test('Rule 2: Severe headache + neurological symptoms triggers RF-002', () => {
    const facts = {
      chief_complaint: 'headache',
      severity: 'severe',
      symptoms: [
        { name: 'headache', severity: 'severe' },
        { name: 'facial drooping', severity: 'moderate' }
      ],
      neurological_symptoms: true,
    };

    const result = screenRedFlags(facts);
    assert.equal(result.detected, true);
    assert.equal(result.severity, 'high');

    const flag = result.flags.find(f => f.rule_id === 'RF-002');
    assert.ok(flag, 'Expected RF-002 flag');
    assert.equal(flag.category, 'neurological');
    assert.equal(flag.message, STANDARD_ALERT_MESSAGE);
  });

  // 3. Chest pain + breathing difficulty (RF-003)
  test('Rule 3: Chest pain + breathing difficulty triggers RF-003', () => {
    const facts = {
      chief_complaint: 'chest pain',
      breathing_difficulty: true,
      symptoms: [{ name: 'chest pressure', severity: 'moderate' }],
    };

    const result = screenRedFlags(facts);
    assert.equal(result.detected, true);
    assert.equal(result.severity, 'high');

    const flag = result.flags.find(f => f.rule_id === 'RF-003');
    assert.ok(flag, 'Expected RF-003 flag');
    assert.equal(flag.category, 'cardiovascular');
    assert.equal(flag.message, STANDARD_ALERT_MESSAGE);
    assert.ok(flag.evidence.some(e => e.includes('Chest pain')));
    assert.ok(flag.evidence.some(e => e.includes('breathing difficulty')));
  });

  // 4. Severe breathing difficulty (RF-004)
  test('Rule 4: Severe breathing difficulty alone triggers RF-004', () => {
    const facts = {
      chief_complaint: 'shortness of breath',
      breathing_difficulty: true,
      severity: 'severe',
      symptoms: [{ name: 'severe dyspnea', severity: 'severe' }],
    };

    const result = screenRedFlags(facts);
    assert.equal(result.detected, true);

    const flag = result.flags.find(f => f.rule_id === 'RF-004');
    assert.ok(flag, 'Expected RF-004 flag');
    assert.equal(flag.category, 'respiratory');
    assert.equal(flag.message, STANDARD_ALERT_MESSAGE);
  });

  test('Rule 4b: Low oxygen saturation (SpO2 < 90%) triggers RF-004', () => {
    const facts = {
      chief_complaint: 'cough',
      breathing_difficulty: true,
      vitals: { spo2: 86 },
    };

    const result = screenRedFlags(facts);
    assert.equal(result.detected, true);
    assert.ok(result.flags.some(f => f.rule_id === 'RF-004'));
  });

  // 5. Loss of consciousness alone (RF-005)
  test('Rule 5: Loss of consciousness alone triggers RF-005', () => {
    const facts = {
      chief_complaint: 'fainting spell',
      loss_of_consciousness: true,
      symptoms: [{ name: 'dizziness', severity: 'mild' }],
    };

    const result = screenRedFlags(facts);
    assert.equal(result.detected, true);

    const flag = result.flags.find(f => f.rule_id === 'RF-005');
    assert.ok(flag, 'Expected RF-005 flag');
    assert.equal(flag.category, 'neurological');
    assert.equal(flag.message, STANDARD_ALERT_MESSAGE);
  });

  // 6. Blood in vomit (RF-006)
  test('Rule 6: Blood in vomit (hematemesis) triggers RF-006', () => {
    const facts = {
      chief_complaint: 'vomiting',
      blood_in_vomit: true,
      bleeding: { present: true, source: 'vomit' },
      symptoms: [{ name: 'vomiting', severity: 'moderate' }],
    };

    const result = screenRedFlags(facts);
    assert.equal(result.detected, true);

    const flag = result.flags.find(f => f.rule_id === 'RF-006');
    assert.ok(flag, 'Expected RF-006 flag');
    assert.equal(flag.category, 'gastrointestinal');
    assert.equal(flag.message, STANDARD_ALERT_MESSAGE);
  });

  // 7. Blood in stool (RF-007)
  test('Rule 7: Blood in stool (melena) triggers RF-007', () => {
    const facts = {
      chief_complaint: 'stomach upset',
      blood_in_stool: true,
      bleeding: { present: true, source: 'stool' },
    };

    const result = screenRedFlags(facts);
    assert.equal(result.detected, true);

    const flag = result.flags.find(f => f.rule_id === 'RF-007');
    assert.ok(flag, 'Expected RF-007 flag');
    assert.equal(flag.category, 'gastrointestinal');
    assert.equal(flag.message, STANDARD_ALERT_MESSAGE);
  });

  // 8. Severe abdominal pain + loss of consciousness (RF-008)
  test('Rule 8: Severe abdominal pain + loss of consciousness triggers RF-008', () => {
    const facts = {
      chief_complaint: 'abdominal pain',
      severity: 'severe',
      loss_of_consciousness: true,
      symptoms: [{ name: 'stomach pain', severity: 'severe' }],
    };

    const result = screenRedFlags(facts);
    assert.equal(result.detected, true);

    const flag = result.flags.find(f => f.rule_id === 'RF-008');
    assert.ok(flag, 'Expected RF-008 flag');
    assert.equal(flag.category, 'abdominal');
    assert.equal(flag.message, STANDARD_ALERT_MESSAGE);
  });

  // 9. High fever + confusion/altered mental state (RF-009)
  test('Rule 9: High fever + confusion triggers RF-009', () => {
    const facts = {
      chief_complaint: 'fever',
      confusion: true,
      vitals: { temperature: 103.2 },
      symptoms: [{ name: 'fever', severity: 'moderate' }],
    };

    const result = screenRedFlags(facts);
    assert.equal(result.detected, true);

    const flag = result.flags.find(f => f.rule_id === 'RF-009');
    assert.ok(flag, 'Expected RF-009 flag');
    assert.equal(flag.category, 'sepsis_infection');
    assert.equal(flag.message, STANDARD_ALERT_MESSAGE);
  });

  // 10. Severe allergic-type symptoms + breathing difficulty (RF-010)
  test('Rule 10: Severe allergic-type symptoms + breathing difficulty triggers RF-010', () => {
    const facts = {
      chief_complaint: 'allergic reaction',
      breathing_difficulty: true,
      symptoms: [
        { name: 'hives', severity: 'severe' },
        { name: 'throat swelling', severity: 'severe' }
      ],
      allergies: ['peanuts'],
    };

    const result = screenRedFlags(facts);
    assert.equal(result.detected, true);

    const flag = result.flags.find(f => f.rule_id === 'RF-010');
    assert.ok(flag, 'Expected RF-010 flag');
    assert.equal(flag.category, 'allergic_immunologic');
    assert.equal(flag.message, STANDARD_ALERT_MESSAGE);
  });
});

describe('Member 6: Negative Controls & Common Mild Symptoms', () => {

  test('Mild headache alone does NOT trigger a red flag', () => {
    const facts = {
      chief_complaint: 'headache',
      severity: 'mild',
      loss_of_consciousness: false,
      symptoms: [{ name: 'headache', severity: 'mild', duration: 'since morning' }],
      relevant_negative_symptoms: ['loss of consciousness', 'fainting'],
    };

    const result = screenRedFlags(facts);
    assert.equal(result.detected, false);
    assert.equal(result.severity, 'none');
    assert.equal(result.flags.length, 0);
    assert.equal(result.disclaimer, DISCLAIMER_TEXT);
  });

  test('Vomiting for two days alone does NOT trigger emergency red flag', () => {
    const facts = {
      chief_complaint: 'vomiting',
      duration: 'two days',
      severity: 'moderate',
      unable_to_keep_fluids: null,
      blood_in_vomit: false,
      loss_of_consciousness: false,
      symptoms: [{ name: 'vomiting', severity: 'moderate', duration: 'two days' }],
    };

    const result = screenRedFlags(facts);
    assert.equal(result.detected, false);
    assert.equal(result.severity, 'none');
    assert.equal(result.flags.length, 0);
  });

  test('Common cold with mild runny nose and cough does NOT trigger red flag', () => {
    const facts = {
      chief_complaint: 'cold',
      severity: 'mild',
      symptoms: [
        { name: 'runny nose', severity: 'mild' },
        { name: 'mild cough', severity: 'mild' }
      ],
    };

    const result = screenRedFlags(facts);
    assert.equal(result.detected, false);
    assert.equal(result.severity, 'none');
    assert.equal(result.flags.length, 0);
  });
});

describe('Member 6: Pertinent Negatives & Denial Handling', () => {

  test('Headache with explicit denial of fainting does not trigger RF-001 or RF-005', () => {
    const facts = {
      chief_complaint: 'headache',
      severity: 'severe',
      loss_of_consciousness: false,
      relevant_negative_symptoms: ['fainting', 'loss of consciousness'],
      symptoms: [{ name: 'headache', severity: 'severe' }],
    };

    const result = screenRedFlags(facts);
    assert.equal(result.flags.some(f => f.rule_id === 'RF-001'), false);
    assert.equal(result.flags.some(f => f.rule_id === 'RF-005'), false);
  });

  test('Chest discomfort with explicit denial of breathing difficulty does not trigger RF-003', () => {
    const facts = {
      chief_complaint: 'chest discomfort',
      breathing_difficulty: false,
      relevant_negative_symptoms: ['shortness of breath', 'breathing difficulty'],
      symptoms: [{ name: 'chest discomfort', severity: 'mild' }],
    };

    const result = screenRedFlags(facts);
    assert.equal(result.flags.some(f => f.rule_id === 'RF-003'), false);
    assert.equal(result.flags.some(f => f.rule_id === 'RF-004'), false);
  });
});

describe('Member 6: Missing Values, Null Safety, & Malformed Payloads', () => {

  test('Handles completely empty object cleanly without error', () => {
    const result = screenRedFlags({});
    assert.equal(result.detected, false);
    assert.equal(result.severity, 'none');
    assert.deepEqual(result.flags, []);
    assert.equal(result.disclaimer, DISCLAIMER_TEXT);
  });

  test('Handles null and undefined arguments cleanly', () => {
    const resNull = screenRedFlags(null);
    assert.equal(resNull.detected, false);
    assert.deepEqual(resNull.flags, []);

    const resUndef = screenRedFlags(undefined);
    assert.equal(resUndef.detected, false);
    assert.deepEqual(resUndef.flags, []);
  });

  test('Handles all fields explicitly set to null without error', () => {
    const facts = {
      chief_complaint: null,
      chief_complaints: null,
      symptoms: null,
      duration: null,
      severity: null,
      associated_symptoms: null,
      relevant_negative_symptoms: null,
      loss_of_consciousness: null,
      breathing_difficulty: null,
      confusion: null,
      bleeding: null,
      unable_to_keep_fluids: null,
      vitals: null,
    };

    const result = screenRedFlags(facts);
    assert.equal(result.detected, false);
    assert.equal(result.severity, 'none');
    assert.deepEqual(result.flags, []);
  });

  test('Sanitizes dirty nested types without throwing', () => {
    const dirty = {
      chief_complaints: [123, null, 'headache'],
      symptoms: [{ name: 456 }, null, { name: 'fever', severity: 'moderate' }],
      bleeding: 'invalid-string',
      vitals: 'not-an-object',
    };

    const sanitized = sanitizeClinicalFacts(dirty);
    assert.equal(sanitized.chief_complaints.includes('headache'), true);
    assert.equal(sanitized.symptoms.some(s => s.name === 'fever'), true);
    assert.equal(sanitized.bleeding, null);
    assert.equal(sanitized.vitals, null);
  });
});

describe('Member 6: Multiple Simultaneous Red Flags', () => {

  test('Simultaneous severe headache + syncope AND active hematemesis returns multiple flags', () => {
    const facts = {
      chief_complaint: 'headache and vomiting blood',
      severity: 'severe',
      loss_of_consciousness: true,
      blood_in_vomit: true,
      bleeding: { present: true, source: 'vomit' },
      symptoms: [
        { name: 'headache', severity: 'severe' },
        { name: 'vomiting blood', severity: 'severe' }
      ],
    };

    const result = screenRedFlags(facts);
    assert.equal(result.detected, true);
    assert.equal(result.severity, 'high');
    assert.ok(result.flags.length >= 2);
    assert.ok(result.flags.some(f => f.rule_id === 'RF-001'));
    assert.ok(result.flags.some(f => f.rule_id === 'RF-006'));
  });

  test('Simultaneous chest pain + dyspnea AND high fever + confusion returns multiple flags', () => {
    const facts = {
      chief_complaint: 'chest pain and high fever',
      breathing_difficulty: true,
      confusion: true,
      vitals: { temperature: 103.0 },
      symptoms: [
        { name: 'chest pain', severity: 'severe' },
        { name: 'fever', severity: 'severe' },
        { name: 'confusion', severity: 'moderate' }
      ],
    };

    const result = screenRedFlags(facts);
    assert.equal(result.detected, true);
    assert.ok(result.flags.some(f => f.rule_id === 'RF-003'));
    assert.ok(result.flags.some(f => f.rule_id === 'RF-009'));
  });
});

describe('Member 6: Natural-Language Normalized Fact Variations', () => {

  test('Normalized syncope idioms ("passed out", "blacked out") properly trigger screening', () => {
    // Simulates facts normalized from "I blacked out at work"
    const facts = {
      chief_complaint: 'syncope episode',
      loss_of_consciousness: true,
      symptoms: [{ name: 'loss of consciousness', severity: 'severe' }],
    };

    const result = screenRedFlags(facts);
    assert.equal(result.detected, true);
    assert.ok(result.flags.some(f => f.rule_id === 'RF-005'));
  });

  test('Normalized headache idioms ("head is killing me", "worst headache") with syncope', () => {
    const facts = {
      chief_complaint: 'severe headache',
      severity: 'severe',
      loss_of_consciousness: true,
      symptoms: [{ name: 'headache', severity: 'severe' }],
    };

    const result = screenRedFlags(facts);
    assert.equal(result.detected, true);
    assert.ok(result.flags.some(f => f.rule_id === 'RF-001'));
  });

  test('Normalized dyspnea idioms ("struggling to breathe", "gasping for air")', () => {
    const facts = {
      chief_complaint: 'gasping for air',
      breathing_difficulty: true,
      symptoms: [{ name: 'gasping for air', severity: 'severe' }],
    };

    const result = screenRedFlags(facts);
    assert.equal(result.detected, true);
    assert.ok(result.flags.some(f => f.rule_id === 'RF-004'));
  });
});

describe('Member 6: Non-Diagnostic Language & Guardrail Conformance', () => {

  test('All flagged messages adhere strictly to non-diagnostic standard phrasing', () => {
    const facts = {
      chief_complaint: 'chest pain',
      breathing_difficulty: true,
      loss_of_consciousness: true,
      blood_in_vomit: true,
      bleeding: { present: true, source: 'vomit' },
      severity: 'severe',
      symptoms: [
        { name: 'headache', severity: 'severe' },
        { name: 'chest pain', severity: 'severe' }
      ]
    };

    const result = screenRedFlags(facts);
    assert.equal(result.detected, true);

    for (const flag of result.flags) {
      assert.equal(flag.message, STANDARD_ALERT_MESSAGE);
      const combinedText = `${flag.message} ${flag.evidence.join(' ')}`.toLowerCase();
      // Ensure zero disease diagnostic claims
      assert.ok(!combinedText.includes('you have stroke'));
      assert.ok(!combinedText.includes('you have heart attack'));
      assert.ok(!combinedText.includes('you have meningitis'));
      assert.ok(!combinedText.includes('you have appendicitis'));
      assert.ok(!combinedText.includes('diagnosed with'));
    }

    assert.equal(result.disclaimer, DISCLAIMER_TEXT);
  });
});

describe('Member 6: Missing Context Identification for Conversational Follow-Up', () => {

  test('Vomiting triggers missing context check for fluids, blood, and pain', () => {
    const facts = {
      chief_complaint: 'vomiting',
      duration: 'two days',
    };

    const missing = identifyMissingContext(facts);
    assert.ok(missing.includes('unable_to_keep_fluids'));
    assert.ok(missing.includes('blood_in_vomit'));
    assert.ok(missing.includes('loss_of_consciousness'));
  });

  test('Headache triggers missing context check for syncope and neurological deficits', () => {
    const facts = {
      chief_complaint: 'headache',
    };

    const missing = identifyMissingContext(facts);
    assert.ok(missing.includes('loss_of_consciousness'));
    assert.ok(missing.includes('neurological_symptoms'));
  });

  test('Chest pain triggers missing context check for breathing difficulty', () => {
    const facts = {
      chief_complaint: 'chest pain',
    };

    const missing = identifyMissingContext(facts);
    assert.ok(missing.includes('breathing_difficulty'));
  });
});
