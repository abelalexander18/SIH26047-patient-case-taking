import React from 'react';
import { InterviewProvider, useInterview } from './context/InterviewContext';
import LandingPage from './pages/LandingPage';
import InterviewPage from './pages/InterviewPage';
import CompletionPage from './pages/CompletionPage';

const AppContent = () => {
  const { currentPage } = useInterview();

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
      <div className="min-h-screen bg-slate-50 text-slate-900 font-sans">
        <AppContent />
      </div>
    </InterviewProvider>
  );
}

export default App;
