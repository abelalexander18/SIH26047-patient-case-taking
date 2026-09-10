import React, { useState } from 'react';
import { FileText, AlertCircle, CheckCircle2, ChevronDown, ChevronUp, Eye } from 'lucide-react';
import Badge from '../common/Badge';

const MedicalReportViewer = ({ reports = [] }) => {
  const [selectedReportId, setSelectedReportId] = useState(() => reports[0]?.id || null);
  const [isOcrExpanded, setIsOcrExpanded] = useState(false);

  if (!reports || reports.length === 0) {
    return (
      <div className="bg-white rounded-2xl border border-slate-200/90 p-6 text-center shadow-xs">
        <div className="w-10 h-10 rounded-xl bg-slate-100 text-slate-400 flex items-center justify-center mx-auto mb-2.5">
          <FileText className="w-5 h-5" />
        </div>
        <h4 className="text-sm font-bold text-slate-800">No Medical Reports Uploaded</h4>
        <p className="text-xs text-slate-500 max-w-sm mx-auto mt-1">
          The patient did not attach external diagnostic reports or prescriptions during this pre-consultation intake.
        </p>
      </div>
    );
  }

  const activeReport = reports.find((r) => r.id === selectedReportId) || reports[0];

  return (
    <div className="bg-white rounded-2xl border border-slate-200/90 p-5 sm:p-6 shadow-xs space-y-5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 pb-3.5 border-b border-slate-100">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-teal-50 text-teal-700 flex items-center justify-center shrink-0">
            <FileText className="w-4 h-4 text-teal-600" />
          </div>
          <div>
            <h3 className="text-base font-bold text-slate-900 tracking-tight">
              Uploaded Medical Reports & Diagnostic Extraction
            </h3>
            <p className="text-xs text-slate-500">
              {reports.length} {reports.length === 1 ? 'document' : 'documents'} attached to patient intake record
            </p>
          </div>
        </div>

        <Badge variant="teal" size="sm">
          Diagnostic Sync (Mock OCR)
        </Badge>
      </div>

      {/* Report Selector Tabs if multiple reports */}
      {reports.length > 1 && (
        <div className="flex flex-wrap items-center gap-2">
          {reports.map((r) => (
            <button
              key={r.id}
              onClick={() => setSelectedReportId(r.id)}
              className={`px-3 py-1.5 text-xs font-semibold rounded-xl border transition-all flex items-center gap-2 cursor-pointer ${
                activeReport.id === r.id
                  ? 'bg-slate-900 text-white border-slate-900 shadow-2xs'
                  : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
              }`}
            >
              <FileText className="w-3.5 h-3.5" />
              <span className="truncate max-w-[150px]">{r.name}</span>
            </button>
          ))}
        </div>
      )}

      {/* Selected Report Metadata Card */}
      <div className="p-4 rounded-xl bg-slate-50 border border-slate-200/80 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="font-bold text-slate-900 text-sm">{activeReport.name}</span>
            <Badge variant="slate" size="sm">
              {activeReport.size}
            </Badge>
          </div>
          <div className="text-slate-500 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px]">
            <span>Category: <strong className="text-slate-700">{activeReport.documentCategory || 'Medical Record'}</strong></span>
            <span>•</span>
            <span>Uploaded: <strong className="text-slate-700">{activeReport.uploadedAt}</strong></span>
            {activeReport.laboratory && (
              <>
                <span>•</span>
                <span>Source: <strong className="text-slate-700">{activeReport.laboratory}</strong></span>
              </>
            )}
          </div>
        </div>

        <Badge variant="teal" size="md" dot={true}>
          {activeReport.status || 'Verified Document'}
        </Badge>
      </div>

      {/* Extracted Data Table */}
      {activeReport.extractedData && activeReport.extractedData.length > 0 ? (
        <div className="space-y-2.5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-600">
              Extracted Parameters & Reference Range Assessment
            </span>
            <span className="text-[11px] text-slate-400 italic">
              * Non-diagnostic automated extraction for clinical reference
            </span>
          </div>

          <div className="border border-slate-200 rounded-xl overflow-hidden shadow-2xs">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-100/80 text-slate-700 border-b border-slate-200 font-semibold">
                    <th className="p-3">Parameter</th>
                    <th className="p-3">Observed Value</th>
                    <th className="p-3">Reference Range</th>
                    <th className="p-3">Status</th>
                    <th className="p-3 hidden sm:table-cell">Clinical Annotation</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 bg-white">
                  {activeReport.extractedData.map((row, idx) => {
                    const isOutside = row.status === 'Outside reference range';

                    return (
                      <tr key={idx} className={isOutside ? 'bg-amber-50/30' : 'hover:bg-slate-50/50'}>
                        <td className="p-3 font-semibold text-slate-900">
                          {row.parameter}
                        </td>
                        <td className={`p-3 font-mono font-bold ${isOutside ? 'text-amber-900' : 'text-slate-800'}`}>
                          {row.value}
                        </td>
                        <td className="p-3 text-slate-500 font-mono text-[11px]">
                          {row.referenceRange}
                        </td>
                        <td className="p-3">
                          <span
                            className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-semibold border ${
                              isOutside
                                ? 'bg-amber-50 text-amber-800 border-amber-200'
                                : 'bg-emerald-50 text-emerald-800 border-emerald-200'
                            }`}
                          >
                            {isOutside ? (
                              <AlertCircle className="w-3 h-3 text-amber-600" />
                            ) : (
                              <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                            )}
                            {row.status}
                          </span>
                        </td>
                        <td className="p-3 text-slate-600 text-[11px] hidden sm:table-cell">
                          {row.clinicalNote || '—'}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      ) : (
        <div className="p-4 rounded-xl bg-slate-50 text-xs text-slate-500 text-center">
          No structured parameters extracted from this document. Document attached for visual inspection.
        </div>
      )}

      {/* Raw OCR Text Collapsible Inspector */}
      {activeReport.rawText && (
        <div className="border border-slate-200 rounded-xl overflow-hidden bg-slate-50/50">
          <button
            type="button"
            onClick={() => setIsOcrExpanded(!isOcrExpanded)}
            className="w-full px-4 py-2.5 flex items-center justify-between text-left text-xs font-bold text-slate-700 hover:bg-slate-100/70 transition-colors cursor-pointer"
          >
            <div className="flex items-center gap-2">
              <Eye className="w-3.5 h-3.5 text-slate-500" />
              <span>Raw OCR Extracted Text</span>
              <span className="text-[10px] font-normal text-slate-400">
                ({activeReport.rawText.length} characters)
              </span>
            </div>
            {isOcrExpanded ? (
              <ChevronUp className="w-4 h-4 text-slate-500" />
            ) : (
              <ChevronDown className="w-4 h-4 text-slate-500" />
            )}
          </button>

          {isOcrExpanded && (
            <div className="p-3 border-t border-slate-200 bg-slate-900 text-slate-200 font-mono text-[11px] leading-relaxed max-h-60 overflow-y-auto whitespace-pre-wrap rounded-b-xl select-all">
              {activeReport.rawText}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default MedicalReportViewer;
