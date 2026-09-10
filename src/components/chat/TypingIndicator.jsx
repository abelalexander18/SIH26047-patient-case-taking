import React from 'react';
import { Activity } from 'lucide-react';

const TypingIndicator = () => {
  return (
    <div className="w-full flex gap-3 sm:gap-4 my-4 justify-start items-start animate-fadeIn">
      {/* AI Avatar */}
      <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-slate-900 flex items-center justify-center text-teal-400 shrink-0 border border-slate-800 shadow-xs mt-0.5">
        <Activity className="w-4 h-4 text-teal-400 animate-pulse" />
      </div>

      {/* Bubble */}
      <div className="flex flex-col items-start">
        <div className="flex items-center gap-2 mb-1 px-1">
          <span className="text-[11px] font-semibold text-slate-500">
            Arogya AI
          </span>
          <span className="text-[10px] text-teal-600 font-medium animate-pulse">
            analyzing symptoms...
          </span>
        </div>

        <div className="px-4 py-3 bg-white border border-slate-200/90 rounded-2xl rounded-tl-xs shadow-xs flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-slate-400 animate-bounce [animation-delay:-0.3s]"></span>
          <span className="w-2 h-2 rounded-full bg-slate-400 animate-bounce [animation-delay:-0.15s]"></span>
          <span className="w-2 h-2 rounded-full bg-slate-400 animate-bounce"></span>
        </div>
      </div>
    </div>
  );
};

export default TypingIndicator;
