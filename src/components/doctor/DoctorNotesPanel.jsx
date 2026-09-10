import React, { useState } from 'react';
import { Save, CheckCircle2, UserCheck, Download, Stethoscope } from 'lucide-react';
import Button from '../common/Button';
import Badge from '../common/Badge';
import { useDoctor } from '../../context/DoctorContext';

const DoctorNotesPanel = ({ currentCase }) => {
  const { updateDoctorNotes, markCaseReviewed, acceptCase, exportCaseReport } = useDoctor();

  const [notes, setNotes] = useState(currentCase.doctorNotes || '');
  const [provisionalDiagnosis, setProvisionalDiagnosis] = useState(currentCase.provisionalDiagnosis || '');
  const [isSaved, setIsSaved] = useState(false);

  const handleSave = () => {
    updateDoctorNotes(currentCase.id, notes, provisionalDiagnosis);
    setIsSaved(true);
    setTimeout(() => setIsSaved(false), 3000);
  };

  const handleAccept = () => {
    if (!notes && !provisionalDiagnosis) {
      updateDoctorNotes(currentCase.id, notes, provisionalDiagnosis);
    }
    acceptCase(currentCase.id);
  };

  const handleReview = () => {
    if (!notes && !provisionalDiagnosis) {
      updateDoctorNotes(currentCase.id, notes, provisionalDiagnosis);
    }
    markCaseReviewed(currentCase.id);
  };

  return (
    <div className="bg-white rounded-2xl border border-slate-200/90 p-5 sm:p-6 shadow-xs space-y-5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 pb-3.5 border-b border-slate-100">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-blue-50 text-blue-700 flex items-center justify-center shrink-0 border border-blue-200/60">
            <Stethoscope className="w-4 h-4 text-blue-600" />
          </div>
          <div>
            <h3 className="text-base font-bold text-slate-900 tracking-tight">
              Physician Clinical Assessment & Orders
            </h3>
            <p className="text-xs text-slate-500">
              Enter provisional clinical diagnosis and attending remarks
            </p>
          </div>
        </div>

        <Badge variant={currentCase.reviewStatus === 'Needs Review' ? 'blue' : 'emerald'} size="sm" dot={true}>
          Status: {currentCase.reviewStatus}
        </Badge>
      </div>

      {/* Inputs Form */}
      <div className="space-y-4">
        {/* Provisional Diagnosis Field */}
        <div>
          <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
            Provisional Clinical Diagnosis (Physician-Authored)
          </label>
          <input
            type="text"
            placeholder="e.g. Acute Febrile Illness under evaluation; rule out Arboviral/Malaria..."
            value={provisionalDiagnosis}
            onChange={(e) => {
              setProvisionalDiagnosis(e.target.value);
              setIsSaved(false);
            }}
            className="w-full px-3.5 py-2.5 text-xs sm:text-sm rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
          />
          <span className="text-[11px] text-slate-400 mt-1 block">
            * Medical diagnoses remain the exclusive legal and professional responsibility of the attending physician.
          </span>
        </div>

        {/* Clinical Remarks & Management Plan */}
        <div>
          <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
            Clinical Remarks, Lab Orders & Management Plan
          </label>
          <textarea
            rows={4}
            placeholder="Enter clinical examination notes, ordered laboratory investigations, oral rehydration instructions, and follow-up guidance..."
            value={notes}
            onChange={(e) => {
              setNotes(e.target.value);
              setIsSaved(false);
            }}
            className="w-full px-3.5 py-2.5 text-xs sm:text-sm rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all resize-y"
          />
        </div>

        {currentCase.reviewedAt && (
          <div className="text-[11px] text-slate-500 bg-slate-50 p-2 rounded-lg border border-slate-200/60">
            Last evaluated: <strong className="text-slate-700">{currentCase.reviewedAt}</strong>
          </div>
        )}
      </div>

      {/* Action Buttons */}
      <div className="pt-3 border-t border-slate-100 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant="primary"
            size="md"
            onClick={handleSave}
            icon={Save}
            className="text-xs font-semibold"
          >
            {isSaved ? 'Notes Saved ✓' : 'Save Notes'}
          </Button>

          <Button
            variant="medical"
            size="md"
            onClick={handleAccept}
            icon={UserCheck}
            className="text-xs font-semibold"
          >
            Accept Case for Consultation
          </Button>

          <Button
            variant="outline"
            size="md"
            onClick={handleReview}
            icon={CheckCircle2}
            className="text-xs font-semibold"
          >
            Mark as Reviewed
          </Button>
        </div>

        <Button
          variant="outline"
          size="md"
          onClick={() => exportCaseReport(currentCase.id)}
          icon={Download}
          className="text-xs font-semibold text-slate-700"
          title="Download Complete Physician Case Dossier (.txt)"
        >
          Export Case (.txt)
        </Button>
      </div>
    </div>
  );
};

export default DoctorNotesPanel;
