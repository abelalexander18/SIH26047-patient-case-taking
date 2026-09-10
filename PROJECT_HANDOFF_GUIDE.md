# Arogya AI (आरोग्य AI) — Project Handoff & Developer Guide

Welcome to the **Arogya AI** project! This document contains all the necessary information, architectural details, and instructions for continuing the development of this project.

---

## 1. Project Overview & Clinical Vision

**Arogya AI** is an AI-assisted pre-consultation intake and clinical triage system aligned with the **Ayushman Bharat Digital Mission (ABDM)** and the **Digital Personal Data Protection (DPDP) Act 2023**.

The application is structured into two complementary interfaces within a single unified React application:
1. **Patient Interface**: A guided, conversational intake where patients report symptoms step-by-step, answer clinical questions, upload medical records/prescriptions, and generate a pre-consultation summary.
2. **Doctor Interface (Doctor Dashboard & Triage Console)**: A physician-facing dashboard used by OPD doctors to review incoming patient cases, assess potential red flags, review AI-synthesized summaries and structured histories, inspect uploaded lab reports, verify transcripts, and record clinical notes/provisional diagnoses.

---

## 2. Tech Stack & Environment

- **Frontend**: React 19 (`react`, `react-dom` `^19.2.8`)
- **Build Tool**: Vite 8 (`@vitejs/plugin-react` `^6.1.0`)
- **Styling**: Tailwind CSS v4 (`tailwindcss`, `@tailwindcss/vite` `^4.3.3`)
- **Iconography**: Lucide React (`lucide-react` `^1.43.0`)
- **Linter**: Oxlint (`oxlint` `^1.79.0`)
- **Typography**: Google Font *Plus Jakarta Sans* (weights 300 to 800)
- **Backend API**: Node.js native HTTP server (`backend/server.mjs`, zero external dependencies)
- **Node Requirement**: Node.js v20.19+ or v22.12+ recommended

---

## 3. Quick Start & How to Run

### Step 1: Install Dependencies
```bash
npm install
```

### Step 2: Start the Development Server (Frontend)
```bash
npm run dev
```
The Vite development server runs at: **http://localhost:5173**

### Step 3: Start the Backend API Server
In a separate terminal:
```bash
npm run server
```
The Node.js backend server runs at: **http://localhost:5000**
- Health check: `http://localhost:5000/api/health`
- Intake API: `http://localhost:5000/api/interview/message`
- Upload API: `http://localhost:5000/api/interview/upload`

### Step 4: Build & Lint
```bash
npm run lint    # Runs oxlint
npm run build   # Creates production build in /dist
```

---

## 4. Project Directory Structure

```
ArogyaAI-Patient-System/
├── backend/
│   └── server.mjs                     # Native Node.js REST API server (CORS, health, interview, upload)
├── public/
│   ├── favicon.svg
│   └── icons.svg
├── src/
│   ├── App.css
│   ├── App.jsx                        # Master routing/switching between Patient & Doctor modes
│   ├── index.css                      # Tailwind CSS v4 setup & custom animations
│   ├── main.jsx                       # React 19 entry point
│   ├── assets/                        # Static image assets
│   ├── components/
│   │   ├── chat/                      # Patient Chat UI (ChatHeader, ChatInput, ChatMessage, ChatWindow, etc.)
│   │   ├── common/                    # Reusable UI components (Button, Badge, Modal)
│   │   ├── doctor/                    # Doctor Interface UI
│   │   │   ├── DoctorHeader.jsx       # Doctor navigation bar & role profile
│   │   │   ├── DoctorDashboardStats.jsx # Metric cards & safety triage alerts
│   │   │   ├── CaseList.jsx           # Searchable, filterable patient intake queue
│   │   │   ├── CaseDetails.jsx        # Complete case evaluation view
│   │   │   ├── RedFlagAlert.jsx       # Safety-critical red flags banner
│   │   │   ├── AiClinicalSummary.jsx  # AI-synthesized summary with verification disclaimer
│   │   │   ├── StructuredHistory.jsx  # 8-category EMR structured history + collapsible ROS
│   │   │   ├── MedicalReportViewer.jsx# Attached records & mock OCR lab extraction table
│   │   │   ├── ConversationTranscriptView.jsx # Original interview conversation audit log
│   │   │   └── DoctorNotesPanel.jsx   # Clinical remarks, provisional diagnosis & export
│   │   ├── landing/                   # Patient landing page components (Header, HeroVisual, TrustSection)
│   │   └── modals/                    # EndInterviewModal, SummaryModal
│   ├── context/
│   │   ├── InterviewContext.jsx       # Patient state manager (chat, upload, stage, viewMode)
│   │   └── DoctorContext.jsx          # Doctor state manager (cases, queue, notes, search, live sync)
│   ├── data/
│   │   ├── mockConversation.js        # 6 clinical intake stages & quick replies
│   │   └── mockCases.js               # Centralized patient cases database & doctor profile
│   ├── pages/
│   │   ├── LandingPage.jsx            # Patient landing page
│   │   ├── InterviewPage.jsx          # Live patient interview chat page
│   │   ├── CompletionPage.jsx         # Post-intake completion page
│   │   └── DoctorPortalPage.jsx       # Doctor Interface host page
│   └── services/
│       └── interviewService.js        # API service with offline triage engine fallback
├── docs/                              # Architecture documentation & walkthrough
├── .gitignore
├── .oxlintrc.json
├── index.html
├── package.json
├── README.md
└── vite.config.js
```

