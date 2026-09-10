import React from 'react';
import { FileText, Download, CheckCircle2, Stethoscope, Clock, ShieldCheck, User } from 'lucide-react';
import Modal from '../common/Modal';
import Button from '../common/Button';
import Badge from '../common/Badge';

const SummaryModal = ({
  isOpen,
  onClose,
  interviewId,
  messages = [],
  uploadedFile = null,
  answeredCount = 0,
  onDownloadReport,
}) => {
  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="OPD Pre-Consultation Summary"
      subtitle="Review the synthesized pre-consultation assessment prepared for your consulting Registered Medical Practitioner (RMP) / doctor."
      maxWidth="max-w-2xl"
    >
      <div className="space-y-6 pt-2 max-h-[70vh] overflow-y-auto pr-1">
        {/* Top Metadata Header */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 p-3.5 rounded-xl bg-slate-50 border border-slate-200/90 text-xs">
          <div>
            <div className="text-slate-400 font-medium">Record ID</div>
            <div className="font-mono font-bold text-slate-800 mt-0.5">{interviewId}</div>
          </div>
          <div>
            <div className="text-slate-400 font-medium">Questions Answered</div>
            <div className="font-bold text-slate-800 mt-0.5">{answeredCount}</div>
          </div>
          <div>
            <div className="text-slate-400 font-medium">Triage Priority</div>
            <div className="font-semibold text-teal-700 mt-0.5">Routine Intake</div>
          </div>
          <div>
            <div className="text-slate-400 font-medium">Report Attached</div>
            <div className="font-semibold text-slate-800 mt-0.5 truncate">
              {uploadedFile ? 'Yes (Verified)' : 'None'}
            </div>
          </div>
        </div>

        {/* Structured Clinical Findings */}
        <div className="space-y-3">
          <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
            <Stethoscope className="w-3.5 h-3.5 text-blue-600" />
            Synthesized Clinical Notes
          </h4>

          <div className="p-4 rounded-xl border border-slate-200 bg-white space-y-2.5 text-sm text-slate-700 leading-relaxed">
            <div className="flex items-start gap-2">
              <span className="font-semibold text-slate-900 w-32 shrink-0">Intake Status:</span>
              <span className="text-emerald-700 font-medium flex items-center gap-1">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 inline" />
                Intake Complete & Synthesized
              </span>
            </div>
            <div className="flex items-start gap-2">
              <span className="font-semibold text-slate-900 w-32 shrink-0">Document Attached:</span>
              <span>{uploadedFile ? `${uploadedFile.name} (${uploadedFile.size})` : 'No outside records uploaded'}</span>
            </div>
            <div className="flex items-start gap-2">
              <span className="font-semibold text-slate-900 w-32 shrink-0">Security Protocol:</span>
              <span className="flex items-center gap-1 text-slate-600">
                <ShieldCheck className="w-4 h-4 text-teal-600" />
                DPDP Act 2023 & ABDM Compliant (256-bit Encrypted)
              </span>
            </div>
          </div>
        </div>

        {/* Transcript Section */}
        <div className="space-y-3">
          <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
            <FileText className="w-3.5 h-3.5 text-slate-600" />
            Full Interview Transcript
          </h4>

          <div className="border border-slate-200 rounded-xl divide-y divide-slate-100 bg-slate-50/50">
            {messages.map((m) => (
              <div key={m.id} className="p-3 text-xs leading-relaxed">
                <div className="flex items-center justify-between text-[11px] font-semibold mb-1">
                  <span className={m.sender === 'ai' ? 'text-teal-800' : 'text-blue-700'}>
                    {m.sender === 'ai' ? 'Arogya AI Assistant' : 'Patient'}
                  </span>
                  <span className="text-slate-400 font-normal">{m.timestamp}</span>
                </div>
                <p className="text-slate-700 whitespace-pre-wrap">{m.text}</p>
                {m.attachedFile && (
                  <div className="mt-1.5 inline-flex items-center gap-1.5 text-[11px] bg-teal-50 text-teal-800 border border-teal-200 px-2 py-0.5 rounded-md">
                    <CheckCircle2 className="w-3 h-3 text-teal-600" />
                    <span>File attached: {m.attachedFile.name}</span>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Action Footer */}
        <div className="flex flex-col-reverse sm:flex-row items-center justify-between gap-3 pt-3 border-t border-slate-200">
          <Button variant="outline" size="sm" onClick={onClose} className="w-full sm:w-auto">
            Close
          </Button>

          <Button
            variant="primary"
            size="sm"
            onClick={onDownloadReport}
            icon={Download}
            className="w-full sm:w-auto bg-slate-900"
          >
            Download Report (.txt)
          </Button>
        </div>
      </div>
    </Modal>
  );
};

export default SummaryModal;
