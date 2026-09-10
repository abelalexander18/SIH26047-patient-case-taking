import React from 'react';
import { Activity, User, FileText, CheckCircle2 } from 'lucide-react';

const ChatMessage = ({ message }) => {
  const isAi = message.sender === 'ai';

  return (
    <div
      className={`w-full flex gap-3 sm:gap-4 my-4 sm:my-5 ${
        isAi ? 'justify-start' : 'justify-end'
      } transition-all duration-200 animate-fadeIn`}
    >
      {/* AI Avatar */}
      {isAi && (
        <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-slate-900 flex items-center justify-center text-teal-400 shrink-0 border border-slate-800 shadow-xs mt-0.5">
          <Activity className="w-4 h-4 text-teal-400" />
        </div>
      )}

      {/* Message Bubble Container */}
      <div
        className={`flex flex-col max-w-[85%] sm:max-w-[75%] lg:max-w-[65%] ${
          isAi ? 'items-start' : 'items-end'
        }`}
      >
        {/* Bubble Header / Sender info */}
        <div className="flex items-center gap-2 mb-1 px-1">
          <span className="text-[11px] font-semibold tracking-tight text-slate-500">
            {isAi ? 'Arogya AI' : 'You'}
          </span>
          {message.timestamp && (
            <span className="text-[10px] text-slate-400 font-normal">
              {message.timestamp}
            </span>
          )}
        </div>

        {/* Bubble Body */}
        <div
          className={`px-4 sm:px-5 py-3 sm:py-3.5 text-sm sm:text-[15px] leading-relaxed tracking-normal shadow-xs ${
            isAi
              ? 'bg-white text-slate-800 rounded-2xl rounded-tl-xs border border-slate-200/90 shadow-slate-200/50'
              : 'bg-blue-600 text-white rounded-2xl rounded-tr-xs shadow-blue-500/10'
          }`}
        >
          <p className="whitespace-pre-wrap">{message.text}</p>

          {/* Clinical Safety Alert Banner (Deterministic Screening) */}
          {((message.screeningResult && message.screeningResult.detected) || (message.redFlagResult && message.redFlagResult.detected)) && (
            <div className="mt-3 p-3.5 rounded-xl bg-amber-50 border border-amber-200/90 text-slate-800 text-xs flex flex-col gap-2 shadow-2xs">
              <div className="flex items-center gap-1.5 font-semibold text-amber-900 text-[12px]">
                <span className="text-amber-600 font-bold text-sm leading-none">⚠</span>
                <span>Potential Red Flag</span>
              </div>
              <p className="text-slate-800 text-[12px] leading-relaxed font-medium">
                {(() => {
                  const res = message.redFlagResult || message.screeningResult;
                  const flags = res.flags || [];
                  if (flags.length > 0 && Array.isArray(flags[0].evidence) && flags[0].evidence.length > 0) {
                    return `${flags[0].evidence.join(' associated with ')}.`;
                  }
                  return res.message || 'Potential clinical safety pattern identified.';
                })()}
              </p>
              <p className="text-slate-600 text-[11px]">
                Prompt clinical evaluation may be appropriate.
              </p>
              <div className="text-[10px] text-slate-500 pt-1.5 border-t border-amber-200/80">
                Screening alert — not a diagnosis.
              </div>
            </div>
          )}

          {/* Attached Document Pill if available */}
          {message.attachedFile && (
            <div
              className={`mt-3 p-2.5 rounded-xl flex items-center gap-2.5 text-xs font-medium border ${
                isAi
                  ? 'bg-slate-50 border-slate-200 text-slate-700'
                  : 'bg-blue-700/80 border-blue-500 text-blue-50'
              }`}
            >
              <div
                className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${
                  isAi ? 'bg-teal-100 text-teal-700' : 'bg-white/20 text-white'
                }`}
              >
                <FileText className="w-4 h-4" />
              </div>
              <div className="truncate flex-1">
                <div className="font-semibold truncate">
                  {message.attachedFile.name}
                </div>
                <div className="text-[10px] opacity-80">
                  {message.attachedFile.size} • Attached medical report / Rx
                </div>
              </div>
              <CheckCircle2
                className={`w-4 h-4 shrink-0 ${
                  isAi ? 'text-teal-600' : 'text-teal-300'
                }`}
              />
            </div>
          )}
        </div>
      </div>

      {/* Patient Avatar */}
      {!isAi && (
        <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-blue-100 text-blue-700 flex items-center justify-center shrink-0 border border-blue-200 shadow-xs mt-0.5">
          <User className="w-4 h-4" />
        </div>
      )}
    </div>
  );
};

export default ChatMessage;
