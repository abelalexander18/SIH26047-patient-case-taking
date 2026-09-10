import React, { createContext, useContext, useState, useCallback, useRef } from 'react';
import { INITIAL_AI_MESSAGE } from '../data/mockConversation';
import {
  sendMessage,
  uploadReport,
  downloadClinicalReport,
  getFormattedTime
} from '../services/interviewService';

const InterviewContext = createContext(null);

export const InterviewProvider = ({ children }) => {
  const [viewMode, setViewMode] = useState('patient'); // 'patient' | 'doctor'
  const [currentPage, setCurrentPage] = useState('landing'); // 'landing' | 'interview' | 'completion'
  const [interviewId, setInterviewId] = useState(() => `MED-${Math.floor(10000 + Math.random() * 90000)}`);
  
  const [messages, setMessages] = useState([INITIAL_AI_MESSAGE]);
  const [currentStageIndex, setCurrentStageIndex] = useState(0);
  const [progress, setProgress] = useState(15);
  const [isTyping, setIsTyping] = useState(false);
  
  // File upload state
  const [uploadedFile, setUploadedFile] = useState(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadError, setUploadError] = useState(null);
  const [lastCompletedSession, setLastCompletedSession] = useState(null);
  
  // Modals state
  const [isEndModalOpen, setIsEndModalOpen] = useState(false);
  const [isSummaryModalOpen, setIsSummaryModalOpen] = useState(false);
  const [isReportModalOpen, setIsReportModalOpen] = useState(false);
  
  // Metrics
  const [answeredCount, setAnsweredCount] = useState(0);
  const [startTime, setStartTime] = useState(null);
  const [endTime, setEndTime] = useState(null);

  const startInterview = useCallback(() => {
    setStartTime(new Date());
    setCurrentPage('interview');
  }, []);

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
      const response = await sendMessage(userText, currentStageIndex, messages);
      
      const aiMsg = {
        id: `ai-${Date.now()}`,
        sender: 'ai',
        text: response.replyText,
        timestamp: getFormattedTime(),
        chips: response.chips,
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
  }, [currentStageIndex, isTyping, messages]);

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
      const fileData = await uploadReport(file, (p) => setUploadProgress(p));
      setUploadedFile(fileData);
      
      // Also add an AI notice in the conversation
      const attachmentNote = {
        id: `ai-file-notice-${Date.now()}`,
        sender: 'ai',
        text: `I've successfully received and processed your medical report: "${fileData.name}" (${fileData.size}). I've attached it to your intake packet for your physician.`,
        timestamp: getFormattedTime(),
        attachedFile: fileData
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
  }, []);

  const removeUploadedFile = useCallback(() => {
    setUploadedFile(null);
    setUploadProgress(0);
    setUploadError(null);
  }, []);

  const openEndModal = useCallback(() => setIsEndModalOpen(true), []);
  const closeEndModal = useCallback(() => setIsEndModalOpen(false), []);

  const confirmEndInterview = useCallback(() => {
    setIsEndModalOpen(false);
    const now = new Date();
    setEndTime(now);
    setLastCompletedSession({
      interviewId,
      answeredCount,
      uploadedFile,
      messages,
      completedAt: now,
    });
    setCurrentPage('completion');
  }, [interviewId, answeredCount, uploadedFile, messages]);

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
    setInterviewId(`MED-${Math.floor(10000 + Math.random() * 90000)}`);
    setMessages([INITIAL_AI_MESSAGE]);
    setCurrentStageIndex(0);
    setProgress(15);
    setIsTyping(false);
    setUploadedFile(null);
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
    setInterviewId(`MED-${Math.floor(10000 + Math.random() * 90000)}`);
    setMessages([INITIAL_AI_MESSAGE]);
    setCurrentStageIndex(0);
    setProgress(15);
    setIsTyping(false);
    setUploadedFile(null);
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
      messages,
    });
  }, [interviewId, answeredCount, uploadedFile, messages]);

  const value = {
    viewMode,
    setViewMode,
    currentPage,
    setCurrentPage,
    lastCompletedSession,
    interviewId,
    messages,
    progress,
    isTyping,
    uploadedFile,
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
