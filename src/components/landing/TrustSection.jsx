import React from 'react';
import { Shield, Clock, Stethoscope } from 'lucide-react';

const TrustSection = () => {
  const items = [
    {
      icon: Clock,
      title: '5–10 Minutes Guided Flow',
      description: 'Conversational triage speeds up patient intake, significantly reducing OPD hospital queue times.',
      color: 'blue'
    },
    {
      icon: Shield,
      title: 'ABDM & DPDP Act 2023 Aligned',
      description: 'Your health responses are confidential, 256-bit encrypted, and aligned with National Health Authority (NHA) standards.',
      color: 'teal'
    },
    {
      icon: Stethoscope,
      title: 'Physician & OPD-Ready Synthesis',
      description: 'Prepares an organized clinical note covering chief complaints, symptom timeline, and vitals for your doctor.',
      color: 'indigo'
    }
  ];

  return (
    <section className="w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 border-t border-slate-200/70">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {items.map((item, idx) => {
          const Icon = item.icon;
          return (
            <div
              key={idx}
              className="p-6 rounded-2xl bg-white border border-slate-200/80 shadow-xs hover:shadow-md transition-all duration-300 flex flex-col items-start text-left group"
            >
              <div className="w-11 h-11 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-center text-slate-800 mb-4 group-hover:scale-105 group-hover:bg-slate-100 transition-all">
                <Icon className="w-5 h-5 text-slate-700" />
              </div>
              <h3 className="text-base font-bold text-slate-900 mb-1.5">
                {item.title}
              </h3>
              <p className="text-sm text-slate-600 leading-relaxed">
                {item.description}
              </p>
            </div>
          );
        })}
      </div>
    </section>
  );
};

export default TrustSection;
