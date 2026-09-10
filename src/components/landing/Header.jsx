import React from 'react';
import { ShieldCheck, Activity, AlertCircle, Stethoscope } from 'lucide-react';
import Badge from '../common/Badge';
import { useInterview } from '../../context/InterviewContext';

const Header = ({ onStartInterview, appName = "Arogya AI" }) => {
  const { setViewMode } = useInterview();
  return (
    <header className="w-full border-b border-slate-200/80 bg-white/85 backdrop-blur-md sticky top-0 z-30 transition-all">
      {/* Top micro-bar for Indian emergency disclaimer */}
      <div className="bg-slate-900 text-slate-300 text-xs py-1.5 px-4">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-1.5 text-[11px] sm:text-xs">
            <AlertCircle className="w-3.5 h-3.5 text-amber-400 shrink-0" />
            <span className="font-semibold text-slate-200">Emergency Medical Notice:</span>
            <span className="hidden sm:inline text-slate-300">In case of life-threatening emergencies, call <strong className="text-amber-300">112</strong> (National Emergency) or <strong className="text-amber-300">108</strong> (Ambulance Helpline) immediately.</span>
            <span className="sm:hidden text-slate-300">Emergency? Call <strong className="text-amber-300">112 / 108</strong> immediately.</span>
          </div>
          <div className="hidden md:flex items-center gap-2 text-slate-400 text-[11px]">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
            <span>ABDM Gateway Online</span>
          </div>
        </div>
      </div>

      {/* Main Navigation Bar */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-18 flex items-center justify-between">
        {/* Logo and Brand */}
        <div className="flex items-center gap-3.5">
          <div className="w-10 h-10 rounded-xl bg-slate-900 flex items-center justify-center shadow-md shadow-slate-900/10 border border-slate-800 text-teal-400 relative overflow-hidden group">
            <div className="absolute inset-0 bg-linear-to-tr from-teal-500/20 to-blue-500/20 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
            <div className="relative flex items-center justify-center">
              <Activity className="w-5 h-5 text-teal-400 transition-transform duration-300 group-hover:scale-105" />
              <span className="absolute -top-1 -right-1 w-2 h-2 rounded-full bg-teal-400 ring-2 ring-slate-900"></span>
            </div>
          </div>

          <div>
            <div className="flex items-center gap-2">
              <span className="text-xl font-bold tracking-tight text-slate-900">
                {appName}
              </span>
              <span className="text-xs font-bold text-teal-700 bg-teal-50 border border-teal-200 px-1.5 py-0.5 rounded">
                आरोग्य
              </span>
              <Badge variant="teal" size="sm" className="hidden sm:inline-flex">
                ABDM Aligned
              </Badge>
            </div>
            <p className="text-[11px] text-slate-500 font-medium">
              AI-Assisted Patient Health Interview • Pre-OPD Triage
            </p>
          </div>
        </div>

        {/* Minimal Nav / Badges */}
        <div className="flex items-center gap-2 sm:gap-3">
          <div className="hidden lg:flex items-center gap-2 text-xs text-slate-600 bg-slate-50 border border-slate-200/80 px-3 py-1.5 rounded-full">
            <ShieldCheck className="w-4 h-4 text-emerald-600" />
            <span className="font-medium text-slate-700">DPDP Act 2023 Compliant</span>
          </div>

          <button
            onClick={() => setViewMode('doctor')}
            className="text-xs sm:text-sm font-semibold text-slate-700 hover:text-blue-700 bg-white hover:bg-slate-50 border border-slate-200 hover:border-slate-300 px-3 sm:px-3.5 py-2 rounded-xl transition-all flex items-center gap-1.5 cursor-pointer shadow-2xs"
            title="Open Doctor Interface & Clinical Dashboard"
          >
            <Stethoscope className="w-4 h-4 text-blue-600 shrink-0" />
            <span>Doctor Portal</span>
          </button>

          {onStartInterview && (
            <button
              onClick={onStartInterview}
              className="text-xs sm:text-sm font-semibold text-slate-900 bg-slate-100 hover:bg-slate-200/80 px-4 py-2 rounded-xl transition-colors cursor-pointer"
            >
              Start Intake
            </button>
          )}
        </div>
      </div>
    </header>
  );
};

export default Header;
