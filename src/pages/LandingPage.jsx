import React from 'react';
import { ArrowRight, ShieldCheck, Clock, CheckCircle, Sparkles, FileUp } from 'lucide-react';
import Header from '../components/landing/Header';
import HeroVisual from '../components/landing/HeroVisual';
import TrustSection from '../components/landing/TrustSection';
import Button from '../components/common/Button';
import Badge from '../components/common/Badge';
import { useInterview } from '../context/InterviewContext';

const LandingPage = () => {
  const { startInterview } = useInterview();

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 selection:bg-teal-100 selection:text-teal-900">
      {/* Top Header */}
      <Header onStartInterview={startInterview} appName="Arogya AI" />

      {/* Hero Section */}
      <main className="flex-1 flex flex-col justify-center max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-10 sm:py-16 lg:py-20">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-8 items-center">
          {/* Left Column: Headline, Subtitle, CTAs */}
          <div className="lg:col-span-7 flex flex-col items-start text-left space-y-6">
            {/* Clinical Badge */}
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-blue-50/80 border border-blue-200/70 text-blue-800 text-xs font-semibold shadow-2xs">
              <span className="w-2 h-2 rounded-full bg-blue-600 animate-pulse" />
              <span>AI-Assisted Patient Interview</span>
              <span className="text-blue-400">•</span>
              <span className="text-blue-700 font-normal">Pre-OPD Intake & Triage</span>
            </div>

            {/* Main Headline */}
            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold tracking-tight text-slate-900 leading-[1.15]">
              Let's understand <br className="hidden sm:inline" />
              <span className="text-transparent bg-clip-text bg-linear-to-r from-blue-700 via-slate-900 to-teal-700">
                how you're feeling.
              </span>
            </h1>

            {/* Subtitle */}
            <p className="text-lg sm:text-xl text-slate-600 max-w-2xl font-normal leading-relaxed">
              Answer a few questions to help us understand your symptoms and prepare a structured pre-consultation assessment for your consulting doctor or hospital OPD.
            </p>

            {/* Quick check items */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 text-sm text-slate-600">
              <div className="flex items-center gap-2">
                <CheckCircle className="w-4 h-4 text-teal-600 shrink-0" />
                <span>Conversational, step-by-step clinical triage</span>
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle className="w-4 h-4 text-teal-600 shrink-0" />
                <span>Upload lab reports (CBC, Sugar, X-Ray) or prescriptions</span>
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle className="w-4 h-4 text-teal-600 shrink-0" />
                <span>Structured summary ready for your consulting doctor</span>
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle className="w-4 h-4 text-teal-600 shrink-0" />
                <span>Protected under DPDP Act 2023 & ABDM standards</span>
              </div>
            </div>

            {/* Main CTA Section */}
            <div className="pt-4 flex flex-col sm:flex-row items-stretch sm:items-center gap-4 w-full sm:w-auto">
              <Button
                variant="primary"
                size="lg"
                onClick={startInterview}
                className="group font-semibold text-base px-8 py-4 rounded-xl shadow-md hover:shadow-lg transition-all"
                icon={ArrowRight}
                iconPosition="right"
              >
                Start Interview
              </Button>
            </div>

            {/* Secondary Meta / Trust indication */}
            <div className="flex flex-wrap items-center gap-y-2 gap-x-6 pt-2 text-xs sm:text-sm text-slate-500">
              <div className="flex items-center gap-1.5">
                <Clock className="w-4 h-4 text-slate-400" />
                <span>Usually takes 5–10 minutes</span>
              </div>
              <div className="flex items-center gap-1.5">
                <ShieldCheck className="w-4 h-4 text-emerald-600" />
                <span className="font-medium text-slate-700">DPDP Act 2023 & ABDM Compliant</span>
              </div>
            </div>
          </div>

          {/* Right Column: Abstract Healthcare AI Visual */}
          <div className="lg:col-span-5 flex justify-center items-center">
            <HeroVisual />
          </div>
        </div>
      </main>

      {/* Trust & Features Section */}
      <TrustSection />

      {/* Minimal Footer */}
      <footer className="w-full border-t border-slate-200/60 bg-white py-6">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-slate-500">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-slate-700">Arogya AI Clinical Systems</span>
            <span>•</span>
            <span>Intelligent Pre-OPD Intake</span>
          </div>
          <div className="flex items-center gap-6">
            <span>ABDM Aligned</span>
            <span>DPDP Act 2023 Compliant</span>
            <span>Emergency: 112 / 108</span>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default LandingPage;
