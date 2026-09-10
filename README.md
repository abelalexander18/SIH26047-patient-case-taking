# Arogya AI (आरोग्य AI) — AI-Powered Patient Case-Taking System

A clinical-grade patient interview and pre-consultation intake web application built with **React**, **Vite**, **Tailwind CSS**, and **Lucide React**, aligned with India's **ABDM (Ayushman Bharat Digital Mission)** and **DPDP Act 2023** standards.

---

## 🚀 Quick Start

### 1. Install Dependencies
```bash
npm install
```

### 2. Start the Frontend Development Server
```bash
npm run dev
```
Open [http://localhost:5173](http://localhost:5173) in your browser.

### 3. Start the Backend REST API Server (Optional)
```bash
npm run server
```
Runs the lightweight clinical API server on [http://localhost:5000](http://localhost:5000).
*(Note: If the backend server is not running, the frontend automatically falls back to the intelligent client-side clinical triage engine seamlessly).*

### 4. Build for Production
```bash
npm run build
```

---

## 📂 Project Structure

```
├── backend/
│   └── server.mjs             # Standalone Node.js REST API server (zero dependencies)
├── public/
│   └── favicon.svg            # Clinical SVG favicon
├── src/
│   ├── components/
│   │   ├── chat/              # ChatHeader, ChatInput, ChatMessage, ChatWindow, ProgressBar, ReportUploadModal, TypingIndicator
│   │   ├── common/            # Button, Badge, Modal
│   │   ├── landing/           # Header, HeroVisual (abstract healthcare visual), TrustSection
│   │   └── modals/            # EndInterviewModal, SummaryModal
│   ├── context/
│   │   └── InterviewContext.jsx # Central state management for patient intake
│   ├── data/
│   │   └── mockConversation.js # Multi-stage clinical dialogue & quick replies (Indian context)
│   ├── pages/
│   │   ├── LandingPage.jsx    # Welcome screen with emergency notice (112/108) & trust pillars
│   │   ├── InterviewPage.jsx  # ChatGPT-style patient triage conversation
│   │   └── CompletionPage.jsx # Post-intake completion card, direct "Start New Interview" & "Home"
│   ├── services/
│   │   └── interviewService.js # REST API client with offline fallback & report generation
│   ├── App.jsx                # Main route controller
│   ├── index.css              # Tailwind CSS imports & animations
│   └── main.jsx               # React entrypoint
├── index.html                 # Main HTML with Plus Jakarta Sans typography
├── package.json
└── vite.config.js
```

---

## 🎨 Healthcare Design System Summary

For building the Doctor interface or extending components:

- **Primary Color**: Deep Healthcare Navy (`#0F172A` / `bg-slate-900`)
- **Secondary Color**: Medical Blue (`#2563EB` / `bg-blue-600`)
- **Accent Color**: Soft Medical Teal (`#0D9488` / `text-teal-600`, `bg-teal-50`)
- **Background**: Soft Gray-White (`#F8FAFC` / `bg-slate-50`)
- **Surfaces**: Pure Crisp White (`#FFFFFF` / `bg-white`)
- **Borders**: Soft Neutral (`#E2E8F0` / `border-slate-200`)
- **Card Radius**: `rounded-2xl` (`16px`)
- **Button Radius**: `rounded-xl` (`10px`–`12px`)
- **Typography**: `Plus Jakarta Sans` / `Inter`
- **Iconography**: `lucide-react`
- **Safety Standard**: Red (`#DC2626` / `bg-red-50`) is strictly reserved for safety-critical potential red flags.
- **Emergency Helplines**: 112 (National Emergency) & 108 (Ambulance Helpline).
