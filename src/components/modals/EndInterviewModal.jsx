import React from 'react';
import { AlertTriangle, LogOut, CheckCircle } from 'lucide-react';
import Modal from '../common/Modal';
import Button from '../common/Button';

const EndInterviewModal = ({
  isOpen,
  onClose,
  onConfirmEnd,
  answeredCount = 0,
}) => {
  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="End this interview?"
      subtitle="Are you sure you want to finish? You can review your answers before completing the interview."
      maxWidth="max-w-md"
    >
      <div className="space-y-4 pt-1">
        {/* Informative banner */}
        <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-600 flex items-start gap-3">
          <div className="w-8 h-8 rounded-lg bg-blue-100 text-blue-700 flex items-center justify-center shrink-0 mt-0.5">
            <CheckCircle className="w-4 h-4 text-blue-600" />
          </div>
          <div>
            <span className="font-semibold text-slate-900 block mb-0.5">
              {answeredCount} response{answeredCount === 1 ? '' : 's'} recorded so far
            </span>
            <span>
              Your responses will be packaged into a structured pre-consultation report for clinical review by your consulting doctor / OPD physician.
            </span>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-col-reverse sm:flex-row items-center justify-end gap-2.5 pt-3">
          <Button
            variant="outline"
            size="md"
            onClick={onClose}
            className="w-full sm:w-auto"
          >
            Continue Interview
          </Button>

          <Button
            variant="primary"
            size="md"
            onClick={onConfirmEnd}
            className="w-full sm:w-auto bg-slate-900 hover:bg-slate-800"
            icon={LogOut}
          >
            End Interview
          </Button>
        </div>
      </div>
    </Modal>
  );
};

export default EndInterviewModal;
