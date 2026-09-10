import React from 'react';
import { AlertTriangle, ShieldAlert, CheckCircle2, Info } from 'lucide-react';
import Badge from '../common/Badge';

const RedFlagAlert = ({ hasRedFlags, redFlags = [] }) => {
  if (!hasRedFlags || redFlags.length === 0) {
    return (
      <div className="bg-emerald-50/60 border border-emerald-200/80 rounded-2xl p-4 sm:p-5 flex items-start gap-3.5 shadow-2xs">
        <div className="w-8 h-8 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0 mt-0.5">
          <CheckCircle2 className="w-4.5 h-4.5 text-emerald-600" />
        </div>
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <h4 className="text-sm font-bold text-emerald-950">
              Safety Screening Status: No Potential Red Flags Identified
            </h4>
            <Badge variant="emerald" size="sm">
              Standard Triage
            </Badge>
          </div>
          <p className="text-xs text-emerald-800/90 mt-1 leading-relaxed">
            No critical red flags were triggered during the pre-consultation intake based on configured clinical screening rules. Routine physician evaluation is appropriate.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-red-50 border border-red-200 rounded-2xl p-5 sm:p-6 shadow-xs space-y-4">
      <div className="flex items-start justify-between gap-3 border-b border-red-200/80 pb-3">
        <div className="flex items-start gap-3">
          <div className="w-9 h-9 rounded-xl bg-red-100 text-red-700 flex items-center justify-center shrink-0 mt-0.5 shadow-2xs">
            <AlertTriangle className="w-5 h-5 text-red-600 stroke-[2.2]" />
          </div>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="text-sm sm:text-base font-bold text-red-950">
                Potential Red Flag Detected — Requires Prompt Review
              </h3>
              <Badge variant="rose" size="sm" dot={true}>
                Safety Critical
              </Badge>
            </div>
            <p className="text-xs text-red-800/90 mt-0.5 leading-relaxed">
              Clinical safety screening detected symptom combinations that warrant prioritized physician evaluation.
            </p>
          </div>
        </div>
      </div>

      <div className="space-y-3">
        {redFlags.map((flag, idx) => (
          <div
            key={flag.id || idx}
            className="bg-white/90 rounded-xl border border-red-200/90 p-4 space-y-2 text-xs text-slate-800"
          >
            <div className="flex items-center justify-between font-semibold text-red-900">
              <span className="flex items-center gap-1.5 font-bold">
                <ShieldAlert className="w-3.5 h-3.5 text-red-600" />
                Category: {flag.category || 'Clinical Concern'}
              </span>
              <span className="text-[11px] font-mono text-red-700 bg-red-50 px-2 py-0.5 rounded border border-red-200">
                Screening Severity: High
              </span>
            </div>

            <p className="text-slate-800 font-medium leading-relaxed">
              {flag.description}
            </p>

            {flag.clinicalGuidance && (
              <div className="bg-red-50/80 p-2.5 rounded-lg border border-red-100 text-[11px] text-red-900 flex items-start gap-2">
                <Info className="w-3.5 h-3.5 text-red-600 shrink-0 mt-0.5" />
                <div>
                  <span className="font-bold">Recommended Clinical Action: </span>
                  {flag.clinicalGuidance}
                </div>
              </div>
            )}
          </div>
        ))}
      </div>

      <div className="text-[11px] text-red-800/80 flex items-center gap-1.5 pt-1">
        <span>* Red flags indicate clinical safety patterns for physician attention and do not represent a final diagnosis.</span>
      </div>
    </div>
  );
};

export default RedFlagAlert;
