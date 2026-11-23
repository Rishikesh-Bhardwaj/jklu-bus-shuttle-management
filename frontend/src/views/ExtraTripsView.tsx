import React from 'react';
import { Sparkles } from 'lucide-react';
import { TripsView } from './TripsView';

interface ExtraTripsViewProps {
  setCurrentView: (view: string) => void;
}

export const ExtraTripsView: React.FC<ExtraTripsViewProps> = ({ setCurrentView }) => {
  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      {/* Information Header */}
      <div className="p-6 rounded-2xl bg-gradient-to-r from-purple-900 to-indigo-900 text-white shadow-md space-y-3">
        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-purple-700/60 text-purple-200 text-xs font-medium">
          <Sparkles className="w-3.5 h-3.5" />
          <span>Special Event & Late-Night Shuttles</span>
        </div>
        <h2 className="text-2xl font-bold">
          Extra University Shuttle Services
        </h2>
        <p className="text-purple-200 text-xs leading-relaxed max-w-2xl">
          Scheduled beyond the daily routine timetable for weekend campus runs, hackathons, inter-college sports meets, tech symposiums, and exam-period extended library shuttles.
        </p>
      </div>

      {/* Render Trips list filtered for EXTRA */}
      <TripsView setCurrentView={setCurrentView} initialCategory="EXTRA" />
    </div>
  );
};
