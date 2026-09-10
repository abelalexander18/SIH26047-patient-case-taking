import React, { useEffect } from 'react';
import { InterviewProvider, useInterview } from './context/InterviewContext';
import { DoctorProvider, useDoctor } from './context/DoctorContext';
import LandingPage from './pages/LandingPage';
import InterviewPage from './pages/InterviewPage';
import CompletionPage from './pages/CompletionPage';
import DoctorPortalPage from './pages/DoctorPortalPage';

const AppContent = () => {
  const { currentPage, viewMode, lastCompletedSession } = useInterview();
  const { ingestPatientCase } = useDoctor();

  // Ingest newly completed patient interview session into the Doctor queue
  useEffect(() => {
    if (lastCompletedSession) {
      ingestPatientCase(lastCompletedSession);
    }
  }, [lastCompletedSession, ingestPatientCase]);

  // When in Doctor Interface mode, render the Doctor Console
  if (viewMode === 'doctor') {
    return <DoctorPortalPage />;
  }

  // Otherwise render the existing Patient Interface workflow
  switch (currentPage) {
    case 'interview':
      return <InterviewPage />;
    case 'completion':
      return <CompletionPage />;
    case 'landing':
    default:
      return <LandingPage />;
  }
};

function App() {
  return (
    <InterviewProvider>
      <DoctorProvider>
        <div className="min-h-screen bg-slate-50 text-slate-900 font-sans">
          <AppContent />
        </div>
      </DoctorProvider>
    </InterviewProvider>
  );
}

export default App;
