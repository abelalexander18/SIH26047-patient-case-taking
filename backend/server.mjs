/**
 * Arogya AI - Node.js Backend API Server
 * Lightweight, zero-dependency REST API for clinical triage & medical report intake.
 * Supports CORS, JSON parsing, and ABDM compliance simulation.
 * 
 * To run:
 *   node backend/server.mjs
 */

import http from 'node:http';
import { processIntakeTurn, processReportDocument, generateReportFollowUpTurn } from './intelligenceBridge.mjs';
import { extractTextFromDocument, determineFileType } from './services/ocrService.mjs';
import { extractMedicalInformation } from './services/medicalReportExtractor.mjs';
import { checkAllReferenceRanges } from './services/referenceRangeChecker.mjs';
import {
  getAllCases,
  getCaseById,
  createCase,
  updateCase,
  addMessageTurnToCase,
  addReportToCase,
  saveDoctorNotes,
} from './services/caseStore.mjs';

const PORT = process.env.PORT || 5000;

const CLINICAL_STAGES = [
  {
    stage: 1,
    title: "Chief Complaint",
    progress: 15,
    quickReplies: [
      "Started since morning",
      "Past 2 to 3 days",
      "About a week ago",
      "After weather change / rain",
      "Comes and goes intermittently"
    ],
    generateReply: (text) => {
      const lower = (text || '').toLowerCase();
      if (lower.includes('fever') || lower.includes('bukhar') || lower.includes('chill')) {
        return "Noted regarding the fever and chills. When did this fever first start, and is it continuous or does it spike at specific times of day?";
      }
      if (lower.includes('headache') || lower.includes('sir dard') || lower.includes('migraine')) {
        return "I understand you are experiencing head pain. When did the headache begin, and is it accompanied by nausea or sensitivity to bright light?";
      }
      if (lower.includes('acidity') || lower.includes('gas') || lower.includes('stomach') || lower.includes('pet')) {
        return "Noted regarding your gastric discomfort. Did this start after eating specific food, and are you experiencing burning sensation or nausea?";
      }
      if (lower.includes('cough') || lower.includes('cold') || lower.includes('throat') || lower.includes('khansi')) {
        return "Understood. When did the cough or cold begin, and is it a dry cough or with phlegm/mucus?";
      }
      return "Thank you for describing that. When did you first notice these symptoms, and have they been constant or coming and going?";
    }
  },
  {
    stage: 2,
    title: "Onset & Duration",
    progress: 35,
    quickReplies: [
      "Mild (manageable, able to work)",
      "Moderate (noticeable discomfort)",
      "Severe (unable to work / rest needed)",
      "Continuous dull body ache",
      "High intensity with weakness"
    ],
    generateReply: () => "On a scale of mild, moderate, to severe, how intense is your discomfort right now? Does it hinder your daily work or sleep?"
  },
  {
    stage: 3,
    title: "Severity & Character",
    progress: 55,
    quickReplies: [
      "High fever with shivering",
      "Nausea & loss of appetite",
      "Severe fatigue & body pain",
      "Breathing tightness or wheezing",
      "No other associated symptoms"
    ],
    generateReply: () => "Are you noticing any accompanying symptoms such as high fever (>100°F), vomiting, loose motions, dizziness, loss of appetite, or breathing difficulty?"
  },
  {
    stage: 4,
    title: "Associated Symptoms",
    progress: 75,
    quickReplies: [
      "Took Paracetamol / Dolo-650 (temporary relief)",
      "Took Antacid / Pantoprazole",
      "Rest and warm water / kadha only",
      "No medicine taken yet",
      "Under existing doctor's prescription"
    ],
    generateReply: () => "Have you taken any medications like Dolo-650, Paracetamol, Pantocid/acidity tablets, or home remedies (kadha)? Any relief observed?"
  },
  {
    stage: 5,
    title: "Medical History & Allergies",
    progress: 90,
    quickReplies: [
      "No prior conditions or allergies",
      "Hypertension (taking daily BP tablets)",
      "Type 2 Diabetes (on Metformin / diet)",
      "Have uploaded prescription / lab report",
      "Everything noted, ready for doctor summary"
    ],
    generateReply: () => "Do you have any existing medical conditions like Diabetes (Sugar), Hypertension (BP), Thyroid, or any drug allergies (e.g., Penicillin)? You may also upload your latest lab reports or prescription slip."
  },
  {
    stage: 6,
    title: "Review & OPD Summary",
    progress: 100,
    quickReplies: ["End Interview & View Summary"],
    generateReply: () => "Dhanyavaad (Thank you). Your complete clinical intake has been compiled according to ABDM clinical standards. Your consulting doctor will review this summary before your consultation."
  }
];

