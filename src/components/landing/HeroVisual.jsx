import React from 'react';
import { Activity, ShieldCheck, HeartPulse, CheckCircle2, Sparkles, FileText } from 'lucide-react';

const HeroVisual = () => {
  return (
    <div className="relative w-full max-w-lg mx-auto lg:max-w-none flex items-center justify-center select-none">
      {/* Background Soft Glow Orbs */}
      <div className="absolute -top-10 -left-10 w-72 h-72 bg-teal-400/20 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute -bottom-10 -right-10 w-80 h-80 bg-blue-500/20 rounded-full blur-3xl pointer-events-none" />

      {/* Main Abstract Visual Showcase Card */}
      <div className="relative w-full aspect-square max-w-[460px] rounded-3xl bg-linear-to-b from-slate-900 via-slate-900 to-slate-950 p-6 sm:p-8 shadow-2xl border border-slate-800/80 overflow-hidden flex flex-col justify-between">
        {/* Subtle Grid / Geometric Mesh in background */}
        <div 
          className="absolute inset-0 opacity-[0.07]"
          style={{
            backgroundImage: `radial-gradient(#38bdf8 1px, transparent 1px)`,
            backgroundSize: '24px 24px'
          }}
        />

        {/* Concentric Geometric Rings */}
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div className="w-80 h-80 rounded-full border border-slate-700/30 animate-subtle-pulse" />
          <div className="w-60 h-60 rounded-full border border-teal-500/20" />
          <div className="w-40 h-40 rounded-full border border-blue-500/20" />
        </div>

        {/* Top Floating Badge */}
        <div className="relative z-10 flex items-center justify-between">
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-slate-800/80 border border-slate-700/80 backdrop-blur-md shadow-sm">
            <span className="w-2 h-2 rounded-full bg-teal-400 animate-pulse" />
            <span className="text-xs font-semibold text-slate-200">ABDM Clinical Gateway</span>
          </div>

          <div className="flex items-center gap-1 text-[11px] text-teal-400/90 font-mono bg-teal-950/60 border border-teal-800/50 px-2.5 py-1 rounded-md">
            <Sparkles className="w-3 h-3 text-teal-400" />
            <span>AI TRIAGE</span>
          </div>
        </div>

        {/* Center: Glowing Medical Cross & Animated Heartbeat Curve */}
        <div className="relative z-10 my-auto flex flex-col items-center justify-center">
          {/* Medical Cross Core */}
          <div className="relative w-24 h-24 rounded-2xl bg-linear-to-tr from-slate-800 to-slate-900 border border-teal-500/30 shadow-lg shadow-teal-500/10 flex items-center justify-center group mb-4">
            <div className="absolute inset-0 rounded-2xl bg-teal-500/10 animate-pulse-ring" />
            
            {/* Medical Cross SVG */}
            <div className="relative w-12 h-12 flex items-center justify-center">
              <div className="absolute w-4 h-12 bg-linear-to-b from-teal-400 to-blue-500 rounded-sm shadow-sm" />
              <div className="absolute h-4 w-12 bg-linear-to-r from-teal-400 to-blue-500 rounded-sm shadow-sm" />
              <div className="absolute w-3.5 h-3.5 rounded-full bg-white shadow-xs" />
            </div>
          </div>

          {/* Heartbeat ECG Line SVG */}
          <div className="w-full max-w-[280px] h-10 flex items-center justify-center">
            <svg className="w-full h-full" viewBox="0 0 300 50" fill="none">
              <path
                d="M 0 25 L 70 25 L 85 5 L 100 45 L 115 15 L 130 35 L 140 25 L 300 25"
                stroke="url(#ecg-gradient-in)"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="opacity-90"
              />
              <defs>
                <linearGradient id="ecg-gradient-in" x1="0%" y1="0%" x2="100%" y2="0%">
                  <stop offset="0%" stopColor="#0d9488" stopOpacity="0.2" />
                  <stop offset="40%" stopColor="#2dd4bf" stopOpacity="1" />
                  <stop offset="60%" stopColor="#38bdf8" stopOpacity="1" />
                  <stop offset="100%" stopColor="#2563eb" stopOpacity="0.2" />
                </linearGradient>
              </defs>
            </svg>
          </div>

          <p className="text-xs font-medium text-slate-400 tracking-wide mt-2">
            Structured OPD Pre-Consultation Model
          </p>
        </div>

        {/* Bottom Floating Telemetry Cards */}
        <div className="relative z-10 grid grid-cols-2 gap-3 pt-4 border-t border-slate-800/80">
          <div className="p-3 rounded-xl bg-slate-800/60 border border-slate-700/60 backdrop-blur-xs flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-teal-500/10 border border-teal-500/20 flex items-center justify-center text-teal-400 shrink-0">
              <ShieldCheck className="w-4 h-4" />
            </div>
            <div>
              <div className="text-[11px] font-semibold text-slate-200">DPDP Act 2023</div>
              <div className="text-[10px] text-slate-400">256-bit Encrypted</div>
            </div>
          </div>

          <div className="p-3 rounded-xl bg-slate-800/60 border border-slate-700/60 backdrop-blur-xs flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-400 shrink-0">
              <FileText className="w-4 h-4" />
            </div>
            <div>
              <div className="text-[11px] font-semibold text-slate-200">OPD Doctor Note</div>
              <div className="text-[10px] text-slate-400">ABHA Link Ready</div>
            </div>
          </div>
        </div>
      </div>

      {/* Floating Micro-Badge Top-Right */}
      <div className="absolute -top-3 -right-3 hidden sm:flex items-center gap-2 px-3 py-2 bg-white rounded-xl shadow-lg border border-slate-200 text-slate-800 animate-float-slow">
        <div className="w-2.5 h-2.5 rounded-full bg-teal-500" />
        <span className="text-xs font-semibold text-slate-700">99.4% Clinical Accuracy</span>
      </div>

      {/* Floating Micro-Badge Bottom-Left */}
      <div className="absolute -bottom-4 -left-3 hidden sm:flex items-center gap-2 px-3.5 py-2.5 bg-white rounded-xl shadow-lg border border-slate-200 text-slate-800">
        <CheckCircle2 className="w-4 h-4 text-emerald-600" />
        <div className="text-left">
          <div className="text-[11px] font-bold text-slate-900 leading-tight">Fast OPD Intake</div>
          <div className="text-[10px] text-slate-500">Takes 5–10 mins</div>
        </div>
      </div>
    </div>
  );
};

export default HeroVisual;
