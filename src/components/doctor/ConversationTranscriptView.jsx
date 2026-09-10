import React, { useState } from 'react';
import { MessageSquare, Activity, User, FileText, CheckCircle2, ChevronDown, ChevronUp } from 'lucide-react';
import Badge from '../common/Badge';

const ConversationTranscriptView = ({ messages = [], patientName = 'Patient' }) => {
  const [isExpanded, setIsExpanded] = useState(true);

  if (!messages || messages.length === 0) {
    return (
      <div className="bg-white rounded-2xl border border-slate-200/90 p-5 text-center text-xs text-slate-500">
        No conversation transcript recorded for this intake.
      </div>
    );
  }

  return (
    <div className="bg-white rounded-2xl border border-slate-200/90 p-5 sm:p-6 shadow-xs space-y-4">
      {/* Header with expand/collapse */}
      <div className="flex items-center justify-between pb-3.5 border-b border-slate-100">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-blue-50 text-blue-700 flex items-center justify-center shrink-0">
            <MessageSquare className="w-4 h-4 text-blue-600" />
          </div>
          <div>
            <h3 className="text-base font-bold text-slate-900 tracking-tight">
              Original Conversation Transcript
            </h3>
            <p className="text-xs text-slate-500">
              Verbatim record of the AI assistant and patient interview ({messages.length} exchanges)
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Badge variant="blue" size="sm">
            Auditable Log
          </Badge>
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer"
            title={isExpanded ? 'Collapse Transcript' : 'Expand Transcript'}
          >
            {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {isExpanded && (
        <div className="space-y-3.5 max-h-[500px] overflow-y-auto pr-2 bg-slate-50/50 p-4 rounded-xl border border-slate-200/70">
          {messages.map((m) => {
            const isAi = m.sender === 'ai';

            return (
              <div
                key={m.id}
                className={`w-full flex gap-3 ${isAi ? 'justify-start' : 'justify-end'}`}
              >
                {/* AI Avatar */}
                {isAi && (
                  <div className="w-7 h-7 rounded-lg bg-slate-900 flex items-center justify-center text-teal-400 shrink-0 border border-slate-800 shadow-2xs mt-0.5">
                    <Activity className="w-3.5 h-3.5" />
                  </div>
                )}

                {/* Bubble Container */}
                <div className={`flex flex-col max-w-[85%] sm:max-w-[75%] ${isAi ? 'items-start' : 'items-end'}`}>
                  {/* Sender Label & Timestamp */}
                  <div className="flex items-center gap-1.5 mb-1 px-1 text-[11px] font-semibold text-slate-500">
                    <span>{isAi ? 'Arogya AI' : patientName}</span>
                    {m.timestamp && <span className="text-slate-400 font-normal">• {m.timestamp}</span>}
                  </div>

                  {/* Message Bubble */}
                  <div
                    className={`px-3.5 py-2.5 text-xs sm:text-[13px] leading-relaxed rounded-xl shadow-2xs ${
                      isAi
                        ? 'bg-white text-slate-800 border border-slate-200/90 rounded-tl-xs'
                        : 'bg-blue-600 text-white rounded-tr-xs'
                    }`}
                  >
                    <p className="whitespace-pre-wrap">{m.text}</p>

                    {/* Attached File Indicator if present */}
                    {m.attachedFile && (
                      <div
                        className={`mt-2 p-2 rounded-lg flex items-center gap-2 text-[11px] font-medium border ${
                          isAi
                            ? 'bg-slate-50 border-slate-200 text-slate-700'
                            : 'bg-blue-700 border-blue-500 text-blue-50'
                        }`}
                      >
                        <FileText className="w-3.5 h-3.5 text-teal-500 shrink-0" />
                        <span className="truncate flex-1 font-semibold">{m.attachedFile.name}</span>
                        <CheckCircle2 className="w-3.5 h-3.5 text-teal-400 shrink-0" />
                      </div>
                    )}
                  </div>
                </div>

                {/* Patient Avatar */}
                {!isAi && (
                  <div className="w-7 h-7 rounded-lg bg-blue-100 text-blue-700 flex items-center justify-center shrink-0 border border-blue-200 shadow-2xs mt-0.5">
                    <User className="w-3.5 h-3.5" />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default ConversationTranscriptView;
