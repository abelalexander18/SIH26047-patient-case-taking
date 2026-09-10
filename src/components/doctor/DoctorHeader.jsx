import React from 'react';
import { Activity, Stethoscope, Clock, ArrowLeftRight, ShieldCheck } from 'lucide-react';
import Button from '../common/Button';
import Badge from '../common/Badge';
import { useDoctor } from '../../context/DoctorContext';
import { useInterview } from '../../context/InterviewContext';

const DoctorHeader = () => {
  const { doctorProfile, activeDoctorView, goToDashboard, goToCases, stats } = useDoctor();
  const { setViewMode } = useInterview();

  return (
    <header className="w-full bg-white border-b border-slate-200/90 sticky top-0 z-30 shadow-2xs">
      {/* Top Clinical Utility Bar */}
      <div className="bg-slate-900 text-slate-300 text-xs py-1.5 px-4">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-2 text-[11px] sm:text-xs">
            <Stethoscope className="w-3.5 h-3.5 text-teal-400 shrink-0" />
            <span className="font-semibold text-white">OPD Clinical Console:</span>
            <span className="text-slate-300 hidden sm:inline">{doctorProfile.hospital} • {doctorProfile.opdRoom}</span>
            <span className="text-slate-400">• NMC Reg: {doctorProfile.nmcRegistration}</span>
          </div>
          <div className="flex items-center gap-4 text-[11px] text-slate-400">
            <div className="hidden md:flex items-center gap-1.5">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
              <span>ABDM Clinical Gateway Connected</span>
            </div>
            <div className="flex items-center gap-1 text-slate-300 font-mono">
              <Clock className="w-3.5 h-3.5 text-teal-400" />
              <span>IST (Live)</span>
            </div>
          </div>
        </div>
      </div>

      {/* Main Navigation Bar */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-18 flex items-center justify-between gap-4">
        {/* Brand & Doctor Role */}
        <div className="flex items-center gap-3.5">
          <div
            onClick={goToDashboard}
            className="w-10 h-10 rounded-xl bg-slate-900 flex items-center justify-center text-teal-400 border border-slate-800 shadow-md shadow-slate-900/10 cursor-pointer group shrink-0"
            title="Arogya AI Doctor Console"
          >
            <Activity className="w-5 h-5 group-hover:scale-105 transition-transform" />
          </div>

          <div>
            <div className="flex items-center gap-2">
              <span
                onClick={goToDashboard}
                className="text-lg sm:text-xl font-bold tracking-tight text-slate-900 cursor-pointer hover:text-blue-600 transition-colors"
              >
                Arogya AI
              </span>
              <span className="text-xs font-bold text-teal-700 bg-teal-50 border border-teal-200 px-1.5 py-0.5 rounded">
                आरोग्य
              </span>
              <Badge variant="teal" size="sm" className="hidden sm:inline-flex" dot={true}>
                Doctor Interface
              </Badge>
            </div>
            <p className="text-[11px] text-slate-500 font-medium hidden sm:block">
              Physician Triage & Pre-Consultation Intake Evaluation
            </p>
          </div>
        </div>

        {/* Center Tabs: Dashboard Overview & Patient Queue */}
        <nav className="hidden md:flex items-center gap-1 p-1 bg-slate-100/80 rounded-xl border border-slate-200/80">
          <button
            onClick={goToDashboard}
            className={`px-3.5 py-1.5 text-xs font-semibold rounded-lg transition-all cursor-pointer ${
              activeDoctorView === 'dashboard'
                ? 'bg-white text-slate-900 shadow-2xs border border-slate-200/60'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/50'
            }`}
          >
            Dashboard
          </button>
          <button
            onClick={goToCases}
            className={`px-3.5 py-1.5 text-xs font-semibold rounded-lg transition-all flex items-center gap-2 cursor-pointer ${
              activeDoctorView === 'cases' || activeDoctorView === 'details'
                ? 'bg-white text-slate-900 shadow-2xs border border-slate-200/60'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/50'
            }`}
          >
            <span>Patient Queue</span>
            {stats.needsReview > 0 && (
              <span className="px-1.5 py-0.2 bg-blue-100 text-blue-700 font-bold rounded-full text-[10px]">
                {stats.needsReview}
              </span>
            )}
          </button>
        </nav>

        {/* Right Section: Doctor Profile & Switch to Patient Portal */}
        <div className="flex items-center gap-3">
          {/* Doctor Profile Mini Card */}
          <div className="hidden lg:flex items-center gap-2.5 px-3 py-1.5 bg-slate-50 rounded-xl border border-slate-200/80 text-left">
            <div className="w-8 h-8 rounded-lg bg-blue-100 text-blue-800 flex items-center justify-center font-bold text-xs">
              AS
            </div>
            <div className="leading-tight">
              <div className="text-xs font-bold text-slate-800">{doctorProfile.name}</div>
              <div className="text-[10px] text-slate-500 font-medium">{doctorProfile.department}</div>
            </div>
          </div>

          {/* Switch to Patient View Button */}
          <Button
            variant="outline"
            size="sm"
            onClick={() => setViewMode('patient')}
            icon={ArrowLeftRight}
            className="text-xs font-semibold text-slate-700 hover:text-blue-700 hover:border-blue-300"
            title="Switch to Patient Intake Mode"
          >
            <span className="hidden sm:inline">Switch to </span>Patient Portal
          </Button>
        </div>
      </div>
    </header>
  );
};

export default DoctorHeader;
