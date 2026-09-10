import React, { createContext, useContext, useState, useCallback, useMemo } from 'react';
import { MOCK_CASES, MOCK_DOCTOR_PROFILE } from '../data/mockCases';
import { getFormattedDate, getFormattedTime } from '../services/interviewService';

const DoctorContext = createContext(null);

export const DoctorProvider = ({ children }) => {
  const [cases, setCases] = useState(MOCK_CASES);
  const [selectedCaseId, setSelectedCaseId] = useState('case-94021'); // Default to Ramesh Kumar for immediate preview
  const [activeDoctorView, setActiveDoctorView] = useState('dashboard'); // 'dashboard' | 'cases' | 'details'
  const [filter, setFilter] = useState('all'); // 'all' | 'red-flags' | 'needs-review' | 'reviewed'
  const [searchQuery, setSearchQuery] = useState('');
  const [toastMessage, setToastMessage] = useState(null);

  const showToast = useCallback((msg) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  }, []);

  const selectCase = useCallback((id) => {
    setSelectedCaseId(id);
    setActiveDoctorView('details');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, []);

  const goToDashboard = useCallback(() => {
    setActiveDoctorView('dashboard');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, []);

  const goToCases = useCallback(() => {
    setActiveDoctorView('cases');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, []);

  const selectedCase = useMemo(() => {
    return cases.find((c) => c.id === selectedCaseId) || cases[0] || null;
  }, [cases, selectedCaseId]);

  // Update physician notes and provisional diagnosis
  const updateDoctorNotes = useCallback((caseId, notes, provisionalDiagnosis) => {
    setCases((prevCases) =>
      prevCases.map((c) => {
        if (c.id === caseId) {
          return {
            ...c,
            doctorNotes: notes,
            provisionalDiagnosis: provisionalDiagnosis,
            reviewedAt: `${getFormattedDate()} at ${getFormattedTime()} (IST) by Dr. Ananya Sharma`,
          };
        }
        return c;
      })
    );
    showToast('Clinical notes and provisional diagnosis updated successfully.');
  }, [showToast]);

  // Mark case as reviewed
  const markCaseReviewed = useCallback((caseId) => {
    setCases((prevCases) =>
      prevCases.map((c) => {
        if (c.id === caseId) {
          return {
            ...c,
            reviewStatus: 'Reviewed',
            reviewedAt: `${getFormattedDate()} at ${getFormattedTime()} (IST) by Dr. Ananya Sharma`,
          };
        }
        return c;
      })
    );
    showToast('Case marked as Reviewed.');
  }, [showToast]);

  // Mark case as accepted / consultation initiated
  const acceptCase = useCallback((caseId) => {
    setCases((prevCases) =>
      prevCases.map((c) => {
        if (c.id === caseId) {
          return {
            ...c,
            reviewStatus: 'Accepted',
            status: 'Consultation In-Progress',
            reviewedAt: `${getFormattedDate()} at ${getFormattedTime()} (IST) by Dr. Ananya Sharma`,
          };
        }
        return c;
      })
    );
    showToast('Case accepted for physician consultation.');
  }, [showToast]);

  // Export clinical case dossier for physician records
  const exportCaseReport = useCallback((caseId) => {
    const targetCase = cases.find((c) => c.id === caseId);
    if (!targetCase) return;

    const content = `======================================================================
AROGYA AI (आरोग्य AI) - PHYSICIAN CLINICAL CASE DOSSIER
Consulting Physician: ${MOCK_DOCTOR_PROFILE.name} (${MOCK_DOCTOR_PROFILE.qualifications})
Hospital: ${MOCK_DOCTOR_PROFILE.hospital}
Registration: ${MOCK_DOCTOR_PROFILE.nmcRegistration}
======================================================================

PATIENT DEMOGRAPHICS:
Patient Name          : ${targetCase.patient.name}
Intake ID             : ${targetCase.intakeId}
Age / Sex             : ${targetCase.patient.age} Y / ${targetCase.patient.gender}
ABHA Health ID        : ${targetCase.patient.abhaId || 'Not reported'}
Blood Group           : ${targetCase.patient.bloodGroup || 'Not reported'}
Intake Timestamp      : ${targetCase.intakeTime}
Current Status        : ${targetCase.status} (Review: ${targetCase.reviewStatus})

----------------------------------------------------------------------
POTENTIAL RED FLAGS & SAFETY ALERTS:
${targetCase.hasRedFlags && targetCase.redFlags.length > 0
  ? targetCase.redFlags.map((rf, i) => `[FLAG ${i + 1}] ${rf.title.toUpperCase()}\n- ${rf.description}\n- Guidance: ${rf.clinicalGuidance}`).join('\n\n')
  : 'No potential red flags identified from configured screening rules.'}

----------------------------------------------------------------------
AI CLINICAL INTAKE SUMMARY:
* Notice: AI-synthesized summary to assist physician evaluation. Please verify directly against patient history.
Chief Complaint       : ${targetCase.aiSummary?.chiefComplaint || targetCase.chiefComplaint}
Symptom Chronology    : ${targetCase.aiSummary?.hpiChronology || 'Not reported'}
Severity & Impact     : ${targetCase.aiSummary?.severity || 'Not reported'}
Associated Symptoms   : ${targetCase.aiSummary?.associatedSymptoms || 'Not reported'}
Current Medications   : ${targetCase.aiSummary?.currentMedications || 'Not reported'}
Medical History       : ${targetCase.aiSummary?.relevantMedicalHistory || 'Not reported'}
Allergies             : ${targetCase.aiSummary?.allergies || 'Not reported'}
Uploaded Lab Reports  : ${targetCase.aiSummary?.uploadedReports || 'None'}

----------------------------------------------------------------------
STRUCTURED CLINICAL HISTORY:
1. Chief Complaint              : ${targetCase.structuredHistory?.chiefComplaint || 'Not reported'}
2. History of Present Illness   : ${targetCase.structuredHistory?.historyOfPresentIllness || 'Not reported'}
3. Past Medical History         : ${targetCase.structuredHistory?.pastMedicalHistory || 'Not reported'}
4. Current Medications          : ${targetCase.structuredHistory?.currentMedications || 'Not reported'}
5. Drug Allergies               : ${targetCase.structuredHistory?.allergies || 'Not reported'}
6. Family History               : ${targetCase.structuredHistory?.familyHistory || 'Not reported'}
7. Personal / Social History    : ${targetCase.structuredHistory?.personalSocialHistory || 'Not reported'}
8. Investigations / Labs        : ${targetCase.structuredHistory?.investigations || 'Not reported'}

----------------------------------------------------------------------
PHYSICIAN CLINICAL ASSESSMENT:
Provisional Diagnosis : ${targetCase.provisionalDiagnosis || '[Pending Doctor Evaluation]'}
Clinical Remarks      : ${targetCase.doctorNotes || '[No remarks entered yet]'}
Review Timestamp      : ${targetCase.reviewedAt || 'Pending Review'}

----------------------------------------------------------------------
CONVERSATION TRANSCRIPT:
${targetCase.messages
  .map(
    (m) => `[${m.timestamp}] ${m.sender === 'ai' ? 'AROGYA AI' : targetCase.patient.name.toUpperCase()}:
${m.text}
`
  )
  .join('\n')}

======================================================================
COMPLIANCE & LEGAL NOTICE:
Generated under the Ayushman Bharat Digital Mission (ABDM) guidelines
and Digital Personal Data Protection (DPDP) Act 2023.
This document is strictly for clinical review by the registered physician.
======================================================================`;

    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `Arogya_Physician_Case_${targetCase.intakeId}.txt`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    showToast(`Case report for ${targetCase.intakeId} downloaded.`);
  }, [cases, showToast]);

  // Dynamically ingest an interview session completed by a patient in the current browser session
  const ingestPatientCase = useCallback((patientSession) => {
    if (!patientSession || !patientSession.interviewId) return;

    // Check if already ingested
    if (cases.some((c) => c.intakeId === patientSession.interviewId)) return;

    // Extract first patient response to determine chief complaint
    const firstPatientMsg = patientSession.messages.find((m) => m.sender === 'patient');
    const complaintText = firstPatientMsg ? firstPatientMsg.text : 'Pre-consultation clinical intake';

    // Simple heuristic for red flags screening in new session
    const allPatientText = patientSession.messages
      .filter((m) => m.sender === 'patient')
      .map((m) => m.text)
      .join(' ')
      .toLowerCase();

    const isHighFeverVomit = (allPatientText.includes('fever') || allPatientText.includes('bukhar')) &&
      (allPatientText.includes('vomit') || allPatientText.includes('dizziness') || allPatientText.includes('severe'));

    const newCase = {
      id: `case-${patientSession.interviewId.toLowerCase().replace(/[^a-z0-9]/g, '')}`,
      intakeId: patientSession.interviewId,
      patient: {
        name: 'Live Patient Intake',
        age: 38,
        gender: 'Not specified',
        phone: '+91 (Live Session)',
        abhaId: 'ABHA-IN-LIVE',
        bloodGroup: 'Not reported',
        location: 'OPD Digital Intake Terminal',
        emergencyContact: 'Not reported',
      },
      intakeTime: 'Just now',
      timestamp: new Date().toISOString(),
      status: 'Interview Completed',
      reviewStatus: 'Needs Review',
      triageCategory: isHighFeverVomit ? 'Priority Review' : 'Routine Review',
      chiefComplaint: complaintText,
      hasRedFlags: isHighFeverVomit,
      redFlags: isHighFeverVomit
        ? [
            {
              id: `rf-live-${Date.now()}`,
              title: 'Potential red flag detected — requires prompt review',
              severity: 'high',
              description: 'Patient reported severe discomfort with febrile or gastric symptoms requiring prompt physician assessment.',
              category: 'Clinical Triage Alert',
              clinicalGuidance: 'Evaluate vital signs and rule out acute dehydration or sepsis.',
            },
          ]
        : [],
      aiSummary: {
        title: 'AI Clinical Intake Summary',
        chiefComplaint: complaintText,
        hpiChronology: `Patient completed ${patientSession.answeredCount} intake questions conversationally. Full dialogue recorded in transcript.`,
        severity: 'Synthesized from conversational responses.',
        associatedSymptoms: 'Recorded in conversation transcript.',
        currentMedications: 'Recorded in clinical dialogue.',
        relevantMedicalHistory: 'Not reported',
        allergies: 'Not reported',
        uploadedReports: patientSession.uploadedFile ? `${patientSession.uploadedFile.name} (${patientSession.uploadedFile.size})` : 'None uploaded',
        disclaimer: 'AI-synthesized summary to assist physician evaluation. Please verify directly against patient history.',
      },
      structuredHistory: {
        chiefComplaint: complaintText,
        historyOfPresentIllness: `Live intake completed at ${getFormattedTime()}. See verbatim transcript below.`,
        pastMedicalHistory: 'Not reported',
        currentMedications: 'Not reported',
        allergies: 'Not reported',
        familyHistory: 'Not reported',
        personalSocialHistory: 'Not reported',
        reviewOfSystems: {
          constitutional: 'Assessed in interview',
          respiratory: 'Not reported',
          gastrointestinal: 'Not reported',
          cardiovascular: 'Not reported',
          neurological: 'Not reported',
          musculoskeletal: 'Not reported',
          dermatological: 'Not reported',
        },
        investigations: patientSession.uploadedFile ? `Uploaded report: ${patientSession.uploadedFile.name}` : 'Not reported',
      },
      messages: patientSession.messages,
      reports: patientSession.uploadedFile
        ? [
            {
              id: `rep-live-${Date.now()}`,
              name: patientSession.uploadedFile.name,
              type: patientSession.uploadedFile.type || 'application/pdf',
              size: patientSession.uploadedFile.size,
              uploadedAt: getFormattedTime(),
              status: 'Attached (Awaiting Physician Review)',
              documentCategory: 'Patient Uploaded Record',
              laboratory: 'External Diagnostic Record',
              extractedData: [
                {
                  parameter: 'Report Verification',
                  value: 'File received & attached',
                  referenceRange: 'Visual inspection required',
                  status: 'Within reference range',
                  clinicalNote: 'Uploaded document attached for attending physician review',
                },
              ],
            },
          ]
        : [],
      doctorNotes: '',
      provisionalDiagnosis: '',
      reviewedAt: null,
    };

    setCases((prev) => [newCase, ...prev]);
    showToast(`New patient intake ${patientSession.interviewId} added to Doctor Queue.`);
  }, [cases, showToast]);

  // Filtered cases based on search & active filter
  const filteredCases = useMemo(() => {
    return cases.filter((c) => {
      // Filter tab
      if (filter === 'red-flags' && !c.hasRedFlags) return false;
      if (filter === 'needs-review' && c.reviewStatus !== 'Needs Review') return false;
      if (filter === 'reviewed' && c.reviewStatus !== 'Reviewed' && c.reviewStatus !== 'Accepted') return false;

      // Search query
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase().trim();
        const matchName = c.patient.name.toLowerCase().includes(query);
        const matchId = c.intakeId.toLowerCase().includes(query);
        const matchComplaint = c.chiefComplaint.toLowerCase().includes(query);
        return matchName || matchId || matchComplaint;
      }

      return true;
    });
  }, [cases, filter, searchQuery]);

  // Aggregate stats
  const stats = useMemo(() => {
    const total = cases.length;
    const needsReview = cases.filter((c) => c.reviewStatus === 'Needs Review').length;
    const redFlags = cases.filter((c) => c.hasRedFlags).length;
    const reviewed = cases.filter((c) => c.reviewStatus === 'Reviewed' || c.reviewStatus === 'Accepted').length;
    return { total, needsReview, redFlags, reviewed };
  }, [cases]);

  const value = {
    cases,
    filteredCases,
    selectedCaseId,
    selectedCase,
    activeDoctorView,
    filter,
    searchQuery,
    doctorProfile: MOCK_DOCTOR_PROFILE,
    stats,
    toastMessage,
    selectCase,
    goToDashboard,
    goToCases,
    setActiveDoctorView,
    setFilter,
    setSearchQuery,
    updateDoctorNotes,
    markCaseReviewed,
    acceptCase,
    exportCaseReport,
    ingestPatientCase,
    showToast,
  };

  return <DoctorContext.Provider value={value}>{children}</DoctorContext.Provider>;
};

export const useDoctor = () => {
  const context = useContext(DoctorContext);
  if (!context) {
    throw new Error('useDoctor must be used within a DoctorProvider');
  }
  return context;
};
