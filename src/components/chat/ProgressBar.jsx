import React from 'react';

const ProgressBar = ({ progress = 15, showLabel = true, className = '' }) => {
  const clamped = Math.min(Math.max(progress, 5), 100);

  return (
    <div className={`flex flex-col gap-1.5 ${className}`}>
      {showLabel && (
        <div className="flex items-center justify-between text-xs">
          <span className="font-semibold text-slate-700 tracking-tight flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-teal-500 animate-pulse"></span>
            Interview Progress
          </span>
          <span className="font-mono font-medium text-slate-500 text-[11px]">
            {clamped}%
          </span>
        </div>
      )}
      <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden border border-slate-200/60 p-0.5">
        <div
          className="h-full bg-linear-to-r from-teal-500 via-blue-500 to-blue-600 rounded-full transition-all duration-500 ease-out shadow-xs"
          style={{ width: `${clamped}%` }}
        />
      </div>
    </div>
  );
};

export default ProgressBar;
