import React from 'react';
import ChatHeader from '../components/chat/ChatHeader';
import ChatWindow from '../components/chat/ChatWindow';
import ChatInput from '../components/chat/ChatInput';
import EndInterviewModal from '../components/modals/EndInterviewModal';
import ReportUploadModal from '../components/chat/ReportUploadModal';
import { useInterview } from '../context/InterviewContext';

const InterviewPage = () => {
  const {
    messages,
    progress,
    isTyping,
    uploadedFile,
    isUploading,
    uploadProgress,
    uploadError,
    isEndModalOpen,
    isReportModalOpen,
    answeredCount,
    sendPatientMessage,
    selectQuickReply,
    handleFileUpload,
    removeUploadedFile,
    openEndModal,
    closeEndModal,
    confirmEndInterview,
    openReportModal,
    closeReportModal,
    goToHome,
  } = useInterview();

  const handleGoHome = () => {
    if (answeredCount > 0) {
      openEndModal();
    } else {
      goToHome();
    }
  };

  // Find latest AI message's chips for quick suggestions
  const latestAiMessage = [...messages].reverse().find((m) => m.sender === 'ai');
  const currentQuickReplies = latestAiMessage?.chips || [];

  return (
    <div className="h-screen h-dvh max-h-dvh flex flex-col bg-slate-50 overflow-hidden font-sans antialiased selection:bg-teal-100 selection:text-teal-900">
      {/* Top Header */}
      <ChatHeader
        appName="Arogya AI"
        progress={progress}
        onEndInterview={openEndModal}
        onOpenReportModal={openReportModal}
        onGoHome={handleGoHome}
        uploadedFile={uploadedFile}
      />

      {/* Main Conversation Stream */}
      <div className="flex-1 flex flex-col min-h-0 relative">
        <ChatWindow messages={messages} isTyping={isTyping} />

        {/* Floating subtle emergency disclaimer notice */}
        <div className="hidden sm:block text-center pb-1 text-[11px] text-slate-400">
          Arogya AI is an OPD pre-triage assistant. In an emergency, dial 112 or 108 immediately.
        </div>

        {/* Bottom Input Area */}
        <ChatInput
          onSendMessage={sendPatientMessage}
          onOpenReportModal={openReportModal}
          isTyping={isTyping}
          quickReplies={currentQuickReplies}
          onSelectQuickReply={selectQuickReply}
          uploadedFile={uploadedFile}
        />
      </div>

      {/* Confirmation Modal to End Interview */}
      <EndInterviewModal
        isOpen={isEndModalOpen}
        onClose={closeEndModal}
        onConfirmEnd={confirmEndInterview}
        answeredCount={answeredCount}
      />

      {/* Medical Report Upload Modal */}
      <ReportUploadModal
        isOpen={isReportModalOpen}
        onClose={closeReportModal}
        onUpload={handleFileUpload}
        uploadedFile={uploadedFile}
        onRemoveFile={removeUploadedFile}
        isUploading={isUploading}
        uploadProgress={uploadProgress}
        uploadError={uploadError}
      />
    </div>
  );
};

export default InterviewPage;
