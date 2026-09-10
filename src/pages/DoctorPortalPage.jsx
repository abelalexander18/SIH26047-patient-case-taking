import React from 'react';
import DoctorHeader from '../components/doctor/DoctorHeader';
import DoctorDashboardStats from '../components/doctor/DoctorDashboardStats';
import CaseList from '../components/doctor/CaseList';
import CaseDetails from '../components/doctor/CaseDetails';
import { useDoctor } from '../context/DoctorContext';
import { CheckCircle2 } from 'lucide-react';

const DoctorPortalPage = () => {
  const { activeDoctorView, toastMessage } = useDoctor();

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 flex flex-col font-sans antialiased selection:bg-teal-100 selection:text-teal-900">
      {/* Top Clinical Header */}
      <DoctorHeader />

      {/* Main Clinical Console Body */}
      <main className="flex-1 max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
        {activeDoctorView === 'dashboard' && (
          <div className="space-y-8">
            <DoctorDashboardStats />
            <div className="pt-2">
              <CaseList />
            </div>
          </div>
        )}

        {activeDoctorView === 'cases' && <CaseList />}

        {activeDoctorView === 'details' && <CaseDetails />}
      </main>

      {/* Floating Action Toast */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 bg-slate-900 text-white px-4 py-3 rounded-xl shadow-xl flex items-center gap-2.5 text-xs sm:text-sm font-medium border border-slate-800 animate-fadeIn">
          <CheckCircle2 className="w-4 h-4 text-teal-400 shrink-0" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Footer */}
      <footer className="w-full border-t border-slate-200/80 bg-white py-4 mt-auto">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-500">
          <div className="flex items-center gap-2">
            <span className="font-bold text-slate-800">Arogya AI Clinical Console</span>
            <span>•</span>
            <span>Registered Medical Practitioner (RMP) Interface</span>
          </div>
          <div className="flex items-center gap-4 text-[11px] text-slate-400">
            <span>ABDM Health Information Provider (HIP/HIU)</span>
            <span>DPDP Act 2023 Compliant</span>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default DoctorPortalPage;
