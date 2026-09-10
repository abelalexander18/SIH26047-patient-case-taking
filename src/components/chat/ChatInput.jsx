import React, { useState, useRef, useEffect } from 'react';
import { Paperclip, ArrowUp, Send, Sparkles, FileText, CheckCircle2 } from 'lucide-react';

const ChatInput = ({
  onSendMessage,
  onOpenReportModal,
  isTyping = false,
  quickReplies = [],
  onSelectQuickReply,
  uploadedFile = null,
}) => {
  const [inputText, setInputText] = useState('');
  const inputRef = useRef(null);

  // Auto focus input when not typing
  useEffect(() => {
    if (!isTyping && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isTyping]);

  const handleSubmit = (e) => {
    if (e) e.preventDefault();
    if (!inputText.trim() || isTyping) return;
    onSendMessage(inputText);
    setInputText('');
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  return (
    <div className="w-full bg-linear-to-t from-slate-50 via-slate-50 to-slate-50/80 pt-2 pb-4 sm:pb-6 px-4 sm:px-6">
      <div className="max-w-4xl mx-auto flex flex-col gap-2.5">
        {/* Quick Suggestion Chips if available */}
        {quickReplies && quickReplies.length > 0 && !isTyping && (
          <div className="flex items-center gap-2 overflow-x-auto pb-1.5 pt-0.5 no-scrollbar mask-fade">
            <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider shrink-0 flex items-center gap-1 pl-1">
              <Sparkles className="w-3 h-3 text-teal-500" />
              Suggestions:
            </span>
            {quickReplies.map((chip, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => onSelectQuickReply(chip)}
                className="shrink-0 px-3 py-1.5 rounded-full text-xs font-medium bg-white hover:bg-slate-100/90 text-slate-700 border border-slate-200/90 shadow-2xs hover:border-slate-300 hover:text-slate-900 transition-all cursor-pointer select-none active:scale-95"
              >
                {chip}
              </button>
            ))}
          </div>
        )}

        {/* Input Bar Card */}
        <form
          onSubmit={handleSubmit}
          className="relative flex items-center gap-2 bg-white rounded-2xl border border-slate-200 shadow-sm p-1.5 sm:p-2 focus-within:ring-2 focus-within:ring-blue-500/20 focus-within:border-blue-500 transition-all"
        >
          {/* Upload Report Button */}
          <button
            type="button"
            onClick={onOpenReportModal}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs sm:text-sm font-medium transition-colors shrink-0 cursor-pointer select-none ${
              uploadedFile
                ? 'bg-teal-50 text-teal-800 border border-teal-200 hover:bg-teal-100'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
            }`}
            title={uploadedFile ? `Report uploaded: ${uploadedFile.name}` : 'Upload medical report (PDF, Image)'}
          >
            <Paperclip className={`w-4 h-4 ${uploadedFile ? 'text-teal-600' : 'text-slate-500'}`} />
            <span className="hidden sm:inline">
              {uploadedFile ? 'Report Added' : 'Upload report'}
            </span>
            {uploadedFile && (
              <span className="w-2 h-2 rounded-full bg-teal-500"></span>
            )}
          </button>

          {/* Text Input */}
          <input
            ref={inputRef}
            type="text"
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={
              isTyping
                ? "AI Assistant is analyzing symptoms..."
                : "Type your response here..."
            }
            disabled={isTyping}
            className="flex-1 bg-transparent border-0 text-slate-900 placeholder:text-slate-400 text-sm sm:text-[15px] px-2 py-2 focus:outline-none disabled:opacity-50"
          />

          {/* Send Button */}
          <button
            type="submit"
            disabled={!inputText.trim() || isTyping}
            className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-slate-900 hover:bg-slate-800 text-white flex items-center justify-center shrink-0 shadow-xs disabled:opacity-40 disabled:hover:bg-slate-900 disabled:cursor-not-allowed transition-all duration-200 cursor-pointer focus:outline-none focus:ring-2 focus:ring-slate-400"
            aria-label="Send message"
          >
            <ArrowUp className="w-4 h-4 sm:w-5 sm:h-5 text-white stroke-[2.5]" />
          </button>
        </form>

        {/* Helper footnote */}
        <div className="flex items-center justify-between px-2 text-[11px] text-slate-400">
          <span className="hidden sm:inline">
            Press <kbd className="font-mono bg-slate-100 border border-slate-200 px-1 py-0.5 rounded text-[10px] text-slate-600">Enter ↵</kbd> to send response
          </span>
          <span className="flex items-center gap-1 ml-auto">
            <span>Confidential clinical interview</span>
            <span>•</span>
            <span>ABDM & DPDP Act 2023 protected</span>
          </span>
        </div>
      </div>
    </div>
  );
};

export default ChatInput;
