import React from 'react';
import {
  CheckCircle2,
  FileText,
  Download,
  RotateCcw,
  ShieldCheck,
  Calendar,
  Clock,
  ArrowRight,
  ClipboardList,
  Sparkles,
  Home,
} from 'lucide-react';
import Button from '../components/common/Button';
import Badge from '../components/common/Badge';
import SummaryModal from '../components/modals/SummaryModal';
import { useInterview } from '../context/InterviewContext';

const CompletionPage = () => {
  const {
    interviewId,
    answeredCount,
    uploadedFile,
    messages,
    isSummaryModalOpen,
    openSummaryModal,
    closeSummaryModal,
    handleDownloadReport,
    startNewInterview,
    goToHome,
  } = useInterview();

  const formattedDate = new Date().toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col justify-between antialiased selection:bg-teal-100 selection:text-teal-900">
      {/* Top header with Home button */}
      <header className="w-full bg-white border-b border-slate-200/80 py-3.5 px-4 sm:px-8">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <div
            onClick={goToHome}
            className="flex items-center gap-2.5 cursor-pointer group"
            title="Go to Home"
          >
            <div className="w-8 h-8 rounded-lg bg-slate-900 flex items-center justify-center text-teal-400 font-bold text-sm group-hover:scale-105 transition-transform">
              M
            </div>
            <span className="font-bold text-slate-900 tracking-tight group-hover:text-blue-600 transition-colors">
              Arogya AI
            </span>
            <span className="text-[10px] font-bold text-teal-700 bg-teal-50 border border-teal-200 px-1.5 py-0.5 rounded ml-1">
              आरोग्य
            </span>
          </div>

          <div className="flex items-center gap-3">
            <div className="hidden sm:flex items-center gap-1.5 text-xs text-slate-500">
              <ShieldCheck className="w-4 h-4 text-emerald-600" />
              <span>ABDM & DPDP Encrypted Intake</span>
            </div>

            {/* Header Home Button */}
            <Button
              variant="outline"
              size="sm"
              onClick={goToHome}
              icon={Home}
              className="text-xs"
            >
              Home
            </Button>
          </div>
        </div>
      </header>

      {/* Main Completion Card Area */}
      <main className="flex-1 flex items-center justify-center px-4 sm:px-6 py-10 sm:py-16">
        <div className="w-full max-w-xl mx-auto flex flex-col items-center text-center">
          {/* Large Success Icon with layered ring */}
          <div className="relative mb-6">
            <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-3xl bg-emerald-50 border border-emerald-200/80 flex items-center justify-center text-emerald-600 shadow-md shadow-emerald-500/10">
              <CheckCircle2 className="w-10 h-10 sm:w-12 sm:h-12 text-emerald-600 stroke-[2.2]" />
            </div>
            <span className="absolute -bottom-1 -right-1 w-6 h-6 rounded-full bg-teal-600 text-white flex items-center justify-center text-xs shadow-xs">
              ✓
            </span>
          </div>

          {/* Heading */}
          <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold tracking-tight text-slate-900 mb-2">
            Interview completed
          </h1>

          {/* Subtitle */}
          <p className="text-sm sm:text-base text-slate-600 max-w-md mx-auto leading-relaxed mb-8">
            Thank you. Your responses have been recorded successfully.
          </p>

          {/* Summary Card */}
          <div className="w-full bg-white rounded-2xl border border-slate-200 shadow-sm p-5 sm:p-7 text-left space-y-5 mb-8">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <div className="w-2.5 h-2.5 rounded-full bg-emerald-500"></div>
                <h3 className="font-bold text-slate-900 text-base">
                  Interview completed
                </h3>
              </div>
              <Badge variant="emerald" size="sm" dot={true}>
                Status: Completed
              </Badge>
            </div>

            {/* Key Metrics Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200/70">
                <span className="text-xs text-slate-500 flex items-center gap-1.5 mb-1 font-medium">
                  <ClipboardList className="w-3.5 h-3.5 text-blue-600" />
                  Questions answered
                </span>
                <span className="text-lg font-bold text-slate-900">
                  {answeredCount}
                </span>
              </div>

              <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200/70">
                <span className="text-xs text-slate-500 flex items-center gap-1.5 mb-1 font-medium">
                  <FileText className="w-3.5 h-3.5 text-teal-600" />
                  Report uploaded
                </span>
                <span className="text-lg font-bold text-slate-900 flex items-center gap-1.5">
                  {uploadedFile ? (
                    <>
                      <span className="text-teal-700">Yes</span>
                      <span className="text-xs font-normal text-slate-500 truncate max-w-[90px]">({uploadedFile.name})</span>
                    </>
                  ) : (
                    <span className="text-slate-600">No</span>
                  )}
                </span>
              </div>

              <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200/70">
                <span className="text-xs text-slate-500 flex items-center gap-1.5 mb-1 font-medium">
                  <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                  Status
                </span>
                <span className="text-lg font-bold text-emerald-700">
                  Completed
                </span>
              </div>
            </div>

            {/* Physician Triage Note */}
            <div className="p-3.5 rounded-xl bg-blue-50/60 border border-blue-100 text-xs text-blue-900 leading-relaxed flex items-start gap-2.5">
              <Sparkles className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
              <div>
                <span className="font-semibold block mb-0.5">Next Steps for Consultation:</span>
                Your responses have been prepared under ABDM clinical standards and will be presented to your consulting doctor or hospital OPD. You can view the synthesized summary or download a copy for your personal records.
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="w-full flex flex-col sm:flex-row items-center justify-center gap-3">
            <Button
              variant="medical"
              size="lg"
              onClick={startNewInterview}
              icon={RotateCcw}
              className="w-full sm:w-auto font-semibold shadow-md"
            >
              Start New Interview
            </Button>

            <Button
              variant="outline"
              size="lg"
              onClick={openSummaryModal}
              icon={FileText}
              className="w-full sm:w-auto"
            >
              View Summary
            </Button>

            <Button
              variant="outline"
              size="lg"
              onClick={handleDownloadReport}
              icon={Download}
              className="w-full sm:w-auto"
            >
              Download Report
            </Button>
          </div>

          {/* Home Navigation Button */}
          <div className="mt-6 flex items-center justify-center">
            <Button
              variant="ghost"
              size="md"
              onClick={goToHome}
              icon={Home}
              className="text-slate-600 hover:text-slate-900 text-sm font-semibold"
            >
              Return to Home
            </Button>
          </div>
        </div>
      </main>

      {/* Summary Modal */}
      <SummaryModal
        isOpen={isSummaryModalOpen}
        onClose={closeSummaryModal}
        interviewId={interviewId}
        messages={messages}
        uploadedFile={uploadedFile}
        answeredCount={answeredCount}
        onDownloadReport={handleDownloadReport}
      />

      {/* Minimal Footer */}
      <footer className="w-full border-t border-slate-200/60 bg-white py-4 text-center text-xs text-slate-400">
        Arogya AI Clinical Systems • Aligned with ABDM (Ayushman Bharat Digital Mission) & DPDP Act 2023 • Emergency: 112 / 108
      </footer>
    </div>
  );
};

export default CompletionPage;
