import React from 'react';
import { Sparkles, AlertCircle, FileText, Pill, HeartPulse, Clock, Activity } from 'lucide-react';
import Badge from '../common/Badge';

const AiClinicalSummary = ({ aiSummary, chiefComplaint }) => {
  if (!aiSummary) return null;

  return (
    <div className="bg-white rounded-2xl border border-slate-200/90 p-5 sm:p-6 shadow-xs space-y-5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 pb-3.5 border-b border-slate-100">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-blue-50 text-blue-700 flex items-center justify-center shrink-0 border border-blue-200/60">
            <Sparkles className="w-4 h-4 text-blue-600" />
          </div>
          <div>
            <h3 className="text-base font-bold text-slate-900 tracking-tight">
              AI Clinical Summary
            </h3>
            <p className="text-xs text-slate-500">
              Synthesized from patient conversational intake responses
            </p>
          </div>
        </div>

        <Badge variant="blue" size="sm">
          Assistive Synthesis
        </Badge>
      </div>

      {/* Mandatory Verification Disclaimer */}
      <div className="bg-blue-50/70 border border-blue-200/80 rounded-xl p-3 sm:p-3.5 flex items-start gap-2.5 text-xs text-blue-900 leading-relaxed">
        <AlertCircle className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
        <div>
          <span className="font-bold">Physician Verification Notice: </span>
          {aiSummary.disclaimer || 'AI-synthesized summary to assist physician evaluation. Please verify directly against patient history.'}
        </div>
      </div>

      {/* Summary Content Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
        {/* Chief Complaint */}
        <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200/70 space-y-1">
          <span className="font-bold text-slate-500 uppercase tracking-wider text-[11px] flex items-center gap-1.5">
            <Activity className="w-3.5 h-3.5 text-blue-600" /> Chief Complaint
          </span>
          <p className="text-slate-800 font-semibold text-sm leading-snug">
            {aiSummary.chiefComplaint || chiefComplaint}
          </p>
        </div>

        {/* Chronology & HPI */}
        <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200/70 space-y-1">
          <span className="font-bold text-slate-500 uppercase tracking-wider text-[11px] flex items-center gap-1.5">
            <Clock className="w-3.5 h-3.5 text-teal-600" /> Symptom Chronology
          </span>
          <p className="text-slate-700 leading-relaxed">
            {aiSummary.hpiChronology || 'Not reported'}
          </p>
        </div>

        {/* Severity */}
        <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200/70 space-y-1">
          <span className="font-bold text-slate-500 uppercase tracking-wider text-[11px]">
            Discomfort Severity & Functional Impact
          </span>
          <p className="text-slate-700 leading-relaxed">
            {aiSummary.severity || 'Not reported'}
          </p>
        </div>

        {/* Associated Symptoms */}
        <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200/70 space-y-1">
          <span className="font-bold text-slate-500 uppercase tracking-wider text-[11px]">
            Associated Symptoms & Pertinent Negatives
          </span>
          <p className="text-slate-700 leading-relaxed">
            {aiSummary.associatedSymptoms || 'Not reported'}
          </p>
        </div>

        {/* Current Medications */}
        <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200/70 space-y-1">
          <span className="font-bold text-slate-500 uppercase tracking-wider text-[11px] flex items-center gap-1.5">
            <Pill className="w-3.5 h-3.5 text-amber-600" /> Current Medications & Home Remedies
          </span>
          <p className="text-slate-700 leading-relaxed">
            {aiSummary.currentMedications || 'Not reported'}
          </p>
        </div>

        {/* Allergies & Comorbidities */}
        <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200/70 space-y-1">
          <span className="font-bold text-slate-500 uppercase tracking-wider text-[11px] flex items-center gap-1.5">
            <HeartPulse className="w-3.5 h-3.5 text-rose-600" /> Allergies & Medical History
          </span>
          <div className="text-slate-700 space-y-0.5">
            <div><strong className="text-slate-800">Allergies:</strong> {aiSummary.allergies || 'Not reported'}</div>
            <div><strong className="text-slate-800">History:</strong> {aiSummary.relevantMedicalHistory || 'Not reported'}</div>
          </div>
        </div>
      </div>

      {/* Uploaded Documents Synopsis */}
      {aiSummary.uploadedReports && (
        <div className="p-3 rounded-xl bg-teal-50/60 border border-teal-200/80 text-xs text-teal-900 flex items-start gap-2">
          <FileText className="w-4 h-4 text-teal-600 shrink-0 mt-0.5" />
          <div>
            <span className="font-bold">Attached Records Synopsis: </span>
            <span>{aiSummary.uploadedReports}</span>
          </div>
        </div>
      )}
    </div>
  );
};

export default AiClinicalSummary;
