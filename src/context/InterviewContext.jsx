import React, { createContext, useContext, useState, useCallback, useRef } from 'react';
import { INITIAL_AI_MESSAGE } from '../data/mockConversation';
import {
  sendMessage,
  uploadReport,
  downloadClinicalReport,
  getFormattedTime
} from '../services/interviewService';
import { createCaseOnBackend } from '../services/caseService';

const InterviewContext = createContext(null);

export const InterviewProvider = ({ children }) => {
  const [viewMode, setViewMode] = useState('patient'); // 'patient' | 'doctor'
  const [currentPage, setCurrentPage] = useState('landing'); // 'landing' | 'interview' | 'completion'
  const [interviewId, setInterviewId] = useState(() => `MED-${Math.floor(10000 + Math.random() * 90000)}`);
  
  const [messages, setMessages] = useState([INITIAL_AI_MESSAGE]);
  const [currentStageIndex, setCurrentStageIndex] = useState(0);
  const [progress, setProgress] = useState(15);
  const [isTyping, setIsTyping] = useState(false);
  
  // Clinical Intelligence & Red Flag State
  const [existingHistory, setExistingHistory] = useState(null);
  const [screeningResult, setScreeningResult] = useState(null);
  const [redFlagResult, setRedFlagResult] = useState(null);
  const [missingFields, setMissingFields] = useState([]);
  const [doctorSummary, setDoctorSummary] = useState('');
  
  // File upload state
  const [uploadedFile, setUploadedFile] = useState(null);
  const [reportContext, setReportContext] = useState(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadError, setUploadError] = useState(null);
  
  // Modals state
  const [isEndModalOpen, setIsEndModalOpen] = useState(false);
  const [isSummaryModalOpen, setIsSummaryModalOpen] = useState(false);
  const [isReportModalOpen, setIsReportModalOpen] = useState(false);
  
  // Metrics
  const [answeredCount, setAnsweredCount] = useState(0);
  const [startTime, setStartTime] = useState(null);
  const [endTime, setEndTime] = useState(null);

  const startInterview = useCallback(() => {
    setViewMode('patient');
    setStartTime(new Date());
    setCurrentPage('interview');
    setMessages((prev) => (prev && prev.length > 0 ? prev : [INITIAL_AI_MESSAGE]));
    createCaseOnBackend({
      id: `case-${interviewId.toLowerCase().replace(/[^a-z0-9]/g, '')}`,
      intakeId: interviewId,
      chiefComplaint: 'Pre-consultation clinical intake',
      status: 'in_progress',
    });
  }, [interviewId]);

  const sendPatientMessage = useCallback(async (userText) => {
    if (!userText.trim() || isTyping) return;

    const patientMsg = {
      id: `patient-${Date.now()}`,
      sender: 'patient',
      text: userText.trim(),
      timestamp: getFormattedTime(),
    };

    setMessages((prev) => [...prev, patientMsg]);
    setAnsweredCount((c) => c + 1);
    setIsTyping(true);

    try {
      const response = await sendMessage(userText, currentStageIndex, messages, existingHistory, reportContext, interviewId);
      
      if (response.updatedHistory) {
        setExistingHistory(response.updatedHistory);
      }
      if (response.screeningResult || response.redFlagResult) {
        const flagRes = response.redFlagResult || response.screeningResult;
        setScreeningResult(flagRes);
        setRedFlagResult(flagRes);
      }
      if (response.missingFields) {
        setMissingFields(response.missingFields);
      }
      if (response.doctorSummary) {
        setDoctorSummary(response.doctorSummary);
      }

      const aiMsg = {
        id: `ai-${Date.now()}`,
        sender: 'ai',
        text: response.replyText,
        timestamp: getFormattedTime(),
        chips: response.chips,
        screeningResult: response.screeningResult || response.redFlagResult,
        redFlagResult: response.redFlagResult || response.screeningResult,
      };

      setMessages((prev) => [...prev, aiMsg]);
      setCurrentStageIndex(response.nextStageIndex);
      setProgress(response.progress);
    } catch (error) {
      console.error('Failed to get AI response:', error);
      const fallbackMsg = {
        id: `ai-err-${Date.now()}`,
        sender: 'ai',
        text: "I understand. Could you tell me a little more about how that impacts your day-to-day activities?",
        timestamp: getFormattedTime(),
        chips: ["Impacts sleep", "Hard to concentrate", "Manageable with rest"]
      };
      setMessages((prev) => [...prev, fallbackMsg]);
    } finally {
      setIsTyping(false);
    }
  }, [currentStageIndex, isTyping, messages, existingHistory, reportContext, interviewId]);

  const selectQuickReply = useCallback((chipText) => {
    if (chipText.toLowerCase().includes('end interview') || chipText.toLowerCase().includes('view summary')) {
      setIsEndModalOpen(true);
      return;
    }
    sendPatientMessage(chipText);
  }, [sendPatientMessage]);

  const handleFileUpload = useCallback(async (file) => {
    setIsUploading(true);
    setUploadProgress(0);
    setUploadError(null);

    try {
      const fileData = await uploadReport(file, (p) => setUploadProgress(p), {
        existingHistory,
        history: messages,
        caseId: interviewId,
        interviewId,
      });
      setUploadedFile(fileData);

      // Structure reportContext object
      const newReportData = {
        fileName: fileData.name,
        fileSize: fileData.size,
        patient: fileData.patient || null,
        reportDate: fileData.reportDate || null,
        vitals: fileData.vitals || [],
        laboratoryResults: fileData.laboratoryResults || [],
        medications: fileData.medications || [],
        diagnosesMentioned: fileData.diagnosesMentioned || [],
        investigations: fileData.investigations || [],
      };

      const newReportAnalysis = {
        abnormalCount: fileData.abnormalCount || 0,
        hasAbnormalValues: fileData.hasAbnormalValues || false,
        evaluatedAbnormalities: fileData.evaluatedAbnormalities || [],
        extractionStatus: fileData.extractionStatus || fileData.status || 'success',
      };

      // CASE 5: Support multiple uploads by preserving history and merging
      setReportContext((prev) => {
        const prevHistory = prev?.reportHistory || (prev?.reportData ? [prev.reportData] : []);
        return {
          reportData: newReportData,
          reportAnalysis: newReportAnalysis,
          ocrText: fileData.rawText || '',
          reportProcessed: true,
          uploadedAt: fileData.uploadedAt || getFormattedTime(),
          reportHistory: [...prevHistory, newReportData],
        };
      });

      // Extract follow-up question and context from backend
      const followUp = fileData.followUp;
      let fileNoticeText = followUp?.replyText;
      let chips = followUp?.chips || [];

      if (!fileNoticeText) {
        // Fallback if followUp is not provided
        fileNoticeText = `I've reviewed the information available in your report: "${fileData.name}". I'd like to clarify a few details to complete your case.`;
        const allAbnormal = [
          ...(fileData.vitals || []).filter((v) => v.status === 'high' || v.status === 'low'),
          ...(fileData.laboratoryResults || []).filter((l) => l.status === 'high' || l.status === 'low')
        ];
        if (allAbnormal.length > 0) {
          fileNoticeText += `\n\nNotable parameters flagged for physician review:\n• ${allAbnormal.map(a => `${a.test_name || a.name}: ${a.value} ${a.unit} (${String(a.status).toUpperCase()}) — Outside configured reference range — physician review recommended.`).join('\n• ')}`;
          chips = ['Yes, taking medication for this', 'No medication taken', 'Recently stopped medication'];
        } else {
          chips = ['No symptoms today, routine checkup', 'Mild discomfort', 'End Interview & View Summary'];
        }
      }

      if (followUp?.updatedHistory) {
        setExistingHistory(followUp.updatedHistory);
      }
      if (followUp?.missingFields) {
        setMissingFields(followUp.missingFields);
      }
      if (followUp?.screeningResult) {
        setScreeningResult(followUp.screeningResult);
        setRedFlagResult(followUp.screeningResult);
      }

      const attachmentNote = {
        id: `ai-file-notice-${Date.now()}`,
        sender: 'ai',
        text: fileNoticeText,
        timestamp: getFormattedTime(),
        attachedFile: fileData,
        chips: chips.length > 0 ? chips : ['Continue with consultation']
      };

      setMessages((prev) => [...prev, attachmentNote]);
      setIsReportModalOpen(false);
      return fileData;
    } catch (err) {
      setUploadError(err.message || 'Failed to upload report');
      throw err;
    } finally {
      setIsUploading(false);
    }
  }, [existingHistory, messages, interviewId]);

  const removeUploadedFile = useCallback(() => {
    setUploadedFile(null);
    setReportContext(null);
    setUploadProgress(0);
    setUploadError(null);
  }, []);

  const openEndModal = useCallback(() => setIsEndModalOpen(true), []);
  const closeEndModal = useCallback(() => setIsEndModalOpen(false), []);

  const confirmEndInterview = useCallback(() => {
    setIsEndModalOpen(false);
    setEndTime(new Date());
    setCurrentPage('completion');
    createCaseOnBackend({
      id: `case-${interviewId.toLowerCase().replace(/[^a-z0-9]/g, '')}`,
      intakeId: interviewId,
      status: 'Interview Completed',
    });
  }, [interviewId]);

  const openReportModal = useCallback(() => setIsReportModalOpen(true), []);
  const closeReportModal = useCallback(() => {
    if (!isUploading) {
      setIsReportModalOpen(false);
      setUploadError(null);
    }
  }, [isUploading]);

  const openSummaryModal = useCallback(() => setIsSummaryModalOpen(true), []);
  const closeSummaryModal = useCallback(() => setIsSummaryModalOpen(false), []);

  // Start a fresh new interview directly (immediately navigates to 'interview')
  const startNewInterview = useCallback(() => {
    setViewMode('patient');
    setInterviewId(`MED-${Math.floor(10000 + Math.random() * 90000)}`);
    setMessages([INITIAL_AI_MESSAGE]);
    setCurrentStageIndex(0);
    setProgress(15);
    setIsTyping(false);
    setExistingHistory(null);
    setScreeningResult(null);
    setRedFlagResult(null);
    setMissingFields([]);
    setDoctorSummary('');
    setUploadedFile(null);
    setReportContext(null);
    setUploadProgress(0);
    setUploadError(null);
    setIsEndModalOpen(false);
    setIsSummaryModalOpen(false);
    setIsReportModalOpen(false);
    setAnsweredCount(0);
    setStartTime(new Date());
    setEndTime(null);
    setCurrentPage('interview');
  }, []);

  // Return to the Landing/Home page
  const goToHome = useCallback(() => {
    setViewMode('patient');
    setInterviewId(`MED-${Math.floor(10000 + Math.random() * 90000)}`);
    setMessages([INITIAL_AI_MESSAGE]);
    setCurrentStageIndex(0);
    setProgress(15);
    setIsTyping(false);
    setExistingHistory(null);
    setScreeningResult(null);
    setRedFlagResult(null);
    setMissingFields([]);
    setDoctorSummary('');
    setUploadedFile(null);
    setReportContext(null);
    setUploadProgress(0);
    setUploadError(null);
    setIsEndModalOpen(false);
    setIsSummaryModalOpen(false);
    setIsReportModalOpen(false);
    setAnsweredCount(0);
    setStartTime(null);
    setEndTime(null);
    setCurrentPage('landing');
  }, []);

  const resetInterview = goToHome;

  const handleDownloadReport = useCallback(() => {
    downloadClinicalReport({
      interviewId,
      answeredCount,
      uploadedReportName: uploadedFile ? uploadedFile.name : null,
      uploadedFile,
      messages,
      screeningResult,
      redFlagResult,
      doctorSummary,
    });
  }, [interviewId, answeredCount, uploadedFile, messages, screeningResult, redFlagResult, doctorSummary]);

  const value = {
    viewMode,
    setViewMode,
    currentPage,
    setCurrentPage,
    interviewId,
    messages,
    progress,
    isTyping,
    existingHistory,
    screeningResult,
    redFlagResult,
    missingFields,
    doctorSummary,
    uploadedFile,
    reportContext,
    setReportContext,
    isUploading,
    uploadProgress,
    uploadError,
    isEndModalOpen,
    isSummaryModalOpen,
    isReportModalOpen,
    answeredCount,
    startTime,
    endTime,
    startInterview,
    startNewInterview,
    goToHome,
    sendPatientMessage,
    selectQuickReply,
    handleFileUpload,
    removeUploadedFile,
    openEndModal,
    closeEndModal,
    confirmEndInterview,
    openReportModal,
    closeReportModal,
    openSummaryModal,
    closeSummaryModal,
    resetInterview,
    handleDownloadReport,
  };

  return <InterviewContext.Provider value={value}>{children}</InterviewContext.Provider>;
};

export const useInterview = () => {
  const context = useContext(InterviewContext);
  if (!context) {
    throw new Error('useInterview must be used within an InterviewProvider');
  }
  return context;
};
