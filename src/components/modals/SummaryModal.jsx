import React, { useState } from 'react';
import { FileText, Download, CheckCircle2, Stethoscope, Clock, ShieldCheck, User, AlertTriangle, Activity, ChevronDown, ChevronUp, Pill, HeartPulse } from 'lucide-react';
import Modal from '../common/Modal';
import Button from '../common/Button';
import Badge from '../common/Badge';
import { useInterview } from '../../context/InterviewContext';

const SummaryModal = ({
  isOpen,
  onClose,
  interviewId,
  messages = [],
  uploadedFile = null,
  answeredCount = 0,
  onDownloadReport,
}) => {
  const { screeningResult, redFlagResult, missingFields, doctorSummary, existingHistory } = useInterview();
  const [isOcrExpanded, setIsOcrExpanded] = useState(false);

  const activeFlagResult = redFlagResult || screeningResult;
  const isRedFlag = Boolean(activeFlagResult && activeFlagResult.detected);
  const needsMoreInfo = !isRedFlag && Array.isArray(missingFields) && missingFields.length > 0;

  let triagePriorityLabel = 'Routine Intake';
  let triagePriorityColor = 'text-teal-800 bg-teal-50 border-teal-200';

  if (isRedFlag) {
    triagePriorityLabel = 'Potential Red Flag';
    triagePriorityColor = 'text-amber-800 bg-amber-50 border-amber-300';
  } else if (needsMoreInfo) {
    triagePriorityLabel = 'Additional Information Needed';
    triagePriorityColor = 'text-blue-800 bg-blue-50 border-blue-200';
  } else {
    triagePriorityLabel = 'Routine Intake';
    triagePriorityColor = 'text-teal-800 bg-teal-50 border-teal-200';
  }

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
            <div className={`font-bold mt-1 text-xs px-2 py-0.5 rounded border inline-block ${triagePriorityColor}`}>
              {triagePriorityLabel}
            </div>
            <div className="text-[9px] text-slate-400 mt-1 leading-tight">
              {isRedFlag 
                ? 'Screening alert — not a diagnosis' 
                : 'Administrative sorting; does not imply patient is medically safe'}
            </div>
          </div>
          <div>
            <div className="text-slate-400 font-medium">Report Attached</div>
            <div className="font-semibold text-slate-800 mt-0.5 truncate">
              {uploadedFile ? `${uploadedFile.name}` : 'None'}
            </div>
          </div>
        </div>

        {/* Red Flag Warning Banner if detected */}
        {isRedFlag && (
          <div className="p-3.5 rounded-xl bg-amber-50 border border-amber-300 text-slate-800 text-xs space-y-2 shadow-2xs">
            <div className="flex items-center gap-1.5 font-semibold text-amber-900 text-[12px]">
              <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
              <span>Potential Red Flag ({activeFlagResult.flags?.[0]?.rule_id || activeFlagResult.rule_id || 'Screening Alert'})</span>
            </div>
            <p className="text-slate-800 text-xs font-medium leading-relaxed">
              {activeFlagResult.flags?.[0]?.evidence?.join(' associated with ') || activeFlagResult.message}
            </p>
            <div className="text-[11px] text-slate-700 bg-white/80 p-2 rounded-lg border border-amber-200">
              {activeFlagResult.flags?.[0]?.message || 'Prompt clinical evaluation may be appropriate.'}
            </div>
            <div className="text-[10px] text-slate-500 pt-1 border-t border-amber-200/60">
              {activeFlagResult.disclaimer || 'Screening alert — not a diagnosis.'}
            </div>
          </div>
        )}

        {/* Structured Clinical Findings */}
        <div className="space-y-3">
          <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
            <Stethoscope className="w-3.5 h-3.5 text-blue-600" />
            Synthesized Doctor-Facing Notes
          </h4>

          <div className="p-4 rounded-xl border border-slate-200 bg-white space-y-3 text-sm text-slate-700 leading-relaxed">
            {doctorSummary ? (
              <div className="p-3 rounded-lg bg-slate-50 border border-slate-200 text-xs text-slate-800 font-mono whitespace-pre-wrap leading-relaxed">
                {doctorSummary}
              </div>
            ) : (
              <div className="flex items-start gap-2">
                <span className="font-semibold text-slate-900 w-32 shrink-0">Intake Status:</span>
                <span className="text-emerald-700 font-medium flex items-center gap-1">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 inline" />
                  Intake Complete & Synthesized
                </span>
              </div>
            )}

            {/* Pertinent Negatives */}
            {existingHistory && existingHistory.relevant_negative_symptoms && existingHistory.relevant_negative_symptoms.length > 0 && (
              <div className="text-xs pt-1 border-t border-slate-100 flex items-center gap-2 flex-wrap">
                <span className="font-semibold text-slate-700">Pertinent Negatives:</span>
                {existingHistory.relevant_negative_symptoms.map((neg, idx) => (
                  <span key={idx} className="px-2 py-0.5 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-700 text-[11px] font-medium">
                    ✓ Denies {neg}
                  </span>
                ))}
              </div>
            )}

            {/* Medical Report Intelligence & Doctor Dashboard */}
            {uploadedFile && (
              <div className="text-xs pt-3 border-t border-slate-200 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-slate-800 flex items-center gap-1.5 text-xs">
                    <Activity className="w-3.5 h-3.5 text-teal-600" />
                    Medical Report Intelligence ({uploadedFile.name})
                  </span>
                  <span className="text-[10px] bg-teal-50 text-teal-700 px-2 py-0.5 rounded border border-teal-200 font-medium">
                    Verified Extraction Pipeline
                  </span>
                </div>

                {/* Patient & Report Metadata */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 p-2.5 rounded-lg bg-slate-50 border border-slate-200 text-[11px]">
                  <div>
                    <span className="text-slate-400 block text-[10px] font-semibold uppercase">Report Date</span>
                    <span className="font-semibold text-slate-800">
                      {uploadedFile.reportDate || uploadedFile.patient?.report_date || uploadedFile.report_date || 'Not specified'}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[10px] font-semibold uppercase">Patient Name</span>
                    <span className="font-semibold text-slate-800">
                      {uploadedFile.patient?.name || 'Not specified'}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[10px] font-semibold uppercase">Age / Sex</span>
                    <span className="font-semibold text-slate-800">
                      {(uploadedFile.patient?.age || uploadedFile.patient?.sex)
                        ? `${uploadedFile.patient.age || '—'} / ${uploadedFile.patient.sex || '—'}`
                        : 'Not specified'}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[10px] font-semibold uppercase">Parsing Status</span>
                    <span className="font-semibold text-emerald-700 flex items-center gap-1">
                      <CheckCircle2 className="w-3 h-3 text-emerald-600 inline" /> Complete
                    </span>
                  </div>
                </div>

                {/* Recorded Vitals */}
                {uploadedFile.vitals && Object.keys(uploadedFile.vitals).length > 0 && (
                  <div className="space-y-1.5">
                    <span className="font-semibold text-slate-700 flex items-center gap-1 text-[11px]">
                      <HeartPulse className="w-3.5 h-3.5 text-rose-500" />
                      Recorded Vitals & Range Review:
                    </span>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {Object.entries(uploadedFile.vitals).map(([vitalKey, val]) => {
                        if (!val || typeof val !== 'object') return null;
                        const isAbnormal = val.status === 'high' || val.status === 'low';
                        const label = vitalKey.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
                        const displayVal = val.value || (val.systolic && val.diastolic ? `${val.systolic}/${val.diastolic}` : null);
                        if (!displayVal) return null;

                        return (
                          <div key={vitalKey} className="p-2.5 rounded-lg bg-white border border-slate-200 text-[11px] flex flex-col gap-1 shadow-2xs">
                            <div className="flex justify-between items-center">
                              <span className="font-medium text-slate-700">{label}: <strong className="text-slate-900">{displayVal} {val.unit || ''}</strong></span>
                              <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold uppercase ${
                                val.status === 'high' ? 'bg-amber-100 text-amber-800 border border-amber-300' :
                                val.status === 'low' ? 'bg-blue-100 text-blue-800 border border-blue-300' :
                                val.status === 'normal' ? 'bg-emerald-100 text-emerald-800 border border-emerald-300' :
                                'bg-slate-100 text-slate-600 border border-slate-200'
                              }`}>
                                {val.status || 'NORMAL'}
                              </span>
                            </div>
                            {isAbnormal && (
                              <div className="text-[10px] text-amber-800 font-medium">
                                Outside configured reference range — physician review recommended.
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Evaluated Laboratory Results */}
                {((uploadedFile.laboratoryResults && uploadedFile.laboratoryResults.length > 0) ||
                  (uploadedFile.evaluatedAbnormalities && uploadedFile.evaluatedAbnormalities.length > 0)) && (
                  <div className="space-y-1.5">
                    <span className="font-semibold text-slate-700 flex items-center gap-1 text-[11px]">
                      <Activity className="w-3.5 h-3.5 text-teal-600" />
                      Evaluated Laboratory Results:
                    </span>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {(uploadedFile.laboratoryResults || uploadedFile.evaluatedAbnormalities).map((lab, idx) => {
                        const isAbnormal = lab.status === 'high' || lab.status === 'low';
                        const rangeStr = lab.reference_range
                          ? `${lab.reference_range.low ?? '—'} - ${lab.reference_range.high ?? '—'}`
                          : 'N/A';
                        const sourceLabel = lab.range_source === 'report' ? 'Report Range' : lab.range_source === 'configured_fallback' ? 'Configured Fallback' : null;

                        return (
                          <div key={idx} className="p-2.5 rounded-lg bg-white border border-slate-200 text-[11px] flex flex-col gap-1 shadow-2xs">
                            <div className="flex justify-between items-center">
                              <span className="font-semibold text-slate-800">{lab.test_name || lab.test}</span>
                              <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold uppercase ${
                                lab.status === 'high' ? 'bg-amber-100 text-amber-800 border border-amber-300' :
                                lab.status === 'low' ? 'bg-blue-100 text-blue-800 border border-blue-300' :
                                lab.status === 'normal' ? 'bg-emerald-100 text-emerald-800 border border-emerald-300' :
                                'bg-slate-100 text-slate-600 border border-slate-200'
                              }`}>
                                {lab.status || 'NORMAL'}
                              </span>
                            </div>
                            <div className="text-[10px] text-slate-600 flex justify-between items-center">
                              <span>Value: <strong className="text-slate-900">{lab.value} {lab.unit}</strong></span>
                              <span className="text-slate-400">Ref: {rangeStr} {sourceLabel ? `(${sourceLabel})` : ''}</span>
                            </div>
                            {isAbnormal && (
                              <div className="text-[10px] text-amber-800 font-medium">
                                Outside configured reference range — physician review recommended.
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Medications Mentioned */}
                {uploadedFile.medications && uploadedFile.medications.length > 0 && (
                  <div className="space-y-1.5">
                    <span className="font-semibold text-slate-700 flex items-center gap-1 text-[11px]">
                      <Pill className="w-3.5 h-3.5 text-indigo-600" />
                      Medications Mentioned in Report:
                    </span>
                    <div className="flex flex-wrap gap-1.5">
                      {uploadedFile.medications.map((med, idx) => {
                        const medText = typeof med === 'string' ? med : `${med.name || med.medication || ''} ${med.dosage || med.dose || ''} ${med.frequency || ''}`.trim();
                        return (
                          <span key={idx} className="px-2.5 py-1 rounded-md bg-indigo-50 border border-indigo-200 text-indigo-800 text-[11px] font-medium">
                            {medText}
                          </span>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Documented Findings / Diagnoses in Report */}
                {uploadedFile.diagnosesMentioned && uploadedFile.diagnosesMentioned.length > 0 && (
                  <div className="space-y-1.5">
                    <span className="font-semibold text-slate-700 flex items-center gap-1 text-[11px]">
                      <FileText className="w-3.5 h-3.5 text-slate-600" />
                      Documented Findings / Prior Diagnoses in Report:
                    </span>
                    <div className="p-2.5 rounded-lg bg-slate-50 border border-slate-200 text-[11px] text-slate-700 space-y-1">
                      <ul className="list-disc pl-4 space-y-0.5">
                        {uploadedFile.diagnosesMentioned.map((item, idx) => (
                          <li key={idx} className="font-medium text-slate-800">{item}</li>
                        ))}
                      </ul>
                      <p className="text-[10px] text-slate-500 italic pt-1">
                        Note: Extracted verbatim from attached medical record; not an AI clinical diagnosis.
                      </p>
                    </div>
                  </div>
                )}

                {/* Raw OCR Extracted Text Transparency Drawer */}
                {uploadedFile.rawText && (
                  <div className="pt-2 border-t border-slate-100">
                    <button
                      type="button"
                      onClick={() => setIsOcrExpanded(!isOcrExpanded)}
                      className="flex items-center justify-between w-full py-1.5 px-2.5 rounded bg-slate-100 hover:bg-slate-200 border border-slate-200 text-xs font-medium text-slate-700 transition-colors"
                    >
                      <span className="flex items-center gap-1.5 font-semibold text-slate-800">
                        <FileText className="w-3.5 h-3.5 text-teal-600" />
                        Extracted Text (OCR Transparency)
                      </span>
                      <span className="flex items-center gap-1 text-[11px] text-slate-500">
                        {isOcrExpanded ? 'Hide Raw Text' : 'View Verbatim Text'}
                        {isOcrExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                      </span>
                    </button>

                    {isOcrExpanded && (
                      <div className="mt-2 p-3 rounded-lg bg-slate-900 text-slate-200 font-mono text-[11px] leading-relaxed max-h-48 overflow-y-auto whitespace-pre-wrap select-all">
                        {uploadedFile.rawText}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            <div className="flex items-start gap-2 pt-1 border-t border-slate-100 text-xs">
              <span className="font-semibold text-slate-900 w-32 shrink-0">Data Standards:</span>
              <span className="flex items-center gap-1 text-slate-600">
                <ShieldCheck className="w-4 h-4 text-teal-600" />
                Designed with ABDM & DPDP principles (Prototype)
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
