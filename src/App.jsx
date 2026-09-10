import React from 'react';
import { InterviewProvider, useInterview } from './context/InterviewContext';
import { DoctorProvider } from './context/DoctorContext';
import LandingPage from './pages/LandingPage';
import InterviewPage from './pages/InterviewPage';
import CompletionPage from './pages/CompletionPage';
import DoctorPortalPage from './pages/DoctorPortalPage';

const AppContent = () => {
  const { currentPage, viewMode } = useInterview();

  if (viewMode === 'doctor') {
    return <DoctorPortalPage />;
  }

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
