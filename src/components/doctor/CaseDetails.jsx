import React from 'react';
import { ArrowLeft, Phone, MapPin, ShieldCheck, Clock, Download, UserCheck, Heart } from 'lucide-react';
import Button from '../common/Button';
import Badge from '../common/Badge';
import RedFlagAlert from './RedFlagAlert';
import AiClinicalSummary from './AiClinicalSummary';
import StructuredHistory from './StructuredHistory';
import ConversationTranscriptView from './ConversationTranscriptView';
import MedicalReportViewer from './MedicalReportViewer';
import DoctorNotesPanel from './DoctorNotesPanel';
import { useDoctor } from '../../context/DoctorContext';

const CaseDetails = () => {
  const { selectedCase, goToCases, acceptCase, exportCaseReport } = useDoctor();

  if (!selectedCase) {
    return (
      <div className="bg-white rounded-2xl border border-slate-200/90 p-12 text-center shadow-xs">
        <h3 className="text-base font-bold text-slate-900 mb-2">No patient case selected</h3>
        <Button variant="primary" size="md" onClick={goToCases}>
          Return to Patient Queue
        </Button>
      </div>
    );
  }

  const { patient } = selectedCase;

  return (
    <div className="space-y-6 pb-12">
      {/* Top Back Navigation & Action Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <button
          onClick={goToCases}
          className="inline-flex items-center gap-2 text-xs sm:text-sm font-semibold text-slate-600 hover:text-slate-900 transition-colors cursor-pointer"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back to Patient Queue</span>
        </button>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => exportCaseReport(selectedCase.id)}
            icon={Download}
            className="text-xs"
          >
            Export Dossier
          </Button>

          <Button
            variant="medical"
            size="sm"
            onClick={() => acceptCase(selectedCase.id)}
            icon={UserCheck}
            className="text-xs font-semibold"
          >
            Accept Case
          </Button>
        </div>
      </div>

      {/* Patient Demographic & Intake Header Card */}
      <div className="bg-white rounded-2xl border border-slate-200/90 p-5 sm:p-6 shadow-xs">
        <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-5 pb-5 border-b border-slate-100">
          {/* Patient Profile */}
          <div className="flex items-start gap-4">
            <div className="w-14 h-14 rounded-2xl bg-blue-100 text-blue-800 flex items-center justify-center font-bold text-xl shrink-0 border border-blue-200/70 shadow-2xs">
              {patient.name
                .split(' ')
                .map((n) => n[0])
                .slice(0, 2)
                .join('')}
            </div>

            <div className="space-y-1">
              <div className="flex flex-wrap items-center gap-2.5">
                <h1 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">
                  {patient.name}
                </h1>
                <span className="text-sm font-semibold text-slate-500">
                  ({patient.age} Years, {patient.gender})
                </span>
                <span className="font-mono text-xs font-bold text-slate-700 bg-slate-100 px-2.5 py-0.5 rounded-md">
                  {selectedCase.intakeId}
                </span>
              </div>

              <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-500">
                {patient.phone && (
                  <span className="flex items-center gap-1">
                    <Phone className="w-3.5 h-3.5 text-slate-400" />
                    {patient.phone}
                  </span>
                )}
                {patient.location && (
                  <span className="flex items-center gap-1">
                    <MapPin className="w-3.5 h-3.5 text-slate-400" />
                    {patient.location}
                  </span>
                )}
                {patient.bloodGroup && (
                  <span className="flex items-center gap-1 font-semibold text-slate-700">
                    <Heart className="w-3.5 h-3.5 text-rose-500" />
                    Blood: {patient.bloodGroup}
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Intake Status & Metadata Badges */}
          <div className="flex flex-wrap lg:flex-col items-start lg:items-end gap-2 text-xs">
            <div className="flex items-center gap-2">
              <Badge
                variant={selectedCase.reviewStatus === 'Needs Review' ? 'blue' : 'emerald'}
                size="md"
                dot={true}
              >
                {selectedCase.reviewStatus}
              </Badge>
              <Badge variant="teal" size="md">
                {selectedCase.triageCategory || 'Standard Triage'}
              </Badge>
            </div>

            <div className="text-slate-500 text-[11px] flex items-center gap-1.5 mt-1">
              <Clock className="w-3.5 h-3.5 text-slate-400" />
              <span>Intake Recorded: <strong className="text-slate-700">{selectedCase.intakeTime}</strong></span>
            </div>

            {patient.abhaId && (
              <div className="text-[11px] text-slate-400 font-mono flex items-center gap-1">
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                <span>ABHA ID: {patient.abhaId}</span>
              </div>
            )}
          </div>
        </div>

        {/* Primary Complaint Synopsis Bar */}
        <div className="pt-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 text-xs">
          <div className="text-slate-700">
            <span className="font-bold text-slate-900 uppercase tracking-wider text-[11px] mr-2">
              Primary Reported Complaint:
            </span>
            <span className="font-medium text-slate-800">{selectedCase.chiefComplaint}</span>
          </div>
          <div className="text-[11px] text-slate-500 font-medium">
            Pre-OPD Digital Intake • ABDM Compliant Record
          </div>
        </div>
      </div>

      {/* 1. Red Flag Alert Section (Prominent near the top) */}
      <RedFlagAlert hasRedFlags={selectedCase.hasRedFlags} redFlags={selectedCase.redFlags} />

      {/* 2. AI Clinical Intake Summary Card */}
      <AiClinicalSummary aiSummary={selectedCase.aiSummary} chiefComplaint={selectedCase.chiefComplaint} />

      {/* 3. Structured Clinical History Section */}
      <StructuredHistory structuredHistory={selectedCase.structuredHistory} />

      {/* 4. Uploaded Medical Reports & OCR Section */}
      <MedicalReportViewer reports={selectedCase.reports} />

      {/* 5. Original Conversation Transcript */}
      <ConversationTranscriptView messages={selectedCase.messages} patientName={patient.name} />

      {/* 6. Physician Clinical Notes & Actions */}
      <DoctorNotesPanel key={selectedCase.id} currentCase={selectedCase} />
    </div>
  );
};

export default CaseDetails;
