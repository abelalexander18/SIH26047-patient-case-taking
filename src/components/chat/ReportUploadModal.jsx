import React, { useState, useRef } from 'react';
import { UploadCloud, FileText, CheckCircle2, X, AlertCircle, RefreshCw, File } from 'lucide-react';
import Modal from '../common/Modal';
import Button from '../common/Button';

const ReportUploadModal = ({
  isOpen,
  onClose,
  onUpload,
  uploadedFile,
  onRemoveFile,
  isUploading,
  uploadProgress,
  uploadError
}) => {
  const [selectedFile, setSelectedFile] = useState(null);
  const [dragOver, setDragOver] = useState(false);
  const [localError, setLocalError] = useState(null);
  const fileInputRef = useRef(null);

  const acceptedFormats = ['.pdf', '.jpg', '.jpeg', '.png'];
  const acceptedTypes = ['application/pdf', 'image/jpeg', 'image/png', 'image/jpg'];

  const validateAndSetFile = (file) => {
    setLocalError(null);
    if (!file) return;

    const extension = '.' + file.name.split('.').pop().toLowerCase();
    if (!acceptedFormats.includes(extension)) {
      setLocalError('Please upload a PDF, JPG, JPEG, or PNG file.');
      return;
    }

    if (file.size > 20 * 1024 * 1024) {
      setLocalError('File size exceeds the 20MB limit.');
      return;
    }

    setSelectedFile(file);
  };

  const handleFileChange = (e) => {
    if (e.target.files && e.target.files[0]) {
      validateAndSetFile(e.target.files[0]);
    }
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    setDragOver(true);
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    setDragOver(false);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setDragOver(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      validateAndSetFile(e.dataTransfer.files[0]);
    }
  };

  const handleStartUpload = async () => {
    if (!selectedFile) return;
    try {
      await onUpload(selectedFile);
      setSelectedFile(null);
    } catch (err) {
      // Handled via context
    }
  };

  const handleClose = () => {
    if (!isUploading) {
      setSelectedFile(null);
      setLocalError(null);
      onClose();
    }
  };

  const formatFileSize = (bytes) => {
    if (!bytes) return '0 B';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title="Medical Report Upload"
      subtitle="Upload recent lab reports (e.g. Blood Test, CBC, Sugar, X-Ray) or prior doctor prescription slips (Parcha)."
      maxWidth="max-w-md"
      showClose={!isUploading}
    >
      <div className="space-y-4 pt-1">
        {/* Already uploaded file state */}
        {uploadedFile && !selectedFile && (
          <div className="p-4 rounded-xl bg-teal-50/70 border border-teal-200/80 flex flex-col gap-3">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-teal-100 text-teal-700 flex items-center justify-center shrink-0">
                  <CheckCircle2 className="w-5 h-5 text-teal-600" />
                </div>
                <div>
                  <h4 className="text-sm font-bold text-slate-900 truncate max-w-[220px] flex items-center gap-1.5">
                    <span className="text-emerald-600 font-extrabold">✓</span>
                    <span className="truncate">{uploadedFile.name}</span>
                  </h4>
                  <p className="text-xs text-emerald-700 font-semibold mt-0.5">
                    Uploaded successfully <span className="text-slate-500 font-normal">({uploadedFile.size})</span>
                  </p>
                </div>
              </div>
              <button
                onClick={onRemoveFile}
                className="text-slate-400 hover:text-rose-600 p-1 rounded-lg hover:bg-white/60 transition-colors"
                title="Remove file"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Extracted Medical Information Preview */}
            {((uploadedFile.patient && uploadedFile.patient.name) || (uploadedFile.vitals && uploadedFile.vitals.length > 0) || (uploadedFile.laboratoryResults && uploadedFile.laboratoryResults.length > 0)) && (
              <div className="mt-1 p-3 bg-white/90 rounded-lg border border-teal-200/90 text-xs space-y-2">
                <div className="font-semibold text-slate-800 flex items-center justify-between">
                  <span>Extracted Medical Information:</span>
                  {uploadedFile.abnormalCount > 0 ? (
                    <span className="px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 text-[10px] font-bold">
                      {uploadedFile.abnormalCount} flagged for review
                    </span>
                  ) : (
                    <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-[10px] font-bold">
                      Parameters within range
                    </span>
                  )}
                </div>

                {uploadedFile.patient && uploadedFile.patient.name && (
                  <div className="text-slate-600 text-[11px]">
                    <span className="font-medium text-slate-700">Patient:</span> {uploadedFile.patient.name}
                    {uploadedFile.patient.age ? ` (${uploadedFile.patient.age}y)` : ''}
                    {uploadedFile.patient.sex ? ` • ${uploadedFile.patient.sex}` : ''}
                  </div>
                )}

                {uploadedFile.vitals && uploadedFile.vitals.length > 0 && (
                  <div className="text-slate-600 text-[11px]">
                    <span className="font-medium text-slate-700">Vitals:</span>{' '}
                    {uploadedFile.vitals.map((v) => `${v.name || v.test_name}: ${v.value} ${v.unit} [${(v.status || '').toUpperCase()}]`).join(', ')}
                  </div>
                )}

                {uploadedFile.laboratoryResults && uploadedFile.laboratoryResults.length > 0 && (
                  <div className="text-slate-600 text-[11px]">
                    <span className="font-medium text-slate-700">Lab Results ({uploadedFile.laboratoryResults.length}):</span>{' '}
                    {uploadedFile.laboratoryResults.slice(0, 3).map((l) => `${l.test_name}: ${l.value} ${l.unit} [${(l.status || '').toUpperCase()}]`).join(', ')}
                    {uploadedFile.laboratoryResults.length > 3 ? '...' : ''}
                  </div>
                )}

                {uploadedFile.medications && uploadedFile.medications.length > 0 && (
                  <div className="text-slate-600 text-[11px]">
                    <span className="font-medium text-slate-700">Medications:</span>{' '}
                    {uploadedFile.medications.map((m) => `${m.name}${m.dose ? ` ${m.dose}` : ''}`).join(', ')}
                  </div>
                )}
              </div>
            )}

            <div className="flex items-center justify-between pt-2 border-t border-teal-100 text-xs text-slate-600">
              <span>Attached to your clinical interview</span>
              <button
                onClick={() => {
                  fileInputRef.current?.click();
                }}
                className="text-teal-700 hover:text-teal-800 font-semibold hover:underline flex items-center gap-1 cursor-pointer"
              >
                <RefreshCw className="w-3 h-3" />
                Replace file
              </button>
            </div>
          </div>
        )}

        {/* Upload in progress */}
        {isUploading && (
          <div className="p-5 rounded-2xl bg-white border border-slate-200 shadow-xs space-y-3">
            <div className="flex items-center justify-between text-xs font-semibold text-slate-700">
              <span className="flex items-center gap-2">
                <UploadCloud className="w-4 h-4 text-blue-600 animate-bounce" />
                Uploading {selectedFile?.name}...
              </span>
              <span className="font-mono text-blue-600">{uploadProgress}%</span>
            </div>

            <div className="w-full h-2.5 bg-slate-100 rounded-full overflow-hidden">
              <div
                className="h-full bg-blue-600 rounded-full transition-all duration-200 ease-out"
                style={{ width: `${uploadProgress}%` }}
              />
            </div>
            <p className="text-[11px] text-slate-400 text-center">
              Processing document & checking laboratory ranges...
            </p>
          </div>
        )}

        {/* File Dropzone (when not uploaded or replacing) */}
        {(!uploadedFile || selectedFile) && !isUploading && (
          <div>
            <input
              ref={fileInputRef}
              type="file"
              accept=".pdf,.jpg,.jpeg,.png"
              onChange={handleFileChange}
              className="hidden"
            />

            {!selectedFile ? (
              <div
                onClick={() => fileInputRef.current?.click()}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                className={`border-2 border-dashed rounded-2xl p-6 sm:p-8 text-center cursor-pointer transition-all duration-200 ${
                  dragOver
                    ? 'border-blue-500 bg-blue-50/50'
                    : 'border-slate-300 hover:border-slate-400 bg-slate-50/50 hover:bg-slate-50'
                }`}
              >
                <div className="w-12 h-12 rounded-2xl bg-white shadow-xs border border-slate-200 flex items-center justify-center text-blue-600 mx-auto mb-3">
                  <UploadCloud className="w-6 h-6" />
                </div>

                <div className="text-sm font-semibold text-slate-800 mb-1">
                  Click to choose file or drag & drop
                </div>
                <p className="text-xs text-slate-500 mb-3">
                  Supports PDF, JPG, JPEG, or PNG (up to 20MB)
                </p>

                <div className="inline-flex items-center gap-1 text-xs text-blue-600 font-medium bg-blue-50 px-3 py-1 rounded-full border border-blue-100">
                  Select Document
                </div>
              </div>
            ) : (
              <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-blue-100 text-blue-700 flex items-center justify-center shrink-0">
                      <File className="w-5 h-5" />
                    </div>
                    <div className="truncate">
                      <div className="text-sm font-semibold text-slate-800 truncate max-w-[200px]">
                        {selectedFile.name}
                      </div>
                      <div className="text-xs text-slate-500">
                        {formatFileSize(selectedFile.size)}
                      </div>
                    </div>
                  </div>
                  <button
                    onClick={() => setSelectedFile(null)}
                    className="text-slate-400 hover:text-slate-600 p-1 rounded-lg hover:bg-slate-200/60"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>

                <Button
                  variant="medical"
                  size="md"
                  onClick={handleStartUpload}
                  className="w-full"
                  icon={UploadCloud}
                >
                  Upload Medical Report
                </Button>
              </div>
            )}
          </div>
        )}

        {/* Error Messages */}
        {(localError || uploadError) && (
          <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-xs text-rose-700 flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
            <span>{localError || uploadError}</span>
          </div>
        )}

        {/* Modal Actions */}
        <div className="flex items-center justify-end gap-2 pt-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleClose}
            disabled={isUploading}
          >
            {uploadedFile ? 'Done' : 'Cancel'}
          </Button>
        </div>
      </div>
    </Modal>
  );
};

export default ReportUploadModal;