---

## 5. Key Architecture & Data Flows

### A. Navigation Without Complex Routing
The app currently uses clean React state for navigation without external router dependencies:
- In `InterviewContext.jsx`:
  - `viewMode`: `'patient' | 'doctor'`
  - `currentPage`: `'landing' | 'interview' | 'completion'`
- In `DoctorContext.jsx`:
  - `activeDoctorView`: `'dashboard' | 'cases' | 'details'`
  - `filter`: `'all' | 'red-flags' | 'needs-review' | 'reviewed'`

Users can switch back and forth between Patient Intake and Doctor Portal at any time using header buttons.

### B. Live Session Synchronization
When a patient completes an interview in the Patient Interface:
1. `InterviewContext` records `lastCompletedSession`.
2. `AppContent` in `App.jsx` listens for `lastCompletedSession` and calls `ingestPatientCase()` from `DoctorContext`.
3. The newly completed patient case is automatically converted into a structured clinical record and appears at the top of the Doctor Queue in real time!

### C. Clinical Safety & Medical Language Principles
- **AI Assistive Role**: AI is an assistant, never the diagnosing doctor.
- **Verification Disclaimer**: Every AI summary includes the notice:
  *"AI-synthesized summary to assist physician evaluation. Please verify directly against patient history."*
- **Non-Diagnostic Red Flags**: Alerts are phrased as *"Potential red flag detected — requires prompt review"* (never "Dengue detected" or "Meningitis detected").
- **Strict Color Semantics**: Red/Rose colors are strictly reserved for safety-critical clinical alerts.
- **No Fabricated Data**: Missing clinical data displays *"Not reported"*.
- **Lab Values**: Labeled as *"Within reference range"* or *"Outside reference range"*, not as diseases.

---

## 6. Centralized Mock Data Schema (`src/data/mockCases.js`)

Each case in `MOCK_CASES` follows this schema:
```javascript
{
  id: 'case-94021',
  intakeId: 'MED-94021',
  patient: {
    name: 'Ramesh Kumar',
    age: 34,
    gender: 'Male',
    phone: '+91 98765 43210',
    abhaId: '91-4920-8201-9482',
    bloodGroup: 'B+',
    location: 'Indirapuram, Ghaziabad (NCR)',
    emergencyContact: 'Sunita Kumar (Spouse) - +91 98765 43211',
  },
  intakeTime: 'Today, 10:15 AM',
  timestamp: '2026-09-10T10:15:00',
  status: 'Interview Completed',
  reviewStatus: 'Needs Review', // 'Needs Review' | 'Reviewed' | 'Accepted'
  triageCategory: 'Priority Review',
  chiefComplaint: 'High fever, shivering chills and persistent body ache for 3 days',
  hasRedFlags: true,
  redFlags: [ ... ],
  aiSummary: { ... },
  structuredHistory: { ... },
  messages: [ ... ],
  reports: [ ... ],
  doctorNotes: '',
  provisionalDiagnosis: '',
  reviewedAt: null,
}
```

---

## 7. Next Steps & Extension Ideas for the Next Phase

Here are logical next steps for the next developer:
1. **Production LLM Integration**: Connect `backend/server.mjs` to a real LLM (Gemini, Claude, or OpenAI) with a clinical prompt system to dynamically generate the dialogue and SOAP notes.
2. **Database Persistence**: Replace local memory state with MongoDB, PostgreSQL, or SQLite (storing patients, cases, transcripts, and doctor notes).
3. **ABDM / ABHA Integration**: Add ABHA number creation / verification flow via National Health Authority (NHA) sandbox APIs.
4. **Real OCR Pipeline**: Integrate Tesseract.js, AWS Textract, or Google Document AI in `backend/server.mjs` for real lab parameter extraction from PDFs and images.
5. **Prescription / E-Rx Generation**: Allow doctors to generate a signed digital prescription PDF with QR code following National Medical Commission (NMC) guidelines.
6. **Multi-language Support (Bhashini / Indian Languages)**: Extend conversational triage to Hindi, Tamil, Telugu, Bengali, Marathi, etc.
