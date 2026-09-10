/**
 * Arogya AI - Node.js Backend API Server
 * Lightweight, zero-dependency REST API for clinical triage & medical report intake.
 * Supports CORS, JSON parsing, and ABDM compliance simulation.
 * 
 * To run:
 *   node backend/server.mjs
 */

import http from 'node:http';

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
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
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
      compliance: 'ABDM & DPDP Act 2023 Aligned',
      timestamp: new Date().toISOString(),
    });
  }

  // 2. Chat interview message endpoint
  if (req.method === 'POST' && url.pathname === '/api/interview/message') {
    let body = '';
    req.on('data', (chunk) => {
      body += chunk;
    });

    req.on('end', () => {
      try {
        const payload = JSON.parse(body || '{}');
        const { message, stageIndex = 0 } = payload;

        if (!message || !message.trim()) {
          return sendJson(res, 400, { error: 'Patient message is required' });
        }

        const safeIndex = Math.min(Math.max(Number(stageIndex) || 0, 0), CLINICAL_STAGES.length - 1);
        const currentStage = CLINICAL_STAGES[safeIndex];

        let replyText = '';
        let nextStageIndex = safeIndex + 1;
        let progress = 100;
        let chips = [];
        let stageTitle = currentStage.title;

        if (safeIndex < CLINICAL_STAGES.length - 1) {
          replyText = currentStage.generateReply(message);
          const nextStage = CLINICAL_STAGES[nextStageIndex];
          progress = nextStage.progress;
          chips = nextStage.quickReplies || [];
          stageTitle = nextStage.title;
        } else {
          replyText = "Dhanyavaad. Your responses are securely compiled for your consulting doctor. Please click 'End Interview' to finalize your intake report.";
          progress = 100;
          chips = ["End Interview & View Summary"];
          stageTitle = "Intake Complete";
        }

        return sendJson(res, 200, {
          replyText,
          nextStageIndex,
          progress,
          chips,
          stageTitle,
          timestamp: new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true }),
        });
      } catch (err) {
        return sendJson(res, 500, { error: 'Internal server error processing clinical response' });
      }
    });
    return;
  }

  // 3. Report upload endpoint
  if (req.method === 'POST' && url.pathname === '/api/interview/upload') {
    // In pure http, handle basic stream reception
    let bytesReceived = 0;
    req.on('data', (chunk) => {
      bytesReceived += chunk.length;
    });

    req.on('end', () => {
      return sendJson(res, 200, {
        id: `abdm_doc_${Date.now()}`,
        status: 'uploaded',
        message: 'Medical report encrypted & linked to patient ABDM record',
        size: `${(bytesReceived / 1024).toFixed(1)} KB`,
      });
    });
    return;
  }

  // Fallback 404
  sendJson(res, 404, { error: 'Endpoint not found' });
});

server.listen(PORT, () => {
  console.log(`[Arogya AI Backend] Server running on http://localhost:${PORT}`);
  console.log(`[Compliance] ABDM & DPDP Act 2023 Gateway Active`);
});
