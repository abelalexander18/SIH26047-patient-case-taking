import React from 'react';
import { Users, AlertTriangle, CheckCircle2, Clock, ArrowRight, ShieldAlert } from 'lucide-react';
import Badge from '../common/Badge';
import Button from '../common/Button';
import { useDoctor } from '../../context/DoctorContext';

const DoctorDashboardStats = () => {
  const { stats, doctorProfile, goToCases, setFilter, selectCase, cases } = useDoctor();

  const urgentCases = cases.filter((c) => c.hasRedFlags && c.reviewStatus === 'Needs Review');

  return (
    <div className="space-y-6">
      {/* Welcome Doctor Banner */}
      <div className="bg-white rounded-2xl border border-slate-200/90 p-5 sm:p-6 shadow-xs flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1.5">
            <h1 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">
              Good day, {doctorProfile.name}
            </h1>
            <Badge variant="blue" size="sm">
              OPD Active
            </Badge>
          </div>
          <p className="text-sm text-slate-600 max-w-2xl leading-relaxed">
            Welcome to the Arogya AI Pre-Consultation Triage Console. Patient intakes conducted conversationally are synthesized below for clinical evaluation.
          </p>
        </div>

        <div className="flex items-center gap-2.5 w-full sm:w-auto shrink-0">
          <Button
            variant="primary"
            size="md"
            onClick={goToCases}
            icon={ArrowRight}
            iconPosition="right"
            className="w-full sm:w-auto font-semibold"
          >
            Review Patient Queue
          </Button>
        </div>
      </div>

      {/* 4 High-Level Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Intakes */}
        <div className="bg-white rounded-2xl border border-slate-200/90 p-4 sm:p-5 shadow-xs hover:border-slate-300 transition-all">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              Total Intakes
            </span>
            <div className="w-8 h-8 rounded-xl bg-slate-100 text-slate-700 flex items-center justify-center">
              <Users className="w-4 h-4" />
            </div>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl sm:text-3xl font-bold text-slate-900">{stats.total}</span>
            <span className="text-xs text-slate-500 font-medium">registered</span>
          </div>
          <p className="text-[11px] text-slate-500 mt-2">
            Digital intake cases logged today
          </p>
        </div>

        {/* Requiring Clinical Review */}
        <div
          onClick={() => {
            setFilter('needs-review');
            goToCases();
          }}
          className="bg-white rounded-2xl border border-blue-200/90 p-4 sm:p-5 shadow-xs hover:border-blue-400 hover:shadow-sm transition-all cursor-pointer group"
        >
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-semibold text-blue-700 uppercase tracking-wider">
              Needs Review
            </span>
            <div className="w-8 h-8 rounded-xl bg-blue-50 text-blue-700 flex items-center justify-center group-hover:scale-105 transition-transform">
              <Clock className="w-4 h-4" />
            </div>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl sm:text-3xl font-bold text-blue-700">{stats.needsReview}</span>
            <span className="text-xs text-blue-600 font-medium">pending</span>
          </div>
          <p className="text-[11px] text-slate-500 mt-2">
            Awaiting physician evaluation & sign-off
          </p>
        </div>

        {/* Safety Red Flags (Reserved Red/Amber) */}
        <div
          onClick={() => {
            setFilter('red-flags');
            goToCases();
          }}
          className="bg-red-50/50 rounded-2xl border border-red-200 p-4 sm:p-5 shadow-xs hover:border-red-300 hover:shadow-sm transition-all cursor-pointer group"
        >
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-bold text-red-900 uppercase tracking-wider flex items-center gap-1.5">
              <ShieldAlert className="w-3.5 h-3.5 text-red-600" />
              Potential Red Flags
            </span>
            <div className="w-8 h-8 rounded-xl bg-red-100 text-red-700 flex items-center justify-center group-hover:scale-105 transition-transform">
              <AlertTriangle className="w-4 h-4 text-red-700" />
            </div>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl sm:text-3xl font-bold text-red-800">{stats.redFlags}</span>
            <span className="text-xs text-red-700 font-medium">cases flagged</span>
          </div>
          <p className="text-[11px] text-red-700/80 mt-2 font-medium">
            Requires prompt clinical assessment
          </p>
        </div>

        {/* Completed & Reviewed */}
        <div
          onClick={() => {
            setFilter('reviewed');
            goToCases();
          }}
          className="bg-white rounded-2xl border border-emerald-200/90 p-4 sm:p-5 shadow-xs hover:border-emerald-400 hover:shadow-sm transition-all cursor-pointer group"
        >
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-semibold text-emerald-800 uppercase tracking-wider">
              Reviewed / Accepted
            </span>
            <div className="w-8 h-8 rounded-xl bg-emerald-50 text-emerald-700 flex items-center justify-center group-hover:scale-105 transition-transform">
              <CheckCircle2 className="w-4 h-4" />
            </div>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl sm:text-3xl font-bold text-emerald-800">{stats.reviewed}</span>
            <span className="text-xs text-emerald-700 font-medium">completed</span>
          </div>
          <p className="text-[11px] text-slate-500 mt-2">
            Physician consultation notes added
          </p>
        </div>
      </div>

      {/* Priority Red Flag Alerts Section */}
      {urgentCases.length > 0 && (
        <div className="bg-red-50/70 border border-red-200 rounded-2xl p-5 sm:p-6 shadow-xs">
          <div className="flex items-center justify-between gap-4 mb-4 pb-3 border-b border-red-200/80">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-red-100 text-red-700 flex items-center justify-center shrink-0">
                <AlertTriangle className="w-4.5 h-4.5 text-red-600" />
              </div>
              <div>
                <h3 className="text-sm sm:text-base font-bold text-red-950">
                  Priority Safety Screening Alerts ({urgentCases.length})
                </h3>
                <p className="text-xs text-red-800/90">
                  Configured screening rules identified potential red flags requiring prompt physician review.
                </p>
              </div>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setFilter('red-flags');
                goToCases();
              }}
              className="hidden sm:inline-flex text-xs bg-white text-red-900 border-red-200 hover:bg-red-50"
            >
              Filter Red Flags
            </Button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
            {urgentCases.map((uc) => (
              <div
                key={uc.id}
                onClick={() => selectCase(uc.id)}
                className="bg-white rounded-xl border border-red-200/90 p-4 shadow-2xs hover:border-red-300 hover:shadow-xs transition-all cursor-pointer group"
              >
                <div className="flex items-start justify-between gap-2 mb-2">
                  <div>
                    <div className="font-bold text-slate-900 text-sm group-hover:text-blue-600 transition-colors">
                      {uc.patient.name} ({uc.patient.age}Y, {uc.patient.gender})
                    </div>
                    <div className="text-xs text-slate-500 font-mono mt-0.5">
                      {uc.intakeId} • {uc.intakeTime}
                    </div>
                  </div>
                  <Badge variant="rose" size="sm">
                    High Priority
                  </Badge>
                </div>

                <div className="text-xs text-red-900/90 bg-red-50/80 p-2.5 rounded-lg border border-red-100/90 mb-3 leading-relaxed">
                  <span className="font-semibold block mb-0.5">Flag: {uc.redFlags[0]?.title}</span>
                  {uc.redFlags[0]?.description}
                </div>

                <div className="flex items-center justify-between text-xs text-slate-600 pt-1">
                  <span className="truncate max-w-[200px] text-[11px] text-slate-500">
                    Chief: {uc.chiefComplaint}
                  </span>
                  <span className="font-semibold text-blue-600 group-hover:underline inline-flex items-center gap-1">
                    Open Case <ArrowRight className="w-3.5 h-3.5" />
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default DoctorDashboardStats;
