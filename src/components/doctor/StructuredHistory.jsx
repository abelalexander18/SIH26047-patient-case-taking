import React, { useState } from 'react';
import { ClipboardList, ChevronDown, ChevronUp, Stethoscope } from 'lucide-react';
import Badge from '../common/Badge';

const StructuredHistory = ({ structuredHistory }) => {
  const [isRosExpanded, setIsRosExpanded] = useState(false);

  if (!structuredHistory) return null;

  const renderValue = (val) => {
    if (!val || val === 'Not reported' || val === 'None reported') {
      return (
        <span className="inline-flex items-center text-slate-400 italic text-xs font-normal">
          Not reported
        </span>
      );
    }
    return <span className="text-slate-800 text-xs font-medium leading-relaxed">{val}</span>;
  };

  const ros = structuredHistory.reviewOfSystems || {};

  return (
    <div className="bg-white rounded-2xl border border-slate-200/90 p-5 sm:p-6 shadow-xs space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between pb-3.5 border-b border-slate-100">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-slate-100 text-slate-700 flex items-center justify-center shrink-0">
            <ClipboardList className="w-4 h-4 text-slate-700" />
          </div>
          <div>
            <h3 className="text-base font-bold text-slate-900 tracking-tight">
              Structured Clinical History
            </h3>
            <p className="text-xs text-slate-500">
              Categorized intake formatted for EHR / ABDM consultation records
            </p>
          </div>
        </div>

        <Badge variant="slate" size="sm">
          EMR Structured
        </Badge>
      </div>

      {/* Main Clinical Sections Table/List */}
      <div className="border border-slate-200/80 rounded-xl divide-y divide-slate-100 text-xs overflow-hidden">
        {/* Chief Complaint */}
        <div className="grid grid-cols-1 sm:grid-cols-12 p-3.5 bg-slate-50/50 gap-2 sm:gap-4 items-baseline">
          <span className="sm:col-span-4 font-bold text-slate-700 uppercase tracking-wider text-[11px]">
            1. Chief Complaint
          </span>
          <div className="sm:col-span-8">
            {renderValue(structuredHistory.chiefComplaint)}
          </div>
        </div>

        {/* History of Present Illness */}
        <div className="grid grid-cols-1 sm:grid-cols-12 p-3.5 gap-2 sm:gap-4 items-baseline">
          <span className="sm:col-span-4 font-bold text-slate-700 uppercase tracking-wider text-[11px]">
            2. History of Present Illness (HPI)
          </span>
          <div className="sm:col-span-8">
            {renderValue(structuredHistory.historyOfPresentIllness)}
          </div>
        </div>

        {/* Past Medical History */}
        <div className="grid grid-cols-1 sm:grid-cols-12 p-3.5 bg-slate-50/50 gap-2 sm:gap-4 items-baseline">
          <span className="sm:col-span-4 font-bold text-slate-700 uppercase tracking-wider text-[11px]">
            3. Past Medical History
          </span>
          <div className="sm:col-span-8">
            {renderValue(structuredHistory.pastMedicalHistory)}
          </div>
        </div>

        {/* Current Medications */}
        <div className="grid grid-cols-1 sm:grid-cols-12 p-3.5 gap-2 sm:gap-4 items-baseline">
          <span className="sm:col-span-4 font-bold text-slate-700 uppercase tracking-wider text-[11px]">
            4. Current Medications
          </span>
          <div className="sm:col-span-8">
            {renderValue(structuredHistory.currentMedications)}
          </div>
        </div>

        {/* Drug Allergies */}
        <div className="grid grid-cols-1 sm:grid-cols-12 p-3.5 bg-slate-50/50 gap-2 sm:gap-4 items-baseline">
          <span className="sm:col-span-4 font-bold text-slate-700 uppercase tracking-wider text-[11px]">
            5. Drug & Substance Allergies
          </span>
          <div className="sm:col-span-8">
            {renderValue(structuredHistory.allergies)}
          </div>
        </div>

        {/* Family History */}
        <div className="grid grid-cols-1 sm:grid-cols-12 p-3.5 gap-2 sm:gap-4 items-baseline">
          <span className="sm:col-span-4 font-bold text-slate-700 uppercase tracking-wider text-[11px]">
            6. Family History
          </span>
          <div className="sm:col-span-8">
            {renderValue(structuredHistory.familyHistory)}
          </div>
        </div>

        {/* Personal & Social History */}
        <div className="grid grid-cols-1 sm:grid-cols-12 p-3.5 bg-slate-50/50 gap-2 sm:gap-4 items-baseline">
          <span className="sm:col-span-4 font-bold text-slate-700 uppercase tracking-wider text-[11px]">
            7. Personal & Social History
          </span>
          <div className="sm:col-span-8">
            {renderValue(structuredHistory.personalSocialHistory)}
          </div>
        </div>

        {/* Investigations & Outside Reports */}
        <div className="grid grid-cols-1 sm:grid-cols-12 p-3.5 gap-2 sm:gap-4 items-baseline">
          <span className="sm:col-span-4 font-bold text-slate-700 uppercase tracking-wider text-[11px]">
            8. Prior Investigations / Labs
          </span>
          <div className="sm:col-span-8">
            {renderValue(structuredHistory.investigations)}
          </div>
        </div>
      </div>

      {/* Review of Systems (Collapsible Sub-Panel) */}
      <div className="border border-slate-200/80 rounded-xl overflow-hidden">
        <button
          onClick={() => setIsRosExpanded(!isRosExpanded)}
          className="w-full flex items-center justify-between p-3.5 bg-slate-50 hover:bg-slate-100/70 text-left transition-colors cursor-pointer"
        >
          <div className="flex items-center gap-2 text-xs font-bold text-slate-800">
            <Stethoscope className="w-4 h-4 text-blue-600" />
            <span>Review of Systems (ROS) Screening Breakdown</span>
          </div>
          <div className="flex items-center gap-1.5 text-xs text-slate-500">
            <span>{isRosExpanded ? 'Collapse' : 'Expand Details'}</span>
            {isRosExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </div>
        </button>

        {isRosExpanded && (
          <div className="p-4 grid grid-cols-1 sm:grid-cols-2 gap-3 bg-white text-xs border-t border-slate-200/80">
            <div className="p-2.5 rounded-lg bg-slate-50/70 border border-slate-100">
              <span className="font-semibold text-slate-600 block mb-0.5">Constitutional:</span>
              {renderValue(ros.constitutional)}
            </div>
            <div className="p-2.5 rounded-lg bg-slate-50/70 border border-slate-100">
              <span className="font-semibold text-slate-600 block mb-0.5">Respiratory:</span>
              {renderValue(ros.respiratory)}
            </div>
            <div className="p-2.5 rounded-lg bg-slate-50/70 border border-slate-100">
              <span className="font-semibold text-slate-600 block mb-0.5">Gastrointestinal:</span>
              {renderValue(ros.gastrointestinal)}
            </div>
            <div className="p-2.5 rounded-lg bg-slate-50/70 border border-slate-100">
              <span className="font-semibold text-slate-600 block mb-0.5">Cardiovascular:</span>
              {renderValue(ros.cardiovascular)}
            </div>
            <div className="p-2.5 rounded-lg bg-slate-50/70 border border-slate-100">
              <span className="font-semibold text-slate-600 block mb-0.5">Neurological:</span>
              {renderValue(ros.neurological)}
            </div>
            <div className="p-2.5 rounded-lg bg-slate-50/70 border border-slate-100">
              <span className="font-semibold text-slate-600 block mb-0.5">Musculoskeletal:</span>
              {renderValue(ros.musculoskeletal)}
            </div>
            <div className="p-2.5 rounded-lg bg-slate-50/70 border border-slate-100 sm:col-span-2">
              <span className="font-semibold text-slate-600 block mb-0.5">Dermatological:</span>
              {renderValue(ros.dermatological)}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default StructuredHistory;
