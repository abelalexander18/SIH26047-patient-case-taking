import React from 'react';
import { Activity, XSquare, LogOut, FileText, CheckCircle2, Home } from 'lucide-react';
import ProgressBar from './ProgressBar';
import Button from '../common/Button';
import Badge from '../common/Badge';

const ChatHeader = ({
  appName = "Arogya AI",
  progress = 15,
  onEndInterview,
  onOpenReportModal,
  onGoHome,
  uploadedFile,
}) => {
  return (
    <header className="w-full bg-white border-b border-slate-200/80 sticky top-0 z-30 shadow-2xs">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 h-16 sm:h-18 flex items-center justify-between gap-4">
        {/* Left: Logo & Title (clickable to return Home) */}
        <div
          onClick={onGoHome}
          className="flex items-center gap-3 shrink-0 cursor-pointer group"
          title="Return to Home"
        >
          <div className="w-9 h-9 rounded-xl bg-slate-900 flex items-center justify-center text-teal-400 border border-slate-800 shadow-xs group-hover:scale-105 transition-transform">
            <Activity className="w-4 h-4" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-sm sm:text-base font-bold text-slate-900 leading-tight group-hover:text-blue-600 transition-colors">
                {appName}
              </h2>
              <span className="hidden md:inline-block w-1 h-1 rounded-full bg-slate-300"></span>
              <Badge variant="blue" size="sm" className="hidden sm:inline-flex">
                Patient Interview
              </Badge>
            </div>
            <p className="text-[11px] text-slate-500 hidden sm:block font-medium">
              Live Pre-OPD Intake • ABDM Aligned
            </p>
          </div>
        </div>

        {/* Center: Progress Indicator (Elegant and Subtle) */}
        <div className="flex-1 max-w-xs sm:max-w-sm px-2 sm:px-4">
          <ProgressBar progress={progress} />
        </div>

        {/* Right: Actions */}
        <div className="flex items-center gap-2 shrink-0">
          {onGoHome && (
            <Button
              variant="ghost"
              size="sm"
              onClick={onGoHome}
              icon={Home}
              className="hidden sm:inline-flex text-xs text-slate-600 hover:text-slate-900"
            >
              Home
            </Button>
          )}

          {uploadedFile && (
            <button
              onClick={onOpenReportModal}
              className="hidden lg:flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-teal-50 border border-teal-200/80 text-teal-800 text-xs font-medium hover:bg-teal-100 transition-colors cursor-pointer"
              title={uploadedFile.name}
            >
              <CheckCircle2 className="w-3.5 h-3.5 text-teal-600" />
              <span className="truncate max-w-[100px]">{uploadedFile.name}</span>
            </button>
          )}

          <Button
            variant="outline"
            size="sm"
            onClick={onEndInterview}
            className="text-xs sm:text-sm text-slate-700 hover:text-rose-700 hover:border-rose-200 hover:bg-rose-50/50 transition-colors"
            icon={LogOut}
            iconPosition="left"
          >
            End Interview
          </Button>
        </div>
      </div>
    </header>
  );
};

export default ChatHeader;