const setCorsHeaders = (res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PATCH, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
};

const sendJson = (res, statusCode, data) => {
  setCorsHeaders(res);
  res.writeHead(statusCode, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(data));
};

const server = http.createServer((req, res) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    setCorsHeaders(res);
    res.writeHead(204);
    res.end();
    return;
  }

  const url = new URL(req.url, `http://${req.headers.host}`);

  // 1. Health check endpoint
  if (req.method === 'GET' && url.pathname === '/api/health') {
    return sendJson(res, 200, {
      status: 'ok',
      service: 'Arogya AI Clinical Gateway',
      region: 'IN',
      compliance: 'Designed with ABDM & DPDP Principles (Prototype)',
      timestamp: new Date().toISOString(),
    });
  }

  // 2. Case Repository Endpoints (Single Source of Truth for Doctor & Patient)
  // GET /api/cases - Return all intake cases for doctor queue
  if (req.method === 'GET' && url.pathname === '/api/cases') {
    const cases = getAllCases();
    return sendJson(res, 200, { cases, total: cases.length });
  }

  // POST /api/cases - Initialize or create patient intake case
  if (req.method === 'POST' && url.pathname === '/api/cases') {
    let body = '';
    req.on('data', (chunk) => { body += chunk; });
    req.on('end', () => {
      try {
        const payload = JSON.parse(body || '{}');
        const newCase = createCase(payload);
        return sendJson(res, 201, newCase);
      } catch (err) {
        return sendJson(res, 400, { error: 'Invalid case payload JSON' });
      }
    });
    return;
  }

  // GET /api/cases/:id/reports - Get reports attached to a case
  const caseReportsMatch = url.pathname.match(/^\/api\/cases\/([^/]+)\/reports$/);
  if (req.method === 'GET' && caseReportsMatch) {
    const caseId = decodeURIComponent(caseReportsMatch[1]);
    const targetCase = getCaseById(caseId);
    if (!targetCase) {
      return sendJson(res, 404, { error: `Case ${caseId} not found` });
    }
    return sendJson(res, 200, { reports: targetCase.reports || [] });
  }

  // PATCH /api/cases/:id or POST /api/cases/:id/notes - Save physician clinical orders & review status
  const caseNotesMatch = url.pathname.match(/^\/api\/cases\/([^/]+)(?:\/notes)?$/);
  if ((req.method === 'PATCH' || (req.method === 'POST' && url.pathname.includes('/notes'))) && caseNotesMatch) {
    const caseId = decodeURIComponent(caseNotesMatch[1]);
    let body = '';
    req.on('data', (chunk) => { body += chunk; });
    req.on('end', () => {
      try {
        const payload = JSON.parse(body || '{}');
        const updated = saveDoctorNotes(caseId, {
          doctorNotes: payload.doctorNotes !== undefined ? payload.doctorNotes : payload.notes,
          provisionalDiagnosis: payload.provisionalDiagnosis,
          reviewStatus: payload.reviewStatus || 'Reviewed',
        });
        if (!updated) {
          return sendJson(res, 404, { error: `Case ${caseId} not found` });
        }
        return sendJson(res, 200, { status: 'ok', case: updated });
      } catch (err) {
        return sendJson(res, 400, { error: 'Invalid JSON payload' });
      }
    });
    return;
  }

  // GET /api/cases/:id - Get complete clinical case details
  const singleCaseMatch = url.pathname.match(/^\/api\/cases\/([^/]+)$/);
  if (req.method === 'GET' && singleCaseMatch) {
    const caseId = decodeURIComponent(singleCaseMatch[1]);
    const targetCase = getCaseById(caseId);
    if (!targetCase) {
      return sendJson(res, 404, { error: `Case ${caseId} not found` });
    }
    return sendJson(res, 200, targetCase);
  }

  // 3. Chat interview message endpoint (Real OpenAI + Red Flag screening + Case Store sync)
  const caseMsgMatch = url.pathname.match(/^\/api\/cases\/([^/]+)\/messages$/);
  if (req.method === 'POST' && (url.pathname === '/api/interview/message' || caseMsgMatch)) {
    let body = '';
    req.on('data', (chunk) => {
      body += chunk;
    });

    req.on('end', async () => {
      try {
        const payload = JSON.parse(body || '{}');
        const {
          message,
          stageIndex = 0,
          history = [],
          existingHistory = null,
          reportContext = null,
          caseId = null,
          interviewId = null
        } = payload;

        if (!message || !message.trim()) {
          return sendJson(res, 400, { error: 'Patient message is required' });
        }

        const turnResult = await processIntakeTurn({
          message,
          existingHistory,
          conversationHistory: history,
          reportContext
        });

        const safeIndex = Math.min(Math.max(Number(stageIndex) || 0, 0), CLINICAL_STAGES.length - 1);
        const nextStageIndex = turnResult.progress >= 100 ? CLINICAL_STAGES.length - 1 : safeIndex + 1;

        const effectiveCaseId = caseId || interviewId || (caseMsgMatch ? decodeURIComponent(caseMsgMatch[1]) : null);
        let savedCase = null;
        if (effectiveCaseId) {
          savedCase = addMessageTurnToCase({
            caseId: effectiveCaseId,
            patientMessage: message,
            aiReply: turnResult.replyText,
            facts: turnResult.updatedHistory,
            screeningResult: turnResult.screeningResult,
            chips: turnResult.chips,
          });
        }

        return sendJson(res, 200, {
          replyText: turnResult.replyText,
          nextStageIndex,
          progress: turnResult.progress,
          chips: turnResult.chips,
          stageTitle: turnResult.stageTitle,
          timestamp: new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true }),
          updatedHistory: turnResult.updatedHistory,
          screeningResult: turnResult.screeningResult,
          screening_result: turnResult.screeningResult,
          missingFields: turnResult.missingFields,
          doctorSummary: turnResult.doctorSummary,
          source: turnResult.source,
          caseId: effectiveCaseId,
          case: savedCase,
        });
      } catch (err) {
        console.error('[Arogya AI Backend] Error processing message:', err);
        return sendJson(res, 500, { error: 'Internal server error processing clinical response' });
      }
    });
    return;
  }

  // 4. Complete Medical-Report Intelligence Pipeline Endpoint (Report OCR + OpenAI + Range Checker + Case Store)
  const caseRepMatch = url.pathname.match(/^\/api\/cases\/([^/]+)\/reports$/);
  if (req.method === 'POST' && (url.pathname === '/api/reports/process' || url.pathname === '/api/interview/upload' || caseRepMatch)) {
    const chunks = [];
    req.on('data', (chunk) => {
      chunks.push(chunk);
    });

    req.on('end', async () => {
      try {
        const buffer = Buffer.concat(chunks);
        const contentType = req.headers['content-type'] || 'application/octet-stream';
        
        let filename = 'medical_report.pdf';
        let mimeType = 'application/pdf';
        let fileBuffer = buffer;

        // Extract boundary if multipart form data
        let existingHistory = null;
        let conversationHistory = [];
        let caseId = null;
        const boundaryMatch = contentType.match(/boundary=(?:"([^"]+)"|([^;]+))/i);
        if (boundaryMatch) {
          const boundary = boundaryMatch[1] || boundaryMatch[2];
          const headerEnd = buffer.indexOf('\r\n\r\n');
          if (headerEnd !== -1) {
            const headerText = buffer.subarray(0, headerEnd).toString('utf-8');
            const fnMatch = headerText.match(/filename="([^"]+)"/i);
            if (fnMatch) filename = fnMatch[1];
            const typeMatch = headerText.match(/Content-Type:\s*([^\r\n]+)/i);
            if (typeMatch) mimeType = typeMatch[1].trim();

            const delimiter = Buffer.from(`\r\n--${boundary}`);
            const contentStart = headerEnd + 4;
            const contentEnd = buffer.indexOf(delimiter, contentStart);
            fileBuffer = contentEnd !== -1 ? buffer.subarray(contentStart, contentEnd) : buffer.subarray(contentStart);

            try {
              const bodyStr = buffer.toString('utf-8');
              const ehMatch = bodyStr.match(/name="existingHistory"\r\n\r\n([\s\S]*?)\r\n--/);
              if (ehMatch) existingHistory = JSON.parse(ehMatch[1]);
              const chMatch = bodyStr.match(/name="history"\r\n\r\n([\s\S]*?)\r\n--/);
              if (chMatch) conversationHistory = JSON.parse(chMatch[1]);
              const cidMatch = bodyStr.match(/name="(?:caseId|interviewId)"\r\n\r\n([^\r\n]+)\r\n--/);
              if (cidMatch) caseId = cidMatch[1].trim();
            } catch (pErr) {
              // Ignore non-critical context parse errors
            }
          }
        }

        // STEP 1: Determine file type
        const fileType = determineFileType(filename, mimeType);

        // STEP 2: Extract text using OCR / Text Extraction
        const ocrResult = await extractTextFromDocument(fileBuffer, filename, mimeType);

        // STEP 3: OpenAI Medical Information Extraction (or deterministic fallback)
        const structuredInfo = await extractMedicalInformation(ocrResult.rawText);

        // STEP 4: Deterministic Reference Range Checker
        const evaluatedReport = checkAllReferenceRanges(structuredInfo);

        // STEP 5: Construct complete doctor-facing and intake packet response
        const responsePayload = {
          id: `rep_${Date.now()}`,
          name: filename,
          size: `${(fileBuffer.length / 1024).toFixed(1)} KB`,
          fileType,
          documentType: evaluatedReport.laboratory_results?.length > 0 ? 'Lab Report' : 'Medical Report',
          reportDate: evaluatedReport.report_date || null,
          patient: evaluatedReport.patient || { name: null, age: null, sex: null },
          vitals: evaluatedReport.vitals || [],
          laboratoryResults: evaluatedReport.laboratory_results || [],
          // Backwards compatibility alias for components checking evaluatedAbnormalities
          evaluatedAbnormalities: evaluatedReport.laboratory_results || [],
          medications: evaluatedReport.medications || [],
          diagnosesMentioned: evaluatedReport.diagnoses_mentioned_in_report || [],
          investigations: evaluatedReport.investigations || [],
          rawText: ocrResult.rawText || '',
          rawTextPreview: (ocrResult.rawText || '').substring(0, 500),
          extractionStatus: ocrResult.extractionStatus || (evaluatedReport.laboratory_results?.length ? 'success' : 'uncertain'),
          abnormalCount: evaluatedReport.abnormal_count || 0,
          hasAbnormalValues: evaluatedReport.has_abnormal_values || false,
          limitationNotes: ocrResult.notes || [],
          status: ocrResult.extractionStatus || 'processed',
          message: 'Medical report processed through OCR, structured extraction, and reference range checker.',
          disclaimer: 'This is an automated information extraction and reference check summary. It does not constitute a medical diagnosis and requires clinical evaluation by a Registered Medical Practitioner (RMP).'
        };

        // STEP 6: Generate immediate context-aware follow-up question to continue the case-taking conversation
        const followUp = await generateReportFollowUpTurn({
          reportData: responsePayload,
          reportAnalysis: {
            abnormalCount: responsePayload.abnormalCount,
            hasAbnormalValues: responsePayload.hasAbnormalValues,
            evaluatedAbnormalities: responsePayload.evaluatedAbnormalities,
            extractionStatus: responsePayload.extractionStatus,
          },
          ocrResult,
          existingHistory,
          conversationHistory,
        });

        responsePayload.followUp = followUp;

        // STEP 7: Sync with Case Repository
        const effectiveCaseId = caseId || url.searchParams.get('caseId') || url.searchParams.get('interviewId') || (caseRepMatch ? decodeURIComponent(caseRepMatch[1]) : null);
        if (effectiveCaseId) {
          const updatedCase = addReportToCase({
            caseId: effectiveCaseId,
            reportPayload: responsePayload,
          });
          responsePayload.caseId = effectiveCaseId;
          responsePayload.case = updatedCase;
        }

        return sendJson(res, 200, responsePayload);
      } catch (err) {
        console.error('[Arogya AI Backend] Error processing medical report:', err);
        return sendJson(res, 500, {
          error: 'Error processing medical report',
          details: err.message
        });
      }
    });
    return;
  }

  // 4. Doctor summary endpoint
  if (req.method === 'POST' && url.pathname === '/api/interview/summary') {
    let body = '';
    req.on('data', (chunk) => { body += chunk; });
    req.on('end', () => {
      try {
        const payload = JSON.parse(body || '{}');
        return sendJson(res, 200, {
          status: 'ok',
          doctorSummary: payload.doctorSummary || 'Pre-consultation clinical intake completed.'
        });
      } catch (err) {
        return sendJson(res, 400, { error: 'Invalid summary payload' });
      }
    });
    return;
  }

  // Fallback 404
  sendJson(res, 404, { error: 'Endpoint not found' });
});

server.listen(PORT, () => {
  console.log(`[Arogya AI Backend] Server running on http://localhost:${PORT}`);
  console.log(`[Architecture] Designed with ABDM & DPDP Principles`);
});
